import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastCtx {
  toast: (t: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const Ctx = createContext<ToastCtx>(null as never);

const ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};
const COLOR = {
  success: "var(--emerald)",
  error: "var(--rose)",
  info: "var(--sky)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list, { ...t, id }]);
      setTimeout(() => remove(id), t.kind === "error" ? 7000 : 4500);
    },
    [remove]
  );

  const api: ToastCtx = {
    toast,
    success: (title, message) => toast({ kind: "success", title, message }),
    error: (title, message) => toast({ kind: "error", title, message }),
    info: (title, message) => toast({ kind: "info", title, message }),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICON[t.kind];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.97 }}
                className="card flex items-start gap-3 p-3.5"
              >
                <Icon size={18} style={{ color: COLOR[t.kind] }} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.message && <p className="mt-0.5 break-words text-xs text-muted">{t.message}</p>}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="text-muted transition hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
