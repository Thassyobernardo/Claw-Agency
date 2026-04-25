/**
 * POST /api/transactions/classify
 *
 * Classifies unclassified transactions for the authenticated company using a
 * two-tier system:
 *
 *   Tier 1 — Keyword classifier (free, deterministic, fast)
 *     src/lib/classifier.ts uses curated keyword + emission-factor rules.
 *
 *   Tier 2 — AI ensemble (paid, uses 3 LLMs in parallel, costs ~US$0.00015/tx)
 *     src/lib/ensemble-classifier.ts fans out to GPT-4o-mini, Gemini 2.5 Flash
 *     and DeepSeek-V3 via OpenRouter, aggregates with majority vote + median.
 *     Only invoked when keyword Tier 1 fails or is below AUTO_THRESHOLD.
 *
 * Flow:
 *   1. Verify JWT session → get companyId
 *   2. Fetch all pending transactions for the company (max 2000 / call)
 *   3. Run keyword classifier on each
 *      - confidence ≥ AUTO_THRESHOLD     → status = 'classified'
 *      - confidence in [REVIEW, AUTO)    → goto AI ensemble
 *      - no rule match                    → goto AI ensemble
 *   4. AI ensemble (only if OPENROUTER_API_KEY set; capped at AI_MAX_PER_CALL)
 *      - confidence ≥ ENSEMBLE_REVIEW    → status = 'classified'
 *      - confidence below                → status = 'needs_review'
 *   5. Persist → return summary
 *
 * Response 200: { classified, flagged, ai_used, unclassified, total }
 * Response 401: { error: "unauthenticated" }
 * Response 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { classify } from "@/lib/classifier";
import {
  tryClassifyEnsemble,
  ENSEMBLE_REVIEW_THRESHOLD,
  type EnsembleResult,
} from "@/lib/ensemble-classifier";

/** Minimum keyword confidence to auto-classify with no AI fallback. */
const AUTO_THRESHOLD = 0.60;
/** Below this we don't even keep the keyword guess — we go straight to AI / needs_review. */
const REVIEW_THRESHOLD = 0.40;
/** Hard cap on AI calls per request, to prevent runaway billing. */
const AI_MAX_PER_CALL = 500;

type PendingRow = {
  id: string;
  description: string;
  amount_aud: string; // postgres.js returns numeric as string
};

type UpdateRow = {
  id: string;
  categoryCode: string;
  confidence: number;
  kgCo2e: number;
  status: "classified" | "needs_review";
  source: "keyword" | "ai_ensemble";
};

export async function POST(_request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── 2. Fetch unclassified transactions ───────────────────────────────
  let rows: PendingRow[];
  try {
    rows = await sql<PendingRow[]>`
      SELECT id, description, amount_aud::text AS amount_aud
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
    return NextResponse.json({ classified: 0, flagged: 0, ai_used: 0, unclassified: 0, total: 0 });
  }

  // ── 3. Tier 1 — Keyword classifier ───────────────────────────────────
  const updates: UpdateRow[] = [];
  const aiQueue: PendingRow[] = [];
  let unclassifiedCount = 0;

  for (const row of rows) {
    const amountAud = parseFloat(row.amount_aud) || 0;
    const result = classify(row.description, amountAud, REVIEW_THRESHOLD);

    if (result && result.confidence >= AUTO_THRESHOLD) {
      // Strong keyword match — accept it as final
      updates.push({
        id:           row.id,
        categoryCode: result.category,
        confidence:   result.confidence,
        kgCo2e:       result.estimatedKgCo2e,
        status:       "classified",
        source:       "keyword",
      });
    } else {
      // No match OR weak match — defer to AI ensemble
      aiQueue.push(row);
    }
  }

  // ── 4. Tier 2 — AI ensemble fallback ─────────────────────────────────
  let aiUsedCount = 0;
  const aiEnabled = !!process.env.OPENROUTER_API_KEY;

  if (aiEnabled && aiQueue.length > 0) {
    const slice = aiQueue.slice(0, AI_MAX_PER_CALL);

    // Run in modest parallel batches to avoid hammering OpenRouter / hitting rate limits
    const BATCH = 5;
    for (let i = 0; i < slice.length; i += BATCH) {
      const batch = slice.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (row): Promise<{ row: PendingRow; result: EnsembleResult | null }> => {
          const amountAud = parseFloat(row.amount_aud) || 0;
          const result = await tryClassifyEnsemble(row.description, amountAud);
          return { row, result };
        }),
      );

      for (const { row, result } of results) {
        if (!result) {
          unclassifiedCount++;
          continue;
        }
        aiUsedCount++;
        updates.push({
          id:           row.id,
          categoryCode: result.category,
          confidence:   result.confidence,
          kgCo2e:       result.kg_co2e,
          status:       result.confidence >= ENSEMBLE_REVIEW_THRESHOLD ? "classified" : "needs_review",
          source:       "ai_ensemble",
        });
      }
    }

    // Anything beyond the AI cap stays unclassified for this call
    unclassifiedCount += aiQueue.length - slice.length;
  } else {
    // AI disabled or no transactions queued — count any AI candidates as unclassified
    unclassifiedCount += aiQueue.length;
  }

  // ── 5. Fetch category UUID map once ───────────────────────────────────
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

  // ── 6. Persist updates ────────────────────────────────────────────────
  let classified = 0;
  let flagged = 0;

  for (const update of updates) {
    const categoryId = categoryMap[update.categoryCode];
    if (!categoryId) {
      // Category code returned by AI but not yet in DB — skip
      console.warn(`[classify] Unknown category code "${update.categoryCode}" from ${update.source}`);
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
      if (update.status === "classified") classified++;
      else                                flagged++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[classify] Update failed for tx ${update.id}:`, msg);
      unclassifiedCount++;
    }
  }

  // ── 7. Return summary ────────────────────────────────────────────────
  return NextResponse.json({
    classified,
    flagged,
    ai_used: aiUsedCount,
    unclassified: unclassifiedCount,
    total: rows.length,
  });
}
