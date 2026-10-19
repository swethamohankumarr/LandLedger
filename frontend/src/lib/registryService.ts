import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  JsonRpcSigner,
  Provider,
  keccak256,
} from "ethers";
import { ABI, CONTRACT_ADDRESS } from "../config";
import type { IndexedProperty, IndexedTransfer, IndexedWallet } from "../types";
import { statusFromCode } from "./utils";

export const REGISTRAR_ROLE = keccak256(new TextEncoder().encode("REGISTRAR_ROLE"));
export const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function readContract(provider: Provider): Contract {
  return new Contract(CONTRACT_ADDRESS, ABI as never, provider);
}

export function writeContract(signer: JsonRpcSigner): Contract {
  return new Contract(CONTRACT_ADDRESS, ABI as never, signer);
}

export interface LiveSnapshot {
  properties: IndexedProperty[];
  transfers: IndexedTransfer[];
  wallets: IndexedWallet[];
  flaggedForReview: { propertyId: string; reason: string }[];
  stats: { pending: number; registered: number; rejected: number; total: number };
}

function toIso(ts: bigint): string {
  const n = Number(ts);
  if (!n) return "";
  return new Date(n * 1000).toISOString().slice(0, 10);
}

/**
 * Reads the whole registry from chain and normalises it into the same shape the
 * off-chain index uses, so every page and the risk scorer are source-agnostic.
 */
export async function loadLiveSnapshot(provider: BrowserProvider | JsonRpcProvider): Promise<LiveSnapshot> {
  const c = readContract(provider);

  const [pending, registered, rejected, total] = await c.getStats();
  const totalN = Number(total);

  const properties: IndexedProperty[] = [];
  const transfers: IndexedTransfer[] = [];
  const walletSet = new Set<string>();

  const PAGE = 100;
  for (let offset = 0; offset < totalN; offset += PAGE) {
    const [ids] = await c.getAllPropertyIds(offset, PAGE);
    for (const idBn of ids as bigint[]) {
      const p = await c.getProperty(idBn);
      const status = statusFromCode(Number(p.status));
      walletSet.add(p.owner.toLowerCase());
      properties.push({
        property_ref: `#${idBn.toString()}`,
        owner_wallet_id: p.owner,
        ownerAddress: p.owner,
        location: p.location,
        city: "",
        area_sqm: Number(p.areaSqm),
        property_type: p.propertyType,
        survey_number: p.surveyNumber,
        document_file: p.documentCID,
        documentCID: p.documentCID,
        documentHash: p.documentHash,
        docUrl: "",
        submitted_date: toIso(p.submittedAt),
        scenario: "",
        notes: p.rejectionReason || "",
        datasetStatus: status,
        onChainId: idBn.toString(),
        onChainStatus: status,
        flagged: false,
        outcome: status,
        reason: p.rejectionReason || "",
      });

      const history = await c.getHistory(idBn);
      (history as { from: string; to: string; timestamp: bigint }[]).forEach((h, i) => {
        transfers.push({
          transfer_id: `${idBn.toString()}-${i}`,
          property_ref: `#${idBn.toString()}`,
          from_wallet_id: h.from,
          to_wallet_id: h.to,
          fromAddress: h.from,
          toAddress: h.to,
          date: toIso(h.timestamp),
          scenario: "",
          outcome: "Completed",
        });
      });
    }
  }

  // Flagged events (best-effort log query).
  const flaggedForReview: { propertyId: string; reason: string }[] = [];
  try {
    const logs = await c.queryFilter(c.filters.FlaggedForReview());
    for (const log of logs) {
      const args = (log as unknown as { args: [bigint, string] }).args;
      if (args) flaggedForReview.push({ propertyId: args[0].toString(), reason: args[1] });
    }
  } catch {
    /* RPC may not support wide ranges */
  }
  const flaggedIds = new Set(flaggedForReview.map((f) => f.propertyId));
  for (const p of properties) if (p.onChainId && flaggedIds.has(p.onChainId)) p.flagged = true;

  const wallets: IndexedWallet[] = Array.from(walletSet).map((addr) => ({
    wallet_id: addr,
    role: "Owner",
    address: addr,
    label: "",
  }));

  return {
    properties,
    transfers,
    wallets,
    flaggedForReview,
    stats: {
      pending: Number(pending),
      registered: Number(registered),
      rejected: Number(rejected),
      total: totalN,
    },
  };
}

/** Lightweight read helpers used by Public Verify (read-only RPC). */
export function makeReadProvider(rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl);
}
