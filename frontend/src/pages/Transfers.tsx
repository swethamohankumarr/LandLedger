import { useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";
import { motion } from "framer-motion";
import { ArrowLeftRight, Send, Inbox, Check, X, ShieldQuestion } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/primitives";
import { useRegistry } from "../providers/RegistryProvider";
import { useWallet } from "../providers/WalletProvider";
import { useToast } from "../providers/ToastProvider";
import { readContract } from "../lib/registryService";
import { isAddress, shortAddr } from "../lib/utils";

export default function Transfers() {
  const { demo, snapshot, refresh } = useRegistry();
  const { account, wrongNetwork, provider, runTx } = useWallet();
  const toast = useToast();

  const [propId, setPropId] = useState("");
  const [buyer, setBuyer] = useState("");
  const [incoming, setIncoming] = useState<{ id: string; location: string }[]>([]);
  const [outgoing, setOutgoing] = useState<{ id: string; location: string; buyer: string }[]>([]);

  const live = !demo && !!account && !wrongNetwork && !!provider;

  const myRegistered = useMemo(
    () => snapshot.properties.filter((p) => p.onChainStatus === "Registered" && (!account || p.ownerAddress.toLowerCase() === account.toLowerCase()) && p.onChainId),
    [snapshot, account]
  );

  useEffect(() => {
    if (!live || !provider || !account) { setIncoming([]); setOutgoing([]); return; }
    (async () => {
      try {
        const c = readContract(provider);
        const ids = (await c.getIncomingTransfers(account)) as bigint[];
        const inc = await Promise.all(ids.map(async (id) => ({ id: id.toString(), location: (await c.getProperty(id)).location })));
        setIncoming(inc);

        const mine = (await c.getPropertiesByOwner(account)) as bigint[];
        const out: { id: string; location: string; buyer: string }[] = [];
        for (const id of mine) {
          const pt = await c.getPendingTransfer(id);
          if (pt.active) out.push({ id: id.toString(), location: (await c.getProperty(id)).location, buyer: pt.buyer });
        }
        setOutgoing(out);
      } catch { /* ignore */ }
    })();
  }, [live, provider, account, snapshot]);

  const buyerValid = isAddress(buyer.trim());
  let checksummed = "";
  try { checksummed = buyerValid ? getAddress(buyer.trim()) : ""; } catch { /* invalid checksum */ }

  async function initiate() {
    if (!live) return toast.info("Live required", "Connect your wallet and switch to Live to initiate a transfer.");
    if (!propId) return toast.error("Select a property");
    if (!checksummed) return toast.error("Invalid buyer address");
    const r = await runTx(`Initiate transfer of #${propId}`, (c) => c.initiateTransfer(BigInt(propId), checksummed));
    if (r.ok) { setBuyer(""); await refresh(); }
  }
  async function accept(id: string) {
    const r = await runTx(`Accept transfer of #${id}`, (c) => c.acceptTransfer(BigInt(id)));
    if (r.ok) await refresh();
  }
  async function cancel(id: string) {
    const r = await runTx(`Cancel transfer of #${id}`, (c) => c.cancelTransfer(BigInt(id)));
    if (r.ok) await refresh();
  }

  return (
    <div>
      <PageHeader title="Transfer Center" subtitle="Ownership moves only with two signatures: the owner initiates, the buyer accepts. The owner can cancel any time before acceptance." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Initiate */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Send size={18} /> Initiate a transfer</h2>
          <label className="label">Property</label>
          <select className="input" value={propId} onChange={(e) => setPropId(e.target.value)}>
            <option value="">Select one of your registered properties…</option>
            {myRegistered.map((p) => (
              <option key={p.property_ref} value={p.onChainId!}>#{p.onChainId} · {p.location}</option>
            ))}
          </select>

          <label className="label mt-4">Buyer wallet address</label>
          <input className="input mono" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="0x…" />
          {buyer && !buyerValid && <p className="mt-1.5 text-xs text-rose">Not a valid 20-byte address.</p>}
          {buyer && buyerValid && !checksummed && <p className="mt-1.5 text-xs text-amber">Checksum mismatch — double-check the address.</p>}
          {checksummed && <p className="mt-1.5 text-xs text-emerald">Checksummed: <span className="mono">{shortAddr(checksummed, 6)}</span></p>}

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber">
            <ShieldQuestion size={16} className="mt-0.5 shrink-0" />
            Addresses are not ENS-resolved here. Transfers are irreversible once the buyer accepts — verify the address with the counterparty out-of-band.
          </div>

          <button className="btn btn-primary mt-4 w-full" onClick={initiate}><ArrowLeftRight size={16} /> Initiate transfer</button>
          {demo && <p className="mt-2 text-center text-xs text-muted">Demo mode — switch to Live to sign.</p>}
        </motion.div>

        {/* Incoming + outgoing */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Inbox size={18} /> Incoming requests</h2>
            {incoming.length === 0 ? (
              <EmptyState title="No incoming requests" message={live ? "Transfers addressed to your wallet will appear here." : "Switch to Live with a connected wallet to see requests addressed to you."} />
            ) : (
              <div className="space-y-2">
                {incoming.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
                    <div><p className="text-sm font-medium">#{t.id} · {t.location}</p><p className="text-xs text-muted">Awaiting your acceptance</p></div>
                    <button className="btn btn-primary !py-1.5" onClick={() => accept(t.id)}><Check size={14} /> Accept</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Send size={18} /> Your outgoing transfers</h2>
            {outgoing.length === 0 ? (
              <EmptyState title="Nothing pending" message={live ? "Transfers you've initiated appear here until accepted or cancelled." : "Switch to Live to view and cancel your pending transfers."} />
            ) : (
              <div className="space-y-2">
                {outgoing.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
                    <div><p className="text-sm font-medium">#{t.id} · {t.location}</p><p className="mono text-xs text-muted">→ {shortAddr(t.buyer, 6)}</p></div>
                    <button className="btn btn-ghost !py-1.5 !text-rose" onClick={() => cancel(t.id)}><X size={14} /> Cancel</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-party progress explainer */}
      <div className="card mt-6 p-6">
        <h3 className="mb-4 font-display font-semibold">How a transfer completes</h3>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {["Owner initiates", "Buyer notified", "Buyer accepts", "History appended"].map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">{i + 1}</span>
                {s}
              </div>
              {i < 3 && <span className="hidden text-muted sm:inline">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
