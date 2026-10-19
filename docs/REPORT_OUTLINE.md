# Project Report — Chapter-wise Outline

Maps the written report to what was actually built, so each claim is backed by an
artifact in this repository.

## Abstract
One-paragraph summary: a blockchain land registry providing tamper-resistant
records, transparent history, and rule-based transfers, with a Registrar
verifying initial claims. State the honest scope up front.
→ *Backed by:* `README.md`, `contracts/LandRegistry.sol`.

## Chapter 1 — Introduction
- Context: land-record fraud, duplicate sales, single points of failure.
- Problem statement and objectives.
- Scope and the explicit non-goals (identity, legal title).
→ *Backed by:* `docs/LIMITATIONS.md`, Landing page.

## Chapter 2 — Literature Review / Existing Systems
- Centralized land records and their failure modes.
- Prior blockchain-registry efforts; the recurring gap: **on-chain data can't
  validate off-chain truth** (garbage-in-garbage-out) → motivates the Registrar role.
→ *Backed by:* `docs/VIVA_QA.md` Q4–Q5, `docs/SECURITY.md` §2.6.

## Chapter 3 — Requirements Analysis
- Functional: submit, approve/reject, transfer (two-party), verify, roles, pause.
- Non-functional: security, gas efficiency, usability, accessibility, honesty.
- Actors: Owner, Buyer, Registrar, Admin, Public.
→ *Backed by:* contract functions + the 11 frontend pages.

## Chapter 4 — System Design
- Architecture (user+MetaMask → React/Ethers → contract → IPFS).
- Data model (Property, TransferRecord, PendingTransfer) and storage indexes.
- Sequence diagrams: register, approve, transfer, verify.
- Design decisions: hash-on-chain not document; custom errors; packed structs.
→ *Backed by:* `docs/ARCHITECTURE.md`.

## Chapter 5 — Implementation
- Smart contract: roles, state machine, events, custom errors, gas choices.
- Off-chain: dataset generation, IPFS pinning (with server-side JWT), seeding.
- Frontend: design system, wallet UX, demo vs live modes, risk scoring.
→ *Backed by:* `contracts/`, `scripts/`, `frontend/src/`.

## Chapter 6 — Fraud Prevention & Risk Scoring
- On-chain guards (duplicate hash/survey, status gating, pending-transfer rule,
  FlaggedForReview).
- Off-chain scoring signals and why each matters; honest framing (flag, not prove).
→ *Backed by:* `frontend/src/lib/riskScore.ts`, Fraud Alerts page, `data/seed-report.json`.

## Chapter 7 — Testing & Security
- Test strategy, matrix, and coverage results.
- Threat model (access control, reentrancy, front-running, DoS, integer,
  centralization) with mitigations/acceptances.
→ *Backed by:* `test/`, `docs/TEST_REPORT.md`, `docs/SECURITY.md`.

## Chapter 8 — Results & Demonstration
- Walkthrough of each scenario and its outcome (register → approve → transfer →
  verify → tamper detection → fraud alerts).
- Screenshots (filenames in README).
→ *Backed by:* `docs/DEMO_SCRIPT.md`, seed summary table.

## Chapter 9 — Limitations & Future Work
- What it solves vs doesn't; identity oracle, multi-sig registrar, zk-privacy,
  Layer-2, legal integration, correction flow.
→ *Backed by:* `docs/LIMITATIONS.md`.

## Chapter 10 — Conclusion
- Restate contribution honestly: a working, tested, demo-ready registry that
  reduces and flags fraud while being transparent about its trust assumptions.

## Appendices
- A: Full contract source + NatSpec.
- B: Test output + coverage report.
- C: Dataset schema (wallets/properties/transfers CSVs) + scenarios.
- D: Deployment checklist and recorded live values.
- E: Viva Q&A.
