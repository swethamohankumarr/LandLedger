import { AnimatePresence, motion } from "framer-motion";
import { Check, X, Loader2, PenLine, Send, AlertTriangle } from "lucide-react";
import { useWallet, TxStep } from "../../providers/WalletProvider";
import { explorerTx } from "../../config";
import { shortAddr } from "../../lib/utils";

const STEPS: { key: TxStep; label: string }[] = [
  { key: "signing", label: "Signing" },
  { key: "submitted", label: "Submitted" },
  { key: "confirming", label: "Confirming" },
  { key: "confirmed", label: "Confirmed" },
];

function stepIndex(step: TxStep): number {
  if (step === "failed") return 1;
  return STEPS.findIndex((s) => s.key === step);
}

export function TxDrawer() {
  const { txs, drawerOpen, setDrawerOpen, clearTxs } = useWallet();

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-[min(92vw,26rem)] flex-col border-l border-border bg-elevated/95 backdrop-blur-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
            role="dialog"
            aria-label="Transaction tracker"
          >
            <header className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-display text-base font-semibold">Transaction tracker</h2>
              <div className="flex items-center gap-2">
                {txs.length > 0 && (
                  <button onClick={clearTxs} className="text-xs text-muted hover:text-ink">
                    Clear
                  </button>
                )}
                <button onClick={() => setDrawerOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {txs.length === 0 && <p className="mt-10 text-center text-sm text-muted">No transactions yet.</p>}
              {txs.map((tx) => {
                const active = stepIndex(tx.step);
                const failed = tx.step === "failed";
                return (
                  <div key={tx.id} className="card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold">{tx.label}</p>
                      {tx.step === "confirmed" && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300 }}
                          className="pill pill-emerald"
                        >
                          <Check size={12} /> Done
                        </motion.span>
                      )}
                      {failed && (
                        <span className="pill pill-rose">
                          <AlertTriangle size={12} /> Failed
                        </span>
                      )}
                    </div>

                    {!failed ? (
                      <ol className="relative ml-1 space-y-2.5 border-l border-border pl-5">
                        {STEPS.map((s, i) => {
                          const done = i < active || tx.step === "confirmed";
                          const current = i === active && tx.step !== "confirmed";
                          const Icon = s.key === "signing" ? PenLine : s.key === "submitted" ? Send : done ? Check : Loader2;
                          return (
                            <li key={s.key} className="relative">
                              <span
                                className="absolute -left-[26px] flex h-4 w-4 items-center justify-center rounded-full"
                                style={{
                                  background: done ? "var(--emerald)" : current ? "var(--primary)" : "var(--surface-strong)",
                                  color: done || current ? "#fff" : "var(--text-muted)",
                                }}
                              >
                                {current && s.key !== "signing" ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Icon size={10} />
                                )}
                              </span>
                              <span className={done || current ? "text-sm" : "text-sm text-muted"}>{s.label}</span>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="text-sm text-rose">{tx.error}</p>
                    )}

                    {tx.hash && (
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                        <span className="mono text-xs text-muted">{shortAddr(tx.hash, 6)}</span>
                        {explorerTx(tx.hash) && (
                          <a
                            href={explorerTx(tx.hash)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            View on Etherscan →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
