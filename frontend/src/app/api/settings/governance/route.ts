/**
 * /api/settings/governance — AASB S2 §6-25 questionnaire
 *
 * GET  → returns the current company's governance answers (or empty defaults)
 * POST → upserts the governance row for the company
 *
 * Maps directly to the company_governance table from migration 012.
 * The PDF generator (/api/report/generate) reads from this table.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

interface GovernanceForm {
  // §6-9 Governance
  board_oversight_body?:         string | null;
  accountable_person_role?:      string | null;
  review_frequency?:             "monthly" | "quarterly" | "biannual" | "annual" | null;
  governance_notes?:             string | null;

  // §10-22 Strategy
  physical_risks_identified?:    string[] | null;
  physical_risks_narrative?:     string | null;
  transition_risks_identified?:  string[] | null;
  transition_risks_narrative?:   string | null;
  opportunities_identified?:     string[] | null;
  opportunities_narrative?:      string | null;
  scenario_15c_completed?:       boolean;
  scenario_15c_narrative?:       string | null;
  scenario_2c_completed?:        boolean;
  scenario_2c_narrative?:        string | null;
  scenario_3c_completed?:        boolean;
  scenario_3c_narrative?:        string | null;
  financial_impact_current?:     string | null;
  financial_impact_anticipated?: string | null;
  business_model_resilience?:    string | null;

  // §23-25 Risk Management
  risk_identification_process?:  string | null;
  risk_integration_process?:     string | null;
  risk_priority_method?:         string | null;

  // §26-42 Targets
  target_base_year?:             number | null;
  target_target_year?:           number | null;
  target_reduction_pct?:         number | null;
  target_scope_coverage?:        string[] | null;
  target_methodology?:           string | null;
  target_narrative?:             string | null;

  // §29 Cross-industry metrics
  energy_total_mwh?:             number | null;
  energy_renewable_pct?:         number | null;
  internal_carbon_price_aud?:    number | null;
  exec_remuneration_climate_pct?: number | null;

  // §B17 Connectivity
  fs_consistency_confirmed?:     boolean;
  fs_inconsistencies_narrative?: string | null;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  const rows = await sql`
    SELECT * FROM company_governance WHERE company_id = ${companyId}::uuid LIMIT 1
  `.catch(() => []);

  if (rows.length === 0) {
    return NextResponse.json({ governance: null });
  }
  return NextResponse.json({ governance: rows[0] });
}

// ─── POST (upsert) ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;
  const userId    = session.user.id;

  let body: GovernanceForm;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Sanitisation: arrays must be string[], booleans coerced
  const arrSan = (v: unknown): string[] | null =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : null;

  const numSan = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const strSan = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
  };

  try {
    await sql`
      INSERT INTO company_governance (
        company_id,
        board_oversight_body, accountable_person_role, review_frequency, governance_notes,
        physical_risks_identified, physical_risks_narrative,
        transition_risks_identified, transition_risks_narrative,
        opportunities_identified, opportunities_narrative,
        scenario_15c_completed, scenario_15c_narrative,
        scenario_2c_completed,  scenario_2c_narrative,
        scenario_3c_completed,  scenario_3c_narrative,
        financial_impact_current, financial_impact_anticipated, business_model_resilience,
        risk_identification_process, risk_integration_process, risk_priority_method,
        target_base_year, target_target_year, target_reduction_pct,
        target_scope_coverage, target_methodology, target_narrative,
        energy_total_mwh, energy_renewable_pct,
        internal_carbon_price_aud, exec_remuneration_climate_pct,
        fs_consistency_confirmed, fs_inconsistencies_narrative,
        completed_at, last_reviewed_at, completed_by_user_id
      ) VALUES (
        ${companyId}::uuid,
        ${strSan(body.board_oversight_body)}, ${strSan(body.accountable_person_role)},
        ${body.review_frequency ?? null}, ${strSan(body.governance_notes)},
        ${arrSan(body.physical_risks_identified)}, ${strSan(body.physical_risks_narrative)},
        ${arrSan(body.transition_risks_identified)}, ${strSan(body.transition_risks_narrative)},
        ${arrSan(body.opportunities_identified)}, ${strSan(body.opportunities_narrative)},
        ${!!body.scenario_15c_completed}, ${strSan(body.scenario_15c_narrative)},
        ${!!body.scenario_2c_completed},  ${strSan(body.scenario_2c_narrative)},
        ${!!body.scenario_3c_completed},  ${strSan(body.scenario_3c_narrative)},
        ${strSan(body.financial_impact_current)}, ${strSan(body.financial_impact_anticipated)},
        ${strSan(body.business_model_resilience)},
        ${strSan(body.risk_identification_process)}, ${strSan(body.risk_integration_process)},
        ${strSan(body.risk_priority_method)},
        ${numSan(body.target_base_year)}, ${numSan(body.target_target_year)},
        ${numSan(body.target_reduction_pct)},
        ${arrSan(body.target_scope_coverage)}, ${strSan(body.target_methodology)},
        ${strSan(body.target_narrative)},
        ${numSan(body.energy_total_mwh)}, ${numSan(body.energy_renewable_pct)},
        ${numSan(body.internal_carbon_price_aud)}, ${numSan(body.exec_remuneration_climate_pct)},
        ${!!body.fs_consistency_confirmed}, ${strSan(body.fs_inconsistencies_narrative)},
        NOW(), NOW(), ${userId}::uuid
      )
      ON CONFLICT (company_id) DO UPDATE SET
        board_oversight_body         = EXCLUDED.board_oversight_body,
        accountable_person_role      = EXCLUDED.accountable_person_role,
        review_frequency             = EXCLUDED.review_frequency,
        governance_notes             = EXCLUDED.governance_notes,
        physical_risks_identified    = EXCLUDED.physical_risks_identified,
        physical_risks_narrative     = EXCLUDED.physical_risks_narrative,
        transition_risks_identified  = EXCLUDED.transition_risks_identified,
        transition_risks_narrative   = EXCLUDED.transition_risks_narrative,
        opportunities_identified     = EXCLUDED.opportunities_identified,
        opportunities_narrative      = EXCLUDED.opportunities_narrative,
        scenario_15c_completed       = EXCLUDED.scenario_15c_completed,
        scenario_15c_narrative       = EXCLUDED.scenario_15c_narrative,
        scenario_2c_completed        = EXCLUDED.scenario_2c_completed,
        scenario_2c_narrative        = EXCLUDED.scenario_2c_narrative,
        scenario_3c_completed        = EXCLUDED.scenario_3c_completed,
        scenario_3c_narrative        = EXCLUDED.scenario_3c_narrative,
        financial_impact_current     = EXCLUDED.financial_impact_current,
        financial_impact_anticipated = EXCLUDED.financial_impact_anticipated,
        business_model_resilience    = EXCLUDED.business_model_resilience,
        risk_identification_process  = EXCLUDED.risk_identification_process,
        risk_integration_process     = EXCLUDED.risk_integration_process,
        risk_priority_method         = EXCLUDED.risk_priority_method,
        target_base_year             = EXCLUDED.target_base_year,
        target_target_year           = EXCLUDED.target_target_year,
        target_reduction_pct         = EXCLUDED.target_reduction_pct,
        target_scope_coverage        = EXCLUDED.target_scope_coverage,
        target_methodology           = EXCLUDED.target_methodology,
        target_narrative             = EXCLUDED.target_narrative,
        energy_total_mwh             = EXCLUDED.energy_total_mwh,
        energy_renewable_pct         = EXCLUDED.energy_renewable_pct,
        internal_carbon_price_aud    = EXCLUDED.internal_carbon_price_aud,
        exec_remuneration_climate_pct = EXCLUDED.exec_remuneration_climate_pct,
        fs_consistency_confirmed     = EXCLUDED.fs_consistency_confirmed,
        fs_inconsistencies_narrative = EXCLUDED.fs_inconsistencies_narrative,
        last_reviewed_at             = NOW(),
        updated_at                   = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[settings/governance] save failed:", msg);
    return NextResponse.json({ error: "save_failed", message: msg }, { status: 500 });
  }
}
