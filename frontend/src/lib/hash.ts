import { keccak256 } from "ethers";

/** keccak256 of a file's raw bytes — identical to the contract's documentHash. */
export async function hashFile(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return keccak256(buf);
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  return keccak256(bytes);
}
