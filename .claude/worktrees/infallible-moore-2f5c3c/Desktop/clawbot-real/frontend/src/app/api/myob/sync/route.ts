/**
 * POST /api/myob/sync
 *
 * Fetches SpendMoney transactions AND Purchase Bills from the connected
 * MYOB company file and imports them into EcoLink's transactions table.
 *
 * - Only imports transactions for the current Australian FY (July–June)
 * - Deduplicates by (company_id, source='myob', external_id)
 * - Marks each new transaction as 'pending' for the classification engine
 *
 * Auth required: valid NextAuth session.
 *
 * Response:
 *   { ok, imported, skipped, pages, fy_from, fy_to, message }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  getValidAccessToken,
  fetchSpendMoney,
  fetchPurchaseBills,
  parseMyobDate,
  type MyobTokenSet,
  type MyobSpendMoney,
  type MyobPurchaseBill,
} from "@/lib/myob";
import { sql } from "@/lib/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentFY() {
  const now  = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${year}-07-01`, to: `${year + 1}-06-30`, year: year + 1 };
}

function fyQuarter(date: Date): number {
  const m = date.getMonth(); // 0-based
  return m >= 6
    ? Math.floor((m - 6) / 3) + 1
    : Math.floor((m + 6) / 3) + 3;
}

function reportingYear(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
}

// ─── Row inserter ─────────────────────────────────────────────────────────────

async function insertTransaction(
  companyId:    string,
  externalId:   string,
  date:         Date,
  description:  string,
  supplierName: string | null,
  amount:       number,
  accountCode:  string | null,
  accountName:  string | null,
): Promise<"imported" | "skipped"> {
  const result = await sql`
    INSERT INTO transactions (
      company_id, source, external_id, transaction_date, description,
      supplier_name, amount_aud, currency, account_code, account_name,
      classification_status, reporting_year, reporting_quarter
    ) VALUES (
      ${companyId}, 'myob', ${externalId},
      ${date.toISOString().split("T")[0]},
      ${description}, ${supplierName},
      ${amount}, 'AUD',
      ${accountCode}, ${accountName},
      'pending',
      ${reportingYear(date)},
      ${fyQuarter(date)}
    )
    ON CONFLICT (company_id, source, external_id) DO NOTHING
    RETURNING id
  `;
  return result.length > 0 ? "imported" : "skipped";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── Load MYOB credentials ──────────────────────────────────────────────────
  const rows = await sql<Array<{
    myob_company_file_uri: string | null;
    myob_token_data:       MyobTokenSet | null;
  }>>`
    SELECT myob_company_file_uri, myob_token_data
    FROM   companies
    WHERE  id = ${companyId}
    LIMIT  1
  `;

  const company = rows[0];
  if (!company?.myob_token_data?.access_token || !company.myob_company_file_uri) {
    return NextResponse.json(
      { error: "myob_not_connected", message: "Connect MYOB first." },
      { status: 400 }
    );
  }

  // ── Ensure token is valid ──────────────────────────────────────────────────
  const { accessToken, updatedTokens } = await getValidAccessToken(company.myob_token_data);
  if (updatedTokens) {
    await sql`
      UPDATE companies
      SET myob_token_data = ${JSON.stringify(updatedTokens)}::jsonb, updated_at = NOW()
      WHERE id = ${companyId}
    `;
  }

  const fileUri = company.myob_company_file_uri;

  // ── Determine FY sync window ───────────────────────────────────────────────
  const fy = currentFY();
  let fromDate = fy.from;
  let toDate   = fy.to;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.from) fromDate = body.from;
    if (body.to)   toDate   = body.to;
  } catch { /* ignore */ }

  let imported = 0;
  let skipped  = 0;
  let pages    = 0;

  // ── Sync 1: SpendMoney transactions ───────────────────────────────────────
  {
    let skip    = 0;
    let hasMore = true;

    while (hasMore) {
      const { transactions, hasMore: more } = await fetchSpendMoney(
        accessToken, fileUri, fromDate, toDate, skip
      );
      hasMore = more;
      pages  += 1;
      skip   += transactions.length;

      for (const tx of transactions) {
        const date        = parseMyobDate(tx.Date);
        const description = tx.Memo?.trim() || tx.Payee?.trim() || "MYOB spend";
        const supplier    = tx.Payee?.trim() || null;
        const amount      = Math.abs(tx.Amount);
        // Use first line account for categorisation
        const firstLine   = tx.Lines?.[0];
        const accountCode = firstLine?.Account?.DisplayID ?? null;
        const accountName = firstLine?.Account?.Name ?? tx.Account?.Name ?? null;
        const externalId  = `spend_${tx.UID}`;

        try {
          const res = await insertTransaction(
            companyId, externalId, date, description, supplier, amount, accountCode, accountName
          );
          if (res === "imported") imported++; else skipped++;
        } catch (err) {
          console.error("[myob/sync] SpendMoney insert failed:", tx.UID, err);
          skipped++;
        }
      }

      if (hasMore) await new Promise((r) => setTimeout(r, 300));
    }
  }

  // ── Sync 2: Purchase Bills (supplier invoices) ─────────────────────────────
  {
    let skip    = 0;
    let hasMore = true;

    while (hasMore) {
      const { bills, hasMore: more } = await fetchPurchaseBills(
        accessToken, fileUri, fromDate, toDate, skip
      );
      hasMore = more;
      pages  += 1;
      skip   += bills.length;

      for (const bill of bills) {
        const date        = parseMyobDate(bill.Date);
        const description = bill.Memo?.trim()
          || bill.Lines?.[0]?.Description?.trim()
          || `Invoice ${bill.Number}`;
        const supplier    = bill.Supplier?.Name?.trim() || null;
        const amount      = Math.abs(bill.Subtotal ?? bill.TotalAmountPaid);
        const firstLine   = bill.Lines?.[0];
        const accountCode = firstLine?.Account?.DisplayID ?? null;
        const accountName = firstLine?.Account?.Name ?? null;
        const externalId  = `bill_${bill.UID}`;

        try {
          const res = await insertTransaction(
            companyId, externalId, date, description, supplier, amount, accountCode, accountName
          );
          if (res === "imported") imported++; else skipped++;
        } catch (err) {
          console.error("[myob/sync] Bill insert failed:", bill.UID, err);
          skipped++;
        }
      }

      if (hasMore) await new Promise((r) => setTimeout(r, 300));
    }
  }

  // ── Update sync timestamp ──────────────────────────────────────────────────
  await sql`UPDATE companies SET updated_at = NOW() WHERE id = ${companyId}`;

  return NextResponse.json({
    ok:       true,
    imported,
    skipped,
    pages,
    fy_from:  fromDate,
    fy_to:    toDate,
    message:  `Imported ${imported} new MYOB transactions (${skipped} already existed).`,
  });
}
