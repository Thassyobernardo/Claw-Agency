/**
 * GET /api/integrations/xero/status
 *
 * Returns the Xero connection status for the current session.
 * Used by the dashboard to show "Connected / Not Connected" UI.
 *
 * Response:
 *   { connected: false }
 *   { connected: true, tenantName: string, tenantId: string, tokenValid: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { isTokenValid } from "@/lib/xero";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/validators";
import { parseTokenData } from "@/lib/crypto";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.cookies.get("xero_tenant_id")?.value;

  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json({ connected: false });
  }

  const rows = await sql<{ name: string; xero_tenant_id: string; xero_token_data: unknown }[]>`
    SELECT name, xero_tenant_id, xero_token_data
    FROM   companies
    WHERE  xero_tenant_id = ${tenantId}
    LIMIT  1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ connected: false });
  }

  const company = rows[0];
  const tokens = parseTokenData(company.xero_token_data);
  const tokenValid = tokens ? isTokenValid(tokens) : false;

  return NextResponse.json({
    connected:  true,
    tenantName: company.name,
    tenantId:   company.xero_tenant_id,
    tokenValid,
  });
}
