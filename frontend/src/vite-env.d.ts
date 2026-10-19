/// <reference types="vite/client" />

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on(event: string, handler: (...args: never[]) => void): void;
  removeListener(event: string, handler: (...args: never[]) => void): void;
  isMetaMask?: boolean;
}

interface Window {
  ethereum?: Eip1193Provider;
}

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_IPFS_GATEWAY?: string;
  readonly VITE_PUBLIC_RPC_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
