/**
 * EcoLink Australia — Xero Client (DB-Backed Token Manager)
 *
 * Single entry point for any API route that needs a valid Xero access token.
 *
 * Responsibilities:
 *   1. Load encrypted token from `companies.xero_token_data`
 *   2. Decrypt with AES-256-GCM (via crypto.ts)
 *   3. Refresh if expired (5-min buffer) using xero.ts helpers
 *   4. Persist refreshed tokens back to DB
 *   5. Return { accessToken, tenantId } — ready for Xero API calls
 *
 * Design: No state. Every call reads the DB fresh (safe for serverless cold-starts).
 * The 5-minute buffer in isTokenValid() ensures no token expires mid-request.
 */

import { sql } from "@/lib/db";
import { parseTokenData, serializeTokenData } from "@/lib/crypto";
import { getValidAccessToken } from "@/lib/xero";

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ValidXeroToken {
  accessToken: string;
  tenantId:    string;
}

export class XeroNotConnectedError extends Error {
  constructor(companyId: string) {
    super(`Company ${companyId} has no Xero token. Connect Xero first.`);
    this.name = "XeroNotConnectedError";
  }
}

export class XeroTokenRefreshError extends Error {
  constructor(cause: string) {
    super(`Xero token refresh failed: ${cause}`);
    this.name = "XeroTokenRefreshError";
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Get a valid Xero access token for a given company.
 *
 * Auto-refreshes if the token is expired, and persists the new token to DB.
 * Throws `XeroNotConnectedError` if no token exists.
 * Throws `XeroTokenRefreshError` if the refresh call fails.
 *
 * @param companyId  UUID from companies table (= session.user.companyId)
 */
export async function getValidXeroToken(companyId: string): Promise<ValidXeroToken> {
  // ── 1. Load encrypted token + tenant ID from DB ─────────────────────────────
  const rows = await sql<{
    xero_tenant_id:  string;
    xero_token_data: unknown;
  }[]>`
    SELECT xero_tenant_id, xero_token_data
    FROM   companies
    WHERE  id = ${companyId}
    LIMIT  1
  `;

  const row    = rows[0];
  const tokens = parseTokenData(row?.xero_token_data);

  if (!tokens?.access_token || !row?.xero_tenant_id) {
    throw new XeroNotConnectedError(companyId);
  }

  // ── 2. Validate / auto-refresh ───────────────────────────────────────────────
  let accessToken: string;
  try {
    const { accessToken: at, updatedTokens } = await getValidAccessToken(tokens);
    accessToken = at;

    // ── 3. Persist refreshed tokens if they changed ───────────────────────────
    if (updatedTokens) {
      await sql`
        UPDATE companies
        SET    xero_token_data = ${serializeTokenData(updatedTokens)}::jsonb,
               updated_at      = NOW()
        WHERE  id = ${companyId}
      `;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new XeroTokenRefreshError(msg);
  }

  return { accessToken, tenantId: row.xero_tenant_id };
}
