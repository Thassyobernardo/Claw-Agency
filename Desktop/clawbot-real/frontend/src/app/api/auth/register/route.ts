/**
 * POST /api/auth/register
 *
 * Creates a new company + owner user, then sends a verification email.
 * The user cannot log in until they confirm their email address.
 *
 * Body: {
 *   email:        string   (required)
 *   password:     string   (required — strong: min 12, upper, lower, digit, symbol)
 *   name:         string   (required)
 *   company_name: string   (required)
 *   abn:          string   (required, 11 digits)
 *   industry:     string   (required — ANZSIC division letter)
 *   state:        string   (required — NSW | VIC | QLD | WA | SA | TAS | ACT | NT)
 * }
 *
 * Response 201: { userId, companyId }
 * Response 400: { error, field? }
 * Response 409: { error: "email_taken" }
 * Response 429: { error: "rate_limited" }
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import { sql } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { normaliseEmail, isValidAbn } from "@/lib/validators";

const ANZSIC_LABELS: Record<string, string> = {
  A: "Agriculture, Forestry & Fishing",
  B: "Mining",
  C: "Manufacturing",
  D: "Electricity, Gas, Water & Waste",
  E: "Construction",
  F: "Wholesale Trade",
  G: "Retail Trade",
  H: "Accommodation & Food Services",
  I: "Transport, Postal & Warehousing",
  J: "Information Media & Telecoms",
  K: "Financial & Insurance Services",
  L: "Rental, Hiring & Real Estate",
  M: "Professional, Scientific & Technical",
  N: "Administrative & Support Services",
  O: "Public Administration & Safety",
  P: "Education & Training",
  Q: "Health Care & Social Assistance",
  R: "Arts & Recreation Services",
  S: "Other Services",
};

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

/** Strong password: min 10 chars, upper, lower, digit, special char */
function validatePassword(pw: string): string | null {
  if (pw.length < 10)           return "Password must be at least 10 characters";
  if (!/[A-Z]/.test(pw))        return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(pw))        return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(pw))        return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain at least one special character";
  return null;
}

function emailHeader() {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <div style="margin-bottom:24px">
        <span style="font-weight:900;font-size:22px;color:#2D3748">
          Eco<span style="color:#16A34A">Link</span><span style="color:#16A34A">.</span>
        </span>
      </div>
  `;
}

function emailFooter() {
  return `
      <hr style="border:none;border-top:1px solid #E2E8F0;margin:28px 0" />
      <p style="color:#A0AEC0;font-size:11px;margin:0">
        EcoLink Australia · Carbon accounting for Australian SMEs<br/>
        If you didn't request this email, you can safely ignore it.
      </p>
    </div>
  `;
}

async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
  appUrl: string,
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const resend = new Resend(resendKey);
  const link = `${appUrl}/api/auth/verify-email?token=${token}`;
  const firstName = name.split(" ")[0];

  await resend.emails.send({
    from:    process.env.EMAIL_FROM ?? "EcoLink <noreply@mytradieai.com.au>",
    to:      email,
    subject: "Confirm your EcoLink account",
    html: `
      ${emailHeader()}
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
      ${emailFooter()}
    `,
  });
}

async function sendWelcomeEmail(
  email: string,
  name: string,
  companyName: string,
  appUrl: string,
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const resend = new Resend(resendKey);
  const firstName = name.split(" ")[0];

  await resend.emails.send({
    from:    process.env.EMAIL_FROM ?? "EcoLink <noreply@mytradieai.com.au>",
    to:      email,
    subject: `Welcome to EcoLink, ${firstName}!`,
    html: `
      ${emailHeader()}
      <h1 style="font-size:22px;font-weight:900;color:#2D3748;margin:0 0 8px">
        Welcome aboard, ${firstName}! 🌿
      </h1>
      <p style="color:#718096;font-size:14px;margin:0 0 16px">
        <strong style="color:#2D3748">${companyName}</strong> is now registered on EcoLink Australia.
        You're one step closer to automatic Scope 1, 2 &amp; 3 carbon reporting.
      </p>

      <div style="background:#F0FDF4;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="font-size:13px;font-weight:700;color:#16A34A;margin:0 0 12px">
          Here's what you can do next:
        </p>
        <ol style="color:#2D3748;font-size:13px;margin:0;padding-left:20px;line-height:1.8">
          <li>✅ Confirm your email (check the previous email)</li>
          <li>🔗 Connect your Xero or MYOB account</li>
          <li>⚡ Run AI auto-classification on your transactions</li>
          <li>📄 Export your AASB S2 carbon report</li>
        </ol>
      </div>

      <a href="${appUrl}/dashboard"
         style="display:inline-block;background:#16A34A;color:#fff;font-weight:700;font-size:14px;
                padding:14px 28px;border-radius:10px;text-decoration:none">
        Go to Dashboard
      </a>

      <p style="color:#718096;font-size:13px;margin-top:20px">
        Questions? Reply to this email — we're here to help.
      </p>
      ${emailFooter()}
    `,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Rate limit ────────────────────────────────────────────────────────
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`register:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: {
    email?: string; password?: string; name?: string;
    company_name?: string; abn?: string; industry?: string; state?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { email, password, name, company_name, abn, industry, state } = body;

  // ── Required fields ───────────────────────────────────────────────────
  if (!email?.trim())
    return NextResponse.json({ error: "email_required", field: "email" }, { status: 400 });
  if (!password)
    return NextResponse.json({ error: "password_required", field: "password" }, { status: 400 });
  if (!name?.trim())
    return NextResponse.json({ error: "name_required", field: "name" }, { status: 400 });
  if (!company_name?.trim())
    return NextResponse.json({ error: "company_name_required", field: "company_name" }, { status: 400 });
  if (!abn?.trim())
    return NextResponse.json({ error: "abn_required", field: "abn" }, { status: 400 });
  if (!industry?.trim())
    return NextResponse.json({ error: "industry_required", field: "industry" }, { status: 400 });
  if (!state?.trim())
    return NextResponse.json({ error: "state_required", field: "state" }, { status: 400 });

  // ── Validate formats ──────────────────────────────────────────────────
  const normEmail = normaliseEmail(email);
  if (!normEmail || !normEmail.includes("@"))
    return NextResponse.json({ error: "invalid_email", field: "email" }, { status: 400 });

  const pwError = validatePassword(password);
  if (pwError)
    return NextResponse.json({ error: pwError, field: "password" }, { status: 400 });

  const cleanAbn = abn.replace(/[\s-]/g, "");
  if (!/^\d{11}$/.test(cleanAbn))
    return NextResponse.json({ error: "invalid_abn_format", field: "abn" }, { status: 400 });
  if (!isValidAbn(cleanAbn))
    return NextResponse.json({ error: "invalid_abn_checksum", field: "abn" }, { status: 400 });

  const cleanIndustry = industry.toUpperCase();
  if (!ANZSIC_LABELS[cleanIndustry])
    return NextResponse.json({ error: "invalid_industry", field: "industry" }, { status: 400 });

  const cleanState = state.toUpperCase();
  if (!AU_STATES.includes(cleanState))
    return NextResponse.json({ error: "invalid_state", field: "state" }, { status: 400 });

  // ── Hash password + generate verify token ────────────────────────────
  const [passwordHash, verifyToken] = await Promise.all([
    bcrypt.hash(password, 12),
    Promise.resolve(crypto.randomBytes(32).toString("hex")),
  ]);

  // ── Insert company + user ─────────────────────────────────────────────
  try {
    const result = await sql.begin(async (tx) => {
      const [company] = await tx<Array<{ id: string }>>`
        INSERT INTO companies (name, abn, industry_anzsic_code, industry_description, state, plan)
        VALUES (
          ${company_name.trim()},
          ${cleanAbn},
          ${cleanIndustry},
          ${ANZSIC_LABELS[cleanIndustry]},
          ${cleanState},
          'starter'
        )
        RETURNING id::text
      `;

      const [user] = await tx<Array<{ id: string }>>`
        INSERT INTO users (company_id, email, name, password_hash, role, verify_token)
        VALUES (
          ${company.id}::uuid,
          ${normEmail},
          ${name.trim()},
          ${passwordHash},
          'owner',
          ${verifyToken}
        )
        RETURNING id::text
      `;

      return { userId: user.id, companyId: company.id };
    });

    // ── Send emails (non-blocking) ────────────────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://claw-agency-hunter-production.up.railway.app";
    const cleanName = name.trim();
    Promise.all([
      sendVerificationEmail(normEmail, cleanName, verifyToken, appUrl),
      sendWelcomeEmail(normEmail, cleanName, company_name.trim(), appUrl),
    ]).catch((e) => console.error("[register] email send failed:", e));

    return NextResponse.json(result, { status: 201 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("users_email_key") || (msg.includes("unique") && msg.includes("email"))) {
      return NextResponse.json({ error: "email_taken", field: "email" }, { status: 409 });
    }
    console.error("[register] DB error:", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
