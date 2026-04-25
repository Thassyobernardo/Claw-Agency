/**
 * GET /api/dashboard/summary
 * Returns total CO2e by scope, transaction counts, and company info.
 * Resolution order: 1) NextAuth session → 2) Xero cookie → 3) demo company
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/validators";

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000001";

async function resolveCompanyId(req: NextRequest): Promise<string> {
  // 1. NextAuth session
  const session = await getServerSession(authOptions);
  if (session?.user?.companyId) return session.user.companyId;

  // 2. Xero cookie — only trust it if it's a valid UUID (reject tampered values)
  const tenantId = req.cookies.get("xero_tenant_id")?.value;
  if (tenantId && isUuid(tenantId)) {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM companies WHERE xero_tenant_id = ${tenantId} LIMIT 1
    `;
    if (rows.length > 0) return rows[0].id;
  }

  // 3. Demo fallback
  return DEMO_COMPANY_ID;
}

export async function GET(req: NextRequest) {
  const companyId = await resolveCompanyId(req);

  const [company] = await sql<{ name: string; abn: string | null; plan: string }[]>`
    SELECT name, abn, plan FROM companies WHERE id = ${companyId} LIMIT 1
  `;

  const scopeRows = await sql<{ scope: number; co2e_kg: number; tx_count: number }[]>`
    SELECT
      scope,
      COALESCE(SUM(co2e_kg), 0) AS co2e_kg,
      COUNT(*)                   AS tx_count
    FROM transactions
    WHERE company_id = ${companyId}
      AND reporting_year = 2024
      AND scope IS NOT NULL
      AND co2e_kg IS NOT NULL
    GROUP BY scope
    ORDER BY scope
  `;

  const [counts] = await sql<{ total: number; classified: number; needs_review: number; factor_not_found: number }[]>`
    SELECT
      COUNT(*)                                                            AS total,
      COUNT(*) FILTER (WHERE classification_status = 'classified')       AS classified,
      COUNT(*) FILTER (WHERE classification_status = 'needs_review')     AS needs_review,
      COUNT(*) FILTER (WHERE classification_status = 'factor_not_found') AS factor_not_found
    FROM transactions
    WHERE company_id = ${companyId} AND reporting_year = 2024
  `;

  const scopeMap: Record<number, { co2e_t: number; tx_count: number }> = {};
  for (const r of scopeRows) {
    scopeMap[r.scope] = { co2e_t: Number(r.co2e_kg) / 1000, tx_count: Number(r.tx_count) };
  }

  const scope1    = scopeMap[1] ?? { co2e_t: 0, tx_count: 0 };
  const scope2    = scopeMap[2] ?? { co2e_t: 0, tx_count: 0 };
  const scope3    = scopeMap[3] ?? { co2e_t: 0, tx_count: 0 };
  const totalCo2e = scope1.co2e_t + scope2.co2e_t + scope3.co2e_t;
  const pct       = (v: number) => totalCo2e > 0 ? Math.round(v / totalCo2e * 100) : 0;

  return NextResponse.json({
    company: {
      name: company?.name ?? "Demo",
      abn:  company?.abn  ?? null,
      plan: company?.plan ?? "starter",
    },
    reporting_year: 2024,
    total_co2e_t: Math.round(totalCo2e * 10) / 10,
    scope1: { co2e_t: Math.round(scope1.co2e_t * 10) / 10, pct: pct(scope1.co2e_t), tx_count: scope1.tx_count },
    scope2: { co2e_t: Math.round(scope2.co2e_t * 10) / 10, pct: pct(scope2.co2e_t), tx_count: scope2.tx_count },
    scope3: { co2e_t: Math.round(scope3.co2e_t * 10) / 10, pct: pct(scope3.co2e_t), tx_count: scope3.tx_count },
    transactions: {
      total:            Number(counts?.total            ?? 0),
      classified:       Number(counts?.classified       ?? 0),
      needs_review:     Number(counts?.needs_review     ?? 0),
      factor_not_found: Number(counts?.factor_not_found ?? 0),
    },
  });
}
