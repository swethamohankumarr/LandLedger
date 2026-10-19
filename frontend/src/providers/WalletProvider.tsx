import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { BrowserProvider, Contract, ContractTransactionResponse } from "ethers";
import { ABI, CONTRACT_ADDRESS, ACTIVE_CHAIN, CHAIN_ID } from "../config";
import { REGISTRAR_ROLE, DEFAULT_ADMIN_ROLE } from "../lib/registryService";
import { decodeError } from "../lib/contractErrors";
import { useToast } from "./ToastProvider";

export type TxStep = "signing" | "submitted" | "confirming" | "confirmed" | "failed";
export interface TrackedTx {
  id: number;
  label: string;
  step: TxStep;
  hash?: string;
  error?: string;
}

interface WalletCtx {
  hasMetaMask: boolean;
  account: string | null;
  chainId: number | null;
  wrongNetwork: boolean;
  connecting: boolean;
  isRegistrar: boolean;
  isAdmin: boolean;
  provider: BrowserProvider | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  runTx: (
    label: string,
    build: (c: Contract) => Promise<ContractTransactionResponse>
  ) => Promise<{ ok: boolean; error?: string }>;
  txs: TrackedTx[];
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  clearTxs: () => void;
}

const Ctx = createContext<WalletCtx>(null as never);

export function WalletProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const hasMetaMask = typeof window !== "undefined" && !!window.ethereum;
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [isRegistrar, setIsRegistrar] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [txs, setTxs] = useState<TrackedTx[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const providerRef = useRef<BrowserProvider | null>(null);

  const wrongNetwork = chainId !== null && chainId !== CHAIN_ID;

  const refreshRoles = useCallback(async (addr: string) => {
    const provider = providerRef.current;
    if (!provider) return;
    try {
      const c = new Contract(CONTRACT_ADDRESS, ABI as never, provider);
      const [reg, adm] = await Promise.all([
        c.hasRole(REGISTRAR_ROLE, addr) as Promise<boolean>,
        c.hasRole(DEFAULT_ADMIN_ROLE, addr) as Promise<boolean>,
      ]);
      setIsRegistrar(reg);
      setIsAdmin(adm);
    } catch {
      setIsRegistrar(false);
      setIsAdmin(false);
    }
  }, []);

  const initFrom = useCallback(
    async (accounts: string[]) => {
      if (!window.ethereum || accounts.length === 0) {
        setAccount(null);
        providerRef.current = null;
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      providerRef.current = provider;
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));
      setAccount(accounts[0]);
      await refreshRoles(accounts[0]);
    },
    [refreshRoles]
  );

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      toast.error("MetaMask not found", "Install the MetaMask extension to use live mode.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      await initFrom(accounts);
    } catch (e) {
      toast.error("Connection failed", decodeError(e));
    } finally {
      setConnecting(false);
    }
  }, [initFrom, toast]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setIsRegistrar(false);
    setIsAdmin(false);
    providerRef.current = null;
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    const hexId = "0x" + CHAIN_ID.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (e) {
      const err = e as { code?: number };
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexId,
                chainName: ACTIVE_CHAIN.name,
                rpcUrls: [ACTIVE_CHAIN.rpc],
                nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
                blockExplorerUrls: ACTIVE_CHAIN.explorer ? [ACTIVE_CHAIN.explorer] : [],
              },
            ],
          });
        } catch (addErr) {
          toast.error("Could not add network", decodeError(addErr));
        }
      } else {
        toast.error("Could not switch network", decodeError(e));
      }
    }
  }, [toast]);

  // Restore an already-authorised connection + subscribe to events.
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((a) => initFrom(a as string[]))
      .catch(() => {});

    const onAccounts = (...args: unknown[]) => initFrom(args[0] as string[]);
    const onChain = () => window.location.reload();
    window.ethereum.on("accountsChanged", onAccounts as never);
    window.ethereum.on("chainChanged", onChain as never);
    return () => {
      window.ethereum?.removeListener("accountsChanged", onAccounts as never);
      window.ethereum?.removeListener("chainChanged", onChain as never);
    };
  }, [initFrom]);

  const runTx = useCallback<WalletCtx["runTx"]>(
    async (label, build) => {
      const provider = providerRef.current;
      if (!provider) {
        toast.error("Wallet not connected");
        return { ok: false, error: "Wallet not connected" };
      }
      if (wrongNetwork) {
        toast.error("Wrong network", `Switch to ${ACTIVE_CHAIN.name} first.`);
        return { ok: false, error: "Wrong network" };
      }
      const id = Date.now() + Math.random();
      const update = (patch: Partial<TrackedTx>) =>
        setTxs((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));

      setTxs((list) => [{ id, label, step: "signing" as TxStep }, ...list].slice(0, 8));
      setDrawerOpen(true);

      try {
        const signer = await provider.getSigner();
        const c = new Contract(CONTRACT_ADDRESS, ABI as never, signer);
        const tx = await build(c);
        update({ step: "submitted", hash: tx.hash });
        update({ step: "confirming" });
        await tx.wait();
        update({ step: "confirmed" });
        if (account) await refreshRoles(account);
        toast.success(`${label} confirmed`);
        return { ok: true };
      } catch (e) {
        const msg = decodeError(e);
        update({ step: "failed", error: msg });
        toast.error(`${label} failed`, msg);
        return { ok: false, error: msg };
      }
    },
    [account, refreshRoles, toast, wrongNetwork]
  );

  return (
    <Ctx.Provider
      value={{
        hasMetaMask,
        account,
        chainId,
        wrongNetwork,
        connecting,
        isRegistrar,
        isAdmin,
        provider: providerRef.current,
        connect,
        disconnect,
        switchNetwork,
        runTx,
        txs,
        drawerOpen,
        setDrawerOpen,
        clearTxs: () => setTxs([]),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useWallet = () => useContext(Ctx);
