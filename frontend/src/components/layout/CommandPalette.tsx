import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CornerDownLeft } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { useRegistry } from "../../providers/RegistryProvider";
import { shortAddr } from "../../lib/utils";

interface Cmd {
  id: string;
  label: string;
  sub?: string;
  to: string;
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { snapshot } = useRegistry();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const nav: Cmd[] = NAV_ITEMS.map((n) => ({ id: `nav-${n.to}`, label: n.label, to: n.to, group: "Pages" }));
    const props: Cmd[] = snapshot.properties
      .filter((p) => p.onChainStatus !== "Reverted")
      .map((p) => ({
        id: `prop-${p.property_ref}`,
        label: `${p.property_ref} · ${p.location}`,
        sub: `${p.city || p.property_type} · owner ${shortAddr(p.ownerAddress)}`,
        to: p.onChainId ? `/property/${p.onChainId}` : `/explorer`,
        group: "Properties",
      }));
    return [...nav, ...props];
  }, [snapshot]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 8);
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.sub?.toLowerCase().includes(q) ||
          c.to.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, commands]);

  const run = (c: Cmd) => {
    setOpen(false);
    navigate(c.to);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="card w-full max-w-xl overflow-hidden p-0"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={18} className="text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter" && filtered[active]) {
                    run(filtered[active]);
                  }
                }}
                placeholder="Jump to a page or search a property by ID / location / owner…"
                className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-muted"
                aria-label="Command palette search"
              />
              <kbd className="pill pill-primary hidden sm:inline-flex">ESC</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches.</li>}
              {filtered.map((c, i) => (
                <li key={c.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(c)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                      i === active ? "bg-[var(--primary-soft)]" : "hover:bg-surface"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.label}</p>
                      {c.sub && <p className="truncate text-xs text-muted">{c.sub}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pill pill-primary hidden sm:inline-flex">{c.group}</span>
                      {i === active && <CornerDownLeft size={14} className="text-muted" />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
