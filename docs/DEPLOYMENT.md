# Deployment Checklist

## A. Smart contract → Sepolia

- [ ] Fund the deployer wallet with Sepolia ETH (e.g. a public faucet).
- [ ] Copy `.env.example` → `.env` and set:
  - [ ] `SEPOLIA_RPC_URL` (Alchemy/Infura endpoint)
  - [ ] `DEPLOYER_PRIVATE_KEY` (becomes admin + first registrar)
  - [ ] `ETHERSCAN_API_KEY`
- [ ] `npm run compile` — compiles cleanly.
- [ ] `npm test` — all tests pass.
- [ ] `npm run deploy:sepolia`
  - Deploys `LandRegistry`.
  - Writes `frontend/src/contracts/{deployment.json,landRegistry.ts}`.
  - Verifies source on Etherscan (after 5 confirmations).
- [ ] **Record the contract address** printed by the script.

## B. (Optional) Seed synthetic data on Sepolia

Local Hardhat is the intended demo environment (it needs 8 funded accounts and
block-time control). On Sepolia, seed only if you have multiple funded keys;
otherwise demo via the bundled snapshot. For local:

```bash
npm run node          # terminal 1
npm run seed:local    # terminal 2  (deploys + seeds + wires the frontend)
```

## C. Frontend → Vercel

- [ ] Set the Vercel project **root directory** to `frontend/`.
- [ ] Framework preset: **Vite** (or rely on `vercel.json`).
- [ ] Environment variables (Project → Settings → Environment Variables):
  - [ ] `VITE_CONTRACT_ADDRESS` = the deployed address
  - [ ] `VITE_CHAIN_ID` = `11155111`
  - [ ] `VITE_IPFS_GATEWAY` = `https://gateway.pinata.cloud/ipfs/`
  - [ ] `VITE_PUBLIC_RPC_URL` = a Sepolia read RPC (enables wallet-free Public Verify)
  - [ ] `PINATA_JWT` = **server-only** (used by `api/pin.ts`; never prefixed `VITE_`)
- [ ] Deploy. Confirm `/api/pin` responds and client routes resolve (SPA rewrite).
- [ ] Smoke test: Landing → Dashboard (Live) → Public Verify a known id → tamper check.

## D. Record your live values

| Item | Value |
|---|---|
| Contract address | `0x… (fill in)` |
| Etherscan link | `https://sepolia.etherscan.io/address/0x…` |
| Deployer / Registrar address | `0x…` |
| App URL (Vercel) | `https://… (fill in)` |
| Network / chainId | Sepolia / 11155111 |

## E. Post-deploy verification

- [ ] Etherscan shows **Verified** source.
- [ ] `getStats()` readable from the app.
- [ ] A fresh wallet can submit a property (Pending).
- [ ] Registrar wallet can approve/reject.
- [ ] A transfer initiates + accepts across two wallets.
- [ ] Verify Document shows MATCH for the original file and TAMPERED for any other.
- [ ] No console errors in normal flows; production build has zero TypeScript errors.
