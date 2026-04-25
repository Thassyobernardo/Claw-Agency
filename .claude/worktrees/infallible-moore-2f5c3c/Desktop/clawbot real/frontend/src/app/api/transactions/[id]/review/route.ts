/**
 * PATCH /api/transactions/[id]/review
 *
 * Human review action on a single transaction.
 *
 * Body: { action: "approve" | "reject" | "reclassify", category_id?: string }
 *
 *   approve      → classification_status = 'classified', keeps existing category_id
 *   reject       → classification_status = 'pending', clears category_id + co2e_kg
 *   reclassify   → classification_status = 'classified', sets provided category_id
 *
 * Security: JWT session required. UUID validated. Company-scoped WHERE clause
 *           prevents BOLA — users can only act on their own company's transactions.
 *
 * Response 200: { id, status }
 * Response 400: { error }
 * Response 401: { error: "unauthenticated" }
 * Response 404: { error: "not_found" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/validators";

type Action = "approve" | "reject" | "reclassify";

interface ReviewBody {
  action: Action;
  category_id?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── Validate transaction ID ───────────────────────────────────────────
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: ReviewBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { action, category_id } = body;

  if (!["approve", "reject", "reclassify"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  if (action === "reclassify" && !category_id) {
    return NextResponse.json({ error: "category_id required for reclassify" }, { status: 400 });
  }

  if (category_id && !isUuid(category_id)) {
    return NextResponse.json({ error: "invalid_category_id" }, { status: 400 });
  }

  // ── Apply action ──────────────────────────────────────────────────────
  try {
    if (action === "approve") {
      const result = await sql`
        UPDATE transactions
        SET
          classification_status = 'classified',
          classified_at         = NOW(),
          classified_by         = 'ai',
          updated_at            = NOW()
        WHERE id         = ${id}::uuid
          AND company_id = ${companyId}::uuid
          AND classification_status = 'needs_review'
        RETURNING id
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

    } else if (action === "reject") {
      const result = await sql`
        UPDATE transactions
        SET
          classification_status     = 'pending',
          category_id               = NULL,
          co2e_kg                   = NULL,
          classification_confidence = NULL,
          classified_at             = NULL,
          updated_at                = NOW()
        WHERE id         = ${id}::uuid
          AND company_id = ${companyId}::uuid
        RETURNING id
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

    } else if (action === "reclassify") {
      // Fetch category to get correct co2e factor from emission_categories
      const cats = await sql<Array<{ id: string; scope: number }>>`
        SELECT id::text, scope FROM emission_categories WHERE id = ${category_id!}::uuid LIMIT 1
      `;
      if (cats.length === 0) {
        return NextResponse.json({ error: "category_not_found" }, { status: 400 });
      }

      const result = await sql`
        UPDATE transactions
        SET
          category_id               = ${category_id!}::uuid,
          classification_status     = 'classified',
          classification_confidence = 1.0,
          scope                     = ${cats[0].scope},
          classified_at             = NOW(),
          classified_by             = 'ai',
          updated_at                = NOW()
        WHERE id         = ${id}::uuid
          AND company_id = ${companyId}::uuid
        RETURNING id
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
    }

    return NextResponse.json({ id, status: action === "reject" ? "pending" : "classified" });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[review] DB error:", msg);
    return NextResponse.json({ error: "db_error", message: msg }, { status: 500 });
  }
}
