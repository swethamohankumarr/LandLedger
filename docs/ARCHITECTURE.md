# Architecture

## 1. System overview

```mermaid
flowchart TD
    subgraph Client
      U["👤 User / Buyer / Owner<br/>+ MetaMask wallet"]
      REG["🛡️ Registrar<br/>(REGISTRAR_ROLE)"]
    end

    subgraph App["Application layer (Vercel)"]
      FE["React + Vite + TypeScript<br/>Ethers.js v6"]
      API["/api/pin (Edge fn)<br/>holds PINATA_JWT"]
    end

    subgraph Chain["Ethereum / Sepolia"]
      SC["LandRegistry.sol<br/>AccessControl · ReentrancyGuard · Pausable"]
    end

    subgraph Storage
      IPFS["IPFS (Pinata)<br/>deed documents"]
    end

    U -->|connect + sign| FE
    REG -->|approve / reject / pause| FE
    FE -->|read/write tx| SC
    FE -->|upload file| API -->|pin| IPFS
    FE -->|render by CID| IPFS
    SC -. stores CID + keccak256 hash .- SC
    PUB["🌐 Anyone"] -->|read-only RPC| SC
```

**Key principle:** documents never go on-chain. Only the IPFS **CID** and the
**keccak256 hash** of the file bytes are stored, so anyone can later prove a file
is the exact one registered without exposing private documents on a public ledger.

## 2. Roles

```mermaid
flowchart LR
    Deployer -->|granted at construction| Admin[DEFAULT_ADMIN_ROLE]
    Deployer -->|granted at construction| Reg[REGISTRAR_ROLE]
    Admin -->|grantRegistrar / revokeRegistrar| Reg
    Reg -->|approve / reject / pause| Ops[(Registry operations)]
    Owner -->|submit / initiate / cancel| Ops
    Buyer -->|accept| Ops
```

## 3. Sequence — Register a property

```mermaid
sequenceDiagram
    actor Owner
    participant FE as dApp
    participant IPFS
    participant SC as LandRegistry
    Owner->>FE: fill details + upload deed
    FE->>FE: keccak256(file bytes)
    FE->>IPFS: POST /api/pin (server JWT)
    IPFS-->>FE: CID
    FE->>FE: pre-check duplicates (hash / survey+location)
    Owner->>SC: submitProperty(location, survey, area, type, CID, hash)
    SC->>SC: validate, store (Pending), index owner
    SC-->>FE: PropertySubmitted(id)
    opt 4th submission in 24h
      SC-->>FE: FlaggedForReview(id, reason)
    end
```

## 4. Sequence — Registrar approval

```mermaid
sequenceDiagram
    actor Registrar
    participant FE
    participant SC as LandRegistry
    Registrar->>FE: open risk-sorted queue
    FE->>SC: getAllPropertyIds / getProperty (read)
    FE->>FE: scoreProperty() off-chain
    alt genuine
      Registrar->>SC: approveProperty(id)
      SC-->>FE: PropertyApproved(id)  [status = Registered]
    else suspicious
      Registrar->>SC: rejectProperty(id, reason)
      SC-->>FE: PropertyRejected(id, reason)  [status = Rejected]
    end
```

## 5. Sequence — Transfer ownership (two-party)

```mermaid
sequenceDiagram
    actor Owner
    actor Buyer
    participant SC as LandRegistry
    Owner->>SC: initiateTransfer(id, buyer)
    SC->>SC: require owner, Registered, no active pending
    SC-->>Buyer: TransferInitiated(id, owner, buyer)
    Buyer->>SC: acceptTransfer(id)
    SC->>SC: move owner, append history, clear pending
    SC-->>Owner: TransferCompleted(id, from, to)
    Note over Owner,SC: Owner may cancelTransfer(id) before acceptance
```

## 6. Sequence — Verify a document (tamper check)

```mermaid
sequenceDiagram
    actor Anyone
    participant FE
    participant SC as LandRegistry
    Anyone->>FE: upload a file to verify
    FE->>FE: keccak256(file)
    FE->>SC: verifyDocument(id, hash)  (or compare client-side)
    SC-->>FE: true / false
    FE-->>Anyone: ✅ MATCH (emerald shield) or ⚠️ TAMPERED (rose alert)
```

## 7. Data model (on-chain)

```mermaid
erDiagram
    PROPERTY ||--o{ TRANSFER_RECORD : "has history"
    PROPERTY ||--o| PENDING_TRANSFER : "may have"
    ADDRESS ||--o{ PROPERTY : "owns (current)"

    PROPERTY {
        uint256 id PK
        address owner
        Status status "Pending|Registered|Rejected"
        uint64 submittedAt
        uint64 registeredAt
        uint256 areaSqm
        string location
        string surveyNumber
        string propertyType
        string documentCID
        bytes32 documentHash
        string rejectionReason
    }
    TRANSFER_RECORD {
        uint256 propertyId FK
        address from
        address to
        uint64 timestamp
    }
    PENDING_TRANSFER {
        address buyer
        uint64 initiatedAt
        bool active
    }
```

**Indexes maintained in storage:** `documentHash → used`,
`keccak(survey‖location) → id`, `owner → uint256[]` (swap-and-pop),
`buyer → incoming ids`, global `uint256[]` for pagination, and a per-wallet
rolling 24h submission log (self-pruning) for the flag heuristic.

## 8. Off-chain layer

- `scripts/seed.ts` replays the synthetic dataset and writes
  `frontend/src/data/registryIndex.json` (UI data) and `data/seed-report.json`
  (fraud demo). The simulated clock is anchored at node start and advanced per
  event's calendar offset so 24h/30-day windows behave as intended.
- `frontend/src/lib/riskScore.ts` is a pure function scoring each property
  0–100 (Low/Medium/High) from cross-record signals. It complements — never
  replaces — the hard on-chain guarantees.
