/**
 * GET /api/reports
 *
 * Returns all AASB S2 reports for the authenticated company,
 * ordered by sealed_at DESC (most recent first).
 *
 * Response shape:
 *   { reports: AASBReportRow[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth/next";
import { authOptions }               from "@/lib/auth";
import { sql }                       from "@/lib/db";

export interface AASBReportRow {
  id:                  string;
  financial_year:      string;
  status:              "generating" | "sealed" | "failed";
  total_scope1_tonnes: number | null;
  total_scope2_tonnes: number | null;
  total_scope3_tonnes: number | null;
  data_quality_score:  number | null;
  sha256_hash:         string | null;
  file_url:            string | null;
  sealed_at:           string | null;
  created_at:          string;
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  const rows = await sql<AASBReportRow[]>`
    SELECT
      id::text,
      financial_year,
      status,
      total_scope1_tonnes,
      total_scope2_tonnes,
      total_scope3_tonnes,
      data_quality_score,
      sha256_hash,
      file_url,
      sealed_at::text,
      created_at::text
    FROM aasb_reports
    WHERE company_id = ${companyId}::uuid
    ORDER BY COALESCE(sealed_at, created_at) DESC
  `;

  return NextResponse.json({ reports: rows });
}
