import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, MonitorSmartphone, FileCode2, Database, CheckCircle2, XCircle, type LucideIcon } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { useRegistry } from "../providers/RegistryProvider";
import { CopyChip } from "../components/ui/primitives";

const STACK = [
  ["Smart contract", "Solidity ^0.8.20, OpenZeppelin v5 (AccessControl, ReentrancyGuard, Pausable)"],
  ["Chain / tooling", "Ethereum, Sepolia testnet, Hardhat, Ethers.js v6, TypeChain"],
  ["Storage", "IPFS via Pinata (CID + keccak256 hash on-chain)"],
  ["Frontend", "React + Vite + TypeScript, Tailwind CSS, Framer Motion, Recharts"],
  ["Wallet", "MetaMask (EIP-1193), automatic network switching"],
];

const GLOSSARY: [string, string][] = [
  ["CID", "Content Identifier — IPFS's hash-based address for a file."],
  ["keccak256", "The hash function used by Ethereum; the on-chain document fingerprint."],
  ["Registrar", "A trusted role (REGISTRAR_ROLE) that approves/rejects initial registrations."],
  ["Pending / Registered / Rejected", "The lifecycle states of a property record."],
  ["Pending transfer", "An initiated transfer awaiting the buyer's acceptance."],
  ["Gas", "The fee paid to miners/validators to execute a transaction."],
];

function Node({ icon: Icon, title, sub, x, y }: { icon: LucideIcon; title: string; sub: string; x: number; y: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="absolute w-40 -translate-x-1/2 rounded-xl border border-border bg-elevated p-3 text-center shadow-card" style={{ left: `${x}%`, top: y }}>
      <div className="mx-auto mb-1 inline-flex rounded-lg bg-[var(--primary-soft)] p-2 text-primary"><Icon size={18} /></div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </motion.div>
  );
}

export default function About() {
  const { snapshot } = useRegistry();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      <PageHeader title="About & Architecture" subtitle="How the pieces fit together, the exact stack, and an honest statement of scope." />

      {/* Architecture diagram */}
      <div className="card mb-6 overflow-hidden p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">System architecture</h2>
        <div className="relative mx-auto h-[300px] max-w-3xl">
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="var(--primary)" /></marker>
            </defs>
            {[[25, 72, 50, 148], [50, 172, 50, 148], [50, 172, 78, 240], [50, 172, 25, 240]].map((l, i) => (
              <line key={i} x1={`${l[0]}%`} y1={l[1]} x2={`${l[2]}%`} y2={l[3]} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#arrow)" opacity="0.6" />
            ))}
          </svg>
          <Node icon={Wallet} title="User + MetaMask" sub="signs transactions" x={25} y={10} />
          <Node icon={MonitorSmartphone} title="React / Ethers.js" sub="this dApp" x={50} y={120} />
          <Node icon={FileCode2} title="Smart Contract" sub="ownership + history" x={25} y={240} />
          <Node icon={Database} title="IPFS (Pinata)" sub="deed documents" x={78} y={240} />
        </div>
        <p className="mt-2 text-center text-xs text-muted">The browser signs with MetaMask, writes records to the contract, and pins documents to IPFS; only the CID + hash are stored on-chain.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Technology stack</h2>
          <dl className="divide-y divide-border">
            {STACK.map(([k, v]) => (
              <div key={k} className="py-2.5"><dt className="text-sm font-semibold">{k}</dt><dd className="text-sm text-muted">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4 rounded-xl border border-border bg-surface p-3 text-xs">
            <p className="text-muted">Active contract address</p>
            <div className="mt-1"><CopyChip value={snapshot.contractAddress} label={snapshot.contractAddress} /></div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Scope — honest limitations</h2>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-emerald">Solves</p>
            {["Tamper-resistant, auditable records", "Duplicate deed / survey rejection", "Owner-only, two-party transfers", "Risk flagging for registrars"].map((t) => (
              <p key={t} className="flex gap-2 text-muted"><CheckCircle2 size={15} className="mt-0.5 text-emerald" />{t}</p>
            ))}
            <p className="mt-3 font-semibold text-rose">Does not solve</p>
            {["Real-world identity / KYC", "Proving a deed is genuine (registrar must)", "Legal recognition of ownership", "Removing trust in registrar/admin", "Privacy — the ledger is public"].map((t) => (
              <p key={t} className="flex gap-2 text-muted"><XCircle size={15} className="mt-0.5 text-rose" />{t}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Glossary */}
      <div className="card mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Glossary</h2>
        <div className="divide-y divide-border">
          {GLOSSARY.map(([term, def], i) => (
            <button key={term} onClick={() => setOpen(open === i ? null : i)} className="w-full py-3 text-left">
              <div className="flex items-center justify-between">
                <span className="font-medium">{term}</span>
                <span className="text-muted">{open === i ? "−" : "+"}</span>
              </div>
              {open === i && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-1 text-sm text-muted">{def}</motion.p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
