import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, ShieldX, Copy, Repeat, FileWarning, Layers, Scan, ShieldAlert, type LucideIcon } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { RiskBadge, StatusPill } from "../components/ui/primitives";
import { useRegistry } from "../providers/RegistryProvider";
import { useRisk } from "../hooks/useRisk";
import { shortAddr } from "../lib/utils";

const SCENARIO_INFO: Record<string, { icon: LucideIcon; title: string; blurb: string }> = {
  DUPLICATE_SURVEY: { icon: Copy, title: "Duplicate survey + location", blurb: "Two records claim the same plot. The contract rejects the second submission outright." },
  REUSED_DOCUMENT: { icon: FileWarning, title: "Reused deed document", blurb: "The same document hash was submitted twice — the on-chain duplicate-hash guard reverts it." },
  BULK_SUBMISSION: { icon: Layers, title: "Bulk submission spike", blurb: "One wallet submitted 4+ properties within 24h, emitting FlaggedForReview for manual scrutiny." },
  RAPID_FLIP: { icon: Repeat, title: "Rapid flipping", blurb: "A property changed hands 3+ times within 30 days — a classic layering pattern." },
  CIRCULAR_TRADE: { icon: Repeat, title: "Circular / wash trade", blurb: "Ownership returned to a previous owner, suggesting a wash trade to fabricate activity." },
  INVALID_SURVEY_FORMAT: { icon: Scan, title: "Invalid survey format", blurb: "Survey number breaks the expected AAA/NN/NNN-X pattern; the registrar rejected it." },
  FORGED_DEED: { icon: ShieldX, title: "Forged deed (manual)", blurb: "Flagged and rejected by the registrar on manual review — the human backstop at work." },
};

export default function FraudAlerts() {
  const { snapshot } = useRegistry();
  const { ranked } = useRisk();

  const alerts = useMemo(
    () => ranked.filter((r) => r.risk.score > 0 || r.property.flagged || r.property.onChainStatus === "Reverted" || r.property.onChainStatus === "Rejected"),
    [ranked]
  );

  const counts = {
    reverted: snapshot.properties.filter((p) => p.onChainStatus === "Reverted").length,
    flagged: snapshot.flaggedForReview.length,
    rejected: snapshot.properties.filter((p) => p.onChainStatus === "Rejected").length,
    high: ranked.filter((r) => r.risk.level === "High").length,
  };

  const summary = [
    { label: "Blocked on-chain (reverted)", value: counts.reverted, color: "var(--rose)", icon: ShieldX },
    { label: "Flagged for review", value: counts.flagged, color: "var(--amber)", icon: AlertTriangle },
    { label: "Rejected by registrar", value: counts.rejected, color: "var(--rose)", icon: ShieldAlert },
    { label: "High-risk records", value: counts.high, color: "var(--rose)", icon: Scan },
  ];

  return (
    <div>
      <PageHeader
        title="Fraud Alerts"
        subtitle="On-chain guards block duplicates outright; off-chain scoring surfaces suspicious patterns for a registrar. This reduces and flags fraud — it does not claim to prove a document is forged."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card flex items-center gap-3 p-4">
            <div className="rounded-xl p-2.5" style={{ background: "var(--surface-strong)", color: s.color }}><s.icon size={18} /></div>
            <div><p className="font-display text-2xl font-bold">{s.value}</p><p className="text-xs text-muted">{s.label}</p></div>
          </motion.div>
        ))}
      </div>

      <div className="space-y-3">
        {alerts.length === 0 && <p className="text-sm text-muted">No alerts — the registry looks clean.</p>}
        {alerts.map(({ property: p, risk }, i) => {
          const info = SCENARIO_INFO[p.scenario];
          const Icon = info?.icon ?? AlertTriangle;
          return (
            <motion.div key={p.property_ref} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="rounded-xl bg-[var(--surface-strong)] p-2.5 text-amber"><Icon size={18} /></div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-xs text-muted">{p.property_ref}</span>
                      <span className="font-medium">{p.location}</span>
                      <StatusPill status={p.onChainStatus} />
                      {p.flagged && <span className="pill pill-amber">FlaggedForReview</span>}
                    </div>
                    {info && <p className="mt-1 text-sm font-semibold text-amber">{info.title}</p>}
                    {info && <p className="text-xs text-muted">{info.blurb}</p>}
                  </div>
                </div>
                {risk.score > 0 ? <RiskBadge level={risk.level} score={risk.score} /> : <span className="pill pill-rose">on-chain block</span>}
              </div>

              {(risk.signals.length > 0 || p.reason) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {risk.signals.map((s) => (
                    <span key={s.code} className="rounded-lg border border-amber/30 bg-amber/10 px-2 py-1 text-xs text-amber" title={s.detail}>{s.label}</span>
                  ))}
                  {p.reason && p.onChainStatus !== "Registered" && (
                    <span className="rounded-lg border border-rose/30 bg-rose/10 px-2 py-1 text-xs text-rose">{p.reason}</span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                <span className="mono">owner {shortAddr(p.ownerAddress)}</span>
                {p.onChainId && <Link to={`/property/${p.onChainId}`} className="font-semibold text-primary hover:underline">Inspect →</Link>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
