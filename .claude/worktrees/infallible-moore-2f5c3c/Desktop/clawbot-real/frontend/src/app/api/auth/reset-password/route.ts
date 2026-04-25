/**
 * POST /api/auth/reset-password
 * Body: { token: string, password: string }
 *
 * Validates the reset token and updates the user's password.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

function validatePassword(pw: string): string | null {
  if (pw.length < 10)           return "Password must be at least 10 characters";
  if (!/[A-Z]/.test(pw))        return "Must contain an uppercase letter";
  if (!/[a-z]/.test(pw))        return "Must contain a lowercase letter";
  if (!/[0-9]/.test(pw))        return "Must contain a number";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Must contain a special character";
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { token?: string; password?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { token, password } = body;

  if (!token) return NextResponse.json({ error: "token_required" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "password_required" }, { status: 400 });

  const pwError = validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError, field: "password" }, { status: 400 });

  const rows = await sql<Array<{ id: string; reset_expires_at: Date }>>`
    SELECT id, reset_expires_at
    FROM   users
    WHERE  reset_token = ${token}
    LIMIT  1
  `.catch(() => []);

  if (!rows.length) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  if (new Date() > new Date(rows[0].reset_expires_at)) {
    return NextResponse.json({ error: "token_expired" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);

  await sql`
    UPDATE users
    SET    password_hash    = ${hash},
           reset_token      = null,
           reset_expires_at = null,
           updated_at       = NOW()
    WHERE  id = ${rows[0].id}::uuid
  `;

  return NextResponse.json({ ok: true });
}
