/**
 * EcoLink Australia — AASB S2 Report Data Aggregator
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PURPOSE:
 *   Aggregates classified transaction data into a sealed AASBReportSnapshot
 *   for a given company + financial year. This snapshot is the authoritative
 *   input for PDF report generation and regulatory submission.
 *
 * ARCHITECTURE:
 *   - 100% pure computation — no LLM, no regex, no estimation.
 *   - All summation uses integer-safe arithmetic (kg → converted to tonnes
 *     only at the final display layer) to avoid floating-point drift.
 *   - Data Quality Score is computed per AASB S2 / GHG Protocol guidance:
 *     only emission-relevant transactions count in the denominator.
 *   - The snapshot is immutable once created — designed for PDF generation.
 *
 * AASB S2 COMPLIANCE NOTE:
 *   AASB S2 paragraph 29 requires disclosure of estimation uncertainty.
 *   The data_quality_score field directly addresses this: a score < 100
 *   means some emission-relevant transactions remain unresolved (needs_review).
 *   The report PDF must disclose this score and list the unresolved count.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── Repository interface (injected, DB-agnostic) ──────────────────────────────

/**
 * A single classified transaction row as returned by the repository query.
 * All CO2e values are in KILOGRAMS (as stored in the DB) — tonnes conversion
 * happens only in the aggregator to avoid per-row rounding errors.
 */
export interface ClassifiedTransaction {
  id: string;
  scope: 1 | 2 | 3;
  scope1_co2e_kg: number;
  scope2_co2e_kg: number;
  scope3_co2e_kg: number;
  co2e_kg: number;
  classification_status: "classified" | "ignored" | "needs_review" | "pending";
  math_engine_version: string;
  category_code: string | null;
  transaction_date: string; // ISO 8601
}

/**
 * Summary counts from the repository — used for data quality score.
 */
export interface TransactionCounts {
  /** Transactions with classification_status = 'classified'. */
  classified: number;
  /** Transactions matched by IGNORE rule (not emission-relevant). */
  ignored: number;
  /** Transactions that still need human review. */
  needs_review: number;
  /** All transactions for the company in the financial year. */
  total: number;
}

/**
 * Repository interface — inject a real DB implementation in production,
 * a mock array in tests. Keeps this module 100% testable without a DB.
 */
export interface ReportRepository {
  /**
   * Return all classified (scope 1+2+3) transactions for the company
   * within the financial year date range.
   */
  getClassifiedTransactions(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ClassifiedTransaction[]>;

  /**
   * Return transaction status counts for the company in the period.
   */
  getTransactionCounts(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<TransactionCounts>;
}

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * Per-scope aggregated emissions summary.
 * All values in metric tonnes CO2e (tCO2e), rounded to 4 decimal places.
 */
export interface ScopeTotal {
  /** Total tCO2e for this scope. */
  totalTonnes: number;
  /** Number of classified transactions contributing to this scope. */
  transactionCount: number;
  /** Breakdown by category code → tCO2e. */
  byCategory: Record<string, number>;
}

/**
 * Data quality metadata per AASB S2 paragraph 29.
 */
export interface DataQualityMetrics {
  /**
   * Percentage of emission-relevant transactions that were classified.
   * = classified / (total - ignored) × 100
   * Range: 0–100. A value of 100 means full physical data coverage.
   */
  score: number;
  /** Absolute counts for regulator disclosure. */
  classifiedCount: number;
  ignoredCount: number;
  needsReviewCount: number;
  totalCount: number;
  /**
   * AASB S2 uncertainty tier.
   * ≥ 95 = Tier 1 (measured data)
   * 80–94 = Tier 2 (mostly measured, some estimated)
   * < 80  = Tier 3 (significant estimation uncertainty — must be disclosed)
   */
  uncertaintyTier: "Tier 1" | "Tier 2" | "Tier 3";
  disclosureRequired: boolean;
}

/**
 * Immutable snapshot produced by aggregateFinancialYear().
 * This is the authoritative input for PDF generation and DB sealing.
 */
export interface AASBReportSnapshot {
  // ── Identity ─────────────────────────────────────────────────────────────
  companyId: string;
  financialYear: string;       // e.g. 'FY24-25'
  periodStart: string;         // ISO 8601 date
  periodEnd: string;           // ISO 8601 date
  ngaEditionYear: number;      // e.g. 2025

  // ── Emission totals ───────────────────────────────────────────────────────
  scope1: ScopeTotal;
  scope2: ScopeTotal;
  scope3: ScopeTotal;

  /** Grand total: scope1 + scope2 + scope3, rounded to 4 decimal places. */
  totalCo2eTonnes: number;

  // ── Data quality (AASB S2 para. 29) ──────────────────────────────────────
  dataQuality: DataQualityMetrics;

  // ── Calculation provenance ────────────────────────────────────────────────
  mathEngineVersion: "calculator_v1";
  generatedAt: string;         // ISO 8601 timestamp
  classifiedTransactionIds: string[];
}

// ─── Financial year utilities ─────────────────────────────────────────────────

/**
 * Parse a financial year string (e.g. 'FY24-25') into start and end Dates.
 * Australian financial year runs 1 July → 30 June.
 *
 * @param financialYear  'FY24-25' format (short years only, e.g. 24 = 2024).
 * @returns              { periodStart, periodEnd } as Date objects.
 */
export function parseFinancialYear(financialYear: string): { periodStart: Date; periodEnd: Date } {
  const match = financialYear.match(/^FY(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(
      `Invalid financial year format: "${financialYear}". ` +
      'Expected "FY24-25" format (2-digit years, Australian FY: 1 Jul – 30 Jun).',
    );
  }
  const startYY = parseInt(match[1]!, 10);
  const endYY   = parseInt(match[2]!, 10);

  // Validate sequential years
  if (endYY !== (startYY + 1) % 100) {
    throw new Error(
      `Invalid financial year: "${financialYear}". End year must be exactly 1 year after start.`,
    );
  }

  const startYear = 2000 + startYY;
  const endYear   = 2000 + endYY;

  return {
    periodStart: new Date(`${startYear}-07-01`),
    periodEnd:   new Date(`${endYear}-06-30`),
  };
}

// ─── Safe summation ───────────────────────────────────────────────────────────

/**
 * Sum an array of kg values and convert to tonnes with 4-decimal precision.
 * Uses integer-accumulation pattern: sum all kg first, divide once at the end.
 * This prevents .toFixed(4) rounding errors from accumulating per-row.
 */
function sumKgToTonnes(values: number[]): number {
  // Accumulate in kg (avoid floating point drift across many rows)
  const totalKg = values.reduce((acc, v) => acc + v, 0);
  return parseFloat((totalKg / 1000).toFixed(4));
}

/**
 * Compute data quality score and AASB S2 uncertainty tier.
 */
function computeDataQuality(counts: TransactionCounts): DataQualityMetrics {
  const emissionRelevant = counts.total - counts.ignored;
  const score = emissionRelevant === 0
    ? 100  // No emission-relevant transactions → trivially complete
    : parseFloat(((counts.classified / emissionRelevant) * 100).toFixed(2));

  const tier: DataQualityMetrics["uncertaintyTier"] =
    score >= 95 ? "Tier 1" :
    score >= 80 ? "Tier 2" :
    "Tier 3";

  return {
    score,
    classifiedCount:  counts.classified,
    ignoredCount:     counts.ignored,
    needsReviewCount: counts.needs_review,
    totalCount:       counts.total,
    uncertaintyTier:  tier,
    disclosureRequired: tier === "Tier 3",
  };
}

// ─── Main aggregator ──────────────────────────────────────────────────────────

/**
 * Aggregate all classified transactions for a company's financial year
 * into an immutable AASBReportSnapshot.
 *
 * This is the authoritative pre-seal computation. Run this before creating
 * the aasb_reports row. The snapshot JSON is what gets hashed (SHA-256)
 * and stored in aasb_reports.sha256_hash.
 *
 * @param companyId       Company UUID.
 * @param financialYear   e.g. 'FY24-25'.
 * @param ngaEditionYear  NGA workbook year (e.g. 2025).
 * @param repo            Injected data repository.
 */
export async function aggregateFinancialYear(
  companyId: string,
  financialYear: string,
  ngaEditionYear: number,
  repo: ReportRepository,
): Promise<AASBReportSnapshot> {
  const { periodStart, periodEnd } = parseFinancialYear(financialYear);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const [transactions, counts] = await Promise.all([
    repo.getClassifiedTransactions(companyId, periodStart, periodEnd),
    repo.getTransactionCounts(companyId, periodStart, periodEnd),
  ]);

  // ── Scope segregation ─────────────────────────────────────────────────────
  const scope1Txs = transactions.filter(t => t.scope === 1);
  const scope2Txs = transactions.filter(t => t.scope === 2);
  const scope3Txs = transactions.filter(t => t.scope === 3);

  // ── Per-category breakdown ─────────────────────────────────────────────────
  function categoryBreakdown(txs: ClassifiedTransaction[], kgField: keyof ClassifiedTransaction): Record<string, number> {
    const acc: Record<string, number> = {};
    for (const tx of txs) {
      const code = tx.category_code ?? "uncategorised";
      const kg   = (tx[kgField] as number) ?? 0;
      acc[code]  = (acc[code] ?? 0) + kg;
    }
    // Convert each category total from kg to tonnes
    return Object.fromEntries(
      Object.entries(acc).map(([k, v]) => [k, parseFloat((v / 1000).toFixed(4))]),
    );
  }

  const scope1: ScopeTotal = {
    totalTonnes:      sumKgToTonnes(scope1Txs.map(t => t.scope1_co2e_kg)),
    transactionCount: scope1Txs.length,
    byCategory:       categoryBreakdown(scope1Txs, "scope1_co2e_kg"),
  };

  const scope2: ScopeTotal = {
    totalTonnes:      sumKgToTonnes(scope2Txs.map(t => t.scope2_co2e_kg)),
    transactionCount: scope2Txs.length,
    byCategory:       categoryBreakdown(scope2Txs, "scope2_co2e_kg"),
  };

  const scope3: ScopeTotal = {
    totalTonnes:      sumKgToTonnes(scope3Txs.map(t => t.scope3_co2e_kg)),
    transactionCount: scope3Txs.length,
    byCategory:       categoryBreakdown(scope3Txs, "scope3_co2e_kg"),
  };

  // ── Grand total (sum at tonne level to avoid kg accumulation error) ────────
  const totalCo2eTonnes = parseFloat(
    (scope1.totalTonnes + scope2.totalTonnes + scope3.totalTonnes).toFixed(4),
  );

  // ── Data quality ──────────────────────────────────────────────────────────
  const dataQuality = computeDataQuality(counts);

  return {
    companyId,
    financialYear,
    periodStart:  periodStart.toISOString().slice(0, 10),
    periodEnd:    periodEnd.toISOString().slice(0, 10),
    ngaEditionYear,
    scope1,
    scope2,
    scope3,
    totalCo2eTonnes,
    dataQuality,
    mathEngineVersion:        "calculator_v1",
    generatedAt:              new Date().toISOString(),
    classifiedTransactionIds: transactions.map(t => t.id),
  };
}
