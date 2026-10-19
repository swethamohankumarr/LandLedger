/**
 * Seeds a LandRegistry with the synthetic dataset end-to-end:
 *   1. deploys a fresh contract and wires its address/ABI into the frontend
 *   2. maps wallet_id -> signer (Hardhat accounts locally)
 *   3. uploads each deed to IPFS (Pinata or a logged local mock) + keccak256
 *   4. submits every property from its owner, approving/rejecting per dataset
 *   5. replays transfers.csv in order (initiate -> accept)
 *   6. catches expected reverts (duplicate guards) and flags, prints a summary
 *   7. writes data/seed-report.json + frontend/src/data/registryIndex.json
 *
 * On a local network the simulated clock is anchored at node start and advanced
 * by each event's calendar offset, so the on-chain 24h flag window and the
 * off-chain 30-day flip window behave exactly as the dataset intends.
 *
 *   npx hardhat node           # terminal 1
 *   npm run seed:local         # terminal 2
 */
import { ethers, network, artifacts } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import * as fs from "fs";
import * as path from "path";
import { pinFile } from "./lib/ipfs";
import { writeFrontendContract } from "./lib/output";
import { WALLETS, PROPERTIES, TRANSFERS, PropertyRow, TransferRow } from "./lib/dataset";
import type { LandRegistry } from "../typechain-types";

const DATA_DIR = path.join(__dirname, "..", "data");
const DOCS_DIR = path.join(DATA_DIR, "documents");
const DEMO_DOCS_DIR = path.join(__dirname, "..", "frontend", "public", "demo-docs");
const FE_DATA_DIR = path.join(__dirname, "..", "frontend", "src", "data");
const GATEWAY = process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

const DAY = 24 * 60 * 60;
const isLocal = network.name === "hardhat" || network.name === "localhost";

interface Outcome {
  property_ref: string;
  scenario: string;
  outcome: string;
  reason: string;
}

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length < WALLETS.length) {
    throw new Error(
      `Seeding needs ${WALLETS.length} signer accounts (W0..W7) but only ${signers.length} are available.\n` +
        `Run against a local Hardhat node (npm run node) for the full demo. For a public testnet, ` +
        `provide multiple funded keys — single-key Sepolia seeding is not supported.`
    );
  }

  // W0 = deployer/registrar, W1..W7 = owners.
  const walletSigner = new Map<string, (typeof signers)[number]>();
  WALLETS.forEach((w, i) => walletSigner.set(w.wallet_id, signers[i]));
  const walletAddress = new Map<string, string>();
  for (const w of WALLETS) walletAddress.set(w.wallet_id, await walletSigner.get(w.wallet_id)!.getAddress());

  const registrar = walletSigner.get("W0")!;

  console.log(`\nNetwork: ${network.name}`);
  console.log(`Registrar (W0): ${await registrar.getAddress()}`);

  // 1. Deploy fresh contract.
  const Factory = await ethers.getContractFactory("LandRegistry", registrar);
  const registry = (await Factory.deploy()) as unknown as LandRegistry;
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const abi = (await artifacts.readArtifact("LandRegistry")).abi;
  writeFrontendContract({ address, chainId, network: network.name, abi });
  console.log(`Deployed LandRegistry at ${address} (chainId ${chainId})`);

  const jwtSet = !!process.env.PINATA_JWT;
  console.log(jwtSet ? "IPFS: Pinata (live)" : "IPFS: LOCAL MOCK (no PINATA_JWT set) — CIDs are synthetic\n");

  // Clock anchor for deterministic local timeline.
  const baseDate = Math.floor(new Date(PROPERTIES[0].submitted_date).getTime() / 1000);
  const latestBlock = await ethers.provider.getBlock("latest");
  const nodeStart = latestBlock ? latestBlock.timestamp + 10 : Math.floor(Date.now() / 1000);
  let lastTs = nodeStart - 1;

  async function advanceTo(dateStr: string) {
    if (!isLocal) return;
    const offset = Math.floor(new Date(dateStr).getTime() / 1000) - baseDate;
    const target = Math.max(nodeStart + offset, lastTs + 1);
    await time.setNextBlockTimestamp(target);
    lastTs = target;
  }

  // Deed uploads: cache by document_file so a reused file yields an identical hash.
  const cidByFile = new Map<string, string>();
  const hashByFile = new Map<string, string>();
  fs.mkdirSync(DEMO_DOCS_DIR, { recursive: true });

  async function prepareDeed(file: string): Promise<{ cid: string; hash: string }> {
    if (cidByFile.has(file)) return { cid: cidByFile.get(file)!, hash: hashByFile.get(file)! };
    const bytes = fs.readFileSync(path.join(DOCS_DIR, file));
    const hash = ethers.keccak256(bytes);
    const { cid, mocked } = await pinFile(file, bytes);
    if (mocked) fs.copyFileSync(path.join(DOCS_DIR, file), path.join(DEMO_DOCS_DIR, file));
    cidByFile.set(file, cid);
    hashByFile.set(file, hash);
    return { cid, hash };
  }

  const outcomes: Outcome[] = [];
  const indexProps: any[] = [];
  const flaggedEvents: { propertyId: string; reason: string }[] = [];
  const refToId = new Map<string, bigint>();

  // 4. Submit every property in chronological order.
  const propsByDate = [...PROPERTIES].sort(
    (a, b) => +new Date(a.submitted_date) - +new Date(b.submitted_date)
  );

  for (const p of propsByDate) {
    await submitOne(p);
  }

  async function submitOne(p: PropertyRow) {
    const owner = walletSigner.get(p.owner_wallet_id)!;
    const { cid, hash } = await prepareDeed(p.document_file);
    const docUrl = jwtSet ? `${GATEWAY}${cid}` : `/demo-docs/${p.document_file}`;

    const base = {
      property_ref: p.property_ref,
      owner_wallet_id: p.owner_wallet_id,
      ownerAddress: walletAddress.get(p.owner_wallet_id)!,
      location: p.location,
      city: p.city,
      area_sqm: p.area_sqm,
      property_type: p.property_type,
      survey_number: p.survey_number,
      document_file: p.document_file,
      documentCID: cid,
      documentHash: hash,
      docUrl,
      submitted_date: p.submitted_date,
      scenario: p.scenario,
      notes: p.notes,
      datasetStatus: p.status,
    };

    await advanceTo(p.submitted_date);
    try {
      const tx = await registry
        .connect(owner)
        .submitProperty(p.location, p.survey_number, p.area_sqm, p.property_type, cid, hash);
      const receipt = await tx.wait();

      // Discover the new id + any FlaggedForReview in this tx.
      let id = 0n;
      let flaggedReason = "";
      for (const log of receipt!.logs) {
        try {
          const parsed = registry.interface.parseLog(log);
          if (parsed?.name === "PropertySubmitted") id = parsed.args[0] as bigint;
          if (parsed?.name === "FlaggedForReview") {
            flaggedReason = parsed.args[1] as string;
            flaggedEvents.push({ propertyId: (parsed.args[0] as bigint).toString(), reason: flaggedReason });
          }
        } catch {
          /* non-registry log */
        }
      }
      refToId.set(p.property_ref, id);

      // Registrar decision.
      let onChainStatus = "Pending";
      let outcome = "Submitted (Pending)";
      let reason = flaggedReason || p.notes;

      if (p.status === "Registered") {
        await advanceTo(p.submitted_date);
        await (await registry.connect(registrar).approveProperty(id)).wait();
        onChainStatus = "Registered";
        outcome = "Registered";
      } else if (p.status === "Rejected") {
        await advanceTo(p.submitted_date);
        const rej =
          p.scenario === "INVALID_SURVEY_FORMAT"
            ? "Survey number fails required format AAA/NN/NNN-X"
            : "Deed failed Registrar manual verification";
        await (await registry.connect(registrar).rejectProperty(id, rej)).wait();
        onChainStatus = "Rejected";
        outcome = "Rejected by Registrar";
        reason = rej;
      } else if (p.status === "Flagged") {
        outcome = flaggedReason ? "Submitted + FLAGGED" : "Submitted (Pending)";
      }

      indexProps.push({ ...base, onChainId: id.toString(), onChainStatus, flagged: !!flaggedReason, outcome, reason });
      outcomes.push({ property_ref: p.property_ref, scenario: p.scenario, outcome, reason });
      console.log(`  ${p.property_ref} [${p.scenario}] -> ${outcome}`);
    } catch (err: any) {
      const reason = decodeRevert(err, registry.interface);
      indexProps.push({ ...base, onChainId: null, onChainStatus: "Reverted", flagged: false, outcome: "Reverted", reason });
      outcomes.push({ property_ref: p.property_ref, scenario: p.scenario, outcome: "Reverted (rejected on-chain)", reason });
      console.log(`  ${p.property_ref} [${p.scenario}] -> REVERTED: ${reason}`);
    }
  }

  // 5. Replay transfers in chronological order.
  const indexTransfers: any[] = [];
  const transfersByDate = [...TRANSFERS].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  console.log("\nReplaying transfers:");
  for (const t of transfersByDate) {
    await replayTransfer(t);
  }

  async function replayTransfer(t: TransferRow) {
    const id = refToId.get(t.property_ref);
    const from = walletSigner.get(t.from_wallet_id)!;
    const to = walletSigner.get(t.to_wallet_id)!;
    const row = {
      transfer_id: t.transfer_id,
      property_ref: t.property_ref,
      from_wallet_id: t.from_wallet_id,
      to_wallet_id: t.to_wallet_id,
      fromAddress: walletAddress.get(t.from_wallet_id)!,
      toAddress: walletAddress.get(t.to_wallet_id)!,
      date: t.date,
      scenario: t.scenario,
      outcome: "",
    };
    try {
      if (id === undefined) throw new Error(`property ${t.property_ref} was never registered`);
      await advanceTo(t.date);
      await (await registry.connect(from).initiateTransfer(id, await to.getAddress())).wait();
      await advanceTo(t.date);
      await (await registry.connect(to).acceptTransfer(id)).wait();
      row.outcome = "Completed";
      console.log(`  ${t.transfer_id} ${t.property_ref} ${t.from_wallet_id}->${t.to_wallet_id} [${t.scenario}] -> Completed`);
    } catch (err: any) {
      row.outcome = `Failed: ${decodeRevert(err, registry.interface)}`;
      console.log(`  ${t.transfer_id} ${t.property_ref} -> ${row.outcome}`);
    }
    indexTransfers.push(row);
  }

  // After replaying transfers, reflect FINAL ownership in the off-chain index
  // so the demo snapshot's "current owner" matches the on-chain state.
  for (const t of transfersByDate) {
    if (!t) continue;
    const row = indexTransfers.find((r) => r.transfer_id === t.transfer_id);
    if (row?.outcome !== "Completed") continue;
    const prop = indexProps.find((p) => p.property_ref === t.property_ref);
    if (prop) {
      prop.owner_wallet_id = t.to_wallet_id;
      prop.ownerAddress = walletAddress.get(t.to_wallet_id)!;
    }
  }

  // 6. Summary table.
  console.log("\n================ SEED SUMMARY ================");
  console.log("property_ref | scenario              | outcome                     | reason");
  console.log("-------------|-----------------------|-----------------------------|---------------------------");
  for (const o of outcomes) {
    console.log(
      `${o.property_ref.padEnd(12)} | ${o.scenario.padEnd(21)} | ${o.outcome.padEnd(27)} | ${o.reason.slice(0, 40)}`
    );
  }
  const [pending, registered, rejected, total] = await registry.getStats();
  console.log("\nOn-chain stats:", { pending: +pending.toString(), registered: +registered.toString(), rejected: +rejected.toString(), total: +total.toString() });

  // 7. Write reports.
  fs.mkdirSync(FE_DATA_DIR, { recursive: true });
  const registryIndex = {
    generatedAt: new Date().toISOString(),
    synthetic: true,
    network: network.name,
    chainId,
    contractAddress: address,
    ipfsMocked: !jwtSet,
    gateway: GATEWAY,
    wallets: WALLETS.map((w) => ({ ...w, address: walletAddress.get(w.wallet_id)! })),
    properties: indexProps,
    transfers: indexTransfers,
    flaggedForReview: flaggedEvents,
  };
  fs.writeFileSync(path.join(FE_DATA_DIR, "registryIndex.json"), JSON.stringify(registryIndex, null, 2));

  const flaggedRows = outcomes.filter(
    (o) => o.outcome.includes("FLAG") || o.outcome.includes("Reverted") || o.outcome.includes("Rejected")
  );
  const seedReport = {
    generatedAt: new Date().toISOString(),
    synthetic: true,
    network: network.name,
    contractAddress: address,
    counts: {
      total: PROPERTIES.length,
      registered: Number(registered),
      rejected: Number(rejected),
      pending: Number(pending),
      reverted: outcomes.filter((o) => o.outcome.startsWith("Reverted")).length,
      flagged: flaggedEvents.length,
    },
    rows: outcomes,
    suspicious: flaggedRows,
    flaggedForReview: flaggedEvents,
    transfers: indexTransfers,
  };
  fs.writeFileSync(path.join(DATA_DIR, "seed-report.json"), JSON.stringify(seedReport, null, 2));

  console.log(`\nWrote frontend/src/data/registryIndex.json and data/seed-report.json`);
  console.log("Done.\n");
}

/** Decodes a custom-error / revert reason into a human string. */
function decodeRevert(err: any, iface?: { parseError: (data: string) => any }): string {
  if (err?.revert?.name) {
    const args = (err.revert.args ?? []).map((a: unknown) => String(a)).join(", ");
    return args ? `${err.revert.name}(${args})` : err.revert.name;
  }
  const data: unknown = err?.data ?? err?.info?.error?.data ?? err?.error?.data;
  if (iface && typeof data === "string" && data.startsWith("0x")) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) {
        const args = (parsed.args ?? []).map((a: unknown) => String(a)).join(", ");
        return args ? `${parsed.name}(${args})` : parsed.name;
      }
    } catch {
      /* fall through */
    }
  }
  return err?.shortMessage || err?.reason || err?.message?.split("\n")[0] || "unknown error";
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
