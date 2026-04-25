import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = session.user.companyId;

  const rows = await sql`
    SELECT id, description, amount_aud, transaction_date, classification_status, source
    FROM transactions
    WHERE company_id = ${companyId}
    ORDER BY transaction_date DESC
  `;

  return NextResponse.json({ transactions: rows });
}
