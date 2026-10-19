# Test Report

## Summary

| Suite | Tool | Tests | Result |
|---|---|---|---|
| Smart contract | Hardhat + Chai + hardhat-network-helpers | **48** | ✅ all passing |
| Risk-scoring library | Vitest | **13** | ✅ all passing |

## Contract coverage (`npx hardhat coverage`)

| File | % Stmts | % Branch | % Funcs | % Lines |
|---|---|---|---|---|
| `LandRegistry.sol` | **100** | **89.36** | **100** | **100** |

> Statements, functions and lines are at **100%**. Branch coverage is **89.36%**.
> The uncovered branches are defensive genesis-time ternaries of the form
> `block.timestamp > SUBMISSION_WINDOW ? … : 0` (the `: 0` path is only reachable
> within the first 24h of chain genesis) — they cannot occur on a live chain and
> carry no logic risk.

## Reproduce

```bash
# contract
npm run compile
npm test
npm run coverage        # writes ./coverage/ and ./coverage.json

# risk library
cd frontend && npm test

# full type-check + production build (zero TS errors)
cd frontend && npm run build
```

## Contract test matrix

| Area | Cases |
|---|---|
| Deployment & roles | deployer has admin + registrar; arbitrary accounts don't; empty initial stats |
| `submitProperty` | happy path + event; auto-increment ids; each empty field + zero area reverts; duplicate hash; duplicate survey+location; same survey different location allowed |
| `approveProperty` | registrar approves + event + stats; non-registrar blocked; non-pending reverts; non-existent reverts |
| `rejectProperty` | registrar rejects + reason + event + stats; empty reason reverts; non-pending reverts |
| `initiateTransfer` | owner initiates + event + incoming index; non-owner blocked; Pending/Rejected blocked; zero buyer; self-transfer; double pending |
| `acceptTransfer` | buyer accepts, ownership moves, history appended, pending cleared; wrong buyer; no active pending; multi-transfer history correctness; owner-index swap-and-pop |
| `cancelTransfer` | owner cancels + event; non-owner blocked; no active pending; re-initiation after cancel |
| Verification | `verifyDocument` match/mismatch + non-existent reverts; `verifyOwner`; `getProperty`/`getHistory` non-existent revert |
| Pagination & stats | `getAllPropertyIds` pages + overflow; `getStats` across lifecycle |
| Pause | blocks submit/transfer; resumes on unpause; only registrar can pause/unpause |
| Role management | grant/revoke registrar take effect + events; zero-address grant reverts; non-admin blocked |
| `FlaggedForReview` | emits on 4th submission in 24h; not flagged beyond window; not flagged across different wallets |
| Reentrancy guard | `acceptTransfer` happy path under `nonReentrant` |

## Risk-library test matrix (`riskScore.test.ts`)

Survey-pattern validation; clean property → Low/0; unknown ref; invalid survey
format; missing document; reused document hash; duplicate survey+location; bulk
submissions in 24h; rapid flip (3-in-30-days) positive and negative; circular
trade; score cap at 100 + level escalation; `scoreAll` descending-risk ordering.
