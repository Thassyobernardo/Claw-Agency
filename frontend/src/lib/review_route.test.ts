/**
 * EcoLink Australia — Review Route Integration Tests
 *
 * Simulates the POST /api/transactions/review handler using injected
 * fake DB and session — zero network, zero Supabase, zero OpenAI.
 *
 * STRATEGY: Extract the core business logic from the Next.js route handler
 * into a testable pure function `resolveManualEntry()`, then test it directly.
 * This avoids the complexity of mocking the Next.js Request/Response objects.
 */

import { describe, it, expect } from "vitest";
import {
  calculateFuelEmissions,
  calculateElectricityEmissions,
  requirePhysicalQuantity,
  isCalculatorError,
  type PhysicalUnit,
} from "./calculator";
import type { ManualEntryPayload } from "../types/manual_entry";

// ═════════════════════════════════════════════════════════════════════════════
// BUSINESS LOGIC — extracted from route.ts for testability
// ═════════════════════════════════════════════════════════════════════════════

const VALID_UNITS = new Set(["L", "kWh", "GJ", "m3", "tonne", "kg", "passenger_km", "vehicle_km", "tonne_km"]);

interface EmissionFactorRow {
  scope: number;
  co2e_factor: number;
  scope3_co2e_factor: number | null;
  energy_content_gj_per_unit: number | null;
  activity: string;
  source_table: string | null;
}

interface ResolveInput {
  payload: ManualEntryPayload;
  txScope: number;
  txState: string | null;
  txCategoryCode: string;
  factor: EmissionFactorRow;
  ngaYear?: number;
}

interface ResolveResult {
  httpStatus: 200 | 400 | 422;
  body: Record<string, unknown>;
}

/**
 * Core resolution logic — mirrors route.ts but without Next.js I/O.
 * Injected with DB row data instead of actual DB queries.
 */
function resolveManualEntry(input: ResolveInput): ResolveResult {
  const { payload, txScope, txState, factor, ngaYear = 2025 } = input;

  // ── Validation: AUD unit ──────────────────────────────────────────────────
  if (
    !VALID_UNITS.has(payload.unit) ||
    (payload.unit as string).toUpperCase() === "AUD"
  ) {
    return {
      httpStatus: 400,
      body: {
        error: "AUD_UNIT_REJECTED",
        message: "AUD is not a physical unit. NGA Factors 2025 Method 1 requires physical quantities only.",
      },
    };
  }

  // ── Validation: negative quantity ─────────────────────────────────────────
  if (!payload.physicalQuantity || payload.physicalQuantity <= 0) {
    return {
      httpStatus: 400,
      body: { error: "INVALID_QUANTITY", message: "physicalQuantity must be a positive number." },
    };
  }

  // ── requirePhysicalQuantity guard ────────────────────────────────────────
  const guard = requirePhysicalQuantity(
    payload.physicalQuantity,
    payload.unit as PhysicalUnit,
    `Transaction ${payload.transactionId}`,
  );
  if (guard) {
    return { httpStatus: 400, body: { error: guard.errorCode, message: guard.reason } };
  }

  // ── Calculator invocation ─────────────────────────────────────────────────
  let scope1Tonnes = 0;
  let scope2Tonnes = 0;
  let scope3Tonnes = 0;
  let totalTonnes  = 0;
  let auditTrail   = "";

  if (txScope === 2) {
    const result = calculateElectricityEmissions(
      payload.physicalQuantity,
      factor.co2e_factor,
      txState ?? "Unknown",
      ngaYear,
    );
    if (isCalculatorError(result)) {
      return { httpStatus: 400, body: { error: result.errorCode, message: result.reason } };
    }
    scope2Tonnes = result.scope2Tonnes;
    totalTonnes  = result.scope2Tonnes;
    auditTrail   = result.auditTrail;
  } else {
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
      return { httpStatus: 400, body: { error: result.errorCode, message: result.reason } };
    }
    scope1Tonnes = result.scope1Tonnes;
    scope3Tonnes = result.scope3Tonnes;
    totalTonnes  = result.totalTonnes;
    auditTrail   = result.auditTrail;
  }

  return {
    httpStatus: 200,
    body: {
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
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// FIXTURES
// ═════════════════════════════════════════════════════════════════════════════

const AMPOL_TX_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const USER_ID     = "u1000000-0000-0000-0000-000000000001";

/** NGA 2025 Table 3 — Petrol, Scope 1, energy content 34.2 GJ/kL */
const PETROL_FACTOR: EmissionFactorRow = {
  scope:                      1,
  co2e_factor:                70.2,   // kg CO2e/GJ (CO2+CH4+N2O combined, NGA 2025 Table 3)
  scope3_co2e_factor:         9.2,    // kg CO2e/GJ (upstream)
  energy_content_gj_per_unit: 34.2,   // GJ/kL (NGA 2025 Appendix A)
  activity:                   "Petrol — Passenger Vehicles",
  source_table:               "Table 3",
};

/** NGA 2025 Table 5 — Electricity NSW, Scope 2 */
const ELEC_NSW_FACTOR: EmissionFactorRow = {
  scope:                      2,
  co2e_factor:                0.66,   // kg CO2e/kWh (NGA 2025 Table 5, NSW)
  scope3_co2e_factor:         null,
  energy_content_gj_per_unit: null,
  activity:                   "Electricity — NSW Grid",
  source_table:               "Table 5",
};

function makePayload(overrides: Partial<ManualEntryPayload> = {}): ManualEntryPayload {
  return {
    transactionId:   AMPOL_TX_ID,
    physicalQuantity: 50,
    unit:            "L",
    userOverrideId:  USER_ID,
    evidenceType:    "invoice_receipt",
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1 — Ampol 50 L Petrol (main scenario)
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /review — Ampol 50 L petrol (Scope 1)", () => {
  /**
   * Math proof for 50 L petrol:
   *   kL       = 50 ÷ 1000           = 0.0500 kL
   *   GJ       = 0.0500 × 34.2       = 1.7100 GJ
   *   Sc1 kg   = 1.7100 × 70.2       = 120.042 kg → 0.1200 tCO2e
   *   Sc3 kg   = 1.7100 × 9.2        = 15.732 kg  → 0.0157 tCO2e
   *   Total    = 0.1200 + 0.0157     = 0.1357 tCO2e
   */
  const result = resolveManualEntry({
    payload:         makePayload({ physicalQuantity: 50, unit: "L" }),
    txScope:         1,
    txState:         null,
    txCategoryCode:  "fuel_petrol",
    factor:          PETROL_FACTOR,
  });

  it("returns HTTP 200", () => {
    expect(result.httpStatus).toBe(200);
  });

  it("status is 'classified'", () => {
    expect(result.body.status).toBe("classified");
  });

  it("mathEngineVersion is 'calculator_v1'", () => {
    expect(result.body.mathEngineVersion).toBe("calculator_v1");
  });

  it("scope1Tonnes = 0.1200 tCO2e (50 L × 34.2 GJ/kL × 70.2 kg/GJ ÷ 1000)", () => {
    expect(result.body.scope1Tonnes).toBe(0.12);
  });

  it("scope3Tonnes = 0.0157 tCO2e (upstream)", () => {
    expect(result.body.scope3Tonnes).toBe(0.0157);
  });

  it("co2eTonnes = 0.1357 tCO2e (scope1 + scope3)", () => {
    expect(result.body.co2eTonnes).toBe(0.1357);
  });

  it("auditTrail references NGA 2025, calculator_v1 and LLM role", () => {
    const trail = result.body.auditTrail as string;
    expect(trail).toContain("calculator_v1");
    expect(trail).toContain("NGA 2025");
    expect(trail).toContain("Petrol — Passenger Vehicles");
    expect(trail).toContain("OCR extraction only");
  });

  it("auditTrail contains all 5 arithmetic steps", () => {
    const trail = result.body.auditTrail as string;
    expect(trail).toContain("norm");
    expect(trail).toContain("GJ");
    expect(trail).toContain("Sc 1");
    expect(trail).toContain("Sc 3");
    expect(trail).toContain("total");
  });

  it("transactionId echoed in response", () => {
    expect(result.body.transactionId).toBe(AMPOL_TX_ID);
  });

  it("evidenceType echoed in response", () => {
    expect(result.body.evidenceType).toBe("invoice_receipt");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2 — AUD / negative protection (AASB S2 Guard)
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /review — AASB S2 Guard: AUD and negative values → 400", () => {
  it("AUD unit → 400 AUD_UNIT_REJECTED", () => {
    const r = resolveManualEntry({
      payload:         makePayload({ unit: "AUD" as never, physicalQuantity: 450 }),
      txScope:         1, txState: null, txCategoryCode: "fuel_petrol",
      factor:          PETROL_FACTOR,
    });
    expect(r.httpStatus).toBe(400);
    expect(r.body.error).toBe("AUD_UNIT_REJECTED");
  });

  it("negative quantity → 400 INVALID_QUANTITY", () => {
    const r = resolveManualEntry({
      payload:         makePayload({ physicalQuantity: -50 }),
      txScope:         1, txState: null, txCategoryCode: "fuel_petrol",
      factor:          PETROL_FACTOR,
    });
    expect(r.httpStatus).toBe(400);
    expect(r.body.error).toBe("INVALID_QUANTITY");
  });

  it("zero quantity → 400 INVALID_QUANTITY", () => {
    const r = resolveManualEntry({
      payload:         makePayload({ physicalQuantity: 0 }),
      txScope:         1, txState: null, txCategoryCode: "fuel_petrol",
      factor:          PETROL_FACTOR,
    });
    expect(r.httpStatus).toBe(400);
  });

  it("400 response does NOT contain co2eTonnes (no calculation attempted)", () => {
    const r = resolveManualEntry({
      payload:         makePayload({ unit: "AUD" as never }),
      txScope:         1, txState: null, txCategoryCode: "fuel_petrol",
      factor:          PETROL_FACTOR,
    });
    expect(r.body.co2eTonnes).toBeUndefined();
    expect(r.body.auditTrail).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3 — Electricity (Scope 2, NSW)
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /review — Electricity 1000 kWh NSW (Scope 2)", () => {
  /**
   * Math proof:
   *   1000 kWh × 0.66 kg CO2e/kWh = 660 kg = 0.6600 tCO2e
   */
  const result = resolveManualEntry({
    payload:         makePayload({ physicalQuantity: 1000, unit: "kWh" }),
    txScope:         2,
    txState:         "NSW",
    txCategoryCode:  "electricity",
    factor:          ELEC_NSW_FACTOR,
  });

  it("returns HTTP 200", () => {
    expect(result.httpStatus).toBe(200);
  });

  it("scope2Tonnes = 0.6600 tCO2e (1000 kWh × 0.66 kg CO2e/kWh)", () => {
    expect(result.body.scope2Tonnes).toBe(0.66);
  });

  it("co2eTonnes = 0.6600 tCO2e (electricity has no scope3 in NGA)", () => {
    expect(result.body.co2eTonnes).toBe(0.66);
  });

  it("scope1Tonnes = 0 (electricity is Scope 2 only)", () => {
    expect(result.body.scope1Tonnes).toBe(0);
  });

  it("auditTrail mentions NSW Grid and NGA Table 5", () => {
    const trail = result.body.auditTrail as string;
    expect(trail).toContain("NSW Grid");
    expect(trail).toContain("Table 5");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4 — estimate evidenceType flagging
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /review — estimate evidence type", () => {
  it("estimate evidenceType still returns 200 (estimate is allowed, must be flagged by caller)", () => {
    const r = resolveManualEntry({
      payload:         makePayload({ evidenceType: "estimate" }),
      txScope:         1, txState: null, txCategoryCode: "fuel_petrol",
      factor:          PETROL_FACTOR,
    });
    expect(r.httpStatus).toBe(200);
    expect(r.body.evidenceType).toBe("estimate");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5 — GJ natural gas path
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /review — Natural Gas 100 GJ (Scope 1 direct)", () => {
  const GAS_FACTOR: EmissionFactorRow = {
    scope:                      1,
    co2e_factor:                51.53,
    scope3_co2e_factor:         13.10,
    energy_content_gj_per_unit: null,   // GJ input — no conversion needed
    activity:                   "Natural Gas — Commercial & Industrial",
    source_table:               "Table 1",
  };

  const result = resolveManualEntry({
    payload:         makePayload({ physicalQuantity: 100, unit: "GJ" }),
    txScope:         1,
    txState:         null,
    txCategoryCode:  "natural_gas",
    factor:          GAS_FACTOR,
  });

  it("returns HTTP 200", () => {
    expect(result.httpStatus).toBe(200);
  });

  it("scope1Tonnes = 5.153 tCO2e (100 GJ × 51.53 kg/GJ)", () => {
    expect(result.body.scope1Tonnes).toBe(5.153);
  });

  it("scope3Tonnes = 1.310 tCO2e (100 GJ × 13.10 kg/GJ)", () => {
    expect(result.body.scope3Tonnes).toBe(1.31);
  });

  it("co2eTonnes = 6.463 tCO2e (Sc1 + Sc3, matches NGA 2025 Example 4 at scale)", () => {
    expect(result.body.co2eTonnes).toBe(6.463);
  });
});
