/**
 * GET /api/auth/xero/diagnose
 *
 * Diagnostic helper for "Invalid redirect_uri" errors.
 *
 * Returns the EXACT redirect URI that this app would send to Xero from the
 * current host, plus a checklist of what to verify. Compare the returned
 * `redirect_uri` against the Redirect URIs registered in your Xero Developer
 * Portal app at https://developer.xero.com/app/manage
 *
 * This route is safe to leave enabled — it only exposes the redirect URI
 * itself, never the client_id, secret, or tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { getResolvedRedirectUri } from "@/lib/xero";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin       = request.nextUrl.origin;
  const fromOrigin   = getResolvedRedirectUri(origin);
  const fromEnv      = process.env.XERO_REDIRECT_URI ?? null;
  const fromAppUrl   = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/auth/xero/callback`
    : null;

  return NextResponse.json({
    redirect_uri_being_sent: fromOrigin,
    sources: {
      env_XERO_REDIRECT_URI:    fromEnv,
      env_NEXT_PUBLIC_APP_URL:  process.env.NEXT_PUBLIC_APP_URL ?? null,
      derived_from_app_url:     fromAppUrl,
      derived_from_request:     `${origin}/api/auth/xero/callback`,
    },
    has_client_id:     !!process.env.XERO_CLIENT_ID,
    has_client_secret: !!process.env.XERO_CLIENT_SECRET,
    fix_checklist: [
      "1. Copy the value of `redirect_uri_being_sent` above.",
      "2. Open https://developer.xero.com/app/manage and select your app.",
      "3. Under 'Configuration' → 'Redirect URIs', confirm the EXACT same value is listed (no trailing slash, no http vs https mismatch).",
      "4. If it isn't, click 'Add URI', paste it, save, and try connecting again.",
      "5. For local dev, also register http://localhost:3000/api/auth/xero/callback",
    ],
  });
}
