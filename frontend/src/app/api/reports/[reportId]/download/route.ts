/**
 * GET /api/reports/[reportId]/download
 *
 * Generates a short-lived (5-minute) pre-signed URL for downloading
 * a sealed AASB S2 report PDF from the PRIVATE Supabase Storage bucket.
 *
 * ─── Security Model ───────────────────────────────────────────────────────────
 *   - Bucket `aasb-reports` is PRIVATE (no public URLs).
 *   - This route verifies the session, confirms the report belongs to the
 *     authenticated company, then generates a signed URL via SERVICE_ROLE key.
 *   - The signed URL expires in 300 seconds (5 minutes) — single download.
 *   - No PDF bytes pass through Next.js — only the signed URL is returned.
 *     The client fetches the PDF directly from Supabase Storage.
 *
 * ─── Attack surface eliminated ────────────────────────────────────────────────
 *   - A user cannot construct a URL for another company's report.
 *   - A leaked signed URL expires in 5 minutes.
 *   - No public bucket policy — direct object access returns 403.
 *
 * Response: { signedUrl: string, expiresAt: string (ISO 8601) }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth/next";
import { authOptions }               from "@/lib/auth";
import { sql }                       from "@/lib/db";

// Signed URL TTL — keep short; the browser downloads immediately after click
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

const BUCKET = "aasb-reports";

// ─── Supabase Storage REST client (no SDK dependency) ─────────────────────────

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // SERVICE_ROLE required for signing
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to generate signed URLs.",
    );
  }
  return { url, key };
}

/**
 * Call the Supabase Storage REST API to create a signed URL.
 * Endpoint: POST /storage/v1/object/sign/{bucket}/{path}
 * Docs: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
 */
async function createSignedUrl(
  objectPath: string,
  ttlSeconds: number,
): Promise<string> {
  const { url, key } = getSupabaseConfig();

  const res = await fetch(
    `${url}/storage/v1/object/sign/${BUCKET}/${objectPath}`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: ttlSeconds }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase sign failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL ?? data.signedUrl;
  if (!signed) {
    throw new Error("Supabase did not return a signed URL.");
  }

  // Supabase returns a path — prefix with the storage base URL
  return signed.startsWith("http") ? signed : `${url}${signed}`;
}

// ─── Extract object path from stored file_url ─────────────────────────────────

/**
 * The generate route stores the full public URL in file_url (for legacy compat).
 * We need to extract just the object path for the signing API.
 *
 * Stored URL formats:
 *   https://xxx.supabase.co/storage/v1/object/public/aasb-reports/{companyId}/{file}
 *   https://xxx.supabase.co/storage/v1/object/aasb-reports/{companyId}/{file}
 *
 * Target: {companyId}/{file}
 */
function extractObjectPath(fileUrl: string): string {
  // Match everything after the bucket name in the URL
  const match = fileUrl.match(/aasb-reports\/(.+)$/);
  if (!match?.[1]) {
    throw new Error(`Cannot extract object path from file_url: ${fileUrl}`);
  }
  return match[1];
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = session.user.companyId;
  const { reportId } = await params;

  if (!reportId || !/^[0-9a-f-]{36}$/i.test(reportId)) {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }

  // ── 2. Verify report ownership + fetch file path ───────────────────────────
  const rows = await sql<{ file_url: string | null; status: string }[]>`
    SELECT file_url, status
    FROM   aasb_reports
    WHERE  id         = ${reportId}::uuid
      AND  company_id = ${companyId}::uuid
    LIMIT  1
  `;

  if (rows.length === 0) {
    // Return 404 regardless of whether the report exists or belongs to another company
    // — prevents report ID enumeration attacks
    return NextResponse.json(
      { error: "Report not found" },
      { status: 404 },
    );
  }

  const report = rows[0]!;

  if (report.status !== "sealed") {
    return NextResponse.json(
      { error: "Report is not sealed yet. PDF is only available for sealed reports." },
      { status: 409 },
    );
  }

  if (!report.file_url) {
    return NextResponse.json(
      { error: "Report PDF not found in storage. Contact support." },
      { status: 500 },
    );
  }

  // ── 3. Extract object path + generate signed URL ───────────────────────────
  let signedUrl: string;
  try {
    const objectPath = extractObjectPath(report.file_url);
    signedUrl        = await createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
  } catch (err) {
    console.error("[download] Signed URL generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate download link. Please try again." },
      { status: 500 },
    );
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  return NextResponse.json({
    signedUrl,
    expiresAt,
    ttlSeconds: SIGNED_URL_TTL_SECONDS,
  });
}
