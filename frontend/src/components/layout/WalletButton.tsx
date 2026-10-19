import { Wallet, LogOut, AlertTriangle, ShieldCheck } from "lucide-react";
import { useWallet } from "../../providers/WalletProvider";
import { ACTIVE_CHAIN } from "../../config";
import { shortAddr } from "../../lib/utils";
import { Spinner } from "../ui/primitives";

export function WalletButton() {
  const { hasMetaMask, account, connecting, connect, disconnect, wrongNetwork, switchNetwork, isRegistrar, isAdmin } =
    useWallet();

  if (!account) {
    return (
      <button className="btn btn-primary" onClick={connect} disabled={connecting}>
        {connecting ? <Spinner /> : <Wallet size={16} />}
        {hasMetaMask ? "Connect wallet" : "Install MetaMask"}
      </button>
    );
  }

  if (wrongNetwork) {
    return (
      <button className="btn btn-ghost !text-amber" onClick={switchNetwork}>
        <AlertTriangle size={16} /> Switch to {ACTIVE_CHAIN.short}
      </button>
    );
  }

  const role = isAdmin ? "Admin" : isRegistrar ? "Registrar" : "Owner";

  return (
    <div className="flex items-center gap-2">
      <span className="pill pill-sky hidden sm:inline-flex">{ACTIVE_CHAIN.short}</span>
      <span className="pill pill-primary inline-flex">
        {(isAdmin || isRegistrar) && <ShieldCheck size={12} />} {role}
      </span>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-emerald" />
        <span className="mono text-xs">{shortAddr(account, 4)}</span>
        <button onClick={disconnect} aria-label="Disconnect" className="text-muted hover:text-rose">
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
