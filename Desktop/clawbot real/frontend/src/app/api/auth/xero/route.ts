/**
 * GET /api/auth/xero
 *
 * Step 1 of the Xero OAuth 2.0 flow.
 * Generates a CSRF state token, stores it in a secure cookie, and
 * redirects the user to the Xero authorization page.
 */

import { NextResponse } from "next/server";
import { buildAuthorizationUrl, generateState } from "@/lib/xero";

export async function GET(): Promise<NextResponse> {
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

  // Generate CSRF state and build authorization URL
  const state = generateState();
  const authUrl = buildAuthorizationUrl(state);

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
