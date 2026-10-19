# Limitations & Future Work

This project is intentionally honest. Blockchain **reduces and flags** fraud and
makes records tamper-resistant and auditable — it does **not** eliminate fraud,
verify identity, or confer legal ownership. This document states exactly what is
and isn't solved, in the same tone as the project deck.

## What it solves

| Area | How |
|---|---|
| **Single point of failure** | Records live in a smart contract replicated across Ethereum nodes; no single server can alter or lose them. |
| **Silent tampering** | Ownership and history are append-only; there is no function to edit history or set an owner directly. Every change emits an event. |
| **Duplicate sale of one plot** | The contract rejects a second registration with the same `documentHash` or the same `(surveyNumber, location)`. |
| **Opaque, slow verification** | Anyone can read current ownership and the full transfer timeline instantly, and re-hash a file to prove it matches the record. |
| **Unseen suspicious activity** | `FlaggedForReview` events + an off-chain risk score surface bulk submissions, flipping, circular trades, reused deeds and bad survey formats. |

## What it does NOT solve (accepted limitations)

1. **No real-world identity verification.** Wallets are pseudonymous; the chain
   cannot confirm who controls a key. A stolen key = stolen control.
2. **Cannot prove a deed is genuine.** The chain stores a hash/CID; it cannot
   tell a real deed from a convincing forgery. This is why the **Registrar must
   verify initial registrations** ("garbage in, garbage out").
3. **Trusted Registrar / Admin dependency.** A malicious registrar can reject a
   genuine claim or approve a bad one (mitigated: events are auditable, records
   can't be rewritten, multiple registrars possible). The admin can manage roles.
4. **No legal recognition.** A testnet record is not a legal title. Real adoption
   needs government/legal integration.
5. **Public-ledger privacy.** All records are world-readable. Only the document
   itself is off-chain; location, survey number and owner addresses are public.
6. **Gas costs.** Every write costs gas; on mainnet this is non-trivial at scale.
7. **Scalability.** Ethereum L1 throughput is limited; large registries would
   need a Layer-2 or app-chain.
8. **Testnet only.** Deployed to Sepolia for demonstration.

## Future work

- **Identity oracle / KYC** (e.g. an Aadhaar-style attestation oracle) to bind
  wallets to verified real-world identities.
- **Multi-sig / DAO Registrar** to remove single-registrar trust; add a timelock
  on admin actions.
- **Zero-knowledge privacy** so ownership can be proven without exposing all
  record details publicly.
- **Layer-2 deployment** (e.g. an Ethereum rollup) for cheaper, higher-throughput
  registration and transfer.
- **Legal integration** with land-record authorities so on-chain records carry
  statutory weight.
- **Dispute resolution & correction flow** — an authorized, audited mechanism to
  correct genuine errors without breaking immutability guarantees.
- **Richer document verification** — notarization attestations, multi-document
  deeds, and automated cross-checks against authoritative survey databases.
