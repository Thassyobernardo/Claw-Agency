/**
 * GET /api/dashboard/transactions?limit=5
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

  const limit = clampInt(req.nextUrl.searchParams.get("limit"), 1, 50, 8);

  const rows = await sql<{
    id: string;
    description: string;
    supplier_name: string | null;
    transaction_date: string;
    amount_aud: number;
    co2e_kg: number | null;
    scope: number | null;
    classification_status: string;
    account_name: string | null;
    category: string | null;
    activity: string | null;
  }[]>`
    SELECT
      t.id,
      t.description,
      t.supplier_name,
      t.transaction_date::text,
      t.amount_aud,
      t.co2e_kg,
      t.scope,
      t.classification_status,
      t.account_name,
      ef.category,
      ef.activity
    FROM   transactions t
    LEFT JOIN emission_factors ef ON ef.id = t.emission_factor_id
    WHERE  t.company_id     = ${companyId}
      AND  t.reporting_year = 2024
    ORDER  BY t.transaction_date DESC
    LIMIT  ${limit}
  `;

  return NextResponse.json({ transactions: rows });
}
