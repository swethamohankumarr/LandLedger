import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Boxes, CheckCircle2, Clock, XCircle, Inbox, Activity as ActivityIcon, Copy } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { CountUp, Sparkline, StatusPill, EmptyState, CopyChip } from "../components/ui/primitives";
import { PropertyCard } from "../components/PropertyCard";
import { useRegistry } from "../providers/RegistryProvider";
import { useWallet } from "../providers/WalletProvider";
import { ACTIVE_CHAIN } from "../config";
import { shortAddr, formatDate } from "../lib/utils";

function monthlyCumulative(dates: string[]): number[] {
  const sorted = [...dates].filter(Boolean).sort();
  const buckets: Record<string, number> = {};
  sorted.forEach((d) => {
    const key = d.slice(0, 7);
    buckets[key] = (buckets[key] || 0) + 1;
  });
  let acc = 0;
  return Object.keys(buckets)
    .sort()
    .map((k) => (acc += buckets[k]));
}

export default function Dashboard() {
  const { snapshot, demo } = useRegistry();
  const { account, isRegistrar, isAdmin } = useWallet();

  const owners = snapshot.wallets.filter((w) => w.role === "Owner");
  const [persona, setPersona] = useState<string>(() => owners[0]?.address ?? "");
  const viewer = (demo ? persona : account)?.toLowerCase() ?? "";
  const viewerWallet = snapshot.wallets.find((w) => w.address.toLowerCase() === viewer);

  const mine = useMemo(
    () => snapshot.properties.filter((p) => p.ownerAddress.toLowerCase() === viewer && p.onChainStatus !== "Reverted"),
    [snapshot, viewer]
  );

  const kpis = [
    { label: "Total records", value: snapshot.stats.total, icon: Boxes, color: "var(--primary)", spark: monthlyCumulative(snapshot.properties.map((p) => p.submitted_date)) },
    { label: "Registered", value: snapshot.stats.registered, icon: CheckCircle2, color: "var(--emerald)", spark: monthlyCumulative(snapshot.properties.filter((p) => p.onChainStatus === "Registered").map((p) => p.submitted_date)) },
    { label: "Pending", value: snapshot.stats.pending, icon: Clock, color: "var(--amber)", spark: monthlyCumulative(snapshot.properties.filter((p) => p.onChainStatus === "Pending").map((p) => p.submitted_date)) },
    { label: "Rejected", value: snapshot.stats.rejected, icon: XCircle, color: "var(--rose)", spark: monthlyCumulative(snapshot.properties.filter((p) => p.onChainStatus === "Rejected").map((p) => p.submitted_date)) },
  ];

  const activity = useMemo(() => {
    const subs = snapshot.properties
      .filter((p) => p.onChainStatus !== "Reverted")
      .map((p) => ({ kind: "submit" as const, date: p.submitted_date, text: `${p.property_ref} submitted`, status: p.onChainStatus, to: p.onChainId ? `/property/${p.onChainId}` : "/explorer" }));
    const trs = snapshot.transfers
      .filter((t) => t.outcome === "Completed")
      .map((t) => ({ kind: "transfer" as const, date: t.date, text: `${t.property_ref} transferred ${shortAddr(t.fromAddress)} → ${shortAddr(t.toAddress)}`, status: "Registered", to: "/explorer" }));
    return [...subs, ...trs].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8);
  }, [snapshot]);

  const role = isAdmin ? "Admin" : isRegistrar ? "Registrar" : viewerWallet?.role ?? "Owner";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your portfolio, registry activity and pending requests at a glance."
        actions={<Link to="/register" className="btn btn-primary">Register a property</Link>}
      />

      {/* Wallet / persona card */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{demo ? "Viewing as (demo persona)" : "Connected wallet"}</p>
            <span className="pill pill-primary">{role}</span>
          </div>
          {demo ? (
            <select
              className="input mt-3"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              aria-label="Demo persona"
            >
              {owners.map((w) => (
                <option key={w.address} value={w.address}>
                  {w.label} · {shortAddr(w.address)}
                </option>
              ))}
            </select>
          ) : account ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="mono text-sm">{shortAddr(account, 6)}</span>
              <CopyChip value={account} label="copy" />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Connect a wallet to view your on-chain portfolio.</p>
          )}
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <span className="pill pill-sky">{demo ? "Synthetic" : ACTIVE_CHAIN.short}</span>
            <span>{mine.length} properties owned</span>
          </div>
        </motion.div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          {kpis.map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card flex items-center justify-between p-5">
              <div>
                <div className="mb-1 flex items-center gap-2 text-muted" style={{ color: k.color }}>
                  <k.icon size={16} />
                  <span className="text-xs font-semibold">{k.label}</span>
                </div>
                <p className="font-display text-2xl font-bold">
                  <CountUp value={k.value} />
                </p>
              </div>
              <Sparkline data={k.spark.length ? k.spark : [0, 0]} color={k.color} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* My properties */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">My properties</h2>
          <Link to="/explorer" className="text-sm font-semibold text-primary hover:underline">Open explorer →</Link>
        </div>
        {mine.length === 0 ? (
          <EmptyState title="No properties yet" message="Properties you own will appear here. Register one to get started." action={<Link to="/register" className="btn btn-primary">Register property</Link>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.slice(0, 6).map((p, i) => (
              <PropertyCard key={p.property_ref} p={p} index={i} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Incoming transfers */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Inbox size={18} /> Incoming transfer requests
          </h2>
          <div className="card p-5">
            <EmptyState
              title="No incoming requests"
              message={demo ? "In the seeded demo all transfers are already completed. In Live mode, requests addressed to your wallet appear here." : "Transfer requests addressed to your wallet will show up here to accept or decline."}
            />
          </div>
        </section>

        {/* Activity feed */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <ActivityIcon size={18} /> Recent activity
          </h2>
          <div className="card divide-y divide-border p-2">
            {activity.map((a, i) => (
              <Link key={i} to={a.to} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition hover:bg-surface">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-surface p-1.5 text-muted">
                    {a.kind === "submit" ? <Copy size={14} /> : <ActivityIcon size={14} />}
                  </span>
                  <span className="text-sm">{a.text}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={a.status} />
                  <span className="hidden text-xs text-muted sm:inline">{formatDate(a.date)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
