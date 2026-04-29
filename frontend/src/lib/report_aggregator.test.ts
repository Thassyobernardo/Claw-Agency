/**
 * EcoLink Australia — Report Aggregator Tests
 *
 * NO DB. NO network. Pure mock repository → pure assertions.
 *
 * ALL expected values are manually verified below each test.
 * The aggregator's sumKgToTonnes() pattern (sum kg first, divide once)
 * is specifically tested to prove it avoids floating-point drift.
 */

import { describe, it, expect } from "vitest";
import {
  aggregateFinancialYear,
  parseFinancialYear,
  type ClassifiedTransaction,
  type TransactionCounts,
  type ReportRepository,
  type AASBReportSnapshot,
} from "./report_aggregator";

// ─── Mock repository factory ──────────────────────────────────────────────────

function makeRepo(
  transactions: ClassifiedTransaction[],
  counts: TransactionCounts,
): ReportRepository {
  return {
    async getClassifiedTransactions() { return transactions; },
    async getTransactionCounts()      { return counts; },
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY_ID = "co-0000-0000-0000-0001";
const FY         = "FY24-25";
const NGA_YEAR   = 2025;

/**
 * 5-transaction test set:
 *   Tx1 — Ampol petrol    Scope 1  scope1_co2e_kg=135.7  (→ 0.1357 t)
 *   Tx2 — Caltex diesel   Scope 1  scope1_co2e_kg=982.4  (→ 0.9824 t)
 *   Tx3 — Origin Energy   Scope 2  scope2_co2e_kg=660.0  (→ 0.6600 t)
 *   Tx4 — AGL Energy      Scope 2  scope2_co2e_kg=528.0  (→ 0.5280 t)
 *   Tx5 — Adobe (IGNORED) — NOT in classified list (count only in ignored)
 *
 * Total Scope 1 kg = 135.7 + 982.4 = 1118.1 → 1.1181 t
 * Total Scope 2 kg = 660.0 + 528.0 = 1188.0 → 1.1880 t
 * Total Scope 3 kg = 0               → 0.0000 t
 * Grand Total      = 1.1181 + 1.1880 = 2.3061 t
 */

const TX1: ClassifiedTransaction = {
  id: "tx-0001", scope: 1,
  scope1_co2e_kg: 135.7, scope2_co2e_kg: 0, scope3_co2e_kg: 0,
  co2e_kg: 135.7, classification_status: "classified",
  math_engine_version: "calculator_v1", category_code: "fuel_petrol",
  transaction_date: "2024-08-15",
};

const TX2: ClassifiedTransaction = {
  id: "tx-0002", scope: 1,
  scope1_co2e_kg: 982.4, scope2_co2e_kg: 0, scope3_co2e_kg: 0,
  co2e_kg: 982.4, classification_status: "classified",
  math_engine_version: "calculator_v1", category_code: "fuel_diesel",
  transaction_date: "2024-10-22",
};

const TX3: ClassifiedTransaction = {
  id: "tx-0003", scope: 2,
  scope1_co2e_kg: 0, scope2_co2e_kg: 660.0, scope3_co2e_kg: 0,
  co2e_kg: 660.0, classification_status: "classified",
  math_engine_version: "calculator_v1", category_code: "electricity",
  transaction_date: "2024-11-01",
};

const TX4: ClassifiedTransaction = {
  id: "tx-0004", scope: 2,
  scope1_co2e_kg: 0, scope2_co2e_kg: 528.0, scope3_co2e_kg: 0,
  co2e_kg: 528.0, classification_status: "classified",
  math_engine_version: "calculator_v1", category_code: "electricity",
  transaction_date: "2025-02-14",
};

const ALL_CLASSIFIED = [TX1, TX2, TX3, TX4];

const COUNTS_WITH_IGNORED: TransactionCounts = {
  classified:   4,
  ignored:      1,   // Adobe subscription
  needs_review: 0,
  total:        5,
};

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1 — parseFinancialYear
// ═════════════════════════════════════════════════════════════════════════════
describe("parseFinancialYear", () => {
  it("parses FY24-25 correctly: start=2024-07-01, end=2025-06-30", () => {
    const { periodStart, periodEnd } = parseFinancialYear("FY24-25");
    expect(periodStart.toISOString().slice(0, 10)).toBe("2024-07-01");
    expect(periodEnd.toISOString().slice(0, 10)).toBe("2025-06-30");
  });

  it("parses FY23-24 correctly", () => {
    const { periodStart } = parseFinancialYear("FY23-24");
    expect(periodStart.toISOString().slice(0, 10)).toBe("2023-07-01");
  });

  it("throws on invalid format 'FY2024-25'", () => {
    expect(() => parseFinancialYear("FY2024-25")).toThrow("Invalid financial year format");
  });

  it("throws on non-sequential years 'FY24-26'", () => {
    expect(() => parseFinancialYear("FY24-26")).toThrow("must be exactly 1 year after start");
  });

  it("throws on backwards years 'FY25-24'", () => {
    expect(() => parseFinancialYear("FY25-24")).toThrow("must be exactly 1 year after start");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2 — Scope totals (2× Scope 1 + 2× Scope 2 + 1× IGNORED)
// ═════════════════════════════════════════════════════════════════════════════
describe("aggregateFinancialYear — scope totals", () => {
  let snapshot: AASBReportSnapshot;

  // Build once, assert in multiple its
  beforeAll(async () => {
    snapshot = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(ALL_CLASSIFIED, COUNTS_WITH_IGNORED),
    );
  });

  it("Scope 1 total = 1.1181 t (135.7 + 982.4 kg ÷ 1000)", () => {
    // 1118.1 kg ÷ 1000 = 1.1181 t (integer accumulation pattern)
    expect(snapshot.scope1.totalTonnes).toBe(1.1181);
  });

  it("Scope 2 total = 1.1880 t (660.0 + 528.0 kg ÷ 1000)", () => {
    // 1188.0 kg ÷ 1000 = 1.1880 t
    expect(snapshot.scope2.totalTonnes).toBe(1.188);
  });

  it("Scope 3 total = 0.0000 t (no scope 3 transactions)", () => {
    expect(snapshot.scope3.totalTonnes).toBe(0);
  });

  it("Grand total = 2.3061 t (Scope 1 + 2 + 3)", () => {
    // 1.1181 + 1.1880 + 0 = 2.3061
    expect(snapshot.totalCo2eTonnes).toBe(2.3061);
  });

  it("Scope 1 transactionCount = 2", () => {
    expect(snapshot.scope1.transactionCount).toBe(2);
  });

  it("Scope 2 transactionCount = 2", () => {
    expect(snapshot.scope2.transactionCount).toBe(2);
  });

  it("Scope 3 transactionCount = 0", () => {
    expect(snapshot.scope3.transactionCount).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3 — Category breakdown
// ═════════════════════════════════════════════════════════════════════════════
describe("aggregateFinancialYear — category breakdown", () => {
  let snapshot: AASBReportSnapshot;

  beforeAll(async () => {
    snapshot = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(ALL_CLASSIFIED, COUNTS_WITH_IGNORED),
    );
  });

  it("Scope 1 byCategory.fuel_petrol = 0.1357 t", () => {
    expect(snapshot.scope1.byCategory["fuel_petrol"]).toBe(0.1357);
  });

  it("Scope 1 byCategory.fuel_diesel = 0.9824 t", () => {
    expect(snapshot.scope1.byCategory["fuel_diesel"]).toBe(0.9824);
  });

  it("Scope 2 byCategory.electricity = 1.1880 t (both electricity txs combined)", () => {
    // 660.0 + 528.0 = 1188.0 kg ÷ 1000 = 1.1880 t
    expect(snapshot.scope2.byCategory["electricity"]).toBe(1.188);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4 — Data Quality Score
// ═════════════════════════════════════════════════════════════════════════════
describe("aggregateFinancialYear — data quality score", () => {
  it("score = 100 when classified=4, ignored=1, total=5 (no needs_review)", async () => {
    /**
     * Proof:
     *   emission-relevant = total - ignored = 5 - 1 = 4
     *   score = 4 / 4 × 100 = 100%  → Tier 1
     */
    const snap = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(ALL_CLASSIFIED, COUNTS_WITH_IGNORED),
    );
    expect(snap.dataQuality.score).toBe(100);
    expect(snap.dataQuality.uncertaintyTier).toBe("Tier 1");
    expect(snap.dataQuality.disclosureRequired).toBe(false);
  });

  it("score = 80 when 4 classified, 1 ignored, 1 needs_review (total 6) → Tier 2", async () => {
    /**
     * Proof:
     *   emission-relevant = 6 - 1 = 5
     *   score = 4 / 5 × 100 = 80%  → Tier 2
     */
    const snap = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(ALL_CLASSIFIED, { classified: 4, ignored: 1, needs_review: 1, total: 6 }),
    );
    expect(snap.dataQuality.score).toBe(80);
    expect(snap.dataQuality.uncertaintyTier).toBe("Tier 2");
    expect(snap.dataQuality.disclosureRequired).toBe(false);
  });

  it("score = 50 when 2 classified, 0 ignored, 2 needs_review (total 4) → Tier 3", async () => {
    /**
     * Proof:
     *   emission-relevant = 4 - 0 = 4
     *   score = 2 / 4 × 100 = 50%  → Tier 3 → disclosureRequired = true
     */
    const snap = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(
        [TX1, TX2],
        { classified: 2, ignored: 0, needs_review: 2, total: 4 },
      ),
    );
    expect(snap.dataQuality.score).toBe(50);
    expect(snap.dataQuality.uncertaintyTier).toBe("Tier 3");
    expect(snap.dataQuality.disclosureRequired).toBe(true);
  });

  it("score = 100 when all transactions are IGNORED (no emission-relevant)", async () => {
    /**
     * Edge case: company processes only SaaS subscriptions.
     * emission-relevant = 5 - 5 = 0 → trivially 100%
     */
    const snap = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(
        [],
        { classified: 0, ignored: 5, needs_review: 0, total: 5 },
      ),
    );
    expect(snap.dataQuality.score).toBe(100);
    expect(snap.totalCo2eTonnes).toBe(0);
  });

  it("disclosureRequired counts echoed correctly", async () => {
    const snap = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(ALL_CLASSIFIED, COUNTS_WITH_IGNORED),
    );
    expect(snap.dataQuality.classifiedCount).toBe(4);
    expect(snap.dataQuality.ignoredCount).toBe(1);
    expect(snap.dataQuality.needsReviewCount).toBe(0);
    expect(snap.dataQuality.totalCount).toBe(5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5 — Snapshot structure (immutability contract)
// ═════════════════════════════════════════════════════════════════════════════
describe("aggregateFinancialYear — snapshot structure", () => {
  let snapshot: AASBReportSnapshot;

  beforeAll(async () => {
    snapshot = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(ALL_CLASSIFIED, COUNTS_WITH_IGNORED),
    );
  });

  it("companyId is echoed", () => {
    expect(snapshot.companyId).toBe(COMPANY_ID);
  });

  it("financialYear is echoed", () => {
    expect(snapshot.financialYear).toBe("FY24-25");
  });

  it("periodStart = 2024-07-01", () => {
    expect(snapshot.periodStart).toBe("2024-07-01");
  });

  it("periodEnd = 2025-06-30", () => {
    expect(snapshot.periodEnd).toBe("2025-06-30");
  });

  it("ngaEditionYear = 2025", () => {
    expect(snapshot.ngaEditionYear).toBe(2025);
  });

  it("mathEngineVersion = 'calculator_v1'", () => {
    expect(snapshot.mathEngineVersion).toBe("calculator_v1");
  });

  it("classifiedTransactionIds contains all 4 classified tx IDs", () => {
    expect(snapshot.classifiedTransactionIds).toHaveLength(4);
    expect(snapshot.classifiedTransactionIds).toContain("tx-0001");
    expect(snapshot.classifiedTransactionIds).toContain("tx-0004");
  });

  it("generatedAt is a valid ISO 8601 timestamp", () => {
    expect(new Date(snapshot.generatedAt).getFullYear()).toBeGreaterThan(2020);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6 — Floating-point safety (integer accumulation pattern)
// ═════════════════════════════════════════════════════════════════════════════
describe("Floating-point safety — kg accumulation pattern", () => {
  it("100 transactions of 0.1 kg each = 10.0000 kg (not 9.9999…)", async () => {
    /**
     * Classic JS floating-point problem:
     *   0.1 + 0.1 + ... (100 times) = 9.999999999999998 in naive sum
     *
     * The integer accumulation pattern (sum first, divide once) avoids this:
     *   100 × 0.1 = 10.0 (exact, because we sum then divide)
     */
    const manyTxs: ClassifiedTransaction[] = Array.from({ length: 100 }, (_, i) => ({
      id: `fp-${i}`,
      scope: 1 as const,
      scope1_co2e_kg: 0.1,
      scope2_co2e_kg: 0,
      scope3_co2e_kg: 0,
      co2e_kg: 0.1,
      classification_status: "classified" as const,
      math_engine_version: "calculator_v1",
      category_code: "fuel_petrol",
      transaction_date: "2024-08-01",
    }));

    const snap = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(manyTxs, { classified: 100, ignored: 0, needs_review: 0, total: 100 }),
    );

    // 100 × 0.1 kg = 10.0 kg ÷ 1000 = 0.01 t
    expect(snap.scope1.totalTonnes).toBe(0.01);
  });

  it("3 transactions of 333.333… kg each rounds stably to 4 decimals", async () => {
    // Each tx = 1000/3 kg ≈ 333.3333...
    // Total kg = 1000.0 → 1.0000 t
    const val = 1000 / 3;
    const txs: ClassifiedTransaction[] = [
      { ...TX1, id: "r1", scope1_co2e_kg: val },
      { ...TX1, id: "r2", scope1_co2e_kg: val },
      { ...TX1, id: "r3", scope1_co2e_kg: val },
    ];
    const snap = await aggregateFinancialYear(
      COMPANY_ID, FY, NGA_YEAR,
      makeRepo(txs, { classified: 3, ignored: 0, needs_review: 0, total: 3 }),
    );
    // 3 × (1000/3) = 1000 kg = 1.0000 t — parseFloat(".toFixed(4)") stabilises this
    expect(snap.scope1.totalTonnes).toBe(1.0);
  });
});

// ═══ Vitest needs beforeAll imported ══════════════════════════════════════════
import { beforeAll } from "vitest";
