import { LAND_REGISTRY_ADDRESS, LAND_REGISTRY_CHAIN_ID, LAND_REGISTRY_ABI } from "./contracts/landRegistry";

/**
 * Centralised, env-validated config. The ONLY client-public contract value is
 * the address. Pinata uploads go through the serverless function at /api/pin so
 * the JWT stays server-side.
 */

export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) || LAND_REGISTRY_ADDRESS;

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? LAND_REGISTRY_CHAIN_ID);

export const ABI = LAND_REGISTRY_ABI;

export const IPFS_GATEWAY =
  (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) || "https://gateway.pinata.cloud/ipfs/";

/** Public read-only RPC used by the Public Verify page (no wallet required). */
export const PUBLIC_RPC_URL = import.meta.env.VITE_PUBLIC_RPC_URL as string | undefined;

export const SEPOLIA_CHAIN_ID = 11155111;
export const LOCALHOST_CHAIN_ID = 31337;

export interface ChainMeta {
  id: number;
  name: string;
  short: string;
  explorer: string;
  rpc: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const CHAINS: Record<number, ChainMeta> = {
  [SEPOLIA_CHAIN_ID]: {
    id: SEPOLIA_CHAIN_ID,
    name: "Sepolia Testnet",
    short: "Sepolia",
    explorer: "https://sepolia.etherscan.io",
    rpc: "https://rpc.sepolia.org",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  [LOCALHOST_CHAIN_ID]: {
    id: LOCALHOST_CHAIN_ID,
    name: "Hardhat Localhost",
    short: "Localhost",
    explorer: "",
    rpc: "http://127.0.0.1:8545",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
};

export const ACTIVE_CHAIN: ChainMeta =
  CHAINS[CHAIN_ID] ?? CHAINS[LOCALHOST_CHAIN_ID];

export function explorerTx(hash: string): string {
  return ACTIVE_CHAIN.explorer ? `${ACTIVE_CHAIN.explorer}/tx/${hash}` : "";
}
export function explorerAddress(addr: string): string {
  return ACTIVE_CHAIN.explorer ? `${ACTIVE_CHAIN.explorer}/address/${addr}` : "";
}
