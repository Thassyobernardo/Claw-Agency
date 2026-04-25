/**
 * GET /api/auth/verify-email?token=...
 *
 * Verifies a user's email address using the token sent during registration.
 * On success, sets email_verified = true and redirects to /login?verified=1
 * On failure, redirects to /login?error=invalid_token
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", request.url),
    );
  }

  const rows = await sql<Array<{ id: string; expired: boolean }>>`
    SELECT id,
           (verify_expires_at IS NOT NULL AND verify_expires_at < NOW()) AS expired
    FROM   users
    WHERE  verify_token = ${token}
      AND  email_verified = false
    LIMIT  1
  `.catch(() => []);

  if (!rows.length) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", request.url),
    );
  }

  if (rows[0].expired) {
    // Token existe mas expirou — limpa pra evitar reuso e manda usuário pedir reenvio
    await sql`
      UPDATE users
      SET    verify_token = null,
             verify_expires_at = null,
             updated_at = NOW()
      WHERE  id = ${rows[0].id}::uuid
    `;
    return NextResponse.redirect(
      new URL("/login?error=token_expired", request.url),
    );
  }

  await sql`
    UPDATE users
    SET    email_verified    = true,
           verify_token      = null,
           verify_expires_at = null,
           updated_at        = NOW()
    WHERE  id = ${rows[0].id}::uuid
  `;

  return NextResponse.redirect(
    new URL("/login?verified=1", request.url),
  );
}
