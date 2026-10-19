import { describe, it, expect } from "vitest";
import { scoreProperty, scoreAll, SURVEY_PATTERN, RiskContext } from "./riskScore";
import type { IndexedProperty, IndexedTransfer } from "../types";

function prop(over: Partial<IndexedProperty>): IndexedProperty {
  return {
    property_ref: "P-001",
    owner_wallet_id: "W1",
    ownerAddress: "0x1",
    location: "1 Main St",
    city: "Bengaluru",
    area_sqm: 500,
    property_type: "Residential",
    survey_number: "BLR/12/345-A",
    document_file: "deed-001.pdf",
    documentCID: "cid1",
    documentHash: "0xhash1",
    docUrl: "/demo-docs/deed-001.pdf",
    submitted_date: "2025-01-01",
    scenario: "NORMAL_SALE",
    notes: "",
    datasetStatus: "Registered",
    onChainId: "1",
    onChainStatus: "Registered",
    flagged: false,
    outcome: "Registered",
    reason: "",
    ...over,
  };
}

function tx(over: Partial<IndexedTransfer>): IndexedTransfer {
  return {
    transfer_id: "T-001",
    property_ref: "P-001",
    from_wallet_id: "W1",
    to_wallet_id: "W2",
    fromAddress: "0x1",
    toAddress: "0x2",
    date: "2025-02-01",
    scenario: "NORMAL_SALE",
    outcome: "Completed",
    ...over,
  };
}

describe("SURVEY_PATTERN", () => {
  it("accepts the canonical format and rejects malformed ones", () => {
    expect(SURVEY_PATTERN.test("BLR/12/345-A")).toBe(true);
    expect(SURVEY_PATTERN.test("KOC-26-INVALID")).toBe(false);
    expect(SURVEY_PATTERN.test("blr/12/345-a")).toBe(false);
    expect(SURVEY_PATTERN.test("BLR/1/345-A")).toBe(false);
  });
});

describe("scoreProperty", () => {
  it("scores a clean property as Low with no signals", () => {
    const ctx: RiskContext = { properties: [prop({})], transfers: [] };
    const r = scoreProperty("P-001", ctx);
    expect(r.signals).toHaveLength(0);
    expect(r.score).toBe(0);
    expect(r.level).toBe("Low");
  });

  it("returns an empty Low result for an unknown ref", () => {
    const r = scoreProperty("P-999", { properties: [prop({})], transfers: [] });
    expect(r.score).toBe(0);
    expect(r.level).toBe("Low");
  });

  it("flags an invalid survey-number format", () => {
    const ctx: RiskContext = {
      properties: [prop({ survey_number: "KOC-26-INVALID" })],
      transfers: [],
    };
    const r = scoreProperty("P-001", ctx);
    expect(r.signals.map((s) => s.code)).toContain("SURVEY_FORMAT");
  });

  it("flags a missing document", () => {
    const ctx: RiskContext = {
      properties: [prop({ documentCID: "", documentHash: "" })],
      transfers: [],
    };
    const r = scoreProperty("P-001", ctx);
    expect(r.signals.map((s) => s.code)).toContain("MISSING_DOCUMENT");
  });

  it("flags a reused document hash across properties", () => {
    const ctx: RiskContext = {
      properties: [
        prop({ property_ref: "P-011", documentHash: "0xSHARED" }),
        prop({ property_ref: "P-030", documentHash: "0xSHARED", survey_number: "CHN/05/660-A", location: "elsewhere" }),
      ],
      transfers: [],
    };
    const r = scoreProperty("P-030", ctx);
    const reused = r.signals.find((s) => s.code === "REUSED_DOCUMENT");
    expect(reused).toBeDefined();
    expect(reused!.detail).toContain("P-011");
  });

  it("flags duplicate survey + location", () => {
    const ctx: RiskContext = {
      properties: [
        prop({ property_ref: "P-001", survey_number: "BLR/12/345-A", location: "12 MG Road" }),
        prop({ property_ref: "P-025", survey_number: "BLR/12/345-A", location: "12 MG Road", documentHash: "0xdifferent" }),
      ],
      transfers: [],
    };
    const r = scoreProperty("P-025", ctx);
    expect(r.signals.map((s) => s.code)).toContain("DUPLICATE_SURVEY");
  });

  it("flags bulk submissions within 24h from one owner", () => {
    const properties = ["P-031", "P-032", "P-033", "P-034"].map((ref, i) =>
      prop({
        property_ref: ref,
        owner_wallet_id: "W6",
        submitted_date: "2025-06-25",
        survey_number: `PUN/30/70${i}-A`,
        location: `Wakad Row ${i}`,
        documentHash: `0xbulk${i}`,
      })
    );
    const r = scoreProperty("P-034", { properties, transfers: [] });
    const bulk = r.signals.find((s) => s.code === "BULK_SUBMISSION");
    expect(bulk).toBeDefined();
    expect(bulk!.detail).toContain("4");
  });

  it("flags rapid flipping (3 transfers within 30 days)", () => {
    const transfers: IndexedTransfer[] = [
      tx({ transfer_id: "T-1", date: "2025-07-05", from_wallet_id: "W5", to_wallet_id: "W1" }),
      tx({ transfer_id: "T-2", date: "2025-07-14", from_wallet_id: "W1", to_wallet_id: "W2" }),
      tx({ transfer_id: "T-3", date: "2025-07-22", from_wallet_id: "W2", to_wallet_id: "W3" }),
    ];
    const r = scoreProperty("P-001", { properties: [prop({})], transfers });
    expect(r.signals.map((s) => s.code)).toContain("RAPID_FLIP");
  });

  it("does NOT flag flipping when transfers are spread beyond 30 days", () => {
    const transfers: IndexedTransfer[] = [
      tx({ transfer_id: "T-1", date: "2025-01-05" }),
      tx({ transfer_id: "T-2", date: "2025-04-05" }),
      tx({ transfer_id: "T-3", date: "2025-09-05" }),
    ];
    const r = scoreProperty("P-001", { properties: [prop({})], transfers });
    expect(r.signals.map((s) => s.code)).not.toContain("RAPID_FLIP");
  });

  it("flags a circular / wash trade (A->B then B->A)", () => {
    const transfers: IndexedTransfer[] = [
      tx({ transfer_id: "T-1", date: "2025-08-01", from_wallet_id: "W2", to_wallet_id: "W3" }),
      tx({ transfer_id: "T-2", date: "2025-08-06", from_wallet_id: "W3", to_wallet_id: "W2" }),
    ];
    const r = scoreProperty("P-001", { properties: [prop({})], transfers });
    expect(r.signals.map((s) => s.code)).toContain("CIRCULAR_TRADE");
  });

  it("caps the score at 100 and escalates the level", () => {
    const ctx: RiskContext = {
      properties: [
        prop({ property_ref: "P-X", documentHash: "0xDUP", survey_number: "BAD", location: "L" }),
        prop({ property_ref: "P-Y", documentHash: "0xDUP", survey_number: "BAD", location: "L", owner_wallet_id: "W1" }),
      ],
      transfers: [],
    };
    const r = scoreProperty("P-X", ctx);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.level).toBe("High");
  });
});

describe("scoreAll", () => {
  it("returns results sorted by descending risk", () => {
    const ctx: RiskContext = {
      properties: [
        prop({ property_ref: "CLEAN" }),
        prop({ property_ref: "BAD", survey_number: "INVALID", documentCID: "", documentHash: "" }),
      ],
      transfers: [],
    };
    const ranked = scoreAll(ctx);
    expect(ranked[0].property.property_ref).toBe("BAD");
    expect(ranked[0].risk.score).toBeGreaterThan(ranked[1].risk.score);
  });
});
