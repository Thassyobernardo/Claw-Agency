/**
 * POST /api/integrations/xero/sync
 *
 * Paginação controlada pelo Frontend (Vercel-timeout-safe pattern).
 *
 * DESIGN: Each call fetches EXACTLY ONE PAGE from Xero and returns.
 * The frontend loop calls this repeatedly until hasMore = false.
 * This keeps every serverless invocation well within Vercel's 60s timeout.
 *
 * Flow per call:
 *   1. Auth + companyId from session
 *   2. getValidXeroToken() → access_token (auto-refresh + DB persist)
 *   3. Load merchant rules from DB (cached per page — no extra round-trips)
 *   4. fetchBankTransactions(page) → 1 page of Xero BankTransactions
 *   5. routeTransactionStatic(tx, rules) → IGNORE / EXTRACTED / NEEDS_REVIEW
 *   6. Bulk INSERT with ON CONFLICT DO NOTHING
 *   7. Return { page, processed, imported, skipped, hasMore }
 *
 * Query param: ?page=N  (default 1)
 * Body param:  { from?, to? }  — override FY date range (optional)
 *
 * Rate limits: Xero allows 60 req/min. The frontend adds 1s between pages,
 * and this route never issues more than 1 Xero API call per invocation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth/next";
import { authOptions }               from "@/lib/auth";
import { sql }                       from "@/lib/db";
import {
  fetchBankTransactions,
  parseXeroDate,
  type XeroBankTransaction,
} from "@/lib/xero";
import {
  getValidXeroToken,
  XeroNotConnectedError,
  XeroTokenRefreshError,
} from "@/lib/xero_client";
import {
  routeTransactionStatic,
  type XeroTransaction,
  type MerchantRule,
} from "@/lib/transaction_router";

// LoadedRule alias for clarity
type LoadedRule = MerchantRule;


// ─── Australian FY helper ─────────────────────────────────────────────────────

function currentFY(): { from: string; to: string; year: number } {
  const now  = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${year}-07-01`, to: `${year + 1}-06-30`, year: year + 1 };
}

// ─── Load merchant rules from DB (called once per request) ───────────────────

async function loadMerchantRules(companyId: string): Promise<LoadedRule[]> {
  // Load both global rules and company-specific overrides, priority DESC
  const rows = await sql<LoadedRule[]>`
    SELECT
      id, merchant_name, pattern, match_type, category_code, scope,
      activity_unit, requires_state, notes_citation, priority, action
    FROM merchant_classification_rules
    WHERE is_active = TRUE
    ORDER BY priority DESC
  `;
  void companyId; // future: company-specific overrides
  return rows;
}

// ─── Map XeroBankTransaction → transactions row ───────────────────────────────

interface InsertPayload {
  externalId:       string;
  txDate:           Date;
  description:      string;
  supplierName:     string | null;
  amountAud:        number;
  currency:         string;
  accountCode:      string | null;
  accountName:      string | null;
  reportingYear:    number;
  reportingQuarter: number;
  status:           "ignored" | "needs_review" | "pending" | "extracted";
  categoryCode:     string | null;
  scope:            number | null;
  quantityValue:    number | null;
  quantityUnit:     string | null;
  routerReason:     string | null;
}

function buildPayload(tx: XeroBankTransaction): Omit<InsertPayload, "status" | "categoryCode" | "scope" | "quantityValue" | "quantityUnit" | "routerReason"> {
  const firstLine   = tx.LineItems?.[0];
  const description = firstLine?.Description?.trim()
    || tx.Reference?.trim()
    || tx.BankAccount?.Name
    || "Xero transaction";
  const supplierName = tx.Contact?.Name?.trim() ?? null;
  const accountCode  = firstLine?.AccountCode ?? null;
  const txDate       = parseXeroDate(tx.Date);
  const txMonth      = txDate.getMonth(); // 0-based
  const txYear       = txDate.getFullYear();
  const reportingYear    = txMonth >= 6 ? txYear + 1 : txYear;
  const reportingQuarter = txMonth >= 6
    ? Math.floor((txMonth - 6) / 3) + 1
    : Math.floor((txMonth + 6) / 3) + 3;

  return {
    externalId:       tx.BankTransactionID,
    txDate,
    description,
    supplierName,
    amountAud:        Math.abs(Number(tx.Total)),
    currency:         tx.CurrencyCode ?? "AUD",
    accountCode,
    accountName:      null, // fetched separately only when needed (perf)
    reportingYear,
    reportingQuarter,
  };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── 2. Parse query params ─────────────────────────────────────────────────
  const url    = new URL(req.url);
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  let fromDate: string;
  let toDate:   string;
  try {
    const body = await req.json().catch(() => ({})) as { from?: string; to?: string };
    const fy   = currentFY();
    fromDate   = body.from ?? fy.from;
    toDate     = body.to   ?? fy.to;
  } catch {
    const fy = currentFY();
    fromDate  = fy.from;
    toDate    = fy.to;
  }

  // ── 3. Get valid Xero token (auto-refresh) ────────────────────────────────
  let accessToken: string;
  let tenantId:    string;
  try {
    ({ accessToken, tenantId } = await getValidXeroToken(companyId));
  } catch (err) {
    if (err instanceof XeroNotConnectedError) {
      return NextResponse.json(
        { error: "xero_not_connected", message: "Connect Xero first via /dashboard/xero-sync." },
        { status: 400 },
      );
    }
    if (err instanceof XeroTokenRefreshError) {
      return NextResponse.json(
        { error: "xero_token_refresh_failed", message: err.message },
        { status: 502 },
      );
    }
    throw err; // unexpected — let Next.js 500 it
  }

  // ── 4. Load merchant rules (once per invocation) ──────────────────────────
  const rules = await loadMerchantRules(companyId);

  // ── 5. Fetch ONE page from Xero ───────────────────────────────────────────
  let xeroTxs: XeroBankTransaction[];
  let hasMore:  boolean;
  try {
    const result = await fetchBankTransactions(accessToken, tenantId, fromDate, toDate, page);
    xeroTxs      = result.transactions;
    hasMore       = result.hasMore;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "xero_api_failed", message: msg, page },
      { status: 502 },
    );
  }

  // ── 6. Route + insert each transaction ───────────────────────────────────
  let imported = 0;
  let skipped  = 0;

  for (const xeroTx of xeroTxs) {
    const base = buildPayload(xeroTx);

    // Route through deterministic engine (0 LLM calls)
    const routerInput: XeroTransaction = {
      merchantName:       base.supplierName ?? base.description,
      description:        base.description,
      amountAud:          base.amountAud,
      xeroTransactionId:  base.externalId,
    };

    const routed = await routeTransactionStatic(routerInput, rules);

    // Map router result to DB fields
    let status:       InsertPayload["status"];
    let categoryCode: string | null = null;
    let scope:        number | null = null;
    let quantityValue:number | null = null;
    let quantityUnit: string | null = null;
    let routerReason: string | null = null;

    if (routed.status === "ignored") {
      status       = "ignored";
      routerReason = routed.reason;
    } else if (routed.status === "extracted") {
      status        = "extracted";
      categoryCode  = routed.categoryCode;
      scope         = routed.scope;
      quantityValue = routed.quantity;
      quantityUnit  = routed.unit;
    } else {
      // needs_review
      status        = "needs_review";
      categoryCode  = routed.categoryCode ?? null;
      scope         = routed.scope ?? null;
      routerReason  = routed.reason;
    }

    try {
      const result = await sql`
        INSERT INTO transactions (
          company_id,
          source,
          external_id,
          transaction_date,
          description,
          supplier_name,
          amount_aud,
          currency,
          account_code,
          classification_status,
          reporting_year,
          reporting_quarter,
          scope,
          quantity_value,
          quantity_unit,
          classification_notes
        ) VALUES (
          ${companyId},
          'xero',
          ${base.externalId},
          ${base.txDate.toISOString().split("T")[0]},
          ${base.description},
          ${base.supplierName},
          ${base.amountAud},
          ${base.currency},
          ${base.accountCode},
          ${status},
          ${base.reportingYear},
          ${base.reportingQuarter},
          ${scope},
          ${quantityValue},
          ${quantityUnit},
          ${routerReason ?? categoryCode}
        )
        ON CONFLICT (company_id, source, external_id) DO NOTHING
        RETURNING id
      `;

      if (result.length > 0) {
        imported += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      console.error("[xero/sync] Insert failed for", base.externalId, err);
      skipped += 1;
    }
  }

  // ── 7. Return page result ─────────────────────────────────────────────────
  return NextResponse.json({
    page,
    processed: xeroTxs.length,
    imported,
    skipped,
    hasMore,
    fromDate,
    toDate,
  });
}

// ─── GET alias (convenience — same logic, page from query) ────────────────────
export { POST as GET };
