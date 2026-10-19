import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Moon, Sun, Activity, Command, FlaskConical, Radio } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { WalletButton } from "./WalletButton";
import { TxDrawer } from "./TxDrawer";
import { CommandPalette } from "./CommandPalette";
import { GuidedTour } from "../GuidedTour";
import { useTheme } from "../../providers/ThemeProvider";
import { useWallet } from "../../providers/WalletProvider";
import { useRegistry } from "../../providers/RegistryProvider";
import { cn, withBase } from "../../lib/utils";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src={withBase("/favicon.svg")} alt="" className="h-8 w-8" />
      <div className="leading-tight">
        <p className="font-display text-sm font-bold">LandLedger</p>
        <p className="text-[10px] uppercase tracking-wider text-muted">Property Registry</p>
      </div>
    </Link>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isRegistrar, isAdmin } = useWallet();
  const { demo } = useRegistry();
  const items = NAV_ITEMS.filter((n) => !n.roleGated || demo || isRegistrar || isAdmin);
  return (
    <nav className="flex flex-col gap-1">
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              isActive ? "bg-[var(--primary-soft)] text-primary" : "text-muted hover:bg-surface hover:text-ink"
            )
          }
        >
          <n.icon size={18} />
          {n.label}
          {n.roleGated && <span className="pill pill-primary ml-auto !px-1.5 !py-0 text-[10px]">role</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function ModeToggle() {
  const { demo, setDemo, refresh } = useRegistry();
  const { account, wrongNetwork } = useWallet();
  const canLive = !!account && !wrongNetwork;
  return (
    <div className="flex items-center rounded-xl border border-border bg-surface p-0.5 text-xs font-semibold">
      <button
        onClick={() => {
          setDemo(true);
          void refresh();
        }}
        className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition", demo && "bg-[var(--primary-soft)] text-primary")}
      >
        <FlaskConical size={13} /> Demo
      </button>
      <button
        onClick={() => {
          setDemo(false);
          void refresh();
        }}
        disabled={!canLive}
        title={canLive ? "Read live from chain" : "Connect a wallet on the right network first"}
        className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition disabled:opacity-40", !demo && "bg-[var(--primary-soft)] text-primary")}
      >
        <Radio size={13} /> Live
      </button>
    </div>
  );
}

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const { txs, setDrawerOpen } = useWallet();
  const { demo } = useRegistry();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pending = txs.filter((t) => t.step !== "confirmed" && t.step !== "failed").length;

  return (
    <div className="min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-border bg-elevated/40 p-5 backdrop-blur-xl lg:flex">
        <Logo />
        <div className="mt-8 flex-1">
          <SideNav />
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted">
          <p className="font-semibold text-ink">Testnet project</p>
          <p className="mt-1">Synthetic data for academic demonstration. Not legally binding.</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="fixed left-0 top-0 z-50 h-screen w-72 border-r border-border bg-elevated p-5 lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
            >
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>
              <SideNav onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <ModeToggle />
          <button
            onClick={() => (document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })))}
            className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted transition hover:text-ink md:flex"
            aria-label="Open command palette"
          >
            <Command size={14} /> Search <kbd className="pill pill-primary !px-1.5 !py-0">⌘K</kbd>
          </button>
          <button onClick={() => setDrawerOpen(true)} className="relative rounded-xl border border-border bg-surface p-2.5" aria-label="Transaction tracker">
            <Activity size={16} />
            {pending > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">{pending}</span>}
          </button>
          <button onClick={toggle} className="rounded-xl border border-border bg-surface p-2.5" aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="hidden sm:block">
            <WalletButton />
          </div>
        </header>

        {demo && (
          <div className="flex items-center justify-center gap-2 border-b border-amber/30 bg-amber/10 px-4 py-2 text-center text-xs font-medium text-amber">
            <FlaskConical size={13} />
            Demo mode — showing bundled <strong>synthetic</strong> data. Connect a wallet and switch to Live to read on-chain.
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-4 sm:hidden">
            <WalletButton />
          </div>
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <TxDrawer />
      <GuidedTour />
    </div>
  );
}
