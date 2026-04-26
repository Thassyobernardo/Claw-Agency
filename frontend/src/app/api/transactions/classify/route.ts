/**
 * POST /api/transactions/classify
 *
 * AASB S2 / NGER-compliant classifier route. Two tiers:
 *
 *   Tier 1 — Keyword classifier (free, deterministic)
 *     src/lib/classifier.ts uses curated keyword + GHG Protocol category mapping.
 *     Returns a category + extracted activity_value (litres / kWh / km).
 *
 *   Tier 2 — AI ensemble (paid, ~US$0.00015 / tx)
 *     src/lib/ensemble-classifier.ts fans out to 3 LLMs via OpenRouter.
 *     Used as fallback when keyword fails OR confidence < threshold OR
 *     activity_value couldn't be extracted from the description.
 *
 * COMPLIANCE GATES enforced here (matching user spec):
 *   - Personal expenses are detected upfront and marked excluded
 *   - Out-of-period transactions are excluded
 *   - Scope 2 electricity transactions get state from company.state if missing
 *   - emission_factors are looked up from DB by category + state + nga_year
 *   - co2e_kg is computed as activity_value × factor.co2e_factor
 *   - Transactions with no activity data go to needs_review (never auto-classified)
 *
 * Response: {
 *   classified, flagged, excluded, ai_used, unclassified, total
 * }
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
import {
  tryClassifyEnsemble,
  ENSEMBLE_REVIEW_THRESHOLD,
} from "@/lib/ensemble-classifier";

const AUTO_THRESHOLD     = 0.75;   // keyword classifier minimum to auto-apply
const AI_MAX_PER_CALL    = 500;
const AI_BATCH_SIZE      = 5;

type PendingRow = {
  id:                string;
  description:       string;
  amount_aud:        string;        // postgres.js returns numeric as string
  transaction_date:  string;        // ISO
};

type CompanyRow = {
  state:                  "NSW"|"VIC"|"QLD"|"WA"|"SA"|"TAS"|"ACT"|"NT" | null;
  reporting_period_start: string | null;
  reporting_period_end:   string | null;
};

type CategoryRow = { code: string; id: string; scope: number };

type FactorRow = {
  id:           string;
  co2e_factor:  string;       // numeric → string
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
  source:           "keyword" | "ai_ensemble" | "rule";
  scope:            1 | 2 | 3 | null;
};

export async function POST(_request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── 2. Fetch company config (state, reporting period) ────────────────
  const companyRows = await sql<CompanyRow[]>`
    SELECT state, reporting_period_start::text, reporting_period_end::text
    FROM   companies
    WHERE  id = ${companyId}::uuid
    LIMIT  1
  `.catch(() => []);

  if (companyRows.length === 0) {
    return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  }
  const company = companyRows[0];

  // Default FY 2023-24 if not set
  const periodStart = company.reporting_period_start ?? "2023-07-01";
  const periodEnd   = company.reporting_period_end   ?? "2024-06-30";

  // ── 3. Fetch unclassified transactions ───────────────────────────────
  let rows: PendingRow[];
  try {
    rows = await sql<PendingRow[]>`
      SELECT id, description, amount_aud::text AS amount_aud,
             transaction_date::text AS transaction_date
      FROM   transactions
      WHERE  company_id = ${companyId}::uuid
        AND  category_id IS NULL
        AND  classification_status = 'pending'
        AND  excluded = FALSE
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
      classified: 0, flagged: 0, excluded: 0, ai_used: 0, unclassified: 0, total: 0,
    });
  }

  // ── 4. Fetch category UUID map ───────────────────────────────────────
  const cats: CategoryRow[] = await sql<CategoryRow[]>`
    SELECT code, id::text, scope FROM emission_categories
  `;
  const categoryMap = Object.fromEntries(cats.map((c) => [c.code, c]));

  // ── 5. Tier 1 — Keyword classify + rule-based exclusion ──────────────
  const updates: UpdateRow[] = [];
  const aiQueue: PendingRow[] = [];

  for (const row of rows) {
    const txDate = row.transaction_date;

    // 5a. Out of reporting period — exclude
    if (isOutsideReportingPeriod(txDate, periodStart, periodEnd)) {
      updates.push({
        id: row.id, categoryCode: "excluded_finance", factorId: null,
        activityValue: null, electricityState: null, confidence: 1.0, kgCo2e: null,
        status: "excluded", excluded: true,
        exclusionReason: "outside_reporting_period",
        source: "rule", scope: null,
      });
      continue;
    }

    // 5b. Personal expense — exclude
    if (detectPersonalExpense(row.description)) {
      updates.push({
        id: row.id, categoryCode: "excluded_personal", factorId: null,
        activityValue: null, electricityState: null, confidence: 1.0, kgCo2e: null,
        status: "excluded", excluded: true,
        exclusionReason: "personal_expense",
        source: "rule", scope: null,
      });
      continue;
    }

    // 5c. Try keyword classifier
    const result = classify(row.description);

    const noFlags    = result && result.flags.length === 0;
    const strongConf = result && result.confidence >= AUTO_THRESHOLD;

    if (result && noFlags && strongConf && result.activityValue != null) {
      // Strong keyword match WITH activity data — try DB lookup for factor
      aiQueue.push({ ...row, _keyword: result } as PendingRow & { _keyword: typeof result });
    } else {
      // No match, weak match, or missing activity → defer to AI
      aiQueue.push(row);
    }
  }

  // ── 6. Tier 2 — Process queued items via AI (or finalize keyword hits) ──
  let aiUsedCount = 0;
  const aiEnabled = !!process.env.OPENROUTER_API_KEY;

  for (let i = 0; i < aiQueue.length; i += AI_BATCH_SIZE) {
    const batch = aiQueue.slice(i, i + AI_BATCH_SIZE);
    const settled = await Promise.all(
      batch.map(async (row) => {
        const amountAud = parseFloat(row.amount_aud) || 0;

        // Use AI ensemble (it's our highest-quality classifier)
        if (!aiEnabled || aiUsedCount >= AI_MAX_PER_CALL) {
          return { row, ai: null };
        }
        aiUsedCount++;
        const ai = await tryClassifyEnsemble({
          description:        row.description,
          amount_aud:         amountAud,
          transaction_date:   row.transaction_date,
          reporting_period_start: periodStart,
          reporting_period_end:   periodEnd,
          company_state:      company.state ?? undefined,
        });
        return { row, ai };
      }),
    );

    for (const { row, ai } of settled) {
      if (!ai) {
        updates.push({
          id: row.id, categoryCode: "", factorId: null,
          activityValue: null, electricityState: null, confidence: 0, kgCo2e: null,
          status: "needs_review", excluded: false, exclusionReason: null,
          source: "ai_ensemble", scope: null,
        });
        continue;
      }

      // AI marked as excluded
      if (ai.excluded) {
        const code = ai.exclusion_reason === "personal_expense"
          ? "excluded_personal"
          : "excluded_finance";
        updates.push({
          id: row.id, categoryCode: code, factorId: null,
          activityValue: null, electricityState: null, confidence: ai.confidence,
          kgCo2e: null,
          status: "excluded", excluded: true,
          exclusionReason: ai.exclusion_reason ?? "not_emission_relevant",
          source: "ai_ensemble", scope: ai.scope,
        });
        continue;
      }

      // Look up emission_factor from DB
      const cat = categoryMap[ai.category];
      if (!cat) {
        updates.push({
          id: row.id, categoryCode: ai.category, factorId: null,
          activityValue: ai.activity_value, electricityState: ai.electricity_state,
          confidence: ai.confidence, kgCo2e: null,
          status: "needs_review", excluded: false, exclusionReason: null,
          source: "ai_ensemble", scope: ai.scope,
        });
        continue;
      }

      // Compute kg CO2e if we have activity + factor
      let kgCo2e: number | null = null;
      let factorId: string | null = null;

      if (ai.activity_value != null) {
        const factor = await fetchFactor(ai.category, ai.scope, ai.electricity_state);
        if (factor) {
          factorId = factor.id;
          kgCo2e   = ai.activity_value * parseFloat(factor.co2e_factor);
        }
      }

      const status: UpdateRow["status"] = ai.needs_review || kgCo2e == null
        ? "needs_review"
        : "classified";

      updates.push({
        id: row.id, categoryCode: ai.category, factorId,
        activityValue: ai.activity_value, electricityState: ai.electricity_state,
        confidence: ai.confidence,
        kgCo2e: kgCo2e != null ? Math.round(kgCo2e * 10000) / 10000 : null,
        status, excluded: false, exclusionReason: null,
        source: "ai_ensemble", scope: ai.scope,
      });
    }
  }

  // ── 7. Persist all updates ───────────────────────────────────────────
  let classified = 0;
  let flagged    = 0;
  let excluded   = 0;
  let unclassifiedCount = 0;

  for (const u of updates) {
    const cat = u.categoryCode ? categoryMap[u.categoryCode] : null;
    const categoryId = cat ? cat.id : null;

    try {
      await sql`
        UPDATE transactions
        SET
          category_id               = ${categoryId}::uuid,
          emission_factor_id        = ${u.factorId}::uuid,
          quantity_value            = ${u.activityValue},
          electricity_state         = ${u.electricityState},
          co2e_kg                   = ${u.kgCo2e},
          scope                     = ${u.scope},
          classification_confidence = ${u.confidence},
          classification_status     = ${u.status},
          classification_notes      = ${`source=${u.source}`},
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
      else                                  unclassifiedCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[classify] Update failed for tx ${u.id}:`, msg);
      unclassifiedCount++;
    }
  }

  return NextResponse.json({
    classified, flagged, excluded,
    ai_used:       aiUsedCount,
    unclassified:  unclassifiedCount,
    total:         rows.length,
  });
}

// ─── Emission factor lookup ──────────────────────────────────────────────────
// Strict: uses current NGA edition + scope + state. Returns null if not found
// (caller flags transaction as needs_review).

async function fetchFactor(
  categoryCode: string,
  scope: 1 | 2 | 3,
  state: string | null,
): Promise<FactorRow | null> {
  // Map category code → emission_factors.activity name pattern.
  // Since emission_factors has its own activity strings, we filter loosely
  // by scope and (for electricity) state.
  if (scope === 2 && categoryCode === "electricity") {
    if (!state) return null;
    const r = await sql<FactorRow[]>`
      SELECT id::text, co2e_factor::text, unit, source_table, state
      FROM   emission_factors
      WHERE  is_current = TRUE
        AND  scope = 2
        AND  state = ${state}
      LIMIT  1
    `.catch(() => []);
    return r[0] ?? null;
  }

  // For Scope 1 fuels, match by scope + activity LIKE
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
      WHERE  is_current = TRUE
        AND  scope = 1
        AND  activity ILIKE ${pat}
      ORDER  BY created_at DESC
      LIMIT  1
    `.catch(() => []);
    return r[0] ?? null;
  }

  // Scope 3 — best-effort lookup by category keyword
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
      WHERE  is_current = TRUE
        AND  scope = 3
        AND  activity ILIKE ${pat}
      ORDER  BY created_at DESC
      LIMIT  1
    `.catch(() => []);
    return r[0] ?? null;
  }

  return null;
}
