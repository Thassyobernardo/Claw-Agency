/**
 * GET /api/auth/xero/login
 *
 * Initiates the Xero OAuth2 flow — updated to write an httpOnly state cookie
 * (required by the callback at /api/integrations/xero/callback) and redirect
 * to the correct Xero authorization endpoint.
 *
 * The redirect_uri points to the existing, fully-implemented callback at:
 *   /api/integrations/xero/callback
 *
 * Env vars required:
 *   XERO_CLIENT_ID      — from developer.xero.com/myapps
 *   XERO_REDIRECT_URI   — must match exactly what's registered in Xero portal
 *                         e.g. http://localhost:3000/api/integrations/xero/callback
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientId    = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI
    ?? `${request.nextUrl.origin}/api/integrations/xero/callback`;

  if (!clientId) {
    return NextResponse.json(
      {
        error: "XERO_CLIENT_ID is not configured.",
        hint:  "Add XERO_CLIENT_ID and XERO_REDIRECT_URI to .env.local. " +
               "Register at https://developer.xero.com/myapps — use Demo Company (AU) for testing.",
      },
      { status: 503 },
    );
  }

  // Opaque CSRF state — the callback at /api/integrations/xero/callback
  // reads the `xero_oauth_state` cookie to verify this value.
  const state = crypto.randomUUID();

  // returnTo: where to redirect AFTER the callback succeeds
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/dashboard/xero-sync";

  // Build Xero authorization URL
  const authUrl = new URL("https://login.xero.com/identity/connect/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id",     clientId);
  authUrl.searchParams.set("redirect_uri",  redirectUri);
  authUrl.searchParams.set("scope", [
    "openid",
    "profile",
    "email",
    "accounting.transactions.read",
    "accounting.contacts.read",
    "offline_access",
  ].join(" "));
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());

  // Write state cookie — callback reads and validates this (CSRF protection)
  response.cookies.set("xero_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   10 * 60, // 10 minutes — time to complete OAuth
    path:     "/",
  });

  // Write returnTo cookie so the callback can redirect back correctly
  response.cookies.set("xero_return_url", returnTo, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   10 * 60,
    path:     "/",
  });

  return response;
}
