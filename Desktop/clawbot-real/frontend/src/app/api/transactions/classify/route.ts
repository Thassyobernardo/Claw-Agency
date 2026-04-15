/**
 * POST /api/transactions/classify
 *
 * Classifies unclassified transactions for the authenticated company using
 * the EcoLink keyword-matching engine (src/lib/classifier.ts).
 *
 * Flow:
 *   1. Verify JWT session → get companyId
 *   2. Fetch all pending transactions for the company (category_id IS NULL)
 *   3. Run classifier on each transaction description + amount
 *   4. Persist results:
 *        confidence ≥ 0.60 → status = 'classified'   (auto-applied)
 *        confidence 0.40–0.59 → status = 'needs_review' (suggested, awaits human)
 *   5. Return summary: { classified, flagged, unclassified, total }
 *
 * Response 200: { classified: number, flagged: number, unclassified: number, total: number }
 * Response 401: { error: "unauthenticated" }
 * Response 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { classify } from "@/lib/classifier";

/** Minimum confidence to auto-classify (no human review needed) */
const AUTO_THRESHOLD = 0.60;
/** Minimum confidence to flag for review ("suggested" category) */
const REVIEW_THRESHOLD = 0.40;

export async function POST(_request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── 2. Fetch unclassified transactions (max 2,000 per call) ──────────
  let rows: Array<{
    id: string;
    description: string;
    amount_aud: string; // postgres.js returns numeric as string
  }>;

  try {
    rows = await sql<typeof rows>`
      SELECT
        id,
        description,
        amount_aud::text AS amount_aud
      FROM   transactions
      WHERE  company_id = ${companyId}::uuid
        AND  category_id IS NULL
        AND  classification_status = 'pending'
      ORDER  BY transaction_date DESC
      LIMIT  2000
    `;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[classify] DB fetch failed:", msg);
    return NextResponse.json({ error: "db_error", message: msg }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ classified: 0, flagged: 0, unclassified: 0, total: 0 });
  }

  // ── 3. Classify each transaction ─────────────────────────────────────
  type UpdateRow = {
    id: string;
    categoryCode: string;
    confidence: number;
    kgCo2e: number;
    status: "classified" | "needs_review";
  };

  const updates: UpdateRow[] = [];
  let unclassifiedCount = 0;

  for (const row of rows) {
    const amountAud = parseFloat(row.amount_aud) || 0;
    const result = classify(row.description, amountAud, REVIEW_THRESHOLD);

    if (!result) {
      unclassifiedCount++;
      continue;
    }

    updates.push({
      id: row.id,
      categoryCode: result.category,
      confidence: result.confidence,
      kgCo2e: result.estimatedKgCo2e,
      status: result.confidence >= AUTO_THRESHOLD ? "classified" : "needs_review",
    });
  }

  // ── 4. Fetch category UUID map once ───────────────────────────────────
  let categoryMap: Record<string, string> = {};
  try {
    const cats = await sql<Array<{ code: string; id: string }>>`
      SELECT code, id::text FROM emission_categories
    `;
    categoryMap = Object.fromEntries(cats.map((c) => [c.code, c.id]));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[classify] Category fetch failed:", msg);
    return NextResponse.json({ error: "db_error", message: msg }, { status: 500 });
  }

  // ── 5. Persist updates ────────────────────────────────────────────────
  let classified = 0;
  let flagged = 0;

  for (const update of updates) {
    const categoryId = categoryMap[update.categoryCode];
    if (!categoryId) {
      // Category code not yet in DB — skip (shouldn't happen after migration 005)
      unclassifiedCount++;
      continue;
    }

    try {
      await sql`
        UPDATE transactions
        SET
          category_id               = ${categoryId}::uuid,
          co2e_kg                   = ${update.kgCo2e},
          classification_confidence = ${update.confidence},
          classification_status     = ${update.status},
          classified_at             = NOW(),
          updated_at                = NOW()
        WHERE  id         = ${update.id}::uuid
          AND  company_id = ${companyId}::uuid
      `;

      if (update.status === "classified") {
        classified++;
      } else {
        flagged++;
      }
    } catch (err: unknown) {
      // Non-fatal — log and continue with remaining transactions
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[classify] Update failed for tx ${update.id}:`, msg);
      unclassifiedCount++;
    }
  }

  // ── 6. Return summary ─────────────────────────────────────────────────
  return NextResponse.json({
    classified,
    flagged,
    unclassified: unclassifiedCount,
    total: rows.length,
  });
}
