/**
 * POST /api/auth/register
 *
 * Creates a new company + owner user in a single transaction.
 *
 * Body: {
 *   email:        string   (required)
 *   password:     string   (required, min 8 chars)
 *   name:         string   (required — user's full name)
 *   company_name: string   (required)
 *   abn?:         string   (optional, 11 digits)
 *   industry?:    string   (ANZSIC division letter, e.g. "E")
 *   state?:       string   (NSW | VIC | QLD | WA | SA | TAS | ACT | NT)
 * }
 *
 * Security:
 *   - bcryptjs hashing (12 rounds)
 *   - Rate limiting: 3 registrations per IP per hour
 *   - Email normalisation + uniqueness enforced at DB level
 *   - ABN format validation (11 digits, no spaces)
 *   - No sensitive data returned
 *
 * Response 201: { userId, companyId }
 * Response 400: { error, field? }
 * Response 409: { error: "email_taken" }
 * Response 429: { error: "rate_limited" }
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { normaliseEmail } from "@/lib/validators";

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

const AU_STATES = ["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Rate limit: 3 registrations per IP per hour ───────────────────────
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`register:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: {
    email?: string;
    password?: string;
    name?: string;
    company_name?: string;
    abn?: string;
    industry?: string;
    state?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { email, password, name, company_name, abn, industry, state } = body;

  // ── Validate required fields ──────────────────────────────────────────
  if (!email?.trim()) {
    return NextResponse.json({ error: "email_required", field: "email" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "password_too_short", field: "password" }, { status: 400 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: "name_required", field: "name" }, { status: 400 });
  }
  if (!company_name?.trim()) {
    return NextResponse.json({ error: "company_name_required", field: "company_name" }, { status: 400 });
  }

  // ── Validate optional fields ──────────────────────────────────────────
  const normEmail = normaliseEmail(email);
  if (!normEmail || !normEmail.includes("@")) {
    return NextResponse.json({ error: "invalid_email", field: "email" }, { status: 400 });
  }

  const cleanAbn = abn?.replace(/\s+/g, "") ?? null;
  if (cleanAbn && !/^\d{11}$/.test(cleanAbn)) {
    return NextResponse.json({ error: "invalid_abn", field: "abn" }, { status: 400 });
  }

  const cleanIndustry = industry?.toUpperCase() ?? null;
  if (cleanIndustry && !ANZSIC_LABELS[cleanIndustry]) {
    return NextResponse.json({ error: "invalid_industry", field: "industry" }, { status: 400 });
  }

  const cleanState = state?.toUpperCase() ?? null;
  if (cleanState && !AU_STATES.includes(cleanState)) {
    return NextResponse.json({ error: "invalid_state", field: "state" }, { status: 400 });
  }

  // ── Hash password ─────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, 12);

  // ── Insert company + user in a transaction ────────────────────────────
  try {
    const result = await sql.begin(async (tx) => {
      // Create company
      const [company] = await tx<Array<{ id: string }>>`
        INSERT INTO companies (
          name,
          abn,
          industry_anzsic_code,
          industry_description,
          state,
          plan
        ) VALUES (
          ${company_name.trim()},
          ${cleanAbn},
          ${cleanIndustry},
          ${cleanIndustry ? ANZSIC_LABELS[cleanIndustry] : null},
          ${cleanState},
          'starter'
        )
        RETURNING id::text
      `;

      // Create owner user
      const [user] = await tx<Array<{ id: string }>>`
        INSERT INTO users (
          company_id,
          email,
          name,
          password_hash,
          role
        ) VALUES (
          ${company.id}::uuid,
          ${normEmail},
          ${name.trim()},
          ${passwordHash},
          'owner'
        )
        RETURNING id::text
      `;

      return { userId: user.id, companyId: company.id };
    });

    return NextResponse.json(result, { status: 201 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // Unique constraint → email already taken
    if (msg.includes("users_email_key") || msg.includes("unique") && msg.includes("email")) {
      return NextResponse.json({ error: "email_taken", field: "email" }, { status: 409 });
    }

    console.error("[register] DB error:", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
