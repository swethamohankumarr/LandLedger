/**
 * Deploys LandRegistry, writes address + ABI into the frontend, and (on a public
 * network with an Etherscan key) verifies the source.
 *
 *   npm run deploy:local     # against a running `npm run node`
 *   npm run deploy:sepolia   # requires SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY
 */
import { ethers, network, run, artifacts } from "hardhat";
import { writeFrontendContract } from "./lib/output";
import type { LandRegistry } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`Deploying with ${await deployer.getAddress()} on ${network.name} (chainId ${chainId})`);

  const Factory = await ethers.getContractFactory("LandRegistry");
  const registry = (await Factory.deploy()) as unknown as LandRegistry;
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`LandRegistry deployed to: ${address}`);

  const abi = (await artifacts.readArtifact("LandRegistry")).abi;
  writeFrontendContract({ address, chainId, network: network.name, abi });
  console.log("Wrote frontend/src/contracts/{deployment.json,landRegistry.ts}");

  // Verify on Etherscan for public networks.
  if (network.name !== "hardhat" && network.name !== "localhost" && process.env.ETHERSCAN_API_KEY) {
    console.log("Waiting for 5 confirmations before verification...");
    await registry.deploymentTransaction()?.wait(5);
    try {
      await run("verify:verify", { address, constructorArguments: [] });
      console.log("Verified on Etherscan.");
    } catch (e: any) {
      console.warn("Verification skipped/failed:", e?.message ?? e);
    }
  }

  console.log("\nNext steps:");
  console.log("  - Record the contract address above.");
  console.log(`  - Etherscan (Sepolia): https://sepolia.etherscan.io/address/${address}`);
  console.log("  - Set VITE_CONTRACT_ADDRESS in frontend/.env to this address (optional; the generated module is used by default).");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
