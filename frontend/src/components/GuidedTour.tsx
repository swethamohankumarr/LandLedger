import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useRegistry } from "../providers/RegistryProvider";

interface Step {
  title: string;
  body: string;
  to: string;
}

const STEPS: Step[] = [
  { title: "1 · Register a property", body: "Owners submit a deed. The file is hashed (keccak256) and pinned to IPFS; only the CID + hash go on-chain. Duplicate deeds and survey numbers are rejected automatically.", to: "/register" },
  { title: "2 · Registrar approves", body: "A trusted Registrar reviews the pending queue — sorted by risk score — and approves genuine claims or rejects suspicious ones. This human step is why 'garbage in' can't become a valid record.", to: "/registrar" },
  { title: "3 · Transfer ownership", body: "The owner initiates a transfer to a buyer; the buyer accepts with their own wallet. Two signatures, one immutable history entry.", to: "/transfers" },
  { title: "4 · Verify ownership & history", body: "Anyone can open a property to see its current owner and full transfer timeline with Etherscan links — no account needed.", to: "/property/1" },
  { title: "5 · Tamper detection", body: "Re-hash any file against the on-chain hash. A match shows a verified shield; a mismatch flags a tampered document.", to: "/property/1" },
  { title: "6 · Fraud alerts", body: "The Fraud Alerts page surfaces duplicate surveys, reused deeds, bulk submissions, rapid flipping and circular trades — scored and explained.", to: "/fraud" },
];

export function GuidedTour() {
  const { tourOpen, setTourOpen, setDemo } = useRegistry();
  const [i, setI] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (tourOpen) {
      setDemo(true);
      setI(0);
      navigate(STEPS[0].to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen]);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(next, STEPS.length - 1));
    setI(clamped);
    navigate(STEPS[clamped].to);
  };

  return (
    <AnimatePresence>
      {tourOpen && (
        <motion.div
          className="fixed bottom-5 left-1/2 z-[80] w-[min(94vw,32rem)] -translate-x-1/2"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
        >
          <div className="card border-primary/40 p-5 shadow-glow">
            <div className="mb-2 flex items-center justify-between">
              <span className="pill pill-primary">
                <Sparkles size={12} /> Guided demo · synthetic data
              </span>
              <button onClick={() => setTourOpen(false)} aria-label="End tour" className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
              <h3 className="font-display text-lg font-semibold">{STEPS[i].title}</h3>
              <p className="mt-1 text-sm text-muted">{STEPS[i].body}</p>
            </motion.div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((_, idx) => (
                  <span
                    key={idx}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: idx === i ? 20 : 8,
                      background: idx === i ? "var(--primary)" : "var(--border)",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => go(i - 1)} disabled={i === 0}>
                  <ChevronLeft size={16} /> Back
                </button>
                {i < STEPS.length - 1 ? (
                  <button className="btn btn-primary" onClick={() => go(i + 1)}>
                    Next <ChevronRight size={16} />
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => setTourOpen(false)}>
                    Finish
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
