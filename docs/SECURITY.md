# Security Audit & Threat Model — `LandRegistry.sol`

This document is the Phase 2 self-audit. It applies manual Slither-style reasoning
to the contract and records what was checked, what is mitigated, and what is an
**accepted** trust assumption (documented honestly rather than hidden).

**Scope:** `contracts/LandRegistry.sol`, compiled with Solidity `0.8.20`
(optimizer on, 200 runs, EVM `paris`), using OpenZeppelin Contracts v5
(`AccessControl`, `ReentrancyGuard`, `Pausable`).

**Test evidence:** 48 passing tests; 100% statement / 100% function / 100% line
coverage, 89.4% branch coverage (`npx hardhat coverage`). See
[TEST_REPORT.md](./TEST_REPORT.md).

---

## 1. Honest security posture

The blockchain layer provides **tamper-resistant records, a transparent
append-only history, and rule-based transfers**. It does **not** eliminate
fraud. In particular it cannot tell whether a submitted deed is genuine — that
is why a trusted **Registrar** must approve every initial registration
("garbage in, garbage out"). The threat model below separates what the code
enforces from what it deliberately trusts a human/off-chain process to do.

---

## 2. Findings by category

### 2.1 Access control
| Risk | Status | Mitigation |
|---|---|---|
| Unauthorized approval/rejection | **Mitigated** | `approveProperty`/`rejectProperty` gated by `onlyRole(REGISTRAR_ROLE)`. Tested: non-registrar reverts with `AccessControlUnauthorizedAccount`. |
| Unauthorized transfer | **Mitigated** | `initiateTransfer`/`cancelTransfer` require `msg.sender == owner`; `acceptTransfer` requires the caller to be the named buyer. |
| Unauthorized role management | **Mitigated** | `grantRegistrar`/`revokeRegistrar` gated by `onlyRole(DEFAULT_ADMIN_ROLE)`. Zero-address grant rejected. |
| Unauthorized pause | **Mitigated** | `pause`/`unpause` gated by `REGISTRAR_ROLE`. |
| Privilege escalation via `AccessControl` | **Mitigated** | Uses OZ v5 `AccessControl`; `REGISTRAR_ROLE`'s admin is the default admin role. No custom role-admin wiring that could grant self-escalation. |

### 2.2 Reentrancy
| Risk | Status | Mitigation |
|---|---|---|
| Reentrancy on state-changing paths | **Mitigated / N/A** | The contract makes **no external calls** (no ETH transfers, no token callbacks, no arbitrary `call`). `acceptTransfer` additionally carries `nonReentrant` as defence-in-depth so future changes that add external calls stay safe. State updates follow checks-effects-interactions ordering. |

### 2.3 Front-running / MEV
| Risk | Status | Mitigation / Acceptance |
|---|---|---|
| Front-running `submitProperty` to claim a survey/hash first | **Partially mitigated** | First-come-first-served on `(survey, location)` and on `documentHash` means an attacker who sees a mempool submission could try to register the same survey first. **Accepted + mitigated:** the Registrar must still approve; a front-run bogus claim is rejected off-chain, and the real claimant's genuine deed is approved. This is exactly the human-verification backstop the design depends on. |
| Front-running a transfer accept | **Not applicable** | `acceptTransfer` can only be called by the specific named buyer; a third party cannot "steal" the accept. |
| Transfer griefing by re-initiating | **Mitigated** | Only one active pending transfer per property (`TransferAlreadyPending`); only the owner can set it. |

### 2.4 Denial of service (DoS)
| Risk | Status | Mitigation |
|---|---|---|
| Unbounded loops in state-changing functions | **Mitigated** | The only loops over user-growable arrays are in `getIncomingTransfers`/`recentSubmissionCount` (both `view`, off-chain gas) and in `_recordSubmissionAndMaybeFlag`, which **prunes** to a bounded 24h window so per-wallet storage cannot grow without bound. |
| `getAllPropertyIds` gas blow-up | **Mitigated** | Paginated with `offset`/`limit`; callers read in pages. |
| Owner-array growth | **Bounded in practice** | `_ownerProperties` grows with real holdings; swap-and-pop keeps removal O(1). No function iterates it on-chain in a state-changing path. |
| Griefing via blocked recipient | **N/A** | No push payments; transfers are pull-style (buyer must accept). |

### 2.5 Arithmetic / integer safety
| Risk | Status | Mitigation |
|---|---|---|
| Overflow / underflow | **Mitigated** | Solidity ≥0.8 reverts on overflow by default. Counters (`_pendingCount` etc.) only decrement after a checked state transition that guarantees the prior increment occurred. `_nextId` starts at 1 so id `0` is a sentinel for "not found". |
| `uint64` timestamp truncation | **Accepted** | `block.timestamp` fits `uint64` until year 584942417355 — no practical risk. Saves storage by packing. |
| Area as `uint256` | **Accepted** | No arithmetic performed on area on-chain; stored as supplied. |

### 2.6 Centralization / trust
| Risk | Status | Mitigation / Acceptance |
|---|---|---|
| Registrar can reject a legitimate claim or approve a bad one | **Accepted (by design)** | This is the deliberate human-in-the-loop. Mitigations: every action emits an event (auditable), the role is explicit, and multiple registrars can be granted. Future work: multi-sig registrar (see [LIMITATIONS.md](./LIMITATIONS.md)). |
| Admin can grant/revoke registrars and could add themselves | **Accepted** | Standard admin trust. The deployer is admin; for production the admin key should be a multi-sig or timelock. Documented as a limitation. |
| Admin/Registrar cannot forge ownership or rewrite history | **Mitigated** | There is **no** function to set an owner directly, delete a property, or edit `_history`. History is append-only; ownership changes only through the two-party accept flow. Even a malicious registrar cannot silently transfer someone's property. |
| Pausing as censorship | **Accepted/limited** | A registrar can pause user actions (circuit breaker). This is a safety feature; it cannot alter records, only halt new ones. |

### 2.7 Input validation & data integrity
| Risk | Status | Mitigation |
|---|---|---|
| Empty/zero inputs | **Mitigated** | Every string field and the area and document hash are validated; `EmptyField`/`ZeroArea` custom errors. |
| Duplicate document across properties | **Mitigated on-chain** | `documentHash` uniqueness enforced; a reused deed file is rejected. (Off-chain risk scoring additionally flags near-duplicates.) |
| Duplicate survey+location (double registration of one plot) | **Mitigated** | `keccak256(survey ‖ "|" ‖ location)` uniqueness enforced. |
| Document authenticity | **Not solved on-chain (honest)** | The chain stores a hash/CID; it cannot know if the PDF is a real deed. Registrar verification + off-chain risk scoring reduce and flag this. |

---

## 3. Slither-style manual checklist

| Detector (conceptual) | Result |
|---|---|
| `reentrancy-eth` / `reentrancy-no-eth` | No external calls; `nonReentrant` on accept. **Clean.** |
| `arbitrary-send` / `unchecked-transfer` | No value transfers. **Clean.** |
| `tx-origin` | Never used; all checks use `msg.sender`. **Clean.** |
| `unprotected-functions` | All state-mutating admin/registrar paths role-gated. **Clean.** |
| `uninitialized-state` | All storage initialized; `_nextId = 1`. **Clean.** |
| `timestamp` dependence | Used only for record-keeping and a 24h heuristic; not for randomness or funds. **Acceptable.** |
| `assembly` / low-level `call` | None. **Clean.** |
| `delegatecall` | None. **Clean.** |
| `locked-ether` | Contract is not `payable`; cannot receive ETH (no `receive`/`payable`). **Clean.** |
| `costly-loop` in writes | Only the bounded, self-pruning submission log. **Acceptable.** |
| `missing-zero-check` | `grantRegistrar` rejects zero; buyer zero rejected in `initiateTransfer`. **Clean.** |
| `events` on sensitive actions | All state changes emit events. **Clean.** |

> To run the real tool: `pip install slither-analyzer && slither .` (requires a
> Python toolchain). The reasoning above mirrors its core detectors.

---

## 4. Residual risks accepted

1. **Trusted Registrar / Admin** — the system is only as honest as the Registrar
   for *initial* registration. Mitigated by auditable events, multiple
   registrars, and the fact that records/history cannot be rewritten.
2. **No real-world identity binding** — wallets are pseudonymous; the chain does
   not know who controls a key. Future work: identity oracle.
3. **Public ledger privacy** — all records are world-readable. Only a hash/CID of
   the deed is stored, but location/survey/owner addresses are public. See
   [LIMITATIONS.md](./LIMITATIONS.md).
4. **Testnet only** — deployed to Sepolia for demonstration; not legally binding.

No high- or critical-severity on-chain vulnerabilities were identified. The
material risks are the **accepted, documented** centralization and
off-chain-authenticity assumptions that this design is explicitly built around.
