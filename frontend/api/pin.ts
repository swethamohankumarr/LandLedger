/**
 * Vercel Edge Function — pins an uploaded file to IPFS via Pinata.
 *
 * The Pinata JWT lives ONLY in the server environment (PINATA_JWT) and is never
 * shipped to the browser. The client posts multipart form-data to /api/pin and
 * receives just the resulting CID.
 */
export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return new Response(JSON.stringify({ error: "PINATA_JWT not configured on the server" }), {
      status: 501,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const inForm = await req.formData();
    const file = inForm.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const out = new FormData();
    out.append("file", file, file.name || "deed");
    out.append("pinataMetadata", JSON.stringify({ name: file.name || "deed" }));

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: out,
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Pinata error: ${text}` }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const json = (await res.json()) as { IpfsHash: string };
    return new Response(JSON.stringify({ cid: json.IpfsHash }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
