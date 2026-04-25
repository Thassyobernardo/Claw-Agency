/**
 * GET /api/auth/myob/callback
 *
 * Step 2 of the MYOB OAuth 2.0 flow.
 *
 * MYOB redirects here with ?code=...&state=...
 * We:
 *  1. Verify the state (CSRF check)
 *  2. Exchange the code for access + refresh tokens
 *  3. Fetch the list of MYOB company files
 *  4. Link the first company file to the authenticated EcoLink company
 *  5. Redirect to dashboard with success flash
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  exchangeCodeForTokens,
  getCompanyFiles,
  type MyobTokenSet,
} from "@/lib/myob";
import { sql } from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // ── MYOB returned an error ─────────────────────────────────────────────────
  if (error) {
    const desc = searchParams.get("error_description") ?? error;
    return redirectWithError(`MYOB authorization failed: ${desc}`);
  }

  if (!code || !state) {
    return redirectWithError("Missing code or state from MYOB.");
  }

  // ── CSRF state check ───────────────────────────────────────────────────────
  const storedState = request.cookies.get("myob_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return redirectWithError("Invalid OAuth state. Please try connecting again.");
  }

  // ── Exchange code for tokens ───────────────────────────────────────────────
  let tokens: MyobTokenSet;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[myob/callback] Token exchange failed:", msg);
    return redirectWithError("Failed to obtain tokens from MYOB.");
  }

  // ── Fetch MYOB company files ───────────────────────────────────────────────
  let files: Awaited<ReturnType<typeof getCompanyFiles>>;
  try {
    files = await getCompanyFiles(tokens.access_token);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[myob/callback] Fetching company files failed:", msg);
    return redirectWithError("Connected to MYOB but could not retrieve your company file.");
  }

  if (files.length === 0) {
    return redirectWithError(
      "No MYOB company files found. Make sure you have at least one company file in your MYOB account."
    );
  }

  // Use the first company file (most users have one)
  const file = files[0];

  // ── Persist in DB ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return redirectWithError("You must be logged in to connect MYOB.");
  }

  try {
    await sql`
      UPDATE companies
      SET
        myob_company_file_id  = ${file.Id},
        myob_company_file_uri = ${file.Uri},
        myob_token_data       = ${JSON.stringify(tokens)}::jsonb,
        updated_at            = NOW()
      WHERE id = ${session.user.companyId}
    `;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[myob/callback] DB update failed:", msg);
    return redirectWithError("Connected to MYOB but failed to save credentials.");
  }

  // ── Success ────────────────────────────────────────────────────────────────
  const response = NextResponse.redirect(
    `${APP_URL}/dashboard?myob=connected&org=${encodeURIComponent(file.Name)}`
  );

  // Clear CSRF cookie
  response.cookies.set("myob_oauth_state", "", { httpOnly: true, maxAge: 0, path: "/" });

  // Store company file ID in cookie for status checks
  response.cookies.set("myob_file_id", file.Id, {
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
  url.searchParams.set("myob", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url.toString());
}
