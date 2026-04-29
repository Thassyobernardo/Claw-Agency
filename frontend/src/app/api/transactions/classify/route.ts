/**
 * POST /api/transactions/classify
 *
 * AASB S2 / NGA Factors 2024-compliant classifier route.
 *
 * THREE-TIER PIPELINE (AI ensemble REMOVED — greenwashing risk):
 *
 *   Tier 0 — Merchant Rules Engine (deterministic, auditable, zero cost)
 *     Queries `merchant_classification_rules` table.
 *     Matches known Australian merchants (BP, Origin Energy, Qantas, Uber, etc.)
 *     Category is rule-assigned → 100% confidence, full audit trail.
 *     Physical quantity still extracted from description; if absent → needs_review
 *     with category pre-filled (reviewer adds quantity only, no re-categorisation).
 *
 *   Tier 1 — Keyword classifier (src/lib/classifier.ts)
 *     Curated keyword → GHG Protocol category mapping.
 *     Extracts physical quantity (litres / kWh / km) from description.
 *     Strong match (≥0.75) + quantity extracted → classified.
 *     Weak match or missing quantity → needs_review with category hint.
 *
 *   No Tier 2 (AI ensemble removed):
 *     Transactions not matched by Tier 0 or Tier 1 → needs_review.
 *     Rationale: AI guesses on unrecognised transactions constitute greenwashing
 *     if submitted in an AASB S2 / NGA-based carbon report (AUASB guidance).
 *     The client must manually classify unknown transactions.
 *
 * COMPLIANCE GATES:
 *   - Personal expenses detected and excluded upfront
 *   - Out-of-period transactions excluded
 *   - Scope 2 electricity requires state (NGA state-specific grid factors)
 *   - CO2e = activity_value × NGA factor (never spend-based)
 *   - Transactions with no activity data → needs_review (never auto-classified)
 *   - classification_notes records source + rule ID or keyword for audit trail
 *
 * Response: { classified, flagged, excluded, rule_matched, keyword_matched, unclassified, total }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  classify,
  detectPersonalExpense,
  isOutsideReportingPeriod,
} from "@/lib/classifier";
import { findMerchantRule } from "@/lib/merchant-rules";

const AUTO_THRESHOLD = 0.75; // keyword classifier minimum to auto-classify

type PendingRow = {
  id:               string;
  description:      string;
  amount_aud:       string;
  transaction_date: string;
};

type CompanyRow = {
  state:                  "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT" | null;
  reporting_period_start: string | null;
  reporting_period_end:   string | null;
  nga_edition_year:       number;
};

type CategoryRow = { code: string; id: string; scope: number };

type FactorRow = {
  id:           string;
  co2e_factor:  string;
  unit:         string;
  source_table: string | null;
  state:        string | null;
};

type UpdateRow = {
  id:               string;
  categoryCode:     string;
  factorId:         string | null;
  activityValue:    number | null;
  electricityState: string | null;
  confidence:       number;
  kgCo2e:           number | null;
  status:           "classified" | "needs_review" | "excluded";
  excluded:         boolean;
  exclusionReason:  string | null;
  source:           "rule" | "keyword" | "unmatched";
  scope:            1 | 2 | 3 | null;
  classificationNotes: string;
};

export async function POST(_request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── 2. Fetch company config ──────────────────────────────────────────
  const companyRows = await sql<CompanyRow[]>`
    SELECT state,
           reporting_period_start::text,
           reporting_period_end::text,
           COALESCE(nga_edition_year, 2024) AS nga_edition_year
    FROM   companies
    WHERE  id = ${companyId}::uuid
    LIMIT  1
  `.catch(() => []);

  if (companyRows.length === 0) {
    return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  }
  const company = companyRows[0];
  const periodStart = company.reporting_period_start ?? "2023-07-01";
  const periodEnd   = company.reporting_period_end   ?? "2024-06-30";

  // ── 3. Fetch unclassified transactions ───────────────────────────────
  let rows: PendingRow[];
  try {
    rows = await sql<PendingRow[]>`
      SELECT id, description, amount_aud::text AS amount_aud,
             transaction_date::text AS transaction_date
      FROM   transactions
      WHERE  company_id        = ${companyId}::uuid
        AND  category_id       IS NULL
        AND  classification_status = 'pending'
        AND  excluded          = FALSE
      ORDER  BY transaction_date DESC
      LIMIT  2000
    `;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[classify] DB fetch failed:", msg);
    return NextResponse.json({ error: "db_error", message: msg }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({
      classified: 0, flagged: 0, excluded: 0,
      rule_matched: 0, keyword_matched: 0, unclassified: 0, total: 0,
    });
  }

  // ── 4. Fetch category UUID map ───────────────────────────────────────
  const cats: CategoryRow[] = await sql<CategoryRow[]>`
    SELECT code, id::text, scope FROM emission_categories
  `;
  const categoryMap = Object.fromEntries(cats.map((c) => [c.code, c]));

  // ── 5. Classification loop ───────────────────────────────────────────
  const updates: UpdateRow[] = [];
  let ruleMatched    = 0;
  let keywordMatched = 0;

  for (const row of rows) {
    const txDate = row.transaction_date;

    // 5a. Out-of-period → exclude
    if (isOutsideReportingPeriod(txDate, periodStart, periodEnd)) {
      updates.push({
        id: row.id, categoryCode: "excluded_finance", factorId: null,
        activityValue: null, electricityState: null, confidence: 1.0, kgCo2e: null,
        status: "excluded", excluded: true, exclusionReason: "outside_reporting_period",
        source: "rule", scope: null,
        classificationNotes: "source=rule:period_exclusion",
      });
      continue;
    }

    // 5b. Personal expense → exclude
    if (detectPersonalExpense(row.description)) {
      updates.push({
        id: row.id, categoryCode: "excluded_personal", factorId: null,
        activityValue: null, electricityState: null, confidence: 1.0, kgCo2e: null,
        status: "excluded", excluded: true, exclusionReason: "personal_expense",
        source: "rule", scope: null,
        classificationNotes: "source=rule:personal_expense_detection",
      });
      continue;
    }

    // ── TIER 0: Merchant Rules Engine ──────────────────────────────────
    const ruleMatch = await findMerchantRule(row.description);

    if (ruleMatch) {
      // 5c-excluded. Finance exclusion rules
      if (ruleMatch.category_code === "excluded_finance" || ruleMatch.category_code === "excluded_personal") {
        updates.push({
          id: row.id, categoryCode: ruleMatch.category_code, factorId: null,
          activityValue: null, electricityState: null, confidence: 1.0, kgCo2e: null,
          status: "excluded", excluded: true, exclusionReason: "not_emission_relevant",
          source: "rule", scope: null,
          classificationNotes: `source=rule:${ruleMatch.id} merchant="${ruleMatch.merchant_name}" citation="${ruleMatch.notes_citation ?? ''}"`,
        });
        ruleMatched++;
        continue;
      }

      // 5c-rule. Known merchant — category is certain; quantity may be missing.
      const ruleScope = (ruleMatch.scope === 1 || ruleMatch.scope === 2 || ruleMatch.scope === 3)
        ? (ruleMatch.scope as 1 | 2 | 3)
        : null;

      // Extract quantity using keyword classifier (re-using its regex logic)
      const keywordResult = classify(row.description);
      const activityValue = keywordResult?.activityValue ?? null;

      // Scope 2 electricity requires state
      const electricityState = ruleMatch.scope === 2 ? (company.state ?? null) : null;

      // If rule requires state and we don't have one → needs_review
      if (ruleMatch.requires_state && !electricityState) {
        updates.push({
          id: row.id, categoryCode: ruleMatch.category_code, factorId: null,
          activityValue: null, electricityState: null, confidence: 1.0, kgCo2e: null,
          status: "needs_review", excluded: false, exclusionReason: null,
          source: "rule", scope: ruleScope,
          classificationNotes: `source=rule:${ruleMatch.id} merchant="${ruleMatch.merchant_name}" flag=missing_state citation="${ruleMatch.notes_citation ?? ''}"`,
        });
        ruleMatched++;
        continue;
      }

      // If activity_unit is NULL (e.g. accommodation) → quantity-based calc impossible
      // Always needs_review with category pre-filled so reviewer adds quantity manually.
      if (ruleMatch.activity_unit == null) {
        updates.push({
          id: row.id, categoryCode: ruleMatch.category_code, factorId: null,
          activityValue: null, electricityState, confidence: 1.0, kgCo2e: null,
          status: "needs_review", excluded: false, exclusionReason: null,
          source: "rule", scope: ruleScope,
          classificationNotes: `source=rule:${ruleMatch.id} merchant="${ruleMatch.merchant_name}" flag=no_activity_unit citation="${ruleMatch.notes_citation ?? ''}"`,
        });
        ruleMatched++;
        continue;
      }

      // Try to compute CO2e from extracted quantity
      let kgCo2e: number | null = null;
      let factorId: string | null = null;

      if (activityValue != null && ruleScope != null) {
        const factor = await fetchFactor(
          ruleMatch.category_code, ruleScope, electricityState, company.nga_edition_year,
        );
        if (factor) {
          factorId = factor.id;
          kgCo2e   = Math.round(activityValue * parseFloat(factor.co2e_factor) * 10000) / 10000;
        }
      }

      const status: UpdateRow["status"] = (activityValue != null && kgCo2e != null)
        ? "classified"
        : "needs_review";

      const flagNote = activityValue == null
        ? " flag=no_activity_quantity"
        : kgCo2e == null ? " flag=factor_not_found" : "";

      updates.push({
        id: row.id, categoryCode: ruleMatch.category_code, factorId,
        activityValue, electricityState, confidence: 1.0, kgCo2e,
        status, excluded: false, exclusionReason: null,
        source: "rule", scope: ruleScope,
        classificationNotes: `source=rule:${ruleMatch.id} merchant="${ruleMatch.merchant_name}"${flagNote} citation="${ruleMatch.notes_citation ?? ''}"`,
      });
      ruleMatched++;
      continue;
    }

    // ── TIER 1: Keyword classifier ──────────────────────────────────────
    const result = classify(row.description);

    const hasActivity   = result?.activityValue != null;
    const strongMatch   = result != null && result.confidence >= AUTO_THRESHOLD;
    const noFlags       = result != null && result.flags.length === 0;

    if (result && strongMatch && noFlags && hasActivity) {
      // Strong keyword match with extracted quantity — try to resolve factor
      const kwScope = result.scope as 1 | 2 | 3;
      const electricityState = kwScope === 2 ? (company.state ?? null) : null;

      if (kwScope === 2 && !electricityState) {
        updates.push({
          id: row.id, categoryCode: result.category, factorId: null,
          activityValue: result.activityValue, electricityState: null, confidence: result.confidence, kgCo2e: null,
          status: "needs_review", excluded: false, exclusionReason: null,
          source: "keyword", scope: kwScope,
          classificationNotes: `source=keyword confidence=${result.confidence} flag=missing_state`,
        });
        keywordMatched++;
        continue;
      }

      const factor = await fetchFactor(result.category, kwScope, electricityState, company.nga_edition_year);
      const kgCo2e = factor && result.activityValue != null
        ? Math.round(result.activityValue * parseFloat(factor.co2e_factor) * 10000) / 10000
        : null;

      const status: UpdateRow["status"] = kgCo2e != null ? "classified" : "needs_review";

      updates.push({
        id: row.id, categoryCode: result.category, factorId: factor?.id ?? null,
        activityValue: result.activityValue, electricityState, confidence: result.confidence,
        kgCo2e,
        status, excluded: false, exclusionReason: null,
        source: "keyword", scope: kwScope,
        classificationNotes: `source=keyword confidence=${result.confidence}${kgCo2e == null ? ' flag=factor_not_found' : ''}`,
      });
      keywordMatched++;
      continue;
    }

    // ── NO MATCH — needs_review (AI removed: greenwashing risk) ─────────
    // Category hint from weak keyword result (if any) for dashboard display.
    const hintCode = result?.category ?? "";
    const hintConf = result?.confidence ?? 0;

    updates.push({
      id: row.id, categoryCode: hintCode, factorId: null,
      activityValue: null, electricityState: null, confidence: hintConf, kgCo2e: null,
      status: "needs_review", excluded: false, exclusionReason: null,
      source: "unmatched", scope: null,
      classificationNotes: `source=unmatched${hintCode ? ` hint=${hintCode}` : ''} flag=no_activity_data — manual review required`,
    });
  }

  // ── 6. Persist all updates ───────────────────────────────────────────
  let classified     = 0;
  let flagged        = 0;
  let excluded       = 0;
  let unclassified   = 0;

  for (const u of updates) {
    const cat        = u.categoryCode ? categoryMap[u.categoryCode] : null;
    const categoryId = cat ? cat.id : null;
    const scopeVal   = u.scope ?? (cat?.scope ?? null);

    try {
      await sql`
        UPDATE transactions
        SET
          category_id               = ${categoryId}::uuid,
          emission_factor_id        = ${u.factorId}::uuid,
          quantity_value            = ${u.activityValue},
          electricity_state         = ${u.electricityState},
          co2e_kg                   = ${u.kgCo2e},
          scope                     = ${scopeVal},
          classification_confidence = ${u.confidence},
          classification_status     = ${u.status},
          classification_notes      = ${u.classificationNotes},
          excluded                  = ${u.excluded},
          exclusion_reason          = ${u.exclusionReason},
          classified_at             = NOW(),
          updated_at                = NOW()
        WHERE id         = ${u.id}::uuid
          AND company_id = ${companyId}::uuid
      `;

      if (u.excluded)                       excluded++;
      else if (u.status === "classified")   classified++;
      else if (u.status === "needs_review") flagged++;
      else                                  unclassified++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[classify] Update failed for tx ${u.id}:`, msg);
      unclassified++;
    }
  }

  return NextResponse.json({
    classified,
    flagged,
    excluded,
    rule_matched:    ruleMatched,
    keyword_matched: keywordMatched,
    unclassified,
    total: rows.length,
  });
}

// ─── Emission factor lookup ──────────────────────────────────────────────────

async function fetchFactor(
  categoryCode: string,
  scope: 1 | 2 | 3,
  state: string | null,
  ngaYear: number,
): Promise<FactorRow | null> {
  // Scope 2 electricity — location-based, state-specific NGA 2024 factors
  if (scope === 2 && categoryCode === "electricity") {
    if (!state) return null;
    const r = await sql<FactorRow[]>`
      SELECT id::text, co2e_factor::text, unit, source_table, state
      FROM   emission_factors
      WHERE  scope = 2
        AND  state = ${state}
        AND  (nga_year = ${ngaYear} OR is_current = TRUE)
      ORDER  BY (nga_year = ${ngaYear}) DESC, is_current DESC
      LIMIT  1
    `.catch(() => []);
    return r[0] ?? null;
  }

  // Scope 1 liquid fuels
  const fuelMap: Record<string, string> = {
    fuel_petrol:  "Petrol",
    fuel_diesel:  "Diesel",
    fuel_lpg:     "LPG",
    natural_gas:  "Natural Gas",
    refrigerants: "Refrigerant",
  };

  if (scope === 1 && fuelMap[categoryCode]) {
    const pat = `%${fuelMap[categoryCode]}%`;
    const r = await sql<FactorRow[]>`
      SELECT id::text, co2e_factor::text, unit, source_table, state
      FROM   emission_factors
      WHERE  scope = 1
        AND  activity ILIKE ${pat}
        AND  (nga_year = ${ngaYear} OR is_current = TRUE)
      ORDER  BY (nga_year = ${ngaYear}) DESC, is_current DESC, created_at DESC
      LIMIT  1
    `.catch(() => []);
    return r[0] ?? null;
  }

  // Scope 3 categories
  const scope3Map: Record<string, string> = {
    air_travel_domestic:      "Domestic",
    air_travel_international: "International",
    rideshare_taxi:           "Taxi",
    public_transport:         "Bus",
    rental_vehicle:           "Hire",
    accommodation_business:   "Accommodation",
    road_freight:             "Freight",
    waste:                    "Waste",
  };

  if (scope === 3 && scope3Map[categoryCode]) {
    const pat = `%${scope3Map[categoryCode]}%`;
    const r = await sql<FactorRow[]>`
      SELECT id::text, co2e_factor::text, unit, source_table, state
      FROM   emission_factors
      WHERE  scope = 3
        AND  activity ILIKE ${pat}
        AND  (nga_year = ${ngaYear} OR is_current = TRUE)
      ORDER  BY (nga_year = ${ngaYear}) DESC, is_current DESC, created_at DESC
      LIMIT  1
    `.catch(() => []);
    return r[0] ?? null;
  }

  return null;
}
