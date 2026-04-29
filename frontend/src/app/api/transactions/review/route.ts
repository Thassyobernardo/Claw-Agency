/**
 * POST /api/transactions/review
 *
 * Resolves a pending (needs_review) transaction using a manually entered
 * physical quantity. Invokes calculator.ts and persists the result.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AASB S2 COMPLIANCE CONTRACT:
 *
 *   1. AUD / negative quantities → 400 Bad Request (no calculation).
 *   2. Emission factors are fetched from emission_factors (NGA 2025).
 *      NEVER hardcoded in this file.
 *   3. Calculation delegated entirely to calculator.ts — zero arithmetic here.
 *   4. Every resolved transaction writes an immutable audit trail string
 *      from calculator.ts into `transactions.classification_notes`.
 *   5. A separate row in `transaction_audit_log` records who resolved it
 *      and what evidence type was declared.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { z } from "zod";
import {
  calculateFuelEmissions,
  calculateElectricityEmissions,
  requirePhysicalQuantity,
  isCalculatorError,
  type PhysicalUnit,
} from "@/lib/calculator";

// ─── Input schema (validated against ManualEntryPayload) ──────────────────────

const VALID_UNITS = ["L", "kWh", "GJ", "m3", "tonne", "kg", "passenger_km", "vehicle_km", "tonne_km"] as const;
const VALID_EVIDENCE = ["invoice_receipt", "direct_entry", "estimate"] as const;

/** AUD is explicitly excluded from valid units — spend-based is prohibited. */
const ManualEntrySchema = z.object({
  transactionId:   z.string().uuid({ message: "transactionId must be a valid UUID" }),
  physicalQuantity: z
    .number()
    .positive({ message: "physicalQuantity must be a positive number — AUD or negative values are rejected" }),
  unit:            z.enum(VALID_UNITS, {
    errorMap: () => ({ message: `unit must be one of: ${VALID_UNITS.join(", ")}. AUD is not a physical unit.` }),
  }),
  userOverrideId:  z.string().min(1),
  evidenceType:    z.enum(VALID_EVIDENCE),
  note:            z.string().max(2000).optional(),
  evidenceDocumentUrl: z.string().url().optional(),
});

type ValidatedPayload = z.infer<typeof ManualEntrySchema>;

// ─── Emission factor row from DB ──────────────────────────────────────────────

interface EmissionFactorRow {
  scope:                     number;
  co2e_factor:               number;   // kg CO2e / unit (Scope 1 for fuel, or Scope 2 for elec)
  scope3_co2e_factor:        number | null;
  energy_content_gj_per_unit:number | null;
  activity:                  string;
  unit:                      string;
  source_table:              string | null;
  math_engine_version:       string;
  state_specific:            boolean;
}

interface TransactionRow {
  id:           string;
  company_id:   string;
  category_code:string | null;
  scope:        number | null;
  classification_status: string;
  description:  string | null;
  state:        string | null;  // for Scope 2 electricity
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Authentication ───────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = session.user.companyId as string;

  // ── 2. Parse + validate body ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ManualEntrySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
        aasb_s2_note: "AUD is not a valid physical unit. NGA Factors 2025 requires Method 1 physical quantities.",
      },
      { status: 400 },
    );
  }

  const payload: ValidatedPayload = parsed.data;

  // ── 3. AASB S2 Guard: reject AUD even if it somehow passed the enum ─────────
  // (Defence-in-depth — the enum already blocks it, this is a belt-and-suspenders check)
  if (
    (payload.unit as string).toUpperCase() === "AUD" ||
    (payload.unit as string) === "$"
  ) {
    return NextResponse.json(
      {
        error: "AUD_UNIT_REJECTED",
        message: "AUD is not a physical unit. NGA Factors 2025 Method 1 requires physical quantities only.",
      },
      { status: 400 },
    );
  }

  // ── 4. requirePhysicalQuantity guard (redundant but explicit) ───────────────
  const guard = requirePhysicalQuantity(
    payload.physicalQuantity,
    payload.unit as PhysicalUnit,
    `Manual entry for transaction ${payload.transactionId}`,
  );
  if (guard) {
    return NextResponse.json({ error: guard.errorCode, message: guard.reason }, { status: 400 });
  }

  // ── 5. Fetch transaction from DB ────────────────────────────────────────────
  const txRows = await sql<TransactionRow[]>`
    SELECT
      t.id::text,
      t.company_id::text,
      ec.code AS category_code,
      t.scope,
      t.classification_status,
      t.description,
      comp.state
    FROM transactions t
    LEFT JOIN emission_categories ec ON ec.id = t.category_id
    LEFT JOIN companies comp ON comp.id = t.company_id
    WHERE t.id = ${payload.transactionId}::uuid
      AND t.company_id = ${companyId}::uuid
    LIMIT 1
  `;

  if (txRows.length === 0) {
    return NextResponse.json(
      { error: "Transaction not found or access denied" },
      { status: 404 },
    );
  }

  const tx = txRows[0]!;

  if (tx.classification_status === "classified") {
    return NextResponse.json(
      { error: "ALREADY_CLASSIFIED", message: "Transaction is already classified. Create a correction instead." },
      { status: 409 },
    );
  }

  // ── 6. Fetch NGA 2025 emission factors from DB ──────────────────────────────
  // Factors are fetched by category code and company's NGA edition year.
  // NEVER hardcoded in this file.
  const factorRows = await sql<EmissionFactorRow[]>`
    SELECT
      ef.scope,
      ef.co2e_factor,
      ef.scope3_co2e_factor,
      ef.energy_content_gj_per_unit,
      ef.activity,
      ef.unit,
      ef.source_table,
      ef.math_engine_version,
      ef.state_specific
    FROM emission_factors ef
    JOIN companies c ON c.id = ${companyId}::uuid
    WHERE ef.is_current   = TRUE
      AND ef.nga_year     = c.nga_edition_year
      AND ef.category     = (
            SELECT name FROM emission_categories
             WHERE code = ${tx.category_code ?? ""}
             LIMIT 1
          )
      AND (
            ef.state_specific = FALSE
            OR ef.state = ${tx.state ?? ""}
          )
    ORDER BY ef.state_specific DESC   -- prefer state-specific if available
    LIMIT 1
  `;

  if (factorRows.length === 0) {
    return NextResponse.json(
      {
        error: "EMISSION_FACTOR_NOT_FOUND",
        message: `No NGA 2025 emission factor found for category "${tx.category_code}". ` +
                 "Run migration 017 and fill all NULL placeholders before resolving transactions.",
      },
      { status: 422 },
    );
  }

  const factor = factorRows[0]!;

  // ── 7. Invoke calculator.ts ──────────────────────────────────────────────────
  let scope1Tonnes = 0;
  let scope2Tonnes = 0;
  let scope3Tonnes = 0;
  let totalTonnes  = 0;
  let auditTrail   = "";

  const ngaYear = 2025; // sourced from migration 017; will be dynamic from company in future

  if (tx.scope === 2) {
    // Electricity (Scope 2) — uses calculateElectricityEmissions
    const result = calculateElectricityEmissions(
      payload.physicalQuantity,
      factor.co2e_factor,
      tx.state ?? "Unknown",
      ngaYear,
    );

    if (isCalculatorError(result)) {
      return NextResponse.json(
        { error: result.errorCode, message: result.reason },
        { status: 400 },
      );
    }

    scope2Tonnes = result.scope2Tonnes;
    totalTonnes  = result.scope2Tonnes;
    auditTrail   = result.auditTrail;

  } else {
    // Fuel / Gas / Refrigerant (Scope 1 / 3) — uses calculateFuelEmissions
    const result = calculateFuelEmissions(
      payload.physicalQuantity,
      payload.unit as PhysicalUnit,
      factor.energy_content_gj_per_unit,
      factor.co2e_factor,
      factor.scope3_co2e_factor ?? 0,
      factor.activity,
      ngaYear,
    );

    if (isCalculatorError(result)) {
      return NextResponse.json(
        { error: result.errorCode, message: result.reason },
        { status: 400 },
      );
    }

    scope1Tonnes = result.scope1Tonnes;
    scope3Tonnes = result.scope3Tonnes;
    totalTonnes  = result.totalTonnes;
    auditTrail   = result.auditTrail;
  }

  // ── 8. Persist to DB inside a transaction ────────────────────────────────────
  await sql.begin(async (db) => {
    // 8a. Update the transaction row
    await db`
      UPDATE transactions SET
        classification_status  = 'classified',
        classified_at          = NOW(),
        quantity_value         = ${payload.physicalQuantity},
        quantity_unit          = ${payload.unit},
        scope1_co2e_kg         = ${scope1Tonnes * 1000},
        scope2_co2e_kg         = ${scope2Tonnes * 1000},
        scope3_co2e_kg         = ${scope3Tonnes * 1000},
        co2e_kg                = ${totalTonnes  * 1000},
        math_engine_version    = ${"calculator_v1"},
        classification_notes   = ${auditTrail},
        updated_at             = NOW()
      WHERE id = ${payload.transactionId}::uuid
        AND company_id = ${companyId}::uuid
    `;

    // 8b. Write immutable audit log entry
    // This log cannot be updated — it is INSERT-only.
    await db`
      INSERT INTO transaction_audit_log (
        transaction_id,
        event_type,
        user_id,
        payload,
        created_at
      ) VALUES (
        ${payload.transactionId}::uuid,
        'manual_review_resolved',
        ${payload.userOverrideId}::uuid,
        ${JSON.stringify({
          physicalQuantity:    payload.physicalQuantity,
          unit:                payload.unit,
          evidenceType:        payload.evidenceType,
          evidenceDocumentUrl: payload.evidenceDocumentUrl ?? null,
          note:                payload.note ?? null,
          totalTonnes,
          scope1Tonnes,
          scope2Tonnes,
          scope3Tonnes,
          mathEngineVersion:   "calculator_v1",
          ngaYear,
          factorSource:        factor.source_table ?? "emission_factors",
          resolvedAt:          new Date().toISOString(),
        })}::jsonb,
        NOW()
      )
    `;
  });

  // ── 9. Return result ─────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      transactionId:     payload.transactionId,
      status:            "classified",
      co2eTonnes:        totalTonnes,
      scope1Tonnes,
      scope2Tonnes,
      scope3Tonnes,
      mathEngineVersion: "calculator_v1",
      evidenceType:      payload.evidenceType,
      ngaYear,
      auditTrail,
    },
    { status: 200 },
  );
}
