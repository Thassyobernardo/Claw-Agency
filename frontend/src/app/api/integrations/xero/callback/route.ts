/**
 * GET /api/integrations/xero/callback
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
 *
 * IMPORTANT: This URL must be registered in Xero Developer Portal:
 *   https://claw-agency.vercel.app/api/integrations/xero/callback
 *   http://localhost:3000/api/integrations/xero/callback
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

  if (error) {
    const desc = searchParams.get("error_description") ?? error;
    return redirectWithError(`Xero authorization failed: ${desc}`);
  }

  if (!code || !state) {
    return redirectWithError("Missing code or state parameter from Xero.");
  }

  const storedState = request.cookies.get("xero_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return redirectWithError("Invalid OAuth state. Please try connecting again.");
  }

  // CRITICAL: redirect_uri sent here must EXACTLY match the one sent in step 1.
  let tokens: XeroTokenSet;
  try {
    tokens = await exchangeCodeForTokens(code, request.nextUrl.origin);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[xero/callback] Token exchange failed:", msg);
    return redirectWithError("Failed to obtain tokens from Xero.");
  }

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

  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.companyId) {
      await sql`
        UPDATE companies
        SET
          xero_tenant_id  = ${tenant.tenantId},
          xero_token_data = ${serializeTokenData(tokens)}::jsonb,
          updated_at      = NOW()
        WHERE id = ${session.user.companyId}
      `;
    } else {
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

  // Honour returnTo cookie if set (e.g. from onboarding wizard)
  const returnTo = request.cookies.get("xero_return_url")?.value;
  const redirectBase = returnTo && returnTo.startsWith("/")
    ? `${APP_URL}${returnTo}`
    : `${APP_URL}/dashboard`;

  const redirectUrl = new URL(redirectBase);
  redirectUrl.searchParams.set("xero", "connected");
  redirectUrl.searchParams.set("org", tenant.tenantName);

  const response = NextResponse.redirect(redirectUrl.toString());

  response.cookies.set("xero_oauth_state", "", { httpOnly: true, maxAge: 0, path: "/" });
  response.cookies.set("xero_return_url",  "", { httpOnly: true, maxAge: 0, path: "/" });

  response.cookies.set("xero_tenant_id", tenant.tenantId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 30,
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
