/**
 * POST /api/xero/sync
 *
 * Fetches bank transactions from the connected Xero organisation and
 * imports them into EcoLink's transactions table.
 *
 * - Only imports "SPEND" (expense) transactions for the current FY
 * - Skips transactions already imported (deduplicates by external_id)
 * - Marks each new transaction as "pending" — the classification engine
 *   will process them in Phase 10
 *
 * Auth required: must have a valid NextAuth session.
 *
 * Response:
 *   { imported: number, skipped: number, pages: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  getValidAccessToken,
  fetchBankTransactions,
  fetchAccounts,
  parseXeroDate,
} from "@/lib/xero";
import { sql } from "@/lib/db";
import { parseTokenData, serializeTokenData } from "@/lib/crypto";

// Australian FY: 1 July → 30 June
function currentFY() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${year}-07-01`, to: `${year + 1}-06-30`, year: year + 1 };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── Load tokens from DB ───────────────────────────────────────────────────
  const rows = await sql<{ xero_tenant_id: string; xero_token_data: unknown }[]>`
    SELECT xero_tenant_id, xero_token_data
    FROM   companies
    WHERE  id = ${companyId}
    LIMIT  1
  `;

  const company = rows[0];
  const tokens = parseTokenData(company?.xero_token_data);
  if (!tokens?.access_token) {
    return NextResponse.json(
      { error: "xero_not_connected", message: "Connect Xero first." },
      { status: 400 }
    );
  }

  // ── Ensure token is valid (auto-refresh if needed) ────────────────────────
  const { accessToken, updatedTokens } = await getValidAccessToken(tokens);
  const tenantId = company.xero_tenant_id;

  // Persist refreshed tokens if they changed (always re-encrypt)
  if (updatedTokens) {
    await sql`
      UPDATE companies
      SET xero_token_data = ${serializeTokenData(updatedTokens)}::jsonb, updated_at = NOW()
      WHERE id = ${companyId}
    `;
  }

  // ── Determine FY and sync window ─────────────────────────────────────────
  const fy = currentFY();

  // Allow custom date range from request body (optional)
  let fromDate = fy.from;
  let toDate   = fy.to;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.from) fromDate = body.from;
    if (body.to)   toDate   = body.to;
  } catch { /* ignore */ }

  // ── Fetch accounts for name resolution ───────────────────────────────────
  const accountMap = await fetchAccounts(accessToken, tenantId);

  // ── Paginated fetch from Xero ─────────────────────────────────────────────
  let page     = 1;
  let imported = 0;
  let skipped  = 0;
  let pages    = 0;
  let hasMore  = true;

  while (hasMore) {
    const { transactions, hasMore: more } = await fetchBankTransactions(
      accessToken, tenantId, fromDate, toDate, page
    );
    hasMore = more;
    pages   = page;
    page   += 1;

    if (transactions.length === 0) break;

    for (const tx of transactions) {
      const externalId = tx.BankTransactionID;

      // ── Description: use first line item description or reference or bank name
      const firstLine   = tx.LineItems?.[0];
      const description = firstLine?.Description?.trim()
        || tx.Reference?.trim()
        || tx.BankAccount?.Name
        || "Xero transaction";

      // ── Supplier name: from Contact
      const supplierName = tx.Contact?.Name?.trim() ?? null;

      // ── Account details
      const accountCode = firstLine?.AccountCode ?? null;
      const accountId   = firstLine?.AccountID   ?? null;
      const accountName = (accountCode && accountMap[accountCode])
        ?? (accountId && accountMap[accountId])
        ?? null;

      // ── Date + amount
      const txDate  = parseXeroDate(tx.Date);
      const amount  = Math.abs(Number(tx.Total));
      const txYear  = txDate.getFullYear();
      const txMonth = txDate.getMonth(); // 0-based
      // Australian FY: July (6) = Q1
      const reportingYear = txMonth >= 6 ? txYear + 1 : txYear;
      const reportingQ    = txMonth >= 6
        ? Math.floor((txMonth - 6) / 3) + 1
        : Math.floor((txMonth + 6) / 3) + 3;

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
            account_name,
            classification_status,
            reporting_year,
            reporting_quarter
          ) VALUES (
            ${companyId},
            'xero',
            ${externalId},
            ${txDate.toISOString().split("T")[0]},
            ${description},
            ${supplierName},
            ${amount},
            ${tx.CurrencyCode ?? "AUD"},
            ${accountCode},
            ${accountName},
            'pending',
            ${reportingYear},
            ${reportingQ}
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
        console.error("[xero/sync] Insert failed for", externalId, err);
        skipped += 1;
      }
    }

    // Safety: Xero rate limit is 60 req/min — add a small delay after each page
    if (hasMore) await new Promise((r) => setTimeout(r, 500));
  }

  // ── Update company sync timestamp ─────────────────────────────────────────
  await sql`
    UPDATE companies SET updated_at = NOW() WHERE id = ${companyId}
  `;

  return NextResponse.json({
    ok:         true,
    imported,
    skipped,
    pages,
    fy_from:    fromDate,
    fy_to:      toDate,
    message:    `Imported ${imported} new transactions (${skipped} already existed).`,
  });
}
