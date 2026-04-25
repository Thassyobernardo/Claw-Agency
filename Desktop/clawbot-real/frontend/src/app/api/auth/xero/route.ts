/**
 * GET /api/auth/xero
 *
 * Step 1 of the Xero OAuth 2.0 flow.
 * Generates a CSRF state token, stores it in a secure cookie, and
 * redirects the user to the Xero authorization page.
 *
 * The redirect URI sent to Xero is auto-derived from:
 *   1. XERO_REDIRECT_URI env var (explicit override) — if set
 *   2. The current request's origin (e.g., https://claw-agency.vercel.app)
 *   3. NEXT_PUBLIC_APP_URL — last-resort fallback
 *
 * Whichever URI is sent MUST be registered in the Xero Developer Portal
 * (https://developer.xero.com/app/manage → Configuration → Redirect URIs).
 *
 * If you see "Error: invalid_request — Invalid redirect_uri" on the Xero
 * login page, the URI sent doesn't match any registered URI in the portal.
 */

import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationUrl, generateState } from "@/lib/xero";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check credentials are configured
  if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error: "xero_not_configured",
        message:
          "Xero credentials are not set. Add XERO_CLIENT_ID and XERO_CLIENT_SECRET to .env.local",
      },
      { status: 503 }
    );
  }

  // Use the request's actual origin so the redirect URI matches the host the
  // user is on (localhost during dev, claw-agency.vercel.app in prod, custom
  // domain if mapped). This avoids "Invalid redirect_uri" errors when the env
  // var was set for a different environment.
  const origin = request.nextUrl.origin;

  // Generate CSRF state and build authorization URL
  const state = generateState();
  const authUrl = buildAuthorizationUrl(state, origin);

  // Store state in a short-lived HttpOnly cookie for verification in the callback
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("xero_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600, // 10 minutes — plenty of time to complete login
    path:     "/",
  });

  return response;
}
