/**
 * GET /api/integrations/xero/diagnose
 *
 * Diagnostic helper for "Invalid redirect_uri" errors.
 * Returns the EXACT redirect URI this app would send to Xero — compare
 * against the URIs registered at https://developer.xero.com/app/manage
 *
 * Safe to leave enabled: only exposes the URI itself, never client_id/secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { getResolvedRedirectUri } from "@/lib/xero";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin     = request.nextUrl.origin;
  const fromOrigin = getResolvedRedirectUri(origin);
  const fromEnv    = process.env.XERO_REDIRECT_URI ?? null;
  const fromAppUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/integrations/xero/callback`
    : null;

  return NextResponse.json({
    redirect_uri_being_sent: fromOrigin,
    sources: {
      env_XERO_REDIRECT_URI:    fromEnv,
      env_NEXT_PUBLIC_APP_URL:  process.env.NEXT_PUBLIC_APP_URL ?? null,
      derived_from_app_url:     fromAppUrl,
      derived_from_request:     `${origin}/api/integrations/xero/callback`,
    },
    has_client_id:     !!process.env.XERO_CLIENT_ID,
    has_client_secret: !!process.env.XERO_CLIENT_SECRET,
    fix_checklist: [
      "1. Copy the value of `redirect_uri_being_sent` above.",
      "2. Open https://developer.xero.com/app/manage and select your app.",
      "3. Under 'Configuration' → 'Redirect URIs', confirm the EXACT same value is listed.",
      "4. If it isn't, click 'Add URI', paste it, save, and try connecting again.",
      "5. For local dev, also register http://localhost:3000/api/integrations/xero/callback",
    ],
  });
}
