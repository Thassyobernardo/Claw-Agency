/**
 * GET /api/dashboard/compliance
 *
 * Returns a compliance summary for the current company so the dashboard can
 * show warnings BEFORE the user generates a PDF for ASIC submission.
 *
 * The user spec lists these mandatory UI warnings:
 *   ⚠ state_required           — Scope 2 electricity has no state
 *   ⚠ no_activity_data         — fuel/electricity tx without litres/kWh
 *   ⚠ outside_reporting_period — tx outside the FY (auto-excluded)
 *   ⚠ personal_expense         — auto-excluded
 *   ⚠ low_confidence           — AI ensemble disagreed
 *   ⚠ no_assurance             — independent assurance not obtained
 *   ⚠ governance_incomplete    — AASB S2 §6-25 questionnaire not filled
 *
 * Response: { ready_for_submission: boolean, warnings: Warning[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

interface Warning {
  level:    "blocker" | "warning" | "info";
  code:     string;
  count:    number;
  message:  string;
  action:   string;
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── Aggregate counts by flag from notes (best-effort) ──────────────────
  const [scope2NoState, noActivityFuel, lowConfidence, needsReview, governance, company] =
    await Promise.all([
      sql<{ count: string }[]>`
        SELECT COUNT(*)::text FROM transactions
        WHERE company_id = ${companyId}::uuid
          AND scope = 2
          AND classification_status = 'classified'
          AND electricity_state IS NULL
          AND excluded = FALSE
      `,
      sql<{ count: string }[]>`
        SELECT COUNT(*)::text FROM transactions
        WHERE company_id = ${companyId}::uuid
          AND scope IN (1, 2)
          AND classification_status = 'classified'
          AND quantity_value IS NULL
          AND excluded = FALSE
      `,
      sql<{ count: string }[]>`
        SELECT COUNT(*)::text FROM transactions
        WHERE company_id = ${companyId}::uuid
          AND classification_status = 'classified'
          AND classification_confidence < 0.70
          AND excluded = FALSE
      `,
      sql<{ count: string }[]>`
        SELECT COUNT(*)::text FROM transactions
        WHERE company_id = ${companyId}::uuid
          AND classification_status = 'needs_review'
      `,
      sql<{
        scenario_15c_completed: boolean;
        scenario_2c_completed:  boolean;
        board_oversight_body:   string | null;
        risk_identification_process: string | null;
      }[]>`
        SELECT scenario_15c_completed, scenario_2c_completed,
               board_oversight_body, risk_identification_process
        FROM   company_governance
        WHERE  company_id = ${companyId}::uuid
        LIMIT  1
      `.catch(() => []),
      sql<{ assurance_status: string }[]>`
        SELECT assurance_status FROM companies
        WHERE  id = ${companyId}::uuid
        LIMIT  1
      `,
    ]);

  const warnings: Warning[] = [];

  const c0 = Number(scope2NoState[0]?.count ?? 0);
  if (c0 > 0) warnings.push({
    level:   "blocker",
    code:    "state_required",
    count:   c0,
    message: `${c0} Scope 2 electricity transaction(s) without a declared Australian state.`,
    action:  "Open each transaction → set electricity_state (NSW/VIC/QLD/SA/WA/TAS/ACT/NT).",
  });

  const c1 = Number(noActivityFuel[0]?.count ?? 0);
  if (c1 > 0) warnings.push({
    level:   "blocker",
    code:    "no_activity_data",
    count:   c1,
    message: `${c1} Scope 1/2 transaction(s) without physical activity data (litres / kWh).`,
    action:  "Spend-based estimates are not allowed under NGA 2023-24. Add activity from the supplier invoice.",
  });

  const c2 = Number(lowConfidence[0]?.count ?? 0);
  if (c2 > 0) warnings.push({
    level:   "warning",
    code:    "low_confidence",
    count:   c2,
    message: `${c2} transaction(s) auto-classified with confidence < 70 %.`,
    action:  "Review and confirm classification before submission.",
  });

  const c3 = Number(needsReview[0]?.count ?? 0);
  if (c3 > 0) warnings.push({
    level:   "blocker",
    code:    "needs_review",
    count:   c3,
    message: `${c3} transaction(s) flagged for manual review.`,
    action:  "Open the Review queue and resolve each transaction.",
  });

  const g = governance[0];
  const govComplete = !!g
    && !!g.board_oversight_body
    && !!g.risk_identification_process
    && g.scenario_15c_completed
    && g.scenario_2c_completed;
  if (!govComplete) warnings.push({
    level:   "blocker",
    code:    "governance_incomplete",
    count:   1,
    message: "AASB S2 §6-25 governance questionnaire is incomplete.",
    action:  "Settings → Climate Governance — fill Board oversight, scenario analysis (1.5°C and 2°C), and risk process.",
  });

  if (company[0]?.assurance_status === "none") {
    warnings.push({
      level:   "warning",
      code:    "no_assurance",
      count:   1,
      message: "Independent assurance has not been obtained.",
      action:  "Engage a registered company auditor under AUASB GS 100 before filing with ASIC.",
    });
  }

  const blockerCount = warnings.filter((w) => w.level === "blocker").length;

  return NextResponse.json({
    ready_for_submission: blockerCount === 0,
    blocker_count:        blockerCount,
    warning_count:        warnings.filter((w) => w.level === "warning").length,
    warnings,
  });
}
