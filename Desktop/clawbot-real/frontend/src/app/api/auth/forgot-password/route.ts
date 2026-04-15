/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 *
 * Generates a password reset token (expires 1h) and sends a reset link.
 * Always returns 200 to prevent email enumeration.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { sql } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { normaliseEmail } from "@/lib/validators";

const OK = NextResponse.json({ ok: true });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) return OK; // don't reveal rate limiting

  let body: { email?: string };
  try { body = await request.json(); } catch { return OK; }

  const normEmail = normaliseEmail(body.email ?? "");
  if (!normEmail) return OK;

  const rows = await sql<Array<{ id: string; name: string }>>`
    SELECT id, name FROM users
    WHERE  email = ${normEmail}
      AND  email_verified = true
    LIMIT  1
  `.catch(() => []);

  if (!rows.length) return OK; // user not found — silent

  const token   = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await sql`
    UPDATE users
    SET    reset_token      = ${token},
           reset_expires_at = ${expires},
           updated_at       = NOW()
    WHERE  id = ${rows[0].id}::uuid
  `.catch(() => null);

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://claw-agency-hunter-production.up.railway.app";
  const link      = `${appUrl}/reset-password?token=${token}`;
  const firstName = rows[0].name.split(" ")[0];
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from:    "EcoLink <noreply@ecolink.com.au>",
      to:      normEmail,
      subject: "Reset your EcoLink password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="margin-bottom:24px">
            <span style="font-weight:900;font-size:22px;color:#2D3748">
              Eco<span style="color:#16A34A">Link</span><span style="color:#16A34A">.</span>
            </span>
          </div>
          <h1 style="font-size:22px;font-weight:900;color:#2D3748;margin:0 0 8px">
            Reset your password, ${firstName}
          </h1>
          <p style="color:#718096;font-size:14px;margin:0 0 24px">
            We received a request to reset your EcoLink password.
            Click the button below — this link expires in <strong>1 hour</strong>.
          </p>
          <a href="${link}"
             style="display:inline-block;background:#16A34A;color:#fff;font-weight:700;font-size:14px;
                    padding:14px 28px;border-radius:10px;text-decoration:none">
            Reset Password
          </a>
          <p style="color:#718096;font-size:13px;margin-top:20px">
            If you didn't request a password reset, you can safely ignore this email.
            Your password will not change.
          </p>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:28px 0" />
          <p style="color:#A0AEC0;font-size:11px;margin:0">EcoLink Australia</p>
        </div>
      `,
    }).catch((e) => console.error("[forgot-password] email failed:", e));
  }

  return OK;
}
