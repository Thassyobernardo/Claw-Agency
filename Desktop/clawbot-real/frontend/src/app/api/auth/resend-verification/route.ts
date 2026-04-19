/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 *
 * Regenerates the verification token for a user whose email is not yet
 * verified, and re-sends the confirmation link. Always returns 200 so we
 * don't leak whether an address exists (prevents user enumeration).
 *
 * Rate-limited per IP (3 / hour) so attackers can't spam the mailbox.
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
  const rl = await checkRateLimit(`resend-verify:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) return OK;

  let body: { email?: string };
  try { body = await request.json(); } catch { return OK; }

  const normEmail = normaliseEmail(body.email ?? "");
  if (!normEmail) return OK;

  // Only resend for users that exist AND are not yet verified
  const rows = await sql<Array<{ id: string; name: string }>>`
    SELECT id, name
    FROM   users
    WHERE  email = ${normEmail}
      AND  email_verified = false
    LIMIT  1
  `.catch(() => []);

  if (!rows.length) return OK;

  const token = crypto.randomBytes(32).toString("hex");

  await sql`
    UPDATE users
    SET    verify_token = ${token},
           updated_at   = NOW()
    WHERE  id = ${rows[0].id}::uuid
  `.catch(() => null);

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return OK;

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://claw-agency-hunter-production.up.railway.app";
  const link      = `${appUrl}/api/auth/verify-email?token=${token}`;
  const firstName = rows[0].name.split(" ")[0];

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from:    process.env.EMAIL_FROM ?? "EcoLink <noreply@mytradieai.com.au>",
    to:      normEmail,
    subject: "Confirm your EcoLink account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="margin-bottom:24px">
          <span style="font-weight:900;font-size:22px;color:#2D3748">
            Eco<span style="color:#16A34A">Link</span><span style="color:#16A34A">.</span>
          </span>
        </div>
        <h1 style="font-size:22px;font-weight:900;color:#2D3748;margin:0 0 8px">
          Confirm your email, ${firstName}
        </h1>
        <p style="color:#718096;font-size:14px;margin:0 0 24px">
          Click the button below to verify your email and activate your EcoLink account.
          This link expires in 24 hours.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#16A34A;color:#fff;font-weight:700;font-size:14px;
                  padding:14px 28px;border-radius:10px;text-decoration:none">
          Confirm Email Address
        </a>
        <hr style="border:none;border-top:1px solid #E2E8F0;margin:28px 0" />
        <p style="color:#A0AEC0;font-size:11px;margin:0">
          EcoLink Australia · Carbon accounting for Australian SMEs<br/>
          If you didn't request this email, you can safely ignore it.
        </p>
      </div>
    `,
  }).catch((e) => console.error("[resend-verification] email failed:", e));

  return OK;
}
