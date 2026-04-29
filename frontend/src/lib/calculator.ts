/**
 * EcoLink Australia — Deterministic Emission Calculator
 *
 * AASB S2 COMPLIANCE:
 *   This module is the SOLE authority for CO2e arithmetic in EcoLink.
 *   The LLM (OpenAI / Groq / Gemini) is STRICTLY FORBIDDEN from
 *   performing calculations. Its only role is OCR extraction of physical
 *   quantities (Litres, kWh, GJ, m3, tonne) from invoice text.
 *
 * DESIGN CONTRACT:
 *   - Zero external dependencies (no API calls, no DB, no AI).
 *   - All multiplication uses .toFixed(4) before further operations to
 *     prevent V8 IEEE-754 floating-point accumulation errors.
 *   - All public functions are pure: same inputs → same outputs, always.
 *   - Every result includes an auditTrail string for AASB S2 traceability.
 *   - SPEND-BASED (AUD) CALCULATION IS PROHIBITED: NGA Factors 2025 uses
 *     Method 1 (physical quantities) exclusively. If no physical unit is
 *     available, the system returns INSUFFICIENT_PHYSICAL_DATA error.
 *
 * Math Engine Version: calculator_v1
 * Source standard: NGA Factors 2025 (DCCEEW) — values supplied by DB row.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Physical units accepted by NGA Factors 2025 Method 1.
 * AUD is intentionally absent — spend-based is NOT a valid NGA method.
 */
export type PhysicalUnit =
  | "L"       // short alias for Litres — emitted by regex_extractor.ts
  | "Litres"  // liquid fuels (L → normalised to kL internally)
  | "Liters"  // US spelling alias
  | "kL"      // kilolitres — NGA table base for liquid fuels
  | "GJ"      // gigajoules — natural gas commercial billing, coal
  | "kWh"     // electricity
  | "m3"      // cubic metres — residential gas, water
  | "tonne"   // waste, coal
  | "t"       // short alias for tonne — emitted by regex_extractor.ts
  | "kg";     // refrigerants

/**
 * Result of a deterministic combustion/fuel emission calculation.
 * All tonne values are metric tonnes CO2e (tCO2e).
 */
export interface FuelEmissionResult {
  /** Scope 1 (direct combustion) emissions in metric tonnes CO2e. */
  scope1Tonnes: number;
  /** Scope 3 (upstream lifecycle) emissions in metric tonnes CO2e. */
  scope3Tonnes: number;
  /** Total (Scope 1 + Scope 3) emissions in metric tonnes CO2e. */
  totalTonnes: number;
  /**
   * Human-readable audit trail for AASB S2 disclosure.
   * MUST be persisted in transactions.classification_notes.
   */
  auditTrail: string;
  /** Quantity after normalisation (kL for liquids, GJ for gas/coal). */
  normalisedQuantity: number;
  /** Unit after normalisation. */
  normalisedUnit: "kL" | "GJ" | "tonne" | "kg";
}

/**
 * Result of a Scope 2 purchased electricity calculation.
 * Electricity has no Scope 3 factor in NGA Factors 2025.
 */
export interface ElectricityEmissionResult {
  /** Scope 2 (purchased electricity) emissions in metric tonnes CO2e. */
  scope2Tonnes: number;
  /** Audit trail string. */
  auditTrail: string;
  /** kWh consumed — passed through unchanged. */
  kwh: number;
}

/**
 * Error returned when calculation cannot proceed.
 * INSUFFICIENT_PHYSICAL_DATA is the mandatory error when no physical
 * unit is present — AUD spend MUST NOT be used as a substitute.
 */
export interface CalculatorError {
  error: true;
  errorCode:
    | "INSUFFICIENT_PHYSICAL_DATA"
    | "INVALID_QUANTITY"
    | "INVALID_FACTOR"
    | "UNSUPPORTED_UNIT";
  reason: string;
  inputQuantity: number | null;
  inputUnit: PhysicalUnit | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Multiply two numbers with .toFixed(4) rounding at each step to prevent
 * IEEE-754 floating-point drift in V8/Node.js.
 */
function safeMul(a: number, b: number): number {
  return parseFloat((a * b).toFixed(4));
}

/** Convert kg CO2e to metric tonnes CO2e with .toFixed(4) precision. */
function kgToTonnes(kg: number): number {
  return parseFloat((kg / 1000).toFixed(4));
}

// ─── AASB S2 Method 1 Guard ───────────────────────────────────────────────────

/**
 * Enforce that a physical quantity is present before any calculation.
 * Call this at every entry point where a transaction may lack activity data.
 *
 * NGA Factors 2025 (DCCEEW) Method 1 requires physical units exclusively.
 * If this guard returns an error, the transaction MUST be set to
 * `classification_status = 'needs_review'` and queued for manual entry.
 */
export function requirePhysicalQuantity(
  quantity: number | null | undefined,
  unit: PhysicalUnit | null | undefined,
  activityLabel: string,
): CalculatorError | null {
  if (quantity == null || unit == null) {
    return {
      error: true,
      errorCode: "INSUFFICIENT_PHYSICAL_DATA",
      reason:
        "Insufficient Physical Data — AASB S2 NGA Method 1 Requires Physical Quantities. " +
        `Activity: ${activityLabel}. ` +
        "No AUD spend-based estimation is permitted under NGA Factors 2025. " +
        "Transaction flagged for manual physical quantity entry.",
      inputQuantity: quantity ?? null,
      inputUnit: unit ?? null,
    };
  }
  return null;
}

// ─── Core calculation functions ───────────────────────────────────────────────

/**
 * Calculate Scope 1 (direct combustion) and Scope 3 (upstream lifecycle)
 * emissions for any fuel or combustible material.
 *
 * Supported input units and their normalisation path:
 *   Litres / Liters → ÷ 1000 → kL → × energy_content_gj_per_unit → GJ
 *   kL              → as-is    → kL → × energy_content_gj_per_unit → GJ
 *   GJ              → direct (energy_content_gj_per_unit not needed)
 *   tonne (coal)    → × energy_content_gj_per_unit (GJ/tonne) → GJ
 *   kg (refrigerant)→ direct factor (kg CO2e/kg) — no GJ conversion
 *
 * @param quantity               Raw quantity from invoice.
 * @param inputUnit              Physical unit as extracted by the LLM (NOT AUD).
 * @param energyContentGjPerUnit NGA Appendix A energy content:
 *                               GJ/kL for liquids, GJ/tonne for coal, null for direct-GJ inputs.
 * @param scope1Factor           NGA Scope 1 factor in kg CO2e per GJ (or kg CO2e/kg for refrigerants).
 * @param scope3Factor           NGA Scope 3 upstream factor in kg CO2e per GJ.
 * @param activityLabel          Human-readable label for audit trail.
 * @param ngaYear                NGA edition year (default 2025).
 */
export function calculateFuelEmissions(
  quantity: number,
  inputUnit: PhysicalUnit,
  energyContentGjPerUnit: number | null,
  scope1Factor: number,
  scope3Factor: number,
  activityLabel = "Fuel combustion",
  ngaYear = 2025,
): FuelEmissionResult | CalculatorError {
  // ── Validation ────────────────────────────────────────────────────────────
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: true, errorCode: "INVALID_QUANTITY", reason: "quantity must be a positive finite number", inputQuantity: quantity, inputUnit };
  }
  if (!Number.isFinite(scope1Factor) || scope1Factor < 0) {
    return { error: true, errorCode: "INVALID_FACTOR", reason: "scope1Factor must be a non-negative finite number", inputQuantity: quantity, inputUnit };
  }
  if (!Number.isFinite(scope3Factor) || scope3Factor < 0) {
    return { error: true, errorCode: "INVALID_FACTOR", reason: "scope3Factor must be a non-negative finite number", inputQuantity: quantity, inputUnit };
  }

  // ── Refrigerant (kg) — direct factor, no GJ conversion ───────────────────
  if (inputUnit === "kg") {
    const scope1Kg = safeMul(quantity, scope1Factor);
    const scope3Kg = safeMul(quantity, scope3Factor);
    const scope1T  = kgToTonnes(scope1Kg);
    const scope3T  = kgToTonnes(scope3Kg);
    const totalT   = parseFloat((scope1T + scope3T).toFixed(4));
    const trail = [
      `[EcoLink calculator_v1 — NGA ${ngaYear}]`,
      `Activity   : ${activityLabel}`,
      `Input      : ${quantity} kg (direct factor — no GJ conversion)`,
      `Scope 1    : ${quantity} kg × ${scope1Factor} kg CO2e/kg = ${scope1Kg} kg CO2e = ${scope1T} tCO2e`,
      `Scope 3    : ${quantity} kg × ${scope3Factor} kg CO2e/kg = ${scope3Kg} kg CO2e = ${scope3T} tCO2e`,
      `Total      : ${scope1T} + ${scope3T} = ${totalT} tCO2e`,
      `Standard   : AASB S2 / NGA Factors ${ngaYear} (DCCEEW)`,
      `LLM Role   : OCR extraction only — did NOT perform this calculation`,
    ].join("\n");
    return { scope1Tonnes: scope1T, scope3Tonnes: scope3T, totalTonnes: totalT, auditTrail: trail, normalisedQuantity: quantity, normalisedUnit: "kg" };
  }

  // ── GJ direct (natural gas already billed in GJ) ──────────────────────────
  if (inputUnit === "GJ") {
    const gjDirect = parseFloat(quantity.toFixed(4));
    const scope1Kg = safeMul(gjDirect, scope1Factor);
    const scope3Kg = safeMul(gjDirect, scope3Factor);
    const scope1T  = kgToTonnes(scope1Kg);
    const scope3T  = kgToTonnes(scope3Kg);
    const totalT   = parseFloat((scope1T + scope3T).toFixed(4));
    const trail = [
      `[EcoLink calculator_v1 — NGA ${ngaYear}]`,
      `Activity   : ${activityLabel}`,
      `Input      : ${quantity} GJ (direct — no unit conversion)`,
      `Scope 1    : ${gjDirect} GJ × ${scope1Factor} kg CO2e/GJ = ${scope1Kg} kg CO2e = ${scope1T} tCO2e`,
      `Scope 3    : ${gjDirect} GJ × ${scope3Factor} kg CO2e/GJ = ${scope3Kg} kg CO2e = ${scope3T} tCO2e`,
      `Total      : ${scope1T} + ${scope3T} = ${totalT} tCO2e`,
      `Standard   : AASB S2 / NGA Factors ${ngaYear} (DCCEEW)`,
      `LLM Role   : OCR extraction only — did NOT perform this calculation`,
    ].join("\n");
    return { scope1Tonnes: scope1T, scope3Tonnes: scope3T, totalTonnes: totalT, auditTrail: trail, normalisedQuantity: gjDirect, normalisedUnit: "GJ" };
  }

  // ── All other units require energy_content_gj_per_unit ───────────────────
  if (energyContentGjPerUnit == null || !Number.isFinite(energyContentGjPerUnit) || energyContentGjPerUnit <= 0) {
    return {
      error: true,
      errorCode: "INVALID_FACTOR",
      reason: `energyContentGjPerUnit is required and must be positive for unit '${inputUnit}'. Source: NGA Factors 2025 Appendix A.`,
      inputQuantity: quantity,
      inputUnit,
    };
  }

  // ── Step 1: Normalise to base unit ────────────────────────────────────────
  let baseQuantity: number;
  let baseUnit: "kL" | "GJ" | "tonne";
  let normNote: string;

  if (inputUnit === "L" || inputUnit === "Litres" || inputUnit === "Liters") {
    baseQuantity = parseFloat((quantity / 1000).toFixed(4));
    baseUnit = "kL";
    normNote = `${quantity} L ÷ 1000 = ${baseQuantity} kL`;
  } else if (inputUnit === "kL") {
    baseQuantity = parseFloat(quantity.toFixed(4));
    baseUnit = "kL";
    normNote = `${quantity} kL (no conversion required)`;
  } else if (inputUnit === "m3") {
    // m3 gas: convert to GJ via energy content (GJ/m3 in NGA Appendix A)
    baseQuantity = parseFloat(quantity.toFixed(4));
    baseUnit = "kL"; // treated structurally as kL slot — energyContent is GJ/m3
    normNote = `${quantity} m3 (energy content GJ/m3 applied in Step 2)`;
  } else if (inputUnit === "tonne" || inputUnit === "t") {
    // Coal or waste-to-energy billed per tonne ("t" is the short form from regex_extractor)
    baseQuantity = parseFloat(quantity.toFixed(4));
    baseUnit = "tonne";
    normNote = `${quantity} tonne (energy content GJ/tonne applied in Step 2)`;
  } else {
    return {
      error: true,
      errorCode: "UNSUPPORTED_UNIT",
      reason: `Unit '${inputUnit}' is not supported by NGA Factors 2025 Method 1. ` +
               "Supported units: Litres, kL, GJ, m3, tonne, kg.",
      inputQuantity: quantity,
      inputUnit,
    };
  }

  // ── Step 2: Convert to GJ ────────────────────────────────────────────────
  const gigajoules = safeMul(baseQuantity, energyContentGjPerUnit);

  // ── Step 3: Scope 1 — Direct combustion ─────────────────────────────────
  const scope1Kg = safeMul(gigajoules, scope1Factor);
  const scope1Tonnes = kgToTonnes(scope1Kg);

  // ── Step 4: Scope 3 — Upstream lifecycle ────────────────────────────────
  const scope3Kg = safeMul(gigajoules, scope3Factor);
  const scope3Tonnes = kgToTonnes(scope3Kg);

  // ── Step 5: Total ────────────────────────────────────────────────────────
  const totalTonnes = parseFloat((scope1Tonnes + scope3Tonnes).toFixed(4));

  // ── Audit trail ──────────────────────────────────────────────────────────
  const auditTrail = [
    `[EcoLink calculator_v1 — NGA ${ngaYear}]`,
    `Activity      : ${activityLabel}`,
    `Step 1 (norm) : ${normNote}`,
    `Step 2 (GJ)   : ${baseQuantity} ${baseUnit} × ${energyContentGjPerUnit} GJ/${baseUnit} = ${gigajoules} GJ`,
    `Step 3 (Sc 1) : ${gigajoules} GJ × ${scope1Factor} kg CO2e/GJ = ${scope1Kg} kg CO2e = ${scope1Tonnes} tCO2e`,
    `Step 4 (Sc 3) : ${gigajoules} GJ × ${scope3Factor} kg CO2e/GJ = ${scope3Kg} kg CO2e = ${scope3Tonnes} tCO2e`,
    `Step 5 (total): ${scope1Tonnes} + ${scope3Tonnes} = ${totalTonnes} tCO2e`,
    `Standard      : AASB S2 / NGA Factors ${ngaYear} Method 1 — Physical Quantities (DCCEEW)`,
    `LLM Role      : OCR extraction only — did NOT perform this calculation`,
  ].join("\n");

  return {
    scope1Tonnes,
    scope3Tonnes,
    totalTonnes,
    auditTrail,
    normalisedQuantity: baseQuantity,
    normalisedUnit: baseUnit === "tonne" ? "tonne" : "kL",
  };
}

/**
 * Calculate Scope 2 purchased electricity emissions.
 *
 * NGA Factors 2025 method:
 *   Scope 2 CO2e (kg) = kWh × location-based factor (NGA Table 5)
 *   Factor is state-specific and updated annually.
 *
 * @param kwh                  Electricity consumed in kWh — MUST be physical reading.
 * @param co2eFactorKgPerKwh   NGA Scope 2 factor in kg CO2e/kWh (from DB, state-matched).
 * @param state                Australian state/territory abbreviation.
 * @param ngaYear              NGA edition year (default 2025).
 */
export function calculateElectricityEmissions(
  kwh: number,
  co2eFactorKgPerKwh: number,
  state: string,
  ngaYear = 2025,
): ElectricityEmissionResult | CalculatorError {
  if (!Number.isFinite(kwh) || kwh <= 0) {
    return { error: true, errorCode: "INVALID_QUANTITY", reason: "kWh must be a positive finite number", inputQuantity: kwh, inputUnit: "kWh" };
  }
  if (!Number.isFinite(co2eFactorKgPerKwh) || co2eFactorKgPerKwh <= 0) {
    return { error: true, errorCode: "INVALID_FACTOR", reason: "co2eFactorKgPerKwh must be a positive finite number", inputQuantity: kwh, inputUnit: "kWh" };
  }

  const co2eKg     = safeMul(kwh, co2eFactorKgPerKwh);
  const scope2Tonnes = kgToTonnes(co2eKg);

  const auditTrail = [
    `[EcoLink calculator_v1 — NGA ${ngaYear}]`,
    `Activity    : Purchased Electricity — ${state} Grid`,
    `Calculation : ${kwh} kWh × ${co2eFactorKgPerKwh} kg CO2e/kWh = ${co2eKg} kg CO2e = ${scope2Tonnes} tCO2e`,
    `Method      : Location-based, NGA Factors ${ngaYear} Table 5 (${state})`,
    `Standard    : AASB S2 / NGA Factors ${ngaYear} Method 1 — Physical Quantities (DCCEEW)`,
    `LLM Role    : OCR extraction only — did NOT perform this calculation`,
  ].join("\n");

  return { scope2Tonnes, auditTrail, kwh };
}

// ─── Type guard ───────────────────────────────────────────────────────────────

export function isCalculatorError(
  result: FuelEmissionResult | ElectricityEmissionResult | CalculatorError,
): result is CalculatorError {
  return (result as CalculatorError).error === true;
}

// ─── Unit conversion helpers (no emission math) ───────────────────────────────

/**
 * Convert natural gas volume (m³) to GJ using the calorific value from NGA.
 * Use when the DB factor is expressed per GJ but the invoice is in m3.
 * The result feeds into calculateFuelEmissions with inputUnit = 'GJ'.
 *
 * @param cubicMetres          Volume in m³ as read from the invoice.
 * @param calorificValueMjPerM3 NGA Appendix A value for the gas network/state.
 *                             Do NOT use a default — always pass the DB value.
 */
export function m3ToGj(cubicMetres: number, calorificValueMjPerM3: number): number {
  const mj = safeMul(cubicMetres, calorificValueMjPerM3);
  return parseFloat((mj / 1000).toFixed(4)); // MJ → GJ
}
