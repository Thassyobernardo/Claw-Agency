/**
 * GET /api/transactions/pending
 *
 * Returns paginated transactions that need human review.
 * By default returns `needs_review` status; optionally also `pending` with ?include_pending=1.
 *
 * Query params:
 *   limit            (1–100, default 50)
 *   offset           (default 0)
 *   include_pending  (0|1, default 0)
 *
 * Response 200: {
 *   transactions: TxReview[],
 *   total: number,
 *   categories: { id, code, label, scope }[]   — for the reclassify dropdown
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { clampInt } from "@/lib/validators";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── Query params ──────────────────────────────────────────────────────
  const sp = request.nextUrl.searchParams;
  const limit          = clampInt(sp.get("limit"),  1, 100, 50);
  const offset         = clampInt(sp.get("offset"), 0, 100_000, 0);
  const includePending = sp.get("include_pending") === "1";

  // ── Statuses to fetch ─────────────────────────────────────────────────
  const statuses: string[] = ["needs_review"];
  if (includePending) statuses.push("pending");

  // ── Transactions ──────────────────────────────────────────────────────
  const transactions = await sql<Array<{
    id: string;
    description: string;
    supplier_name: string | null;
    transaction_date: string;
    amount_aud: string;
    co2e_kg: string | null;
    classification_status: string;
    classification_confidence: string | null;
    account_name: string | null;
    account_code: string | null;
    category_id: string | null;
    category_code: string | null;
    category_label: string | null;
    scope: number | null;
  }>>`
    SELECT
      t.id::text,
      t.description,
      t.supplier_name,
      t.transaction_date::text,
      t.amount_aud::text,
      t.co2e_kg::text,
      t.classification_status,
      t.classification_confidence::text,
      t.account_name,
      t.account_code,
      t.category_id::text,
      ec.code   AS category_code,
      ec.label  AS category_label,
      t.scope
    FROM   transactions t
    LEFT   JOIN emission_categories ec ON ec.id = t.category_id
    WHERE  t.company_id = ${companyId}::uuid
      AND  t.classification_status = ANY(${statuses}::text[])
    ORDER  BY t.transaction_date DESC
    LIMIT  ${limit}
    OFFSET ${offset}
  `;

  // ── Count ─────────────────────────────────────────────────────────────
  const countRows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
    FROM   transactions
    WHERE  company_id = ${companyId}::uuid
      AND  classification_status = ANY(${statuses}::text[])
  `;
  const total = parseInt(countRows[0]?.count ?? "0", 10);

  // ── Categories (for reclassify dropdown) ─────────────────────────────
  const categories = await sql<Array<{
    id: string;
    code: string;
    label: string;
    scope: number;
  }>>`
    SELECT id::text, code, label, scope
    FROM   emission_categories
    ORDER  BY scope, label
  `;

  return NextResponse.json({ transactions, total, categories });
}
