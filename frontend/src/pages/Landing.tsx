import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  FileLock2,
  GitBranch,
  ArrowRight,
  Sparkles,
  Moon,
  Sun,
  CheckCircle2,
  XCircle,
  Fingerprint,
  Users,
  Boxes,
} from "lucide-react";
import { useRegistry } from "../providers/RegistryProvider";
import { useTheme } from "../providers/ThemeProvider";
import { CountUp } from "../components/ui/primitives";
import { withBase } from "../lib/utils";

function ChainArt() {
  return (
    <svg viewBox="0 0 420 320" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--sky)" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => {
          const x = 70 + c * 130;
          const y = 50 + r * 95;
          return (
            <motion.g
              key={`${r}-${c}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: (r + c) * 0.12, duration: 0.5 }}
            >
              <motion.path
                d={`M${x} ${y - 26} L${x + 26} ${y - 11} L${x + 26} ${y + 17} L${x} ${y + 32} L${x - 26} ${y + 17} L${x - 26} ${y - 11} Z`}
                fill="var(--surface)"
                stroke="url(#lg)"
                strokeWidth="1.5"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4 + r, repeat: Infinity, delay: c * 0.3 }}
              />
              <circle cx={x} cy={y + 3} r="4" fill="var(--emerald)" opacity="0.9" />
            </motion.g>
          );
        })
      )}
      {[0, 1].map((r) =>
        [0, 1].map((c) => (
          <line
            key={`l-${r}-${c}`}
            x1={70 + c * 130 + 26}
            y1={50 + r * 95}
            x2={70 + (c + 1) * 130 - 26}
            y2={50 + r * 95}
            stroke="url(#lg)"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.5"
          />
        ))
      )}
    </svg>
  );
}

export default function Landing() {
  const { snapshot, setTourOpen } = useRegistry();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const registrars = snapshot.wallets.filter((w) => w.role === "Registrar").length || 1;

  const stats = [
    { label: "Properties on record", value: snapshot.stats.total, icon: Boxes },
    { label: "Ownership transfers", value: snapshot.transfers.filter((t) => t.outcome === "Completed").length, icon: GitBranch },
    { label: "Active registrars", value: registrars, icon: Users },
  ];

  const steps = [
    { icon: FileLock2, title: "Submit & hash the deed", body: "The deed is pinned to IPFS; its keccak256 hash and CID are written on-chain. The file itself never touches the chain." },
    { icon: ShieldCheck, title: "Registrar verifies", body: "A trusted Registrar approves genuine claims. Blockchain can't judge a real-world document, so this human check stays." },
    { icon: GitBranch, title: "Transfer with two signatures", body: "Owner initiates, buyer accepts — each with their own wallet. Every change appends to a permanent history." },
    { icon: Fingerprint, title: "Anyone verifies", body: "Re-hash a file to prove it matches the record, and read the full ownership timeline without an account." },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src={withBase("/favicon.svg")} alt="" className="h-9 w-9" />
          <div className="leading-tight">
            <p className="font-display text-base font-bold">LandLedger</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">Decentralized Property Registry</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="rounded-xl border border-border bg-surface p-2.5" aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/app" className="btn btn-ghost">Launch App</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="pill pill-primary mb-5">
            <Sparkles size={13} /> Ethereum · Sepolia · IPFS
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            Property records that are{" "}
            <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--sky)] bg-clip-text text-transparent">
              tamper-resistant and transparent
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted">
            A blockchain-based land registry: ownership and a permanent transfer history live in a smart contract,
            deeds live on IPFS, and only the registered owner can move a property — with a Registrar verifying every
            initial claim.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/app" className="btn btn-primary">
              Launch App <ArrowRight size={16} />
            </Link>
            <button
              className="btn btn-ghost"
              onClick={() => {
                navigate("/app");
                setTourOpen(true);
              }}
            >
              <Sparkles size={16} /> Try Guided Demo
            </button>
          </div>
          <p className="mt-4 text-xs text-muted">No wallet needed for the demo — it uses bundled synthetic data.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="card relative aspect-[4/3] overflow-hidden p-6">
          <ChainArt />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/40 to-transparent" />
        </motion.div>
      </section>

      {/* Live stats */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card flex items-center gap-4 p-6"
            >
              <div className="rounded-xl bg-[var(--primary-soft)] p-3 text-primary">
                <s.icon size={22} />
              </div>
              <div>
                <p className="font-display text-3xl font-bold">
                  <CountUp value={s.value} />
                </p>
                <p className="text-sm text-muted">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Problem -> Solution */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-7">
            <h2 className="font-display text-xl font-semibold text-rose">The problem today</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {["Centralized records are a single point of failure and can be altered.", "Forged or duplicate documents enable the same plot to be sold twice.", "Manual verification is slow, opaque and hard to audit."].map((t) => (
                <li key={t} className="flex gap-3">
                  <XCircle size={18} className="mt-0.5 shrink-0 text-rose" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-7">
            <h2 className="font-display text-xl font-semibold text-emerald">What this changes</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {["Records and history are append-only and independently verifiable.", "Duplicate deeds and survey numbers are rejected by the contract.", "Transfers follow strict rules and need both parties' signatures."].map((t) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <h2 className="mb-8 text-center font-display text-2xl font-bold">How it works</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="card p-6">
              <div className="mb-4 inline-flex rounded-xl bg-[var(--primary-soft)] p-3 text-primary">
                <s.icon size={20} />
              </div>
              <div className="mb-1 text-xs font-semibold text-muted">STEP {i + 1}</div>
              <h3 className="font-display text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Honest limitations */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="card overflow-hidden p-0">
          <div className="border-b border-border bg-surface p-6">
            <h2 className="font-display text-xl font-semibold">What this does — and doesn't — solve</h2>
            <p className="mt-1 text-sm text-muted">We're deliberately honest: blockchain reduces and flags fraud. It does not eliminate it.</p>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2">
            <div className="bg-bg p-6">
              <p className="mb-3 font-semibold text-emerald">It does</p>
              <ul className="space-y-2 text-sm text-muted">
                {["Make records tamper-resistant and auditable", "Prevent on-chain duplicate deeds / survey numbers", "Enforce owner-only, two-party transfers", "Flag suspicious patterns for a registrar"].map((t) => (
                  <li key={t} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="bg-bg p-6">
              <p className="mb-3 font-semibold text-rose">It does not</p>
              <ul className="space-y-2 text-sm text-muted">
                {["Verify real-world identity or KYC", "Prove a submitted deed is genuine (Registrar must)", "Replace legal recognition of ownership", "Remove the need to trust the Registrar/Admin"].map((t) => (
                  <li key={t} className="flex gap-2"><XCircle size={16} className="mt-0.5 shrink-0 text-rose" />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Academic project · deployed on a testnet · all data shown is synthetic.
        </p>
      </section>
    </div>
  );
}
