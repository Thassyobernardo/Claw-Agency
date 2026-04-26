/**
 * /api/settings/assurance — Independent assurance metadata (AUASB GS 100)
 *
 * Reads/writes assurance fields on the companies table (added by migration 011):
 *   - assurance_status         : 'none' | 'limited' | 'reasonable'
 *   - assurance_provider       : audit firm name
 *   - assurance_asic_reg       : ASIC company auditor registration number
 *   - assurance_standard       : default 'AUASB GS 100'
 *   - assurance_obtained_at    : date assurance was issued
 *
 * The PDF report shows these on the cover page and in Section 8.
 * Without 'limited' or 'reasonable' assurance, the PDF carries a warning that
 * the report cannot be filed under mandatory AASB S2 disclosure rules.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

interface AssuranceForm {
  assurance_status:        "none" | "limited" | "reasonable";
  assurance_provider?:     string | null;
  assurance_asic_reg?:     string | null;
  assurance_standard?:     string | null;
  assurance_obtained_at?:  string | null;  // ISO date "YYYY-MM-DD"
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  const rows = await sql<Array<{
    assurance_status:       string;
    assurance_provider:     string | null;
    assurance_asic_reg:     string | null;
    assurance_standard:     string | null;
    assurance_obtained_at:  string | null;
  }>>`
    SELECT assurance_status, assurance_provider, assurance_asic_reg,
           assurance_standard, assurance_obtained_at::text
    FROM   companies
    WHERE  id = ${companyId}::uuid
    LIMIT  1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  }
  return NextResponse.json({ assurance: rows[0] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  let body: AssuranceForm;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Validate assurance_status
  if (!["none", "limited", "reasonable"].includes(body.assurance_status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  // If status != 'none', provider + asic_reg are required
  if (body.assurance_status !== "none") {
    if (!body.assurance_provider?.trim()) {
      return NextResponse.json(
        { error: "provider_required", message: "Auditor name is required when assurance is obtained." },
        { status: 400 }
      );
    }
    if (!body.assurance_asic_reg?.trim()) {
      return NextResponse.json(
        { error: "asic_reg_required", message: "ASIC company auditor registration number is required." },
        { status: 400 }
      );
    }
  }

  // Validate date format if provided
  let obtainedAt: string | null = null;
  if (body.assurance_obtained_at) {
    const d = new Date(body.assurance_obtained_at);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    }
    obtainedAt = d.toISOString().slice(0, 10);
  }

  const standard = body.assurance_standard?.trim() || "AUASB GS 100";

  try {
    await sql`
      UPDATE companies
      SET
        assurance_status        = ${body.assurance_status},
        assurance_provider      = ${body.assurance_provider?.trim() || null},
        assurance_asic_reg      = ${body.assurance_asic_reg?.trim() || null},
        assurance_standard      = ${standard},
        assurance_obtained_at   = ${obtainedAt}::date,
        updated_at              = NOW()
      WHERE id = ${companyId}::uuid
    `;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[settings/assurance] save failed:", msg);
    return NextResponse.json({ error: "save_failed", message: msg }, { status: 500 });
  }
}
