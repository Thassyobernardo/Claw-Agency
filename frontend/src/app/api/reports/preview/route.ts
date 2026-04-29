/**
 * POST /api/reports/preview
 *
 * Returns aggregated totals for a financial year WITHOUT sealing.
 * Used by the reports page "Preview Totals" button.
 * Safe to call multiple times — read-only, no DB writes.
 */
import { NextRequest, NextResponse }   from "next/server";
import { getServerSession }            from "next-auth/next";
import { authOptions }                 from "@/lib/auth";
import { sql }                         from "@/lib/db";
import { z }                           from "zod";
import {
  aggregateFinancialYear,
  parseFinancialYear,
  type ReportRepository,
  type ClassifiedTransaction,
  type TransactionCounts,
} from "@/lib/report_aggregator";

const Schema = z.object({
  financialYear: z.string().regex(/^FY\d{2}-\d{2}$/),
});

function buildRepo(companyId: string): ReportRepository {
  return {
    async getClassifiedTransactions(cId, periodStart, periodEnd) {
      return sql<ClassifiedTransaction[]>`
        SELECT
          id::text,
          scope,
          COALESCE(scope1_co2e_kg, 0)::float AS scope1_co2e_kg,
          COALESCE(scope2_co2e_kg, 0)::float AS scope2_co2e_kg,
          COALESCE(scope3_co2e_kg, 0)::float AS scope3_co2e_kg,
          COALESCE(co2e_kg, 0)::float        AS co2e_kg,
          classification_status,
          math_engine_version,
          ec.code                            AS category_code,
          transaction_date::text
        FROM transactions t
        LEFT JOIN emission_categories ec ON ec.id = t.category_id
        WHERE t.company_id            = ${cId}::uuid
          AND t.classification_status = 'classified'
          AND t.transaction_date     >= ${periodStart.toISOString().slice(0, 10)}
          AND t.transaction_date     <= ${periodEnd.toISOString().slice(0, 10)}
      `;
      void companyId;
    },
    async getTransactionCounts(cId, periodStart, periodEnd) {
      const rows = await sql<TransactionCounts[]>`
        SELECT
          COUNT(*) FILTER (WHERE classification_status = 'classified')   AS classified,
          COUNT(*) FILTER (WHERE classification_status = 'ignored')      AS ignored,
          COUNT(*) FILTER (WHERE classification_status = 'needs_review') AS needs_review,
          COUNT(*)                                                         AS total
        FROM transactions
        WHERE company_id     = ${cId}::uuid
          AND transaction_date >= ${periodStart.toISOString().slice(0, 10)}
          AND transaction_date <= ${periodEnd.toISOString().slice(0, 10)}
      `;
      void companyId;
      const r = rows[0] ?? { classified: 0, ignored: 0, needs_review: 0, total: 0 };
      return {
        classified:   Number(r.classified),
        ignored:      Number(r.ignored),
        needs_review: Number(r.needs_review),
        total:        Number(r.total),
      };
    },
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  const body   = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid financialYear" }, { status: 400 });
  }
  const { financialYear } = parsed.data;

  let periodStart: Date;
  let periodEnd:   Date;
  try {
    ({ periodStart, periodEnd } = parseFinancialYear(financialYear));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
  void periodStart; void periodEnd;

  const snapshot = await aggregateFinancialYear(companyId, financialYear, 2025, buildRepo(companyId));

  return NextResponse.json({
    scope1Tonnes:     snapshot.scope1.totalTonnes,
    scope2Tonnes:     snapshot.scope2.totalTonnes,
    scope3Tonnes:     snapshot.scope3.totalTonnes,
    totalCo2eTonnes:  snapshot.totalCo2eTonnes,
    dataQualityScore: snapshot.dataQuality.score,
    uncertaintyTier:  snapshot.dataQuality.uncertaintyTier,
    classifiedCount:  snapshot.dataQuality.classifiedCount,
    needsReviewCount: snapshot.dataQuality.needsReviewCount,
    generatedAt:      snapshot.generatedAt,
  });
}
