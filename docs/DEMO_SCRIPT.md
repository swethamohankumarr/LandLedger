# 5-Minute Demo Script

A timed walkthrough for evaluators. Everything works in **Demo mode** (no wallet
needed). For the signing steps, switch to **Live** with a Hardhat account after
running `npm run node` + `npm run seed:local`.

> Tip: the **Try Guided Demo** button on the landing page runs steps 2–6 as a
> floating tour automatically.

---

### 0:00 — Landing (`/`)  ·  30s
- Point out the headline and the **"What this does and doesn't solve"** section.
- Say the honesty line: *"tamper-resistant records and rule-based transfers — but a Registrar still verifies initial claims; it doesn't verify identity or replace legal title."*
- Click **Launch App**.

### 0:30 — Dashboard (`/app`)  ·  30s
- Note the **Demo mode** banner ("synthetic data").
- Switch the **persona** dropdown (e.g. *Aarav Menon*) → KPIs, sparklines, My Properties, recent activity update.
- Press **⌘K / Ctrl-K** → command palette → type `fraud` to show quick navigation.

### 1:00 — Register a property (`/register`)  ·  60s
- Step 1: enter a location, area, and a **bad survey number** like `KOC-26-X` → see the inline *"will be flagged"* warning.
- Step 2: drag in any PDF → watch the **keccak256 fingerprint** generate and the IPFS CID appear.
  - Re-upload a file already in the registry to trigger the **"deed already registered"** pre-check.
- Step 3: review. Step 4: **Sign** (in Live mode this submits on-chain; in Demo it explains the hashing/IPFS already ran).

### 2:00 — Registrar Console (`/registrar`)  ·  45s
- Show the **queue sorted by risk** with reasons under each item.
- Click **P-034** (bulk) → right panel shows **risk reasons** + the document viewer + **Approve / Reject**.
- Open **Bulk CSV import** to show preview + validation + batch progress.

### 2:45 — Transfer Center (`/transfers`)  ·  30s
- Select one of your registered properties, paste a buyer address → show **checksum validation** and the **irreversibility warning**.
- Explain the **two-party flow**: owner initiates → buyer accepts → history appended.

### 3:15 — Registry Explorer (`/explorer`)  ·  30s
- Filter by **City** / **Status**, sort by **Risk**, toggle **card/table**, click **Export CSV**.

### 3:45 — Property Detail + tamper check (`/property/1`)  ·  45s
- Show the **ownership timeline** (Registered → transfers) and the **QR code** for public verification.
- **Verify Document:** upload the *correct* deed (`data/documents/deed-001.pdf`) → **emerald "Document verified"** with matching hashes.
- Upload *any other* file → **rose "Tampered / different file"** with differing hashes. ← the showstopper.

### 4:30 — Analytics + Fraud Alerts (`/analytics`, `/fraud`)  ·  30s
- Analytics: status donut, risk distribution, transfers-over-time.
- Fraud Alerts: walk the scenarios — **duplicate survey (P-025)**, **reused document (P-030)**, **bulk (P-031…034)**, **rapid flip (P-005)**, **circular trade (P-008)**, **invalid format (P-026)**, **forged/rejected (P-027)**.

### 5:00 — Close
- Public Verify (`/verify?id=1`) — anyone can verify with no wallet.
- About (`/about`) — architecture diagram + honest limitations + glossary.

---

## Fraud scenarios cheat-sheet

| Property | Scenario | Expected outcome |
|---|---|---|
| P-025 | Duplicate survey + location (of P-001) | **Reverted** on submit (`DuplicateSurveyLocation`) |
| P-030 | Reuses P-011's deed file | **Reverted** on submit (`DuplicateDocumentHash`) |
| P-031…P-034 | 4 submissions from W6 in 24h | P-034 emits **FlaggedForReview** |
| P-005 | 3 transfers in ~17 days | **Rapid flip** (risk) |
| P-008 | W2→W3→W2 | **Circular trade** (risk) |
| P-026 | `KOC-26-INVALID` survey | **Rejected** by registrar (invalid format) |
| P-027 | Forged deed | **Rejected** by registrar (manual) |
