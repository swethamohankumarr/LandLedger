import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, FileText, Upload, AlertTriangle, ChevronRight, Lock } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { RiskBadge, EmptyState, StatusPill } from "../components/ui/primitives";
import { useRegistry } from "../providers/RegistryProvider";
import { useWallet } from "../providers/WalletProvider";
import { useToast } from "../providers/ToastProvider";
import { useRisk } from "../hooks/useRisk";
import { SURVEY_PATTERN } from "../lib/riskScore";
import { shortAddr, withBase } from "../lib/utils";
import type { IndexedProperty } from "../types";

export default function Registrar() {
  const { demo, snapshot, refresh } = useRegistry();
  const { account, wrongNetwork, isRegistrar, isAdmin, runTx } = useWallet();
  const toast = useToast();
  const { score } = useRisk();

  const [selected, setSelected] = useState<IndexedProperty | null>(null);
  const [rejecting, setRejecting] = useState<IndexedProperty | null>(null);
  const [reason, setReason] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const canAct = !demo && !!account && !wrongNetwork && (isRegistrar || isAdmin);

  const queue = useMemo(() => {
    return snapshot.properties
      .filter((p) => p.onChainStatus === "Pending")
      .map((p) => ({ p, risk: score(p.property_ref) }))
      .sort((a, b) => b.risk.score - a.risk.score);
  }, [snapshot, score]);

  const gate = !demo && !(isRegistrar || isAdmin);

  async function approve(p: IndexedProperty) {
    if (!canAct) return toast.info("Registrar + Live required", "Connect a registrar wallet and switch to Live.");
    if (!p.onChainId) return;
    const r = await runTx(`Approve ${p.property_ref}`, (c) => c.approveProperty(BigInt(p.onChainId!)));
    if (r.ok) { setSelected(null); await refresh(); }
  }
  async function reject() {
    if (!rejecting?.onChainId) return;
    if (!canAct) return toast.info("Registrar + Live required");
    if (!reason.trim()) return toast.error("Reason required");
    const r = await runTx(`Reject ${rejecting.property_ref}`, (c) => c.rejectProperty(BigInt(rejecting.onChainId!), reason.trim()));
    if (r.ok) { setRejecting(null); setReason(""); setSelected(null); await refresh(); }
  }

  return (
    <div>
      <PageHeader
        title="Registrar Console"
        subtitle="Review the pending queue — sorted by highest risk — and decide each claim. This human verification is what keeps forged claims from becoming valid records."
        actions={<button className="btn btn-ghost" onClick={() => setShowBulk(true)}><Upload size={16} /> Bulk CSV import</button>}
      />

      {gate ? (
        <EmptyState icon={<Lock size={40} className="text-amber" />} title="Registrar role required" message="This console is role-gated. Connect a wallet that holds REGISTRAR_ROLE, or explore it in Demo mode." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Queue */}
          <div className="lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Pending queue ({queue.length})</h2>
              {demo && <span className="pill pill-amber">demo — actions need Live</span>}
            </div>
            {queue.length === 0 ? (
              <EmptyState title="Queue is clear" message="No properties are awaiting a decision." />
            ) : (
              <div className="space-y-3">
                {queue.map(({ p, risk }, i) => (
                  <motion.button
                    key={p.property_ref}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelected(p)}
                    className={`card flex w-full items-center gap-4 p-4 text-left transition hover:border-primary/40 ${selected?.property_ref === p.property_ref ? "border-primary/50" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="mono text-xs text-muted">{p.property_ref}</span>
                        <RiskBadge level={risk.level} score={risk.score} />
                      </div>
                      <p className="truncate font-medium">{p.location}</p>
                      <p className="truncate text-xs text-muted">
                        {risk.signals.length ? risk.signals.map((s) => s.label).join(" · ") : "No risk signals"}
                      </p>
                    </div>
                    <span className="mono text-xs text-muted">{shortAddr(p.ownerAddress)}</span>
                    <ChevronRight size={18} className="text-muted" />
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Detail / document viewer */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              {!selected ? (
                <div className="card p-6"><EmptyState title="Select a property" message="Pick a queue item to review its document and risk reasons." /></div>
              ) : (
                <motion.div key={selected.property_ref} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display font-semibold">{selected.property_ref}</h3>
                    <StatusPill status={selected.onChainStatus} />
                  </div>
                  <dl className="mb-4 space-y-1.5 text-sm">
                    <Row k="Location" v={selected.location} />
                    <Row k="Survey" v={selected.survey_number} warn={!SURVEY_PATTERN.test(selected.survey_number)} />
                    <Row k="Area" v={`${selected.area_sqm} m²`} />
                    <Row k="Owner" v={shortAddr(selected.ownerAddress, 6)} mono />
                    <Row k="CID" v={shortAddr(selected.documentCID, 8)} mono />
                  </dl>

                  {(() => {
                    const r = score(selected.property_ref);
                    return r.signals.length > 0 ? (
                      <div className="mb-4 space-y-1.5">
                        <p className="text-xs font-semibold text-muted">RISK REASONS</p>
                        {r.signals.map((s) => (
                          <div key={s.code} className="rounded-lg border border-amber/30 bg-amber/10 p-2 text-xs text-amber">
                            <strong>{s.label}</strong> — {s.detail}
                          </div>
                        ))}
                      </div>
                    ) : <p className="mb-4 rounded-lg border border-emerald/30 bg-emerald/10 p-2 text-xs text-emerald">No risk signals detected.</p>;
                  })()}

                  {selected.docUrl ? (
                    <a href={withBase(selected.docUrl)} target="_blank" rel="noreferrer" className="btn btn-ghost mb-3 w-full"><FileText size={16} /> Open deed document</a>
                  ) : (
                    <p className="mb-3 text-xs text-muted">Document link unavailable in this mode.</p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn btn-primary" onClick={() => approve(selected)}><Check size={16} /> Approve</button>
                    <button className="btn btn-ghost !text-rose" onClick={() => { setRejecting(selected); setReason(""); }}><X size={16} /> Reject</button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      <AnimatePresence>
        {rejecting && (
          <Modal onClose={() => setRejecting(null)} title={`Reject ${rejecting.property_ref}`}>
            <p className="mb-3 text-sm text-muted">Provide a reason — it is stored on-chain and shown in the property's record.</p>
            <textarea className="input min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Survey number fails required format / deed inconsistent on review" />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
              <button className="btn btn-primary !bg-[var(--rose)]" onClick={reject}>Confirm rejection</button>
            </div>
          </Modal>
        )}
        {showBulk && <BulkImport onClose={() => setShowBulk(false)} canAct={canAct} />}
      </AnimatePresence>
    </div>
  );
}

function Row({ k, v, mono, warn }: { k: string; v: string; mono?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={`${mono ? "mono text-xs" : ""} ${warn ? "text-amber" : ""} text-right`}>
        {warn && <AlertTriangle size={12} className="mr-1 inline" />}{v}
      </dd>
    </div>
  );
}

function Modal({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="card w-full max-w-lg p-6" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-display text-lg font-semibold">{title}</h3>
        {children}
      </motion.div>
    </motion.div>
  );
}

interface BulkRow { location: string; surveyNumber: string; areaSqm: string; propertyType: string; documentCID: string; documentHash: string; valid: boolean; error: string }

function BulkImport({ onClose, canAct }: { onClose: () => void; canAct: boolean }) {
  const toast = useToast();
  const { runTx } = useWallet();
  const { refresh } = useRegistry();
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const parse = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    const header = lines.shift()?.split(",").map((h) => h.trim().toLowerCase()) ?? [];
    const idx = (n: string) => header.indexOf(n);
    const out: BulkRow[] = lines.filter(Boolean).map((line) => {
      const cells = line.split(",");
      const get = (n: string) => (idx(n) >= 0 ? (cells[idx(n)] ?? "").trim() : "");
      const r: BulkRow = {
        location: get("location"),
        surveyNumber: get("surveynumber") || get("survey_number"),
        areaSqm: get("areasqm") || get("area_sqm"),
        propertyType: get("propertytype") || get("property_type") || "Residential",
        documentCID: get("documentcid") || get("document_cid") || "",
        documentHash: get("documenthash") || get("document_hash") || "",
        valid: true,
        error: "",
      };
      if (!r.location || !r.surveyNumber || !(Number(r.areaSqm) > 0)) { r.valid = false; r.error = "Missing required field"; }
      else if (!r.documentHash.startsWith("0x") || r.documentHash.length !== 66) { r.valid = false; r.error = "documentHash must be 32-byte hex"; }
      return r;
    });
    setRows(out);
  };

  const submitAll = async () => {
    if (!canAct) return toast.info("Registrar + Live required", "Switch to Live with a registrar wallet to batch submit.");
    const valid = rows.filter((r) => r.valid);
    setProgress({ done: 0, total: valid.length });
    let ok = 0;
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      const res = await runTx(`Bulk ${i + 1}/${valid.length}`, (c) =>
        c.submitProperty(r.location, r.surveyNumber, BigInt(Math.floor(Number(r.areaSqm))), r.propertyType, r.documentCID || "bafybulk", r.documentHash)
      );
      if (res.ok) ok++;
      setProgress({ done: i + 1, total: valid.length });
    }
    toast.success("Bulk import finished", `${ok}/${valid.length} submitted.`);
    await refresh();
  };

  const validCount = rows.filter((r) => r.valid).length;

  return (
    <Modal title="Bulk CSV import" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Columns: <span className="mono text-xs">location, surveyNumber, areaSqm, propertyType, documentCID, documentHash</span>. Rows are validated before submission.</p>
      <input type="file" accept=".csv,text/csv" className="input" onChange={async (e) => { const f = e.target.files?.[0]; if (f) parse(await f.text()); }} />

      {rows.length > 0 && (
        <>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="pill pill-emerald">{validCount} valid</span>
            {rows.length - validCount > 0 && <span className="pill pill-rose">{rows.length - validCount} invalid</span>}
          </div>
          <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-elevated text-left text-muted">
                <tr><th className="p-2">Location</th><th className="p-2">Survey</th><th className="p-2">Area</th><th className="p-2">Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="max-w-[120px] truncate p-2">{r.location}</td>
                    <td className="p-2">{r.surveyNumber}</td>
                    <td className="p-2">{r.areaSqm}</td>
                    <td className="p-2">{r.valid ? <span className="text-emerald">ok</span> : <span className="text-rose">{r.error}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {progress && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-surface-strong">
                <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{progress.done}/{progress.total} submitted</p>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={submitAll} disabled={validCount === 0}>Submit {validCount} valid</button>
          </div>
        </>
      )}
    </Modal>
  );
}
