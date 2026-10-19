# Viva / Evaluator Q&A (30 questions)

Accurate, honest answers mapped to what this project actually implements.

### 1. Why Ethereum (and not a private/permissioned chain)?
Ethereum offers a mature, battle-tested smart-contract platform, the richest tooling (Hardhat, Ethers, OpenZeppelin, MetaMask), and public verifiability — anyone can independently audit records. For a public registry, public verifiability is the point. A permissioned chain would reintroduce a controlling authority, undermining the transparency goal. We deploy to the **Sepolia** testnet for a cost-free, realistic demonstration.

### 2. Why store the document on IPFS instead of on-chain?
On-chain storage is extremely expensive (gas per byte) and permanent and public — unsuitable for large or private documents. We store only the IPFS **CID** (so the file is retrievable) and the **keccak256 hash** of the file bytes (so the file's integrity can be proven). This keeps gas low while preserving tamper-evidence.

### 3. If only the hash is on-chain, what does that actually guarantee?
That the **document has not changed** since registration. Anyone can re-hash a file and compare it to the stored hash: a match proves it's byte-identical to the registered deed; a mismatch proves it's different/altered. It does **not** prove the original deed was genuine — that's the Registrar's job.

### 4. Does blockchain eliminate property fraud?
No, and we never claim it does. It makes records **tamper-resistant**, history **transparent**, and transfers **rule-based**, and it **flags** suspicious patterns. But "garbage in, garbage out": if a forged deed is approved by the Registrar, the chain faithfully records a bad claim. We reduce and surface fraud; we don't eliminate it.

### 5. Then why have a Registrar at all — isn't that centralization?
Yes, it's a deliberate, documented trust assumption. A blockchain cannot judge whether a real-world document is authentic, so a human/authority must verify **initial** registrations. Crucially, even a malicious Registrar **cannot rewrite history or silently seize a property** — there's no such function. Future work replaces the single Registrar with a multi-sig/DAO.

### 6. What exactly can the Registrar and Admin do — and not do?
Registrar: approve/reject pending registrations, pause/unpause. Admin: grant/revoke registrars. **Neither** can edit a property's history, set an owner directly, delete records, or move someone's property. Ownership only changes via the two-party `initiate`→`accept` flow.

### 7. How do you prevent the same plot being registered twice?
Two on-chain guards: a `documentHash` uniqueness map (reused deed file ⇒ revert `DuplicateDocumentHash`), and a `keccak256(surveyNumber ‖ location)` uniqueness map (⇒ revert `DuplicateSurveyLocation`). The dataset demonstrates both (P-030 and P-025 revert).

### 8. How does a transfer work and why two signatures?
The **owner** calls `initiateTransfer(id, buyer)`; the **buyer** then calls `acceptTransfer(id)`. Requiring both parties' wallet signatures prevents forcing a property onto someone and ensures mutual consent. The owner can `cancelTransfer` before acceptance. On acceptance, ownership moves and an immutable `TransferRecord` is appended.

### 9. What about front-running?
For `submitProperty`, an attacker who sees a mempool submission could try to register the same survey first. This is mitigated by the **Registrar backstop** (a bogus front-run claim is rejected) — exactly the human check the design relies on. `acceptTransfer` is safe: only the specific named buyer can call it, so a transfer can't be "stolen".

### 10. Is the contract vulnerable to reentrancy?
No. It makes **no external calls** (no ETH transfers, no token callbacks). `acceptTransfer` additionally carries OpenZeppelin's `nonReentrant` as defence-in-depth, and we follow checks-effects-interactions ordering. The contract isn't `payable`, so it can't hold or leak ETH.

### 11. How is access control implemented?
OpenZeppelin `AccessControl` with `DEFAULT_ADMIN_ROLE` and a custom `REGISTRAR_ROLE`. The deployer gets both at construction. Role checks use `onlyRole(...)` modifiers; unauthorized calls revert with `AccessControlUnauthorizedAccount`.

### 12. Why custom errors instead of `require` strings?
Custom errors are cheaper (they encode a 4-byte selector + args instead of a string) and give structured, decodable failure data. The frontend decodes them into friendly messages (e.g. "This survey number and location are already registered (#1)").

### 13. How did you make the contract gas-conscious?
Packed struct field ordering (owner + status + `uint64` timestamps share slots), `uint64` timestamps, `calldata` for external string params, custom errors, running status counters for O(1) `getStats()`, swap-and-pop for the owner index, paginated list reads, and a self-pruning 24h submission log to bound storage growth.

### 14. What is `FlaggedForReview` and how is the 24h window enforced on-chain?
Each wallet keeps a rolling array of submission timestamps. On each submit we prune entries older than 24h and append `now`; if the count then exceeds 3, we emit `FlaggedForReview(id, reason)`. The pruning bounds the array (a DoS consideration). The dataset's P-034 triggers it.

### 15. Immutability vs. correcting genuine errors — how do you reconcile them?
History is append-only by design, which is the integrity guarantee. Genuine errors are handled at the **edges**: a bad registration is `Rejected` (not deleted) with a stored reason; future work adds an authorized, audited correction flow. We never expose a "rewrite history" function.

### 16. What stops a malicious actor from flooding the registry (DoS)?
No unbounded loops exist in state-changing functions (the only growable-array loops are `view` functions and the self-pruning submission log). Bulk spam is flagged (`FlaggedForReview`) and visible to the Registrar. There are no push payments to grief.

### 17. How does off-chain risk scoring work, and isn't it just heuristics?
Yes — it's an explicitly heuristic, pure function (`riskScore.ts`) scoring 0–100 (Low/Medium/High) from signals: reused document, duplicate survey, bulk submissions, rapid flipping, circular trades, invalid survey format, new-wallet-high-volume. It's a **triage aid** for the Registrar, not a verdict, and it's unit-tested. Importantly, records whose duplicate was already blocked on-chain are **not** penalized.

### 18. How do you handle a 51% attack / chain reorg?
A 51% attack could reorder/censor recent transactions but **cannot forge signatures** or invent ownership transfers you didn't sign. We rely on Ethereum's economic security; for high-value finality, applications wait for several confirmations (our deploy script waits 5 before verifying). Deep history is effectively immutable.

### 19. GDPR / privacy — personal data on a public, immutable ledger?
A real concern. We deliberately keep the **document off-chain** (only hash+CID on-chain). But location, survey number and wallet addresses are public and immutable — in conflict with the "right to erasure". Mitigations/future work: store only hashed/salted identifiers, use zero-knowledge proofs, or keep PII entirely off-chain behind access control. Documented in LIMITATIONS.md.

### 20. Why hash the file with keccak256 specifically?
keccak256 is Ethereum's native hash (cheap in the EVM) and collision-resistant. Using the same function on-chain and in the browser means the frontend can compute a hash that exactly matches what the contract stores and checks via `verifyDocument`.

### 21. What happens if IPFS loses the file (persistence)?
IPFS content isn't guaranteed to persist unless **pinned**. We pin via Pinata (a pinning service). If a file is lost, the **hash on-chain still lets you verify** any copy you later obtain, but retrieval depends on the pin. Production would use redundant pinning / Filecoin.

### 22. Why MetaMask, and how do you handle wrong networks?
MetaMask is the standard EIP-1193 browser wallet. The app detects a missing extension (install prompt), listens for `accountsChanged`/`chainChanged`, and offers one-click **network switching** (adding the chain if needed) when the user is on the wrong network.

### 23. How is the frontend prevented from leaking secrets?
The only public value is the contract address. The **Pinata JWT never reaches the browser** — uploads go through a Vercel Edge function (`/api/pin`) that holds the secret server-side. Env validation separates `VITE_*` (public) from server-only variables.

### 24. How did you test the contract and what's the coverage?
48 Hardhat + Chai tests covering every happy path and revert (unauthorized approve, non-owner transfer, wrong-buyer accept, duplicate hash, duplicate survey+location, double pending, transferring Pending/Rejected, self-transfer, pause behavior, multi-transfer history, hash match/mismatch, the flag event, role grant/revoke). Coverage: **100% statements / functions / lines, ~89% branches** (the remaining branches are genesis-time defensive ternaries). The risk library has 13 Vitest tests.

### 25. What is the dataset and is it real?
It's **synthetic** — 8 wallets, 40 properties, 8 transfers, and generated dummy PDF deeds. It's clearly labelled synthetic throughout the UI. It encodes specific fraud scenarios (duplicate survey, reused document, bulk, flip, circular, invalid format, forged) so every feature is demonstrable.

### 26. How does the seed simulate time windows on a local chain?
On a local network it anchors a clock at node start and advances each event's block timestamp by the event's calendar offset from the earliest date. This makes the on-chain 24h flag window and off-chain 30-day flip window behave exactly as the dataset intends, deterministically.

### 27. Can the public verify ownership without a wallet?
Yes. The **Public Verify** page uses a read-only RPC (or the bundled snapshot in demo) to look up a property's current owner, full history, and lets anyone re-hash a document to confirm it matches — no wallet, no gas.

### 28. What are the main attack surfaces you considered?
Access control, reentrancy, front-running, DoS/unbounded loops, integer issues, and centralization. Each is analysed with mitigation/acceptance in [SECURITY.md](SECURITY.md), using manual Slither-style reasoning. No high/critical on-chain vulnerabilities were found; the material risks are the accepted, documented trust assumptions.

### 29. How would this scale to a real country-sized registry?
Not on Ethereum L1 as-is (throughput and gas). A production path: deploy on a **Layer-2 rollup** (cheaper, higher throughput) or an app-specific chain, batch registrations, and keep heavy data off-chain with strong pinning. The contract logic is already paginated and index-based to support large reads.

### 30. If you had more time, what's the single most important improvement?
Replacing the single trusted Registrar with a **multi-sig / DAO Registrar plus an identity-attestation oracle**. That attacks the two biggest honest limitations at once — single-registrar trust and the lack of real-world identity binding — moving the system closer to something legally and operationally credible.
