/**
 * EcoLink Australia — Regex Extractor + Transaction Router Tests
 *
 * NO mocks. NO OpenAI client. NO network calls.
 * Every test is pure input → output assertion.
 */

import { describe, it, expect } from "vitest";
import { extractViaRegex, extractAnyUnit } from "./regex_extractor";
import {
  routeTransactionStatic,
  type MerchantRule,
  type XeroTransaction,
  type ExtractedResult,
  type IgnoredResult,
  type NeedsReviewResult,
} from "./transaction_router";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RULES: MerchantRule[] = [
  {
    id: "1", merchant_name: "Ampol", pattern: "ampol",
    match_type: "contains", category_code: "fuel_petrol", scope: 1,
    activity_unit: "L", requires_state: false,
    notes_citation: "NGA 2025 Table 3", priority: 200, action: "EXTRACT_VOLUME",
  },
  {
    id: "2", merchant_name: "BP Australia", pattern: "bp ",
    match_type: "contains", category_code: "fuel_petrol", scope: 1,
    activity_unit: "L", requires_state: false,
    notes_citation: "NGA 2025 Table 3", priority: 200, action: "EXTRACT_VOLUME",
  },
  {
    id: "3", merchant_name: "Origin Energy", pattern: "origin energy",
    match_type: "contains", category_code: "electricity", scope: 2,
    activity_unit: "kWh", requires_state: true,
    notes_citation: "NGA 2025 Table 5", priority: 300, action: "EXTRACT_VOLUME",
  },
  {
    id: "4", merchant_name: "AGL Energy", pattern: "agl",
    match_type: "contains", category_code: "electricity", scope: 2,
    activity_unit: "kWh", requires_state: true,
    notes_citation: "NGA 2025 Table 5", priority: 300, action: "EXTRACT_VOLUME",
  },
  {
    id: "5", merchant_name: "Adobe", pattern: "adobe",
    match_type: "contains", category_code: "excluded_software", scope: 0,
    activity_unit: null, requires_state: false,
    notes_citation: "SaaS — not emission-relevant", priority: 480, action: "IGNORE",
  },
  {
    id: "6", merchant_name: "Xero", pattern: "xero",
    match_type: "contains", category_code: "excluded_software", scope: 0,
    activity_unit: null, requires_state: false,
    notes_citation: "SaaS accounting — not emission-relevant", priority: 500, action: "IGNORE",
  },
  {
    id: "7", merchant_name: "ATO", pattern: " ato ",
    match_type: "contains", category_code: "excluded_software", scope: 0,
    activity_unit: null, requires_state: false,
    notes_citation: "Tax payment — not an emission event", priority: 490, action: "IGNORE",
  },
  {
    id: "8", merchant_name: "Microsoft", pattern: "microsoft",
    match_type: "contains", category_code: "excluded_software", scope: 0,
    activity_unit: null, requires_state: false,
    notes_citation: "SaaS — not emission-relevant", priority: 480, action: "IGNORE",
  },
  {
    id: "9", merchant_name: "Accor Hotels", pattern: "accor",
    match_type: "contains", category_code: "accommodation_business", scope: 3,
    activity_unit: null, requires_state: false,
    notes_citation: "Accommodation — no standard physical unit", priority: 200, action: "NEEDS_REVIEW",
  },
  {
    id: "10", merchant_name: "Jemena Gas", pattern: "jemena",
    match_type: "contains", category_code: "natural_gas", scope: 1,
    activity_unit: "GJ", requires_state: false,
    notes_citation: "NGA 2025 Table 1", priority: 300, action: "EXTRACT_VOLUME",
  },
];

function makeTx(overrides: Partial<XeroTransaction> = {}): XeroTransaction {
  return {
    merchantName: "Unknown",
    description: "Test transaction",
    amountAud: 100,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1 — extractViaRegex: Litres (L)
// ═════════════════════════════════════════════════════════════════════════════
describe("extractViaRegex — Litres (L)", () => {
  it("extracts integer: '62 L'", () => {
    expect(extractViaRegex("Fuel purchase 62 L petrol", "L")).toBe(62);
  });

  it("extracts decimal: '62.5 L'", () => {
    expect(extractViaRegex("Volume: 62.5 L", "L")).toBe(62.5);
  });

  it("extracts 'Litres' spelling", () => {
    expect(extractViaRegex("Total: 500 Litres", "L")).toBe(500);
  });

  it("extracts 'Liters' (US) spelling", () => {
    expect(extractViaRegex("Dispensed 120 Liters", "L")).toBe(120);
  });

  it("extracts 'Lts' abbreviation", () => {
    expect(extractViaRegex("Fuel 80 Lts", "L")).toBe(80);
  });

  it("extracts comma-formatted number: '1,240 L'", () => {
    expect(extractViaRegex("Bulk fuel 1,240 L diesel", "L")).toBe(1240);
  });

  it("returns null when no L match found", () => {
    expect(extractViaRegex("Microsoft 365 subscription $99", "L")).toBeNull();
  });

  it("returns null for ambiguous (two different values)", () => {
    // '50 L' and '80 L' — which one is the billed volume?
    expect(extractViaRegex("Filled 50 L then topped 80 L", "L")).toBeNull();
  });

  it("returns same value for duplicate labels (non-ambiguous)", () => {
    // '62.5 L' appears twice — same value → unambiguous
    expect(extractViaRegex("Volume: 62.5 L (62.5 L billed)", "L")).toBe(62.5);
  });

  it("does NOT match dollar amounts", () => {
    expect(extractViaRegex("Invoice total: $125.00", "L")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2 — extractViaRegex: kWh
// ═════════════════════════════════════════════════════════════════════════════
describe("extractViaRegex — kWh", () => {
  it("extracts '1240 kWh'", () => {
    expect(extractViaRegex("Electricity usage: 1240 kWh", "kWh")).toBe(1240);
  });

  it("extracts '1,240 kWh' (comma-formatted)", () => {
    expect(extractViaRegex("Total consumption: 1,240 kWh", "kWh")).toBe(1240);
  });

  it("extracts lowercase 'kwh'", () => {
    expect(extractViaRegex("Used 850 kwh this quarter", "kWh")).toBe(850);
  });

  it("extracts uppercase 'KWH'", () => {
    expect(extractViaRegex("850 KWH total", "kWh")).toBe(850);
  });

  it("returns null when no kWh found", () => {
    expect(extractViaRegex("Fuel 50 L petrol", "kWh")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3 — extractViaRegex: GJ (Natural Gas)
// ═════════════════════════════════════════════════════════════════════════════
describe("extractViaRegex — GJ", () => {
  it("extracts '100 GJ'", () => {
    expect(extractViaRegex("Gas consumption: 100 GJ", "GJ")).toBe(100);
  });

  it("extracts decimal GJ '38.6 GJ'", () => {
    expect(extractViaRegex("Energy: 38.6 GJ", "GJ")).toBe(38.6);
  });

  it("extracts lowercase 'gj'", () => {
    expect(extractViaRegex("Natural gas: 250 gj", "GJ")).toBe(250);
  });

  it("returns null for pure kWh text", () => {
    expect(extractViaRegex("Electricity 1000 kWh", "GJ")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4 — extractViaRegex: other units
// ═════════════════════════════════════════════════════════════════════════════
describe("extractViaRegex — m3, t, kg", () => {
  it("extracts m3: '450 m3'", () => {
    expect(extractViaRegex("Gas volume 450 m3", "m3")).toBe(450);
  });

  it("extracts m³ unicode: '450 m³'", () => {
    expect(extractViaRegex("Gas volume 450 m³ residential", "m3")).toBe(450);
  });

  it("extracts tonne: '5.2 t'", () => {
    expect(extractViaRegex("Waste disposed 5.2 t MSW", "t")).toBe(5.2);
  });

  it("extracts 'tonnes': '3 tonnes'", () => {
    expect(extractViaRegex("Collected 3 tonnes of waste", "t")).toBe(3);
  });

  it("extracts kg: '2.5 kg'", () => {
    expect(extractViaRegex("Refrigerant recharge 2.5 kg R-410A", "kg")).toBe(2.5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5 — extractAnyUnit (multi-unit scan)
// ═════════════════════════════════════════════════════════════════════════════
describe("extractAnyUnit — multi-unit scan", () => {
  it("finds Litres when present", () => {
    const r = extractAnyUnit("Fuel: 62.5 L petrol");
    expect(r?.unit).toBe("L");
    expect(r?.value).toBe(62.5);
  });

  it("finds kWh when present", () => {
    const r = extractAnyUnit("Electricity 1240 kWh NSW");
    expect(r?.unit).toBe("kWh");
    expect(r?.value).toBe(1240);
  });

  it("returns null for non-physical text", () => {
    expect(extractAnyUnit("Adobe Creative Cloud subscription $99")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6 — routeTransactionStatic: IGNORE path (zero API calls)
// ═════════════════════════════════════════════════════════════════════════════
describe("routeTransactionStatic — IGNORE path", () => {
  it("Xero subscription → status: ignored", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Xero Limited", description: "Monthly subscription Apr 2025" }),
      RULES,
    );
    expect(r.status).toBe("ignored");
  });

  it("Adobe → status: ignored", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Adobe Systems", description: "Creative Cloud annual" }),
      RULES,
    );
    expect(r.status).toBe("ignored");
  });

  it("Microsoft → status: ignored", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Microsoft Corp", description: "Microsoft 365 Business" }),
      RULES,
    );
    expect(r.status).toBe("ignored");
  });

  it("ATO → status: ignored", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "ATO", description: "GST ato payment Q2" }),
      RULES,
    );
    expect(r.status).toBe("ignored");
  });

  it("ignored result has matchedRule with action=IGNORE", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Xero Ltd", description: "Sub" }),
      RULES,
    ) as IgnoredResult;
    expect(r.matchedRule.action).toBe("IGNORE");
    expect(r.matchedRule.category_code).toBe("excluded_software");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 7 — routeTransactionStatic: EXTRACT_VOLUME path
// ═════════════════════════════════════════════════════════════════════════════
describe("routeTransactionStatic — EXTRACT_VOLUME path", () => {
  it("Ampol + '62.5 L' in description → extracted, quantity=62.5", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Ampol", description: "Fuel purchase 62.5 L petrol" }),
      RULES,
    ) as ExtractedResult;
    expect(r.status).toBe("extracted");
    expect(r.quantity).toBe(62.5);
    expect(r.unit).toBe("L");
  });

  it("Ampol + no volume in description → needs_review", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Ampol", description: "Fuel card payment" }),
      RULES,
    );
    expect(r.status).toBe("needs_review");
  });

  it("needs_review reason states manual entry requirement (in PT)", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Ampol", description: "No volume here" }),
      RULES,
    ) as NeedsReviewResult;
    expect(r.reason).toContain("Preenchimento manual necessário");
  });

  it("AGL + '1,240 kWh' → extracted, quantity=1240", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "AGL Energy Pty Ltd", description: "Electricity usage: 1,240 kWh Q1 2025" }),
      RULES,
    ) as ExtractedResult;
    expect(r.status).toBe("extracted");
    expect(r.quantity).toBe(1240);
    expect(r.unit).toBe("kWh");
  });

  it("Origin Energy + kWh → requiresState=true", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Origin Energy", description: "Electricity 800 kWh" }),
      RULES,
    ) as ExtractedResult;
    expect(r.requiresState).toBe(true);
    expect(r.scope).toBe(2);
  });

  it("Jemena Gas + '100 GJ' → extracted, GJ unit", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Jemena Gas Networks", description: "Natural gas supply 100 GJ commercial" }),
      RULES,
    ) as ExtractedResult;
    expect(r.status).toBe("extracted");
    expect(r.quantity).toBe(100);
    expect(r.unit).toBe("GJ");
    expect(r.categoryCode).toBe("natural_gas");
  });

  it("extracted result has correct categoryCode, scope, matchedRule", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Ampol", description: "50 L diesel" }),
      RULES,
    ) as ExtractedResult;
    expect(r.categoryCode).toBe("fuel_petrol");
    expect(r.scope).toBe(1);
    expect(r.matchedRule.action).toBe("EXTRACT_VOLUME");
  });

  it("priority: higher priority rule wins (AGL priority=300 beats generic lower)", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "AGL Energy", description: "Electricity 500 kWh" }),
      RULES,
    ) as ExtractedResult;
    expect(r.matchedRule.merchant_name).toBe("AGL Energy");
    expect(r.categoryCode).toBe("electricity");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 8 — routeTransactionStatic: NEEDS_REVIEW path
// ═════════════════════════════════════════════════════════════════════════════
describe("routeTransactionStatic — NEEDS_REVIEW path", () => {
  it("Accor Hotels → needs_review (rule action=NEEDS_REVIEW)", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Accor Hotels Sydney", description: "2 nights" }),
      RULES,
    );
    expect(r.status).toBe("needs_review");
  });

  it("unknown merchant → needs_review (no match)", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Bubba Bait Shop", description: "Fishing gear" }),
      RULES,
    );
    expect(r.status).toBe("needs_review");
  });

  it("accommodation needs_review has pre-filled categoryCode", async () => {
    const r = await routeTransactionStatic(
      makeTx({ merchantName: "Accor", description: "Hotel stay" }),
      RULES,
    ) as NeedsReviewResult;
    expect(r.categoryCode).toBe("accommodation_business");
    expect(r.scope).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 9 — Zero-API invariants (no LLM client in any path)
// ═════════════════════════════════════════════════════════════════════════════
describe("Zero-API Invariants", () => {
  it("routeTransactionStatic signature has no openai parameter", () => {
    // TypeScript enforces this at compile time.
    // This runtime test confirms the function only takes 2 args.
    expect(routeTransactionStatic.length).toBe(2);
  });

  it("3× IGNORE transactions complete with no errors (no API timeout risk)", async () => {
    const inputs = [
      makeTx({ merchantName: "Xero",      description: "Annual plan" }),
      makeTx({ merchantName: "Adobe Inc", description: "Creative Cloud" }),
      makeTx({ merchantName: "Microsoft", description: "Azure DevOps" }),
    ];
    const results = await Promise.all(inputs.map(tx => routeTransactionStatic(tx, RULES)));
    expect(results.every(r => r.status === "ignored")).toBe(true);
  });

  it("EXTRACT_VOLUME with valid quantity resolves synchronously-fast (< 10ms)", async () => {
    const start = Date.now();
    await routeTransactionStatic(
      makeTx({ merchantName: "Ampol", description: "Fuel 62.5 L" }),
      RULES,
    );
    expect(Date.now() - start).toBeLessThan(10);
  });
});
