/**
 * Off-chain risk scoring — a PURE function (no I/O, no globals) so it is fully
 * unit-testable and deterministic.
 *
 * HONEST SCOPE: this does NOT detect forged documents or verify identity. It
 * REDUCES risk by surfacing statistically suspicious patterns for a human
 * Registrar to review, complementing the hard on-chain guarantees (duplicate
 * hash / survey-location rejection, one pending transfer, status gating,
 * FlaggedForReview). A high score means "look closely", not "this is fraud".
 */
import type { IndexedProperty, IndexedTransfer } from "../types";

export const SURVEY_PATTERN = /^[A-Z]{3}\/\d{2}\/\d{3}-[A-Z]$/;

export type RiskLevel = "Low" | "Medium" | "High";

export interface RiskSignal {
  code: string;
  label: string;
  weight: number;
  detail: string;
}

export interface RiskResult {
  score: number; // 0..100
  level: RiskLevel;
  signals: RiskSignal[];
}

export interface RiskContext {
  properties: IndexedProperty[];
  transfers: IndexedTransfer[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: string, b: string): number {
  return Math.abs(+new Date(a) - +new Date(b)) / DAY_MS;
}

function levelFor(score: number): RiskLevel {
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

/**
 * Scores a single property against the whole dataset context.
 */
export function scoreProperty(ref: string, ctx: RiskContext): RiskResult {
  const p = ctx.properties.find((x) => x.property_ref === ref);
  const signals: RiskSignal[] = [];
  if (!p) return { score: 0, level: "Low", signals };

  // 1. Survey-number format mismatch.
  if (!SURVEY_PATTERN.test(p.survey_number)) {
    signals.push({
      code: "SURVEY_FORMAT",
      label: "Invalid survey-number format",
      weight: 25,
      detail: `"${p.survey_number}" does not match the expected pattern AAA/NN/NNN-X.`,
    });
  }

  // 2. Missing document.
  if (!p.documentCID || !p.documentHash) {
    signals.push({
      code: "MISSING_DOCUMENT",
      label: "Missing deed document",
      weight: 30,
      detail: "No IPFS document / hash is attached to this property.",
    });
  }

  // A duplicate that was blocked on-chain (Reverted) never entered the registry,
  // so it must not make the OTHER, legitimate record look suspicious. We only
  // count non-reverted records as conflicting "others".
  const notReverted = (x: IndexedProperty) => x.onChainStatus !== "Reverted";

  // 3. Same document reused across properties (by hash).
  const docOthers = ctx.properties.filter(
    (x) => x.property_ref !== ref && x.documentHash && x.documentHash === p.documentHash && notReverted(x)
  );
  if (docOthers.length > 0) {
    signals.push({
      code: "REUSED_DOCUMENT",
      label: "Deed document reused",
      weight: 40,
      detail: `The same document hash appears on: ${docOthers.map((x) => x.property_ref).join(", ")}.`,
    });
  }

  // 4. Duplicate survey + location across properties.
  const surveyOthers = ctx.properties.filter(
    (x) =>
      x.property_ref !== ref &&
      x.survey_number === p.survey_number &&
      x.location.toLowerCase() === p.location.toLowerCase() &&
      notReverted(x)
  );
  if (surveyOthers.length > 0) {
    signals.push({
      code: "DUPLICATE_SURVEY",
      label: "Duplicate survey + location",
      weight: 40,
      detail: `Same survey number and location as: ${surveyOthers.map((x) => x.property_ref).join(", ")}.`,
    });
  }

  // 5. Bulk submissions from the owner within 24h.
  const ownerSubs = ctx.properties.filter((x) => x.owner_wallet_id === p.owner_wallet_id);
  const within24h = ownerSubs.filter(
    (x) => daysBetween(x.submitted_date, p.submitted_date) <= 1
  );
  if (within24h.length > 3) {
    signals.push({
      code: "BULK_SUBMISSION",
      label: "Bulk submissions in 24h",
      weight: 20,
      detail: `Owner ${p.owner_wallet_id} submitted ${within24h.length} properties within 24h.`,
    });
  }

  // 6. Rapid flipping — 3+ transfers of this property within any 30-day window.
  const tx = ctx.transfers
    .filter((t) => t.property_ref === ref)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  if (tx.length >= 3) {
    for (let i = 0; i + 2 < tx.length; i++) {
      if (daysBetween(tx[i].date, tx[i + 2].date) <= 30) {
        signals.push({
          code: "RAPID_FLIP",
          label: "Rapid flipping",
          weight: 25,
          detail: `${tx.length} transfers, 3 within 30 days (first ${tx[0].date}).`,
        });
        break;
      }
    }
  }

  // 7. Circular trade — A -> B then B -> A on this property.
  let circular = false;
  for (let i = 0; i < tx.length && !circular; i++) {
    for (let j = i + 1; j < tx.length; j++) {
      if (tx[i].from_wallet_id === tx[j].to_wallet_id && tx[i].to_wallet_id === tx[j].from_wallet_id) {
        circular = true;
        break;
      }
    }
  }
  if (circular) {
    signals.push({
      code: "CIRCULAR_TRADE",
      label: "Circular / wash trade",
      weight: 20,
      detail: "Ownership returned to a previous owner (possible wash trade).",
    });
  }

  // 8. Very new wallet transacting high volume — activity CONCENTRATED in the
  //    wallet's first 24h (not merely a high lifetime total spread over months).
  const firstActivity = ownerSubs
    .map((x) => +new Date(x.submitted_date))
    .reduce((m, d) => Math.min(m, d), Infinity);
  const firstDayVolume = ownerSubs.filter(
    (x) => (+new Date(x.submitted_date) - firstActivity) / DAY_MS <= 1
  ).length;
  const ageDays = (+new Date(p.submitted_date) - firstActivity) / DAY_MS;
  if (ageDays <= 1 && firstDayVolume >= 4) {
    signals.push({
      code: "NEW_WALLET_HIGH_VOLUME",
      label: "New wallet, high volume",
      weight: 15,
      detail: `Wallet transacted ${firstDayVolume} registrations on its very first day of activity.`,
    });
  }

  const score = Math.min(
    100,
    signals.reduce((s, sig) => s + sig.weight, 0)
  );
  return { score, level: levelFor(score), signals };
}

/** Scores every property and returns them sorted by descending risk. */
export function scoreAll(ctx: RiskContext): Array<{ property: IndexedProperty; risk: RiskResult }> {
  return ctx.properties
    .map((property) => ({ property, risk: scoreProperty(property.property_ref, ctx) }))
    .sort((a, b) => b.risk.score - a.risk.score);
}
