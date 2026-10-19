/**
 * Client-side IPFS pinning. Uploads go to the serverless function at /api/pin
 * so the Pinata JWT NEVER reaches the browser. When the function is unavailable
 * (e.g. local `vite dev` without `vercel dev`), we return a deterministic mock
 * CID so the Register flow can still be demonstrated end-to-end — clearly
 * flagged as mocked to the caller.
 */
import { keccak256, toUtf8Bytes } from "ethers";

export interface PinOutcome {
  cid: string;
  mocked: boolean;
}

export async function pinFileToIpfs(file: File): Promise<PinOutcome> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/pin", { method: "POST", body: form });
    if (res.ok) {
      const json = (await res.json()) as { cid: string };
      if (json.cid) return { cid: json.cid, mocked: false };
    }
  } catch {
    /* fall through to mock */
  }
  // Deterministic mock CID derived from name + size (no secret needed).
  const seed = keccak256(toUtf8Bytes(`${file.name}:${file.size}:${file.lastModified}`));
  return { cid: `bafymock${seed.slice(2, 48)}`, mocked: true };
}
