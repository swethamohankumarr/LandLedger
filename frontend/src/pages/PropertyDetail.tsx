import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, FileText, ShieldCheck, ShieldAlert, UploadCloud, MapPin, Ruler, Building2, Hash, Clock, type LucideIcon } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill, RiskBadge, CopyChip, EmptyState } from "../components/ui/primitives";
import { useRegistry } from "../providers/RegistryProvider";
import { useRisk } from "../hooks/useRisk";
import { hashFile } from "../lib/hash";
import { shortAddr, formatDate, withBase } from "../lib/utils";
import { explorerAddress } from "../config";

export default function PropertyDetail() {
  const { id } = useParams();
  const { snapshot } = useRegistry();
  const { score } = useRisk();
  const [check, setCheck] = useState<{ status: "idle" | "match" | "tamper"; hash?: string }>({ status: "idle" });

  const p = useMemo(
    () => snapshot.properties.find((x) => x.onChainId === id) ?? snapshot.properties.find((x) => x.property_ref === id),
    [snapshot, id]
  );
  const history = useMemo(() => (p ? snapshot.transfers.filter((t) => t.property_ref === p.property_ref && t.outcome === "Completed").sort((a, b) => +new Date(a.date) - +new Date(b.date)) : []), [snapshot, p]);

  if (!p) {
    return (
      <div>
        <PageHeader title="Property not found" />
        <EmptyState title="No such property" message="This id is not in the current data source." action={<Link to="/explorer" className="btn btn-primary">Back to explorer</Link>} />
      </div>
    );
  }

  const risk = score(p.property_ref);
  const verifyUrl = `${window.location.origin}${withBase("/verify")}?id=${p.onChainId ?? ""}`;

  async function onVerify(file: File) {
    if (!p) return;
    const h = await hashFile(file);
    setCheck({ status: h.toLowerCase() === p.documentHash.toLowerCase() ? "match" : "tamper", hash: h });
  }

  // Timeline: origin (submission) + transfers.
  const timeline = [
    { label: "Registered to", addr: history[0]?.fromAddress ?? p.ownerAddress, date: p.submitted_date, origin: true },
    ...history.map((t) => ({ label: "Transferred to", addr: t.toAddress, date: t.date, origin: false, tx: t })),
  ];

  return (
    <div>
      <Link to="/explorer" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to explorer</Link>
      <PageHeader
        title={p.location}
        subtitle={`${p.property_ref}${p.city ? " · " + p.city : ""} · ${p.property_type}`}
        actions={<StatusPill status={p.onChainStatus} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: facts + timeline */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card grid gap-4 p-6 sm:grid-cols-2">
            <Fact icon={MapPin} label="Location" value={p.location} />
            <Fact icon={Building2} label="Type" value={p.property_type} />
            <Fact icon={Ruler} label="Area" value={`${p.area_sqm.toLocaleString()} m²`} />
            <Fact icon={Hash} label="Survey number" value={p.survey_number} mono />
            <div className="sm:col-span-2">
              <p className="label">Current owner</p>
              <div className="flex items-center gap-2">
                <CopyChip value={p.ownerAddress} label={shortAddr(p.ownerAddress, 8)} />
                {explorerAddress(p.ownerAddress) && <a className="text-xs text-primary hover:underline" href={explorerAddress(p.ownerAddress)} target="_blank" rel="noreferrer">Etherscan →</a>}
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="label">Document hash (keccak256)</p>
              <p className="mono break-all text-xs text-emerald">{p.documentHash}</p>
            </div>
            {p.onChainStatus === "Rejected" && p.reason && (
              <div className="rounded-xl border border-rose/30 bg-rose/10 p-3 text-sm text-rose sm:col-span-2">Rejected: {p.reason}</div>
            )}
          </div>

          {/* Timeline */}
          <div className="card p-6">
            <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-semibold"><Clock size={18} /> Ownership timeline</h2>
            <ol className="relative ml-2 space-y-5 border-l border-border pl-6">
              {timeline.map((e, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="relative">
                  <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full" style={{ background: e.origin ? "var(--primary)" : "var(--emerald)" }}>
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>
                  <p className="text-sm font-medium">{e.label} <span className="mono">{shortAddr(e.addr, 6)}</span></p>
                  <p className="text-xs text-muted">{formatDate(e.date)}{e.origin ? " · initial registration" : ""}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right: risk, QR, document, verify */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-3 font-display font-semibold">Risk panel</h3>
            {risk.score > 0 ? (
              <>
                <RiskBadge level={risk.level} score={risk.score} />
                <ul className="mt-3 space-y-2 text-xs text-muted">
                  {risk.signals.map((s) => <li key={s.code} className="rounded-lg border border-amber/30 bg-amber/10 p-2 text-amber"><strong>{s.label}</strong> — {s.detail}</li>)}
                </ul>
              </>
            ) : <p className="text-sm text-emerald">No risk signals — this record looks clean.</p>}
          </div>

          <div className="card flex flex-col items-center p-6 text-center">
            <h3 className="mb-3 font-display font-semibold">Public verification</h3>
            <div className="rounded-xl bg-white p-3"><QRCodeSVG value={verifyUrl} size={132} /></div>
            <p className="mt-3 text-xs text-muted">Scan to open the read-only public verification for this property.</p>
          </div>

          {p.docUrl && (
            <a href={withBase(p.docUrl)} target="_blank" rel="noreferrer" className="btn btn-ghost w-full"><FileText size={16} /> View deed document</a>
          )}

          {/* Verify tool */}
          <div className="card p-6">
            <h3 className="mb-2 font-display font-semibold">Verify a document</h3>
            <p className="mb-3 text-xs text-muted">Upload a file to re-hash it and compare against the on-chain hash.</p>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-5 text-center text-sm transition hover:border-primary/40">
              <UploadCloud size={22} className="mb-2 text-primary" />
              Choose file to verify
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onVerify(f); }} />
            </label>

            {check.status !== "idle" && (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={`mt-4 rounded-xl border p-4 ${check.status === "match" ? "border-emerald/40 bg-emerald/10" : "border-rose/40 bg-rose/10"}`}>
                <div className="flex items-center gap-2">
                  {check.status === "match" ? <ShieldCheck size={22} className="text-emerald" /> : <ShieldAlert size={22} className="text-rose" />}
                  <p className={`font-display text-lg font-bold ${check.status === "match" ? "text-emerald" : "text-rose"}`}>
                    {check.status === "match" ? "Document verified" : "Tampered / different file"}
                  </p>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div><p className="text-muted">On-chain hash</p><p className="mono break-all">{p.documentHash}</p></div>
                  <div><p className="text-muted">Uploaded file hash</p><p className={`mono break-all ${check.status === "match" ? "text-emerald" : "text-rose"}`}>{check.hash}</p></div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value, mono }: { icon: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="label flex items-center gap-1.5"><Icon size={13} /> {label}</p>
      <p className={mono ? "mono text-sm" : "font-medium"}>{value}</p>
    </div>
  );
}
