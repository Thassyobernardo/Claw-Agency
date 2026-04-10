/**
 * POST /api/auth/xero/refresh
 *
 * Manually refresh the Xero access token for the currently connected
 * organisation (identified by the xero_tenant_id session cookie).
 *
 * This endpoint is also called automatically by the sync pipeline before
 * any Xero API call when the stored token is close to expiry.
 *
 * Response: { ok: true, expires_at: number } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken, type XeroTokenSet } from "@/lib/xero";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/validators";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.cookies.get("xero_tenant_id")?.value;

  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json(
      { error: "not_connected", message: "No Xero organisation connected." },
      { status: 401 }
    );
  }

  // Fetch current tokens from DB
  const rows = await sql<{ xero_token_data: XeroTokenSet }[]>`
    SELECT xero_token_data
    FROM   companies
    WHERE  xero_tenant_id = ${tenantId}
    LIMIT  1
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "not_found", message: "Organisation not found in database." },
      { status: 404 }
    );
  }

  const tokens = rows[0].xero_token_data;

  if (!tokens?.refresh_token) {
    return NextResponse.json(
      { error: "no_refresh_token", message: "No refresh token stored. Please reconnect Xero." },
      { status: 400 }
    );
  }

  // Refresh
  let refreshed: XeroTokenSet;
  try {
    refreshed = await refreshAccessToken(tokens.refresh_token);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[xero/refresh] Refresh failed:", msg);
    return NextResponse.json(
      { error: "refresh_failed", message: msg },
      { status: 502 }
    );
  }

  // Persist updated tokens
  await sql`
    UPDATE companies
    SET    xero_token_data = ${JSON.stringify(refreshed)}::jsonb,
           updated_at      = NOW()
    WHERE  xero_tenant_id  = ${tenantId}
  `;

  return NextResponse.json({ ok: true, expires_at: refreshed.expires_at });
}
