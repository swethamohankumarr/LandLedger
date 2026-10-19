import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { SearchCheck, ShieldCheck, ShieldAlert, UploadCloud, Radio } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill, CopyChip, EmptyState, Spinner } from "../components/ui/primitives";
import { useRegistry } from "../providers/RegistryProvider";
import { makeReadProvider, readContract } from "../lib/registryService";
import { PUBLIC_RPC_URL } from "../config";
import { hashFile } from "../lib/hash";
import { shortAddr, formatDate, statusFromCode } from "../lib/utils";

interface Result {
  id: string;
  owner: string;
  status: string;
  location: string;
  surveyNumber: string;
  documentHash: string;
  history: { from: string; to: string; date: string }[];
  source: "chain" | "demo";
}

export default function PublicVerify() {
  const { snapshot } = useRegistry();
  const [params] = useSearchParams();
  const [idInput, setIdInput] = useState(params.get("id") ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<{ status: "idle" | "match" | "tamper"; hash?: string }>({ status: "idle" });

  async function lookup(id: string) {
    setError(""); setResult(null); setCheck({ status: "idle" });
    if (!id.trim()) return;
    setLoading(true);
    try {
      if (PUBLIC_RPC_URL) {
        const c = readContract(makeReadProvider(PUBLIC_RPC_URL));
        const p = await c.getProperty(BigInt(id));
        const h = (await c.getHistory(BigInt(id))) as { from: string; to: string; timestamp: bigint }[];
        setResult({
          id,
          owner: p.owner,
          status: statusFromCode(Number(p.status)),
          location: p.location,
          surveyNumber: p.surveyNumber,
          documentHash: p.documentHash,
          history: h.map((x) => ({ from: x.from, to: x.to, date: new Date(Number(x.timestamp) * 1000).toISOString().slice(0, 10) })),
          source: "chain",
        });
      } else {
        const p = snapshot.properties.find((x) => x.onChainId === id.trim() || x.property_ref === id.trim());
        if (!p) throw new Error("not found");
        setResult({
          id: p.onChainId ?? p.property_ref,
          owner: p.ownerAddress,
          status: p.onChainStatus,
          location: p.location,
          surveyNumber: p.survey_number,
          documentHash: p.documentHash,
          history: snapshot.transfers.filter((t) => t.property_ref === p.property_ref && t.outcome === "Completed").map((t) => ({ from: t.fromAddress, to: t.toAddress, date: t.date })),
          source: "demo",
        });
      }
    } catch {
      setError("No property found for that id in the current data source.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.get("id")) void lookup(params.get("id")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onVerify(file: File) {
    if (!result) return;
    const h = await hashFile(file);
    setCheck({ status: h.toLowerCase() === result.documentHash.toLowerCase() ? "match" : "tamper", hash: h });
  }

  return (
    <div>
      <PageHeader
        title="Public Verify"
        subtitle="Anyone can verify a property's current owner and full history — no wallet required. Uses a read-only RPC when configured, otherwise the bundled synthetic snapshot."
      />

      <div className="card mb-6 p-5">
        <label className="label">Property ID</label>
        <div className="flex gap-2">
          <input className="input" value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder="e.g. 1" onKeyDown={(e) => e.key === "Enter" && lookup(idInput)} />
          <button className="btn btn-primary" onClick={() => lookup(idInput)} disabled={loading}>
            {loading ? <Spinner /> : <SearchCheck size={16} />} Verify
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <Radio size={12} /> Source: {PUBLIC_RPC_URL ? "public RPC (live, read-only)" : "bundled synthetic snapshot"}
        </p>
      </div>

      {error && <EmptyState title="Not found" message={error} />}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="mono text-xs text-muted">Property #{result.id}</p>
                <h2 className="font-display text-xl font-semibold">{result.location}</h2>
              </div>
              <StatusPill status={result.status} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="label">Current owner</p><CopyChip value={result.owner} label={shortAddr(result.owner, 8)} /></div>
              <div><p className="label">Survey number</p><p className="mono text-sm">{result.surveyNumber}</p></div>
              <div className="sm:col-span-2"><p className="label">Document hash</p><p className="mono break-all text-xs text-emerald">{result.documentHash}</p></div>
            </div>

            <h3 className="mb-3 mt-6 font-display font-semibold">Ownership history</h3>
            {result.history.length === 0 ? (
              <p className="text-sm text-muted">No transfers yet — still with the original registrant.</p>
            ) : (
              <ol className="relative ml-2 space-y-3 border-l border-border pl-5">
                {result.history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[23px] h-3 w-3 rounded-full bg-emerald" />
                    <p className="text-sm"><span className="mono">{shortAddr(h.from, 5)}</span> → <span className="mono">{shortAddr(h.to, 5)}</span></p>
                    <p className="text-xs text-muted">{formatDate(h.date)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card p-6">
            <h3 className="mb-2 font-display font-semibold">Verify document</h3>
            <p className="mb-3 text-xs text-muted">Upload the deed you hold to confirm it matches the registered hash.</p>
            <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-border p-5 text-center text-sm transition hover:border-primary/40">
              <UploadCloud size={22} className="mb-2 text-primary" /> Choose file
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onVerify(f); }} />
            </label>
            {check.status !== "idle" && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`mt-4 rounded-xl border p-4 text-center ${check.status === "match" ? "border-emerald/40 bg-emerald/10" : "border-rose/40 bg-rose/10"}`}>
                {check.status === "match" ? <ShieldCheck size={28} className="mx-auto text-emerald" /> : <ShieldAlert size={28} className="mx-auto text-rose" />}
                <p className={`mt-1 font-display font-bold ${check.status === "match" ? "text-emerald" : "text-rose"}`}>{check.status === "match" ? "Verified match" : "Does not match"}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
