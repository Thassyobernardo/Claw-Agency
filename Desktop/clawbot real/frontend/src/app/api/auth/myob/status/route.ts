/**
 * GET /api/auth/myob/status
 *
 * Returns whether the authenticated company has a valid MYOB connection.
 * Used by the dashboard to show the Connect / Disconnect button.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isTokenValid, type MyobTokenSet } from "@/lib/myob";
import { sql } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await sql<Array<{
    myob_company_file_id:  string | null;
    myob_company_file_uri: string | null;
    myob_token_data:       MyobTokenSet | null;
  }>>`
    SELECT myob_company_file_id, myob_company_file_uri, myob_token_data
    FROM   companies
    WHERE  id = ${session.user.companyId}
    LIMIT  1
  `;

  const row = rows[0];
  const tokens = row?.myob_token_data;

  const connected = !!(
    tokens?.access_token &&
    row?.myob_company_file_id
  );

  const tokenValid = connected && tokens ? isTokenValid(tokens) : false;

  return NextResponse.json({
    connected,
    tokenValid,
    companyFileId:  row?.myob_company_file_id  ?? null,
    companyFileUri: row?.myob_company_file_uri ?? null,
  });
}
