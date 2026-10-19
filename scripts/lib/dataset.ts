/**
 * Canonical synthetic dataset for the Decentralized Land Registry.
 *
 * SYNTHETIC — every wallet, deed, survey number and date here is fabricated for
 * demonstration and grading. Nothing corresponds to a real person or property.
 *
 * Shared by `generateDataset.ts` (writes the CSVs + PDFs) and `seed.ts`
 * (replays the dataset on-chain). Keeping one source of truth avoids drift.
 */

export type DatasetStatus =
  | "Registered" // submit + approve
  | "Rejected" // submit + reject (reason given)
  | "Pending" // submit, leave for the Registrar queue
  | "Flagged" // submit expected to succeed AND emit FlaggedForReview
  | "Reverted"; // submit expected to REVERT on-chain (duplicate guards)

export type Scenario =
  | "NORMAL_SALE"
  | "RAPID_FLIP"
  | "CIRCULAR_TRADE"
  | "DUPLICATE_SURVEY"
  | "REUSED_DOCUMENT"
  | "INVALID_SURVEY_FORMAT"
  | "FORGED_DEED"
  | "BULK_SUBMISSION";

export interface WalletRow {
  wallet_id: string; // W0..W7
  role: "Registrar" | "Owner";
  address: string; // PLACEHOLDER — mapped to a real signer at seed time
  label: string;
}

export interface PropertyRow {
  property_ref: string; // P-001..P-040
  owner_wallet_id: string; // W1..W7
  location: string;
  city: string;
  area_sqm: number;
  property_type: "Residential" | "Agricultural" | "Commercial";
  survey_number: string;
  document_file: string; // file in data/documents (P-030 reuses deed-011.pdf)
  submitted_date: string; // ISO date
  status: DatasetStatus;
  scenario: Scenario;
  notes: string;
}

export interface TransferRow {
  transfer_id: string; // T-001..
  property_ref: string;
  from_wallet_id: string;
  to_wallet_id: string;
  date: string; // ISO date
  scenario: Scenario;
}

export const WALLETS: WalletRow[] = [
  { wallet_id: "W0", role: "Registrar", address: "0xREGISTRAR_PLACEHOLDER", label: "State Land Registrar" },
  { wallet_id: "W1", role: "Owner", address: "0xW1_PLACEHOLDER", label: "Aarav Menon" },
  { wallet_id: "W2", role: "Owner", address: "0xW2_PLACEHOLDER", label: "Diya Sharma" },
  { wallet_id: "W3", role: "Owner", address: "0xW3_PLACEHOLDER", label: "Rohan Nair" },
  { wallet_id: "W4", role: "Owner", address: "0xW4_PLACEHOLDER", label: "Ishita Rao" },
  { wallet_id: "W5", role: "Owner", address: "0xW5_PLACEHOLDER", label: "Kabir Khan" },
  { wallet_id: "W6", role: "Owner", address: "0xW6_PLACEHOLDER", label: "Ananya Iyer" },
  { wallet_id: "W7", role: "Owner", address: "0xW7_PLACEHOLDER", label: "Vihaan Reddy" },
];

// Expected survey-number format: AAA/NN/NNN-X  (e.g. BLR/12/345-A)
export const PROPERTIES: PropertyRow[] = [
  { property_ref: "P-001", owner_wallet_id: "W1", location: "12 MG Road", city: "Bengaluru", area_sqm: 540, property_type: "Residential", survey_number: "BLR/12/345-A", document_file: "deed-001.pdf", submitted_date: "2025-01-06", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean residential plot." },
  { property_ref: "P-002", owner_wallet_id: "W2", location: "Backwater Farm, Kumbalangi", city: "Kochi", area_sqm: 3200, property_type: "Agricultural", survey_number: "KOC/08/112-B", document_file: "deed-002.pdf", submitted_date: "2025-01-09", status: "Registered", scenario: "NORMAL_SALE", notes: "Agricultural land." },
  { property_ref: "P-003", owner_wallet_id: "W3", location: "Nariman Point Suite 9", city: "Mumbai", area_sqm: 210, property_type: "Commercial", survey_number: "MUM/21/009-C", document_file: "deed-003.pdf", submitted_date: "2025-01-14", status: "Registered", scenario: "NORMAL_SALE", notes: "Commercial office." },
  { property_ref: "P-004", owner_wallet_id: "W4", location: "7 Besant Nagar", city: "Chennai", area_sqm: 480, property_type: "Residential", survey_number: "CHN/05/220-A", document_file: "deed-004.pdf", submitted_date: "2025-01-18", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-005", owner_wallet_id: "W5", location: "Jubilee Hills Villa 3", city: "Hyderabad", area_sqm: 760, property_type: "Residential", survey_number: "HYD/14/501-D", document_file: "deed-005.pdf", submitted_date: "2025-01-22", status: "Registered", scenario: "RAPID_FLIP", notes: "Flipped 3x within 30 days (see transfers)." },
  { property_ref: "P-006", owner_wallet_id: "W6", location: "Hinjewadi Plot 44", city: "Pune", area_sqm: 1200, property_type: "Agricultural", survey_number: "PUN/30/077-B", document_file: "deed-006.pdf", submitted_date: "2025-01-15", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-007", owner_wallet_id: "W7", location: "Connaught Place Block C", city: "Delhi", area_sqm: 330, property_type: "Commercial", survey_number: "DEL/02/404-C", document_file: "deed-007.pdf", submitted_date: "2025-02-02", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-008", owner_wallet_id: "W2", location: "Whitefield Lane 2", city: "Bengaluru", area_sqm: 600, property_type: "Residential", survey_number: "BLR/17/888-A", document_file: "deed-008.pdf", submitted_date: "2025-02-08", status: "Registered", scenario: "CIRCULAR_TRADE", notes: "Traded W2->W3->W2 (wash-trade pattern)." },
  { property_ref: "P-009", owner_wallet_id: "W1", location: "Fort Kochi House 11", city: "Kochi", area_sqm: 410, property_type: "Residential", survey_number: "KOC/08/305-A", document_file: "deed-009.pdf", submitted_date: "2025-02-12", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-010", owner_wallet_id: "W3", location: "Bandra Reclamation 5", city: "Mumbai", area_sqm: 290, property_type: "Residential", survey_number: "MUM/21/610-A", document_file: "deed-010.pdf", submitted_date: "2025-02-20", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-011", owner_wallet_id: "W4", location: "Adyar Riverside 8", city: "Chennai", area_sqm: 520, property_type: "Residential", survey_number: "CHN/05/330-B", document_file: "deed-011.pdf", submitted_date: "2025-02-25", status: "Registered", scenario: "NORMAL_SALE", notes: "Deed file later reused by P-030." },
  { property_ref: "P-012", owner_wallet_id: "W5", location: "Gachibowli Tower 12", city: "Hyderabad", area_sqm: 180, property_type: "Commercial", survey_number: "HYD/14/777-C", document_file: "deed-012.pdf", submitted_date: "2025-03-03", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-013", owner_wallet_id: "W6", location: "Koregaon Park 9", city: "Pune", area_sqm: 650, property_type: "Residential", survey_number: "PUN/30/150-A", document_file: "deed-013.pdf", submitted_date: "2025-03-20", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-014", owner_wallet_id: "W7", location: "Chattarpur Farm 2", city: "Delhi", area_sqm: 4000, property_type: "Agricultural", survey_number: "DEL/02/900-B", document_file: "deed-014.pdf", submitted_date: "2025-03-11", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-015", owner_wallet_id: "W1", location: "Indiranagar 100ft Rd", city: "Bengaluru", area_sqm: 240, property_type: "Commercial", survey_number: "BLR/12/212-C", document_file: "deed-015.pdf", submitted_date: "2025-03-18", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-016", owner_wallet_id: "W2", location: "Panampilly Nagar 6", city: "Kochi", area_sqm: 470, property_type: "Residential", survey_number: "KOC/08/418-A", document_file: "deed-016.pdf", submitted_date: "2025-03-26", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-017", owner_wallet_id: "W3", location: "T Nagar 5th St", city: "Chennai", area_sqm: 360, property_type: "Residential", survey_number: "CHN/05/145-A", document_file: "deed-017.pdf", submitted_date: "2025-04-01", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-018", owner_wallet_id: "W4", location: "Powai Hills 3", city: "Mumbai", area_sqm: 2100, property_type: "Agricultural", survey_number: "MUM/21/730-B", document_file: "deed-018.pdf", submitted_date: "2025-04-07", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-019", owner_wallet_id: "W5", location: "Baner Road 21", city: "Pune", area_sqm: 540, property_type: "Residential", survey_number: "PUN/30/260-A", document_file: "deed-019.pdf", submitted_date: "2025-04-14", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-020", owner_wallet_id: "W7", location: "Saket District Centre", city: "Delhi", area_sqm: 300, property_type: "Residential", survey_number: "DEL/02/333-A", document_file: "deed-020.pdf", submitted_date: "2025-04-20", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-021", owner_wallet_id: "W7", location: "HSR Layout Sector 2", city: "Bengaluru", area_sqm: 420, property_type: "Residential", survey_number: "BLR/12/566-A", document_file: "deed-021.pdf", submitted_date: "2025-04-28", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-022", owner_wallet_id: "W1", location: "Banjara Hills Rd 12", city: "Hyderabad", area_sqm: 5400, property_type: "Agricultural", survey_number: "HYD/14/044-B", document_file: "deed-022.pdf", submitted_date: "2025-05-05", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-023", owner_wallet_id: "W2", location: "Egmore High St 4", city: "Chennai", area_sqm: 200, property_type: "Commercial", survey_number: "CHN/05/901-C", document_file: "deed-023.pdf", submitted_date: "2025-05-12", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-024", owner_wallet_id: "W3", location: "Viman Nagar 7", city: "Pune", area_sqm: 480, property_type: "Residential", survey_number: "PUN/30/370-A", document_file: "deed-024.pdf", submitted_date: "2025-05-19", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-025", owner_wallet_id: "W4", location: "12 MG Road", city: "Bengaluru", area_sqm: 540, property_type: "Residential", survey_number: "BLR/12/345-A", document_file: "deed-025.pdf", submitted_date: "2025-05-24", status: "Reverted", scenario: "DUPLICATE_SURVEY", notes: "Same survey+location as P-001 -> submit reverts (DuplicateSurveyLocation)." },
  { property_ref: "P-026", owner_wallet_id: "W5", location: "Elamkulam 3", city: "Kochi", area_sqm: 330, property_type: "Residential", survey_number: "KOC-26-INVALID", document_file: "deed-026.pdf", submitted_date: "2025-05-29", status: "Rejected", scenario: "INVALID_SURVEY_FORMAT", notes: "Survey number fails AAA/NN/NNN-X pattern; Registrar rejects." },
  { property_ref: "P-027", owner_wallet_id: "W6", location: "Kalyani Nagar 15", city: "Pune", area_sqm: 610, property_type: "Residential", survey_number: "PUN/30/480-A", document_file: "deed-027.pdf", submitted_date: "2025-06-04", status: "Rejected", scenario: "FORGED_DEED", notes: "Deed inconsistent on manual review; Registrar rejects." },
  { property_ref: "P-028", owner_wallet_id: "W7", location: "Nungambakkam 2", city: "Chennai", area_sqm: 290, property_type: "Residential", survey_number: "CHN/05/155-A", document_file: "deed-028.pdf", submitted_date: "2025-06-09", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-029", owner_wallet_id: "W1", location: "Aundh Lane 8", city: "Pune", area_sqm: 500, property_type: "Residential", survey_number: "PUN/30/590-A", document_file: "deed-029.pdf", submitted_date: "2025-06-14", status: "Pending", scenario: "NORMAL_SALE", notes: "Left in the Registrar queue to demo the pending workflow." },
  { property_ref: "P-030", owner_wallet_id: "W4", location: "Alwarpet 9", city: "Chennai", area_sqm: 450, property_type: "Residential", survey_number: "CHN/05/660-A", document_file: "deed-011.pdf", submitted_date: "2025-06-19", status: "Reverted", scenario: "REUSED_DOCUMENT", notes: "Reuses P-011's deed file -> identical hash -> submit reverts (DuplicateDocumentHash)." },
  // --- BULK_SUBMISSION cluster: W6, all same day -> 4th+ emits FlaggedForReview ---
  { property_ref: "P-031", owner_wallet_id: "W6", location: "Wakad Row 1", city: "Pune", area_sqm: 300, property_type: "Residential", survey_number: "PUN/30/700-A", document_file: "deed-031.pdf", submitted_date: "2025-06-25", status: "Flagged", scenario: "BULK_SUBMISSION", notes: "Bulk 1/4 from W6 in 24h." },
  { property_ref: "P-032", owner_wallet_id: "W6", location: "Wakad Row 2", city: "Pune", area_sqm: 300, property_type: "Residential", survey_number: "PUN/30/701-A", document_file: "deed-032.pdf", submitted_date: "2025-06-25", status: "Flagged", scenario: "BULK_SUBMISSION", notes: "Bulk 2/4 from W6 in 24h." },
  { property_ref: "P-033", owner_wallet_id: "W6", location: "Wakad Row 3", city: "Pune", area_sqm: 300, property_type: "Residential", survey_number: "PUN/30/702-A", document_file: "deed-033.pdf", submitted_date: "2025-06-25", status: "Flagged", scenario: "BULK_SUBMISSION", notes: "Bulk 3/4 from W6 in 24h." },
  { property_ref: "P-034", owner_wallet_id: "W6", location: "Wakad Row 4", city: "Pune", area_sqm: 300, property_type: "Residential", survey_number: "PUN/30/703-A", document_file: "deed-034.pdf", submitted_date: "2025-06-25", status: "Flagged", scenario: "BULK_SUBMISSION", notes: "Bulk 4/4 from W6 in 24h -> FlaggedForReview emitted." },
  { property_ref: "P-035", owner_wallet_id: "W5", location: "Kondapur Enclave 6", city: "Hyderabad", area_sqm: 430, property_type: "Residential", survey_number: "HYD/14/821-A", document_file: "deed-035.pdf", submitted_date: "2025-07-02", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-036", owner_wallet_id: "W3", location: "Juhu Tara Rd 3", city: "Mumbai", area_sqm: 260, property_type: "Commercial", survey_number: "MUM/21/515-C", document_file: "deed-036.pdf", submitted_date: "2025-07-09", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-037", owner_wallet_id: "W2", location: "Marine Drive Kochi 4", city: "Kochi", area_sqm: 380, property_type: "Residential", survey_number: "KOC/08/525-A", document_file: "deed-037.pdf", submitted_date: "2025-07-16", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-038", owner_wallet_id: "W4", location: "Anna Nagar W 10", city: "Chennai", area_sqm: 540, property_type: "Residential", survey_number: "CHN/05/175-A", document_file: "deed-038.pdf", submitted_date: "2025-07-23", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-039", owner_wallet_id: "W1", location: "Jayanagar 4th Block", city: "Bengaluru", area_sqm: 460, property_type: "Residential", survey_number: "BLR/12/633-A", document_file: "deed-039.pdf", submitted_date: "2025-07-30", status: "Registered", scenario: "NORMAL_SALE", notes: "Clean." },
  { property_ref: "P-040", owner_wallet_id: "W7", location: "Vasant Kunj C-9", city: "Delhi", area_sqm: 350, property_type: "Residential", survey_number: "DEL/02/488-A", document_file: "deed-040.pdf", submitted_date: "2025-08-05", status: "Pending", scenario: "NORMAL_SALE", notes: "Left pending to populate the Registrar queue." },
];

export const TRANSFERS: TransferRow[] = [
  // Rapid flip of P-005 — 3 transfers inside 30 days.
  { transfer_id: "T-001", property_ref: "P-005", from_wallet_id: "W5", to_wallet_id: "W1", date: "2025-07-05", scenario: "RAPID_FLIP" },
  { transfer_id: "T-002", property_ref: "P-005", from_wallet_id: "W1", to_wallet_id: "W2", date: "2025-07-14", scenario: "RAPID_FLIP" },
  { transfer_id: "T-003", property_ref: "P-005", from_wallet_id: "W2", to_wallet_id: "W3", date: "2025-07-22", scenario: "RAPID_FLIP" },
  // Circular trade of P-008 — W2 -> W3 -> W2.
  { transfer_id: "T-004", property_ref: "P-008", from_wallet_id: "W2", to_wallet_id: "W3", date: "2025-08-01", scenario: "CIRCULAR_TRADE" },
  { transfer_id: "T-005", property_ref: "P-008", from_wallet_id: "W3", to_wallet_id: "W2", date: "2025-08-06", scenario: "CIRCULAR_TRADE" },
  // Normal, well-spaced sales.
  { transfer_id: "T-006", property_ref: "P-001", from_wallet_id: "W1", to_wallet_id: "W4", date: "2025-09-01", scenario: "NORMAL_SALE" },
  { transfer_id: "T-007", property_ref: "P-003", from_wallet_id: "W3", to_wallet_id: "W5", date: "2025-09-15", scenario: "NORMAL_SALE" },
  { transfer_id: "T-008", property_ref: "P-010", from_wallet_id: "W3", to_wallet_id: "W6", date: "2025-10-02", scenario: "NORMAL_SALE" },
];

/** Expected survey-number format used by the off-chain risk scorer. */
export const SURVEY_PATTERN = /^[A-Z]{3}\/\d{2}\/\d{3}-[A-Z]$/;
