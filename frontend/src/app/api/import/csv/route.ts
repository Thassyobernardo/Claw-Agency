import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

// Parse a simple CSV string into rows
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detect delimiter (comma or semicolon)
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
    if (values.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// Map common CSV column names to our schema fields
function mapRow(row: Record<string, string>): {
  date: string | null;
  description: string;
  amount: number | null;
} {
  // Date variants
  const date =
    row["date"] || row["transaction date"] || row["txn date"] ||
    row["transaction_date"] || row["posted date"] || null;

  // Description variants
  const description =
    row["description"] || row["narrative"] || row["details"] ||
    row["merchant"] || row["memo"] || row["payee"] || "Unknown";

  // Amount variants (use debit if present, else amount)
  const rawAmount =
    row["amount"] || row["debit"] || row["credit"] ||
    row["transaction amount"] || row["amount (aud)"] || "0";

  const amount = parseFloat(rawAmount.replace(/[^0-9.-]/g, "")) || null;

  return { date, description: description.slice(0, 500), amount };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const companyId = session.user.companyId;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".txt")) {
      return NextResponse.json(
        { error: "Only CSV files are supported for now. Excel support coming soon." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in file. Check CSV format." }, { status: 400 });
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const mapped = mapRow(row);
      if (!mapped.amount || !mapped.description || mapped.description === "Unknown") {
        skipped++;
        continue;
      }

      // Parse date safely
      let txDate: string;
      if (mapped.date) {
        const parsed = new Date(mapped.date);
        txDate = isNaN(parsed.getTime())
          ? new Date().toISOString().split("T")[0]
          : parsed.toISOString().split("T")[0];
      } else {
        txDate = new Date().toISOString().split("T")[0];
      }

      await sql`
        INSERT INTO transactions (
          company_id, description, amount_aud, transaction_date,
          classification_status, source
        ) VALUES (
          ${companyId}, ${mapped.description}, ${Math.abs(mapped.amount)},
          ${txDate}, 'pending', 'csv_import'
        )
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      inserted,
      skipped,
      message: `${inserted} transactions imported successfully.`,
    });
  } catch (err) {
    console.error("[import/csv]", err);
    return NextResponse.json({ error: "Import failed. Please try again." }, { status: 500 });
  }
}
