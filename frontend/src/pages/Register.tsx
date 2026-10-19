import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, Fingerprint, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Loader2, PenLine } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { useRegistry } from "../providers/RegistryProvider";
import { useWallet } from "../providers/WalletProvider";
import { useToast } from "../providers/ToastProvider";
import { hashFile } from "../lib/hash";
import { pinFileToIpfs } from "../lib/ipfsClient";
import { SURVEY_PATTERN } from "../lib/riskScore";
import { shortAddr } from "../lib/utils";

type Form = { location: string; city: string; surveyNumber: string; areaSqm: string; propertyType: string };
const TYPES = ["Residential", "Agricultural", "Commercial"];
const STEP_LABELS = ["Details", "Document", "Review", "Sign"];

export default function Register() {
  const { demo, snapshot, refresh } = useRegistry();
  const { account, wrongNetwork, runTx } = useWallet();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({ location: "", city: "", surveyNumber: "", areaSqm: "", propertyType: "Residential" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [docHash, setDocHash] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [mocked, setMocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const surveyValid = SURVEY_PATTERN.test(form.surveyNumber.trim());
  const detailsValid = form.location.trim() && form.surveyNumber.trim() && Number(form.areaSqm) > 0 && form.propertyType;

  const dupHash = useMemo(() => (docHash ? snapshot.properties.find((p) => p.documentHash?.toLowerCase() === docHash.toLowerCase()) : undefined), [docHash, snapshot]);
  const dupSurvey = useMemo(
    () =>
      snapshot.properties.find(
        (p) =>
          p.survey_number.toLowerCase() === form.surveyNumber.trim().toLowerCase() &&
          p.location.toLowerCase() === form.location.trim().toLowerCase() &&
          p.onChainStatus !== "Reverted"
      ),
    [form.surveyNumber, form.location, snapshot]
  );

  const onFile = useCallback(async (f: File) => {
    setFile(f);
    setPreview(f.type.startsWith("image/") || f.type === "application/pdf" ? URL.createObjectURL(f) : null);
    setBusy(true);
    try {
      const h = await hashFile(f);
      setDocHash(h);
      const pin = await pinFileToIpfs(f);
      setCid(pin.cid);
      setMocked(pin.mocked);
    } catch {
      toast.error("Could not process file");
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const submit = async () => {
    if (!cid || !docHash) return;
    if (demo || !account || wrongNetwork) {
      toast.info("Live mode required", "Connect a wallet on the right network and switch to Live to write on-chain.");
      return;
    }
    const res = await runTx("Register property", (c) =>
      c.submitProperty(form.location.trim(), form.surveyNumber.trim(), BigInt(Math.floor(Number(form.areaSqm))), form.propertyType, cid, docHash)
    );
    if (res.ok) {
      await refresh();
      navigate("/app");
    }
  };

  const canNext = step === 0 ? !!detailsValid : step === 1 ? !!(file && docHash && cid) : true;

  return (
    <div>
      <PageHeader title="Register a property" subtitle="A four-step wizard: capture details, hash & pin the deed, review, then sign the on-chain submission." />

      {/* Stepper */}
      <div className="mb-8 flex items-center">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition"
                style={{
                  background: i <= step ? "var(--primary)" : "var(--surface-strong)",
                  color: i <= step ? "#fff" : "var(--text-muted)",
                }}
              >
                {i < step ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span className={`hidden text-sm font-medium sm:inline ${i <= step ? "" : "text-muted"}`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className="mx-3 h-px flex-1" style={{ background: i < step ? "var(--primary)" : "var(--border)" }} />}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="card p-6">
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold">Property details</h2>
                  <div>
                    <label className="label">Location / address</label>
                    <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="12 MG Road" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">City</label>
                      <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" />
                    </div>
                    <div>
                      <label className="label">Area (m²)</label>
                      <input className="input" type="number" min={1} value={form.areaSqm} onChange={(e) => setForm({ ...form, areaSqm: e.target.value })} placeholder="540" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Survey number</label>
                      <input className="input" value={form.surveyNumber} onChange={(e) => setForm({ ...form, surveyNumber: e.target.value })} placeholder="BLR/12/345-A" />
                      {form.surveyNumber && !surveyValid && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-amber"><AlertTriangle size={12} /> Expected format AAA/NN/NNN-X — this will be flagged for the registrar.</p>
                      )}
                    </div>
                    <div>
                      <label className="label">Type</label>
                      <select className="input" value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value })}>
                        {TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  {dupSurvey && (
                    <div className="rounded-xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">
                      <AlertTriangle size={14} className="mr-1 inline" /> A property with this survey number and location already exists ({dupSurvey.property_ref}). The contract will reject a duplicate.
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold">Upload the deed document</h2>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void onFile(f); }}
                    onClick={() => inputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition"
                    style={{ borderColor: dragOver ? "var(--primary)" : "var(--border)", background: dragOver ? "var(--primary-soft)" : "transparent" }}
                  >
                    <UploadCloud size={32} className="mb-3 text-primary" />
                    <p className="font-medium">Drag & drop or click to upload</p>
                    <p className="mt-1 text-xs text-muted">PDF or image · the file is hashed locally and pinned to IPFS</p>
                    <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
                  </div>

                  {file && (
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        {busy && <Loader2 size={18} className="animate-spin text-muted" />}
                      </div>

                      {docHash && (
                        <div className="mt-3 rounded-lg bg-bg/60 p-3">
                          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted"><Fingerprint size={13} /> Document fingerprint (keccak256)</p>
                          <p className="mono break-all text-xs text-emerald">{docHash}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-muted">IPFS CID:</span>
                            <span className="mono">{cid ? shortAddr(cid, 8) : "…"}</span>
                            {mocked && <span className="pill pill-amber">mock (no server JWT)</span>}
                          </div>
                        </div>
                      )}

                      {dupHash && (
                        <div className="mt-3 rounded-lg border border-rose/40 bg-rose/10 p-3 text-xs text-rose">
                          <AlertTriangle size={13} className="mr-1 inline" /> This exact document is already registered ({dupHash.property_ref}). A reused deed will be rejected on-chain.
                        </div>
                      )}
                    </div>
                  )}

                  {preview && file?.type === "application/pdf" && <iframe title="deed preview" src={preview} className="h-72 w-full rounded-xl border border-border" />}
                  {preview && file?.type.startsWith("image/") && <img alt="deed preview" src={preview} className="max-h-72 rounded-xl border border-border" />}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold">Review before signing</h2>
                  <dl className="divide-y divide-border rounded-xl border border-border">
                    {[
                      ["Location", form.location],
                      ["City", form.city || "—"],
                      ["Survey number", form.surveyNumber],
                      ["Area", `${form.areaSqm} m²`],
                      ["Type", form.propertyType],
                      ["Document", file?.name ?? "—"],
                      ["IPFS CID", cid ?? "—"],
                      ["Hash", docHash ?? "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                        <dt className="text-muted">{k}</dt>
                        <dd className={`text-right ${k === "Hash" || k === "IPFS CID" ? "mono break-all text-xs" : "font-medium"}`}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {(dupHash || dupSurvey) && (
                    <div className="rounded-xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">
                      <AlertTriangle size={14} className="mr-1 inline" /> This submission conflicts with an existing record and will revert on-chain. Adjust before signing.
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto inline-flex rounded-2xl bg-[var(--primary-soft)] p-4 text-primary"><PenLine size={28} /></div>
                  <h2 className="font-display text-lg font-semibold">Sign the submission</h2>
                  <p className="mx-auto max-w-md text-sm text-muted">
                    Signing sends <span className="mono">submitProperty(...)</span> from your wallet. The record enters the Registrar's queue as <strong>Pending</strong>.
                  </p>
                  {(demo || !account || wrongNetwork) && (
                    <div className="mx-auto max-w-md rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
                      {demo ? "You're in Demo mode. " : !account ? "No wallet connected. " : "Wrong network. "}
                      Connect a wallet and switch to <strong>Live</strong> to actually write on-chain. The hashing + IPFS steps above already ran for real.
                    </div>
                  )}
                  <button className="btn btn-primary mx-auto" onClick={submit} disabled={busy || !cid}>
                    <PenLine size={16} /> Sign & submit
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-4 flex justify-between">
            <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft size={16} /> Back
            </button>
            {step < 3 && (
              <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Next <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Side info */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-2 font-display text-sm font-semibold">Why only a hash on-chain?</h3>
            <p className="text-sm text-muted">Storing documents on-chain is expensive and public. We store the IPFS CID and a keccak256 hash so anyone can later prove a file is the exact one registered — without putting private documents on a public ledger.</p>
          </div>
          <div className="card p-5">
            <h3 className="mb-2 font-display text-sm font-semibold">On-chain guards</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 text-emerald" /> Duplicate document hash → rejected</li>
              <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 text-emerald" /> Duplicate survey + location → rejected</li>
              <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 text-emerald" /> 4+ submissions in 24h → flagged for review</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
