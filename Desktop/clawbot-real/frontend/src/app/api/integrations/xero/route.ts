/**
 * GET /api/integrations/xero
 *
 * Step 1 of the Xero OAuth 2.0 flow.
 *
 * NOTE: This route lives outside /api/auth/* so the NextAuth catch-all
 * ([...nextauth]) does not intercept it. NextAuth handles its own routes
 * under /api/auth/* and was returning "This action with HTTP GET is not
 * supported by NextAuth.js" for our custom Xero endpoints.
 *
 * Generates a CSRF state token, stores it in a secure cookie, and
 * redirects the user to the Xero authorization page.
 */

import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationUrl, generateState } from "@/lib/xero";

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const origin = request.nextUrl.origin;
  const state = generateState();
  const authUrl = buildAuthorizationUrl(state, origin);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("xero_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600,
    path:     "/",
  });

  return response;
}
