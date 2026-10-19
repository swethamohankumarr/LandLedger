/**
 * IPFS upload helper. Uses Pinata when PINATA_JWT is set; otherwise falls back
 * to a clearly-logged local mock that produces a deterministic pseudo-CID and
 * copies the file into data/.mock-ipfs so the pipeline still runs end-to-end
 * without any secret.
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const MOCK_DIR = path.join(__dirname, "..", "..", "data", ".mock-ipfs");

export interface PinResult {
  cid: string;
  mocked: boolean;
}

/** keccak256-free content fingerprint used only to mint a stable mock CID. */
function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export async function pinFile(fileName: string, bytes: Buffer): Promise<PinResult> {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    fs.mkdirSync(MOCK_DIR, { recursive: true });
    const cid = `bafymock${sha256(bytes).slice(0, 46)}`;
    fs.writeFileSync(path.join(MOCK_DIR, `${cid}.pdf`), bytes);
    return { cid, mocked: true };
  }

  const form = new FormData();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  form.append("file", blob, fileName);
  form.append("pinataMetadata", JSON.stringify({ name: fileName }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata upload failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { IpfsHash: string };
  return { cid: json.IpfsHash, mocked: false };
}
