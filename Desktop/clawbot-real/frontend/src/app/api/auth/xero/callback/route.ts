/**
 * GET /api/auth/xero/callback
 *
 * Step 2 of the Xero OAuth 2.0 flow.
 *
 * Xero redirects here with ?code=...&state=...
 * We:
 *  1. Verify the state (CSRF check)
 *  2. Exchange the code for access + refresh tokens
 *  3. Fetch the connected Xero tenants (organisations)
 *  4a. If the user is logged in → link Xero to THEIR company
 *  4b. If not logged in → upsert by xero_tenant_id (new org signup flow)
 *  5. Redirect the user to the dashboard with a success flash
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  exchangeCodeForTokens,
  getConnectedTenants,
  type XeroTokenSet,
} from "@/lib/xero";
import { sql } from "@/lib/db";
import { serializeTokenData } from "@/lib/crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // ─── Xero returned an error ──────────────────────────────────────────────
  if (error) {
    const desc = searchParams.get("error_description") ?? error;
    return redirectWithError(`Xero authorization failed: ${desc}`);
  }

  if (!code || !state) {
    return redirectWithError("Missing code or state parameter from Xero.");
  }

  // ─── CSRF state check ─────────────────────────────────────────────────────
  const storedState = request.cookies.get("xero_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return redirectWithError("Invalid OAuth state. Please try connecting again.");
  }

  // ─── Exchange code for tokens ─────────────────────────────────────────────
  // CRITICAL: redirect_uri sent here must EXACTLY match the one sent in step 1.
  // We use the same request origin so they always agree.
  let tokens: XeroTokenSet;
  try {
    tokens = await exchangeCodeForTokens(code, request.nextUrl.origin);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[xero/callback] Token exchange failed:", msg);
    return redirectWithError("Failed to obtain tokens from Xero.");
  }

  // ─── Fetch connected Xero organisations ───────────────────────────────────
  let tenants: Awaited<ReturnType<typeof getConnectedTenants>>;
  try {
    tenants = await getConnectedTenants(tokens.access_token);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[xero/callback] Fetching tenants failed:", msg);
    return redirectWithError("Connected to Xero but could not retrieve your organisation.");
  }

  if (tenants.length === 0) {
    return redirectWithError(
      "No Xero organisations found. Make sure you granted access to at least one organisation."
    );
  }

  const tenant = tenants[0];

  // ─── Persist in DB ────────────────────────────────────────────────────────
  try {
    // Check if the user is authenticated — if so, link Xero to THEIR company
    const session = await getServerSession(authOptions);

    if (session?.user?.companyId) {
      // Logged-in flow: attach Xero credentials to the user's existing company
      await sql`
        UPDATE companies
        SET
          xero_tenant_id  = ${tenant.tenantId},
          xero_token_data = ${serializeTokenData(tokens)}::jsonb,
          updated_at      = NOW()
        WHERE id = ${session.user.companyId}
      `;
    } else {
      // Anonymous flow (future: public sign-up via Xero)
      // Upsert by xero_tenant_id — creates a shell company if this is a new org.
      // IMPORTANT: tokens are AES-256-GCM encrypted on BOTH the INSERT and UPDATE paths.
      const encryptedTokenJson = serializeTokenData(tokens);
      await sql`
        INSERT INTO companies (name, xero_tenant_id, xero_token_data)
        VALUES (
          ${tenant.tenantName},
          ${tenant.tenantId},
          ${encryptedTokenJson}::jsonb
        )
        ON CONFLICT (xero_tenant_id)
        DO UPDATE SET
          xero_token_data = ${encryptedTokenJson}::jsonb,
          updated_at      = NOW()
      `;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[xero/callback] DB upsert failed:", msg);
    return redirectWithError("Connected to Xero but failed to save credentials.");
  }

  // ─── Success — redirect to dashboard ─────────────────────────────────────
  const response = NextResponse.redirect(
    `${APP_URL}/dashboard?xero=connected&org=${encodeURIComponent(tenant.tenantName)}`
  );

  // Clear the CSRF state cookie
  response.cookies.set("xero_oauth_state", "", { httpOnly: true, maxAge: 0, path: "/" });

  // Store tenant ID in a signed HttpOnly cookie for status checks
  response.cookies.set("xero_tenant_id", tenant.tenantId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 30, // 30 days
    path:     "/",
  });

  return response;
}

function redirectWithError(message: string): NextResponse {
  const url = new URL(`${APP_URL}/dashboard`);
  url.searchParams.set("xero", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url.toString());
}
