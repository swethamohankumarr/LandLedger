/**
 * Writes the synthetic dataset to /data:
 *   - wallets.csv, properties.csv, transfers.csv
 *   - documents/*.pdf (one valid PDF per distinct document_file)
 *
 * Deterministic: re-running regenerates identical bytes, so document hashes are
 * stable. P-030 intentionally shares P-011's deed file.
 *
 *   npm run gen:dataset
 */
import * as fs from "fs";
import * as path from "path";
import { makeDeedPdf } from "./lib/pdf";
import { WALLETS, PROPERTIES, TRANSFERS } from "./lib/dataset";

const DATA_DIR = path.join(__dirname, "..", "data");
const DOCS_DIR = path.join(DATA_DIR, "documents");

function csv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(","));
  return lines.join("\n") + "\n";
}

function main() {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, ".mock-ipfs"), { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, ".mock-ipfs", ".gitkeep"), "");

  // --- CSVs ---
  fs.writeFileSync(path.join(DATA_DIR, "wallets.csv"), csv(WALLETS as never));
  fs.writeFileSync(
    path.join(DATA_DIR, "properties.csv"),
    csv(
      PROPERTIES.map((p) => ({
        property_ref: p.property_ref,
        owner_wallet_id: p.owner_wallet_id,
        location: p.location,
        city: p.city,
        area_sqm: p.area_sqm,
        property_type: p.property_type,
        survey_number: p.survey_number,
        document_file: p.document_file,
        submitted_date: p.submitted_date,
        status: p.status,
        scenario: p.scenario,
        notes: p.notes,
      }))
    )
  );
  fs.writeFileSync(path.join(DATA_DIR, "transfers.csv"), csv(TRANSFERS as never));

  // --- PDFs: one per distinct document_file ---
  const written = new Set<string>();
  let created = 0;
  for (const p of PROPERTIES) {
    if (written.has(p.document_file)) continue;
    written.add(p.document_file);

    // The deed's content is keyed to the FIRST property that uses the file, so
    // deed-011.pdf (also used by P-030) is generated once from P-011's details.
    const source = PROPERTIES.find((q) => q.document_file === p.document_file)!;
    const pdf = makeDeedPdf("CERTIFIED COPY OF LAND DEED (SYNTHETIC)", [
      `Document file : ${source.document_file}`,
      `Property ref  : ${source.property_ref}`,
      `Survey number : ${source.survey_number}`,
      `Location      : ${source.location}, ${source.city}`,
      `Area (sq.m)   : ${source.area_sqm}`,
      `Type          : ${source.property_type}`,
      "",
      "This is a synthetic deed generated for the Decentralized Land",
      "Registry academic project. It has no legal validity.",
    ]);
    fs.writeFileSync(path.join(DOCS_DIR, p.document_file), pdf);
    created++;
  }

  console.log(`Dataset written to ${DATA_DIR}`);
  console.log(`  wallets.csv     : ${WALLETS.length} rows`);
  console.log(`  properties.csv  : ${PROPERTIES.length} rows`);
  console.log(`  transfers.csv   : ${TRANSFERS.length} rows`);
  console.log(`  documents/*.pdf : ${created} files (P-030 reuses deed-011.pdf)`);
}

main();
