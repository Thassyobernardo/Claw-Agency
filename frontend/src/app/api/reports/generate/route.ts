/**
 * POST /api/reports/generate
 *
 * Seals a financial year's AASB S2 report.
 * This is a ONE-WAY, IRREVERSIBLE operation.
 *
 * ─── Pre-conditions (enforced server-side) ────────────────────────────────────
 *   1. No transactions with status = 'needs_review' for the FY → 400
 *   2. No existing 'sealed' report for the same company + FY  → 409
 *
 * ─── Steps ───────────────────────────────────────────────────────────────────
 *   1. Auth + validate input
 *   2. Pending-review guard
 *   3. aggregateFinancialYear() → AASBReportSnapshot
 *   4. INSERT aasb_reports (status='generating') → reportId
 *   5. sealFinancialReport(reportId, snapshot) → PDF + SHA-256 + Storage
 *   6. Return { reportId, fileUrl, sha256Hash, sealedAt, lockedTransactionCount }
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
import { sealFinancialReport, type SupabaseStorageClient } from "@/lib/report_sealer";


// ─── Input schema ─────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  financialYear: z.string().regex(/^FY\d{2}-\d{2}$/, {
    message: "financialYear must be in FY24-25 format",
  }),
});

// ─── DB Repository (real implementation) ─────────────────────────────────────

function buildRepository(companyId: string): ReportRepository {
  return {
    async getClassifiedTransactions(cId, periodStart, periodEnd) {
      const rows = await sql<ClassifiedTransaction[]>`
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
        WHERE t.company_id           = ${cId}::uuid
          AND t.classification_status = 'classified'
          AND t.transaction_date     >= ${periodStart.toISOString().slice(0, 10)}
          AND t.transaction_date     <= ${periodEnd.toISOString().slice(0, 10)}
      `;
      void companyId;
      return rows;
    },

    async getTransactionCounts(cId, periodStart, periodEnd) {
      const rows = await sql<TransactionCounts[]>`
        SELECT
          COUNT(*) FILTER (WHERE classification_status = 'classified')  AS classified,
          COUNT(*) FILTER (WHERE classification_status = 'ignored')     AS ignored,
          COUNT(*) FILTER (WHERE classification_status = 'needs_review') AS needs_review,
          COUNT(*)                                                        AS total
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

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId   = session.user.companyId;
  const companyName = session.user.companyName ?? "Unknown Company";

  // ── 2. Validate input ──────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { financialYear } = parsed.data;

  // ── 3. Parse FY dates (validate format early) ──────────────────────────────
  let periodStart: Date;
  let periodEnd:   Date;
  try {
    ({ periodStart, periodEnd } = parseFinancialYear(financialYear));
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid financial year", message: String(err) },
      { status: 400 },
    );
  }

  // ── 4. Pending-review guard ────────────────────────────────────────────────
  const pendingRows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM transactions
    WHERE company_id            = ${companyId}::uuid
      AND classification_status = 'needs_review'
      AND transaction_date     >= ${periodStart.toISOString().slice(0, 10)}
      AND transaction_date     <= ${periodEnd.toISOString().slice(0, 10)}
  `;
  const pendingCount = parseInt(pendingRows[0]?.count ?? "0", 10);
  if (pendingCount > 0) {
    return NextResponse.json(
      {
        error:         "PENDING_REVIEW_TRANSACTIONS",
        message:       `Você possui ${pendingCount} transação(ões) pendentes na Fila de Revisão. Resolva-as antes de selar o relatório.`,
        pendingCount,
        reviewUrl:     "/dashboard/review",
      },
      { status: 400 },
    );
  }

  // ── 5. Duplicate-seal guard ────────────────────────────────────────────────
  const existingRows = await sql<{ id: string; status: string }[]>`
    SELECT id::text, status
    FROM aasb_reports
    WHERE company_id     = ${companyId}::uuid
      AND financial_year = ${financialYear}
      AND status         = 'sealed'
    LIMIT 1
  `;
  if (existingRows.length > 0) {
    return NextResponse.json(
      {
        error:    "ALREADY_SEALED",
        message:  `Report for ${financialYear} is already sealed. Download it from the Reports page.`,
        reportId: existingRows[0]!.id,
      },
      { status: 409 },
    );
  }

  // ── 6. Aggregate financial year ────────────────────────────────────────────
  const repo     = buildRepository(companyId);
  const snapshot = await aggregateFinancialYear(companyId, financialYear, 2025, repo);

  // ── 7. Create aasb_reports row (status = 'generating') ────────────────────
  const reportRows = await sql<{ id: string }[]>`
    INSERT INTO aasb_reports (
      company_id,
      financial_year,
      status,
      total_scope1_tonnes,
      total_scope2_tonnes,
      total_scope3_tonnes,
      data_quality_score
    ) VALUES (
      ${companyId}::uuid,
      ${financialYear},
      'generating',
      ${snapshot.scope1.totalTonnes},
      ${snapshot.scope2.totalTonnes},
      ${snapshot.scope3.totalTonnes},
      ${snapshot.dataQuality.score}
    )
    RETURNING id::text
  `;
  const reportId = reportRows[0]!.id;

  // ── 8. Build storage client (Supabase REST — no SDK required) ────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  /**
   * Minimal SupabaseStorageClient implemented with plain fetch.
   * Avoids the @supabase/supabase-js dependency in this route.
   */
  const storage: SupabaseStorageClient = {
    from(bucket: string) {
      return {
        async upload(path: string, buffer: Buffer, opts: { contentType: string; upsert: boolean }) {
          const res = await fetch(
            `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
            {
              method:  "POST",
              headers: {
                Authorization:  `Bearer ${supabaseKey}`,
                "Content-Type": opts.contentType,
                "x-upsert":    String(opts.upsert),
              },
              body: new Uint8Array(buffer),
            },
          );
          if (!res.ok) {
            return { data: null, error: new Error(await res.text()) };
          }
          return { data: { path }, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}` } };
        },
      };
    },
  };


  // ── 9. Seal (PDF → SHA-256 → Upload → DB lock) ────────────────────────────
  const sealResult = await sealFinancialReport(
    reportId,
    { ...snapshot, companyId, financialYear },
    storage,
    sql as unknown as Parameters<typeof sealFinancialReport>[3],
  );


  if (!sealResult.success) {
    // Mark as failed in DB so it doesn't block future attempts
    await sql`
      UPDATE aasb_reports SET status = 'failed', updated_at = NOW()
      WHERE id = ${reportId}::uuid
    `.catch(() => null);

    return NextResponse.json(
      {
        error:    "SEAL_FAILED",
        stage:    sealResult.stage,
        message:  sealResult.error,
        reportId,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok:                     true,
    reportId:               sealResult.reportId,
    financialYear,
    companyId,
    companyName,
    fileUrl:                sealResult.fileUrl,
    sha256Hash:             sealResult.sha256Hash,
    sealedAt:               sealResult.sealedAt,
    lockedTransactionCount: sealResult.lockedTransactionCount,
    scope1Tonnes:           snapshot.scope1.totalTonnes,
    scope2Tonnes:           snapshot.scope2.totalTonnes,
    scope3Tonnes:           snapshot.scope3.totalTonnes,
    totalCo2eTonnes:        snapshot.totalCo2eTonnes,
    dataQualityScore:       snapshot.dataQuality.score,
    uncertaintyTier:        snapshot.dataQuality.uncertaintyTier,
  });
}
