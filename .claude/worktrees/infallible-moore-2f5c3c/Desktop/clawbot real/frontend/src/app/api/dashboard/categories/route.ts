/**
 * GET /api/dashboard/categories?limit=5
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid, clampInt } from "@/lib/validators";

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export async function GET(req: NextRequest) {
  const session  = await getServerSession(authOptions);
  const tenantId = req.cookies.get("xero_tenant_id")?.value;

  let companyId = session?.user?.companyId ?? DEMO_COMPANY_ID;

  if (!session && tenantId && isUuid(tenantId)) {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM companies WHERE xero_tenant_id = ${tenantId} LIMIT 1
    `;
    if (rows.length > 0) companyId = rows[0].id;
  }

  const limit = clampInt(req.nextUrl.searchParams.get("limit"), 1, 20, 5);

  const rows = await sql<{
    category: string;
    activity: string;
    scope: number;
    co2e_t: number;
    tx_count: number;
  }[]>`
    SELECT
      COALESCE(ef.category, t.account_name, 'Uncategorised') AS category,
      COALESCE(ef.activity, 'Unknown activity')              AS activity,
      t.scope,
      ROUND(SUM(t.co2e_kg) / 1000.0, 2)                     AS co2e_t,
      COUNT(*)                                               AS tx_count
    FROM   transactions t
    LEFT JOIN emission_factors ef ON ef.id = t.emission_factor_id
    WHERE  t.company_id     = ${companyId}
      AND  t.reporting_year = 2024
      AND  t.co2e_kg        IS NOT NULL
      AND  t.scope          IS NOT NULL
    GROUP  BY ef.category, ef.activity, t.account_name, t.scope
    ORDER  BY SUM(t.co2e_kg) DESC
    LIMIT  ${limit}
  `;

  return NextResponse.json({ categories: rows });
}
