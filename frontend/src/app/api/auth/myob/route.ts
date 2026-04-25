/**
 * GET /api/auth/myob
 *
 * Step 1 of the MYOB OAuth 2.0 flow.
 * Generates a CSRF state token, stores it in a secure cookie, and
 * redirects the user to the MYOB authorization page.
 */

import { NextResponse } from "next/server";
import { buildAuthorizationUrl, generateState } from "@/lib/myob";

export async function GET(): Promise<NextResponse> {
  if (!process.env.MYOB_CLIENT_ID || !process.env.MYOB_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:   "myob_not_configured",
        message: "MYOB credentials not set. Add MYOB_CLIENT_ID and MYOB_CLIENT_SECRET to .env.local",
      },
      { status: 503 }
    );
  }

  const state  = generateState();
  const authUrl = buildAuthorizationUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("myob_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600,
    path:     "/",
  });

  return response;
}
