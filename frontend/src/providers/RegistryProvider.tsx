import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useWallet } from "./WalletProvider";
import { loadLiveSnapshot } from "../lib/registryService";
import type { IndexedProperty, IndexedTransfer, IndexedWallet } from "../types";
import rawIndex from "../data/registryIndex.json";

const demoIndex = rawIndex as unknown as {
  network: string;
  contractAddress: string;
  ipfsMocked: boolean;
  gateway: string;
  wallets: IndexedWallet[];
  properties: IndexedProperty[];
  transfers: IndexedTransfer[];
  flaggedForReview: { propertyId: string; reason: string }[];
};

export interface Snapshot {
  source: "demo" | "live";
  properties: IndexedProperty[];
  transfers: IndexedTransfer[];
  wallets: IndexedWallet[];
  flaggedForReview: { propertyId: string; reason: string }[];
  stats: { pending: number; registered: number; rejected: number; total: number };
  contractAddress: string;
  ipfsMocked: boolean;
  network: string;
}

function computeStats(props: IndexedProperty[]) {
  let pending = 0,
    registered = 0,
    rejected = 0,
    total = 0;
  for (const p of props) {
    if (p.onChainStatus === "Reverted") continue;
    total++;
    if (p.onChainStatus === "Registered") registered++;
    else if (p.onChainStatus === "Pending") pending++;
    else if (p.onChainStatus === "Rejected") rejected++;
  }
  return { pending, registered, rejected, total };
}

const demoSnapshot: Snapshot = {
  source: "demo",
  properties: demoIndex.properties,
  transfers: demoIndex.transfers,
  wallets: demoIndex.wallets,
  flaggedForReview: demoIndex.flaggedForReview,
  stats: computeStats(demoIndex.properties),
  contractAddress: demoIndex.contractAddress,
  ipfsMocked: demoIndex.ipfsMocked,
  network: demoIndex.network,
};

interface RegistryCtx {
  demo: boolean;
  setDemo: (v: boolean) => void;
  loading: boolean;
  snapshot: Snapshot;
  refresh: () => Promise<void>;
  tourOpen: boolean;
  setTourOpen: (v: boolean) => void;
}

const Ctx = createContext<RegistryCtx>(null as never);

export function RegistryProvider({ children }: { children: ReactNode }) {
  const { account, wrongNetwork, provider } = useWallet();
  const [demo, setDemoState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("demoMode");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });
  const [snapshot, setSnapshot] = useState<Snapshot>(demoSnapshot);
  const [loading, setLoading] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const setDemo = useCallback((v: boolean) => {
    setDemoState(v);
    try {
      localStorage.setItem("demoMode", String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    if (demo || !account || wrongNetwork || !provider) {
      setSnapshot(demoSnapshot);
      return;
    }
    setLoading(true);
    try {
      const live = await loadLiveSnapshot(provider);
      setSnapshot({
        source: "live",
        ...live,
        contractAddress: demoIndex.contractAddress,
        ipfsMocked: false,
        network: "live",
      });
    } catch {
      setSnapshot(demoSnapshot);
    } finally {
      setLoading(false);
    }
  }, [demo, account, wrongNetwork, provider]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ demo, setDemo, loading, snapshot, refresh, tourOpen, setTourOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export const useRegistry = () => useContext(Ctx);
