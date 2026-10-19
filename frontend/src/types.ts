// Shared domain types for the dApp. The on-chain shapes mirror the Solidity
// structs; the indexed shapes mirror what scripts/seed.ts writes to
// registryIndex.json.

export type ChainStatus = "Pending" | "Registered" | "Rejected";

export interface OnChainProperty {
  id: bigint;
  owner: string;
  status: number; // 0 Pending, 1 Registered, 2 Rejected
  submittedAt: bigint;
  registeredAt: bigint;
  areaSqm: bigint;
  location: string;
  surveyNumber: string;
  propertyType: string;
  documentCID: string;
  documentHash: string;
  rejectionReason: string;
}

export interface TransferRecord {
  propertyId: bigint;
  from: string;
  to: string;
  timestamp: bigint;
}

// --- Indexed (off-chain, from the seed) ---

export interface IndexedWallet {
  wallet_id: string;
  role: "Registrar" | "Owner";
  address: string;
  label: string;
}

export interface IndexedProperty {
  property_ref: string;
  owner_wallet_id: string;
  ownerAddress: string;
  location: string;
  city: string;
  area_sqm: number;
  property_type: string;
  survey_number: string;
  document_file: string;
  documentCID: string;
  documentHash: string;
  docUrl: string;
  submitted_date: string;
  scenario: string;
  notes: string;
  datasetStatus: string;
  onChainId: string | null;
  onChainStatus: string;
  flagged: boolean;
  outcome: string;
  reason: string;
}

export interface IndexedTransfer {
  transfer_id: string;
  property_ref: string;
  from_wallet_id: string;
  to_wallet_id: string;
  fromAddress: string;
  toAddress: string;
  date: string;
  scenario: string;
  outcome: string;
}

export interface RegistryIndex {
  generatedAt: string;
  synthetic: boolean;
  network: string;
  chainId: number;
  contractAddress: string;
  ipfsMocked: boolean;
  gateway: string;
  wallets: IndexedWallet[];
  properties: IndexedProperty[];
  transfers: IndexedTransfer[];
  flaggedForReview: { propertyId: string; reason: string }[];
}
