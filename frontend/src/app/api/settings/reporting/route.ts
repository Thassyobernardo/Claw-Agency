/**
 * /api/settings/reporting — NGA edition + reporting frequency
 *
 * Lets the company choose:
 *   - WHICH NGA Factors workbook applies to their reporting period
 *     (e.g. 2024 for FY 2023-24, 2025 for FY 2024-25)
 *   - HOW OFTEN they want to review their emissions (daily/weekly/monthly/
 *     quarterly/biannual/annual)
 *
 * The frequency drives:
 *   - Dashboard period-vs-period comparison
 *   - Email digest cadence (when digest_enabled = true)
 *   - Auto-snapshot at period end (saved to reporting_period_snapshots)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "biannual", "annual"] as const;
type Frequency = typeof FREQUENCIES[number];

interface ReportingForm {
  nga_edition_year:    number;
  reporting_frequency: Frequency;
  digest_enabled:      boolean;
  digest_recipients:   string[];
  reporting_period_start?: string | null;  // ISO YYYY-MM-DD
  reporting_period_end?:   string | null;
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  const rows = await sql<Array<{
    nga_edition_year:        number;
    reporting_frequency:     string;
    digest_enabled:          boolean;
    digest_recipients:       string[] | null;
    reporting_period_start:  string | null;
    reporting_period_end:    string | null;
  }>>`
    SELECT nga_edition_year, reporting_frequency,
           digest_enabled, digest_recipients,
           reporting_period_start::text, reporting_period_end::text
    FROM   companies
    WHERE  id = ${companyId}::uuid
    LIMIT  1
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  }
  return NextResponse.json({ reporting: rows[0] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  let body: ReportingForm;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  // Validate NGA edition year
  const year = Number(body.nga_edition_year);
  if (!Number.isFinite(year) || year < 2020 || year > 2050) {
    return NextResponse.json({ error: "invalid_nga_year" }, { status: 400 });
  }
  // Validate frequency
  if (!FREQUENCIES.includes(body.reporting_frequency)) {
    return NextResponse.json({ error: "invalid_frequency" }, { status: 400 });
  }

  // Validate recipient emails
  const recipients = (body.digest_recipients ?? [])
    .filter((e) => typeof e === "string")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  // Validate dates
  let pStart: string | null = null, pEnd: string | null = null;
  if (body.reporting_period_start) {
    const d = new Date(body.reporting_period_start);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "invalid_period_start" }, { status: 400 });
    pStart = d.toISOString().slice(0, 10);
  }
  if (body.reporting_period_end) {
    const d = new Date(body.reporting_period_end);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "invalid_period_end" }, { status: 400 });
    pEnd = d.toISOString().slice(0, 10);
  }

  try {
    await sql`
      UPDATE companies
      SET nga_edition_year       = ${year},
          reporting_frequency    = ${body.reporting_frequency},
          digest_enabled         = ${!!body.digest_enabled},
          digest_recipients      = ${recipients.length > 0 ? recipients : null},
          reporting_period_start = ${pStart}::date,
          reporting_period_end   = ${pEnd}::date,
          updated_at             = NOW()
      WHERE id = ${companyId}::uuid
    `;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[settings/reporting] save failed:", msg);
    return NextResponse.json({ error: "save_failed", message: msg }, { status: 500 });
  }
}
