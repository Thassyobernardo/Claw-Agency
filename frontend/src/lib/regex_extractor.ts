/**
 * EcoLink Australia — Regex Physical Quantity Extractor
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ZERO-AI EXTRACTION ENGINE
 *
 * Replaces the LLM Gateway for physical quantity extraction in the
 * Transaction Router. This module:
 *
 *   - Has ZERO external dependencies (no API calls, no network, no AI).
 *   - Is 100% deterministic: same input → same output, always.
 *   - Returns null if no unambiguous match is found (NULL Mandate, Rule 2).
 *   - NEVER converts units or performs arithmetic (Zero-Math, Rule 3).
 *
 * DESIGN CONTRACT:
 *   The regex patterns are deliberately strict. A partial match or ambiguous
 *   text returns null — the transaction is then routed to `needs_review`
 *   for manual physical quantity entry (ManualEntryPayload).
 *
 * AASB S2 COMPLIANCE:
 *   Extraction by regex is MORE compliant than LLM extraction because:
 *   (a) It is reproducible by any auditor with the source text.
 *   (b) It cannot hallucinate — it either finds an exact match or returns null.
 *   (c) The null path always triggers a human review, not a fabricated value.
 *
 * Math Engine Version: regex_extractor_v1
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── Supported physical unit types ───────────────────────────────────────────

/**
 * Physical units that can be extracted by this engine.
 * Maps 1:1 to `activity_unit` values in merchant_classification_rules.
 * AUD is intentionally absent — spend-based extraction is prohibited.
 */
export type ExtractableUnit = "L" | "kWh" | "GJ" | "m3" | "t" | "kg";

// ─── Regex pattern registry ───────────────────────────────────────────────────
//
// PATTERN DESIGN PRINCIPLES:
//   1. Number must be followed immediately (optional whitespace) by the unit token.
//   2. Unit token must be a complete token — bounded by word boundary or whitespace.
//      This prevents "kWh" matching "MkWh" (megawatt-hour) or "1234" matching "12".
//   3. Case-insensitive (`i` flag) because invoice OCR text is unreliable.
//   4. Comma-formatted numbers (1,240 kWh) are normalised before matching.
//   5. Each pattern captures exactly ONE group: the numeric quantity string.

const PATTERNS: Record<ExtractableUnit, RegExp> = {
  // Litres — matches: 62.5 L, 62.5L, 62.5 Litres, 62.5 Liters, 62.5 Lts
  L: /(?:^|[\s,:])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:L|Litres|Liters|Lts)(?=[\s,.:;)\]|$]|$)/i,

  // kWh — matches: 1240 kWh, 1,240 kWh, 1240kWh, 1240 KWH
  kWh: /(?:^|[\s,:])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:kWh|KWH|kwh)(?=[\s,.:;)\]|$]|$)/i,

  // GJ — matches: 100 GJ, 100GJ, 100.5 GJ (natural gas commercial billing)
  GJ: /(?:^|[\s,:])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:GJ|gj)(?=[\s,.:;)\]|$]|$)/i,

  // m3 — matches: 450 m3, 450m3, 450 m³, 450 m^3 (residential gas)
  m3: /(?:^|[\s,:])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:m3|m³|m\^3|M3)(?=[\s,.:;)\]|$]|$)/i,

  // Metric tonnes — matches: 5 t, 5t, 5 tonne, 5 tonnes, 5 T (waste, coal)
  t: /(?:^|[\s,:])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:t|T|tonne|tonnes|metric\s+tonne)(?=[\s,.:;)\]|$]|$)/i,

  // Kilograms — matches: 2.5 kg, 2.5kg, 2.5 KG (refrigerants)
  kg: /(?:^|[\s,:])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:kg|KG|Kg)(?=[\s,.:;)\]|$]|$)/i,
};

// ─── Normalisation helper ──────────────────────────────────────────────────────

/**
 * Remove comma-separators from a numeric string before parsing.
 * e.g. "1,240" → "1240", "38,600.5" → "38600.5"
 */
function stripCommas(numStr: string): string {
  return numStr.replace(/,/g, "");
}

// ─── Core extraction function ─────────────────────────────────────────────────

/**
 * Extract a single physical quantity from a text string using strict regex.
 *
 * RULES:
 *   - Returns the FIRST unambiguous numeric match for the expected unit.
 *   - If zero matches: returns null (route to needs_review).
 *   - If multiple matches with DIFFERENT values: returns null (ambiguous).
 *   - If multiple matches with the SAME value: returns that value (duplicate labels).
 *   - NEVER converts units. NEVER performs arithmetic. Raw number only.
 *
 * @param text          Invoice description or narration text.
 * @param expectedUnit  The physical unit expected for this merchant category.
 * @returns             Parsed number if unambiguously found, null otherwise.
 */
export function extractViaRegex(
  text: string,
  expectedUnit: ExtractableUnit,
): number | null {
  const pattern = PATTERNS[expectedUnit];
  if (!pattern) return null;

  // Find all matches in the text
  const matches: number[] = [];
  // Reset lastIndex for global-flagged reuse safety
  const re = new RegExp(pattern.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const numStr = stripCommas(match[1]);
    const value = parseFloat(numStr);
    if (Number.isFinite(value) && value > 0) {
      matches.push(value);
    }
  }

  if (matches.length === 0) return null;

  // Multiple distinct values = ambiguous = null
  const unique = [...new Set(matches)];
  if (unique.length > 1) return null;

  return unique[0]!;
}

// ─── Multi-unit scan (for unknown unit) ────────────────────────────────────────

export interface MultiUnitMatch {
  value: number;
  unit: ExtractableUnit;
}

/**
 * Scan text for ANY physical quantity across all supported units.
 * Used when the rule has `activity_unit = null` but we want to attempt extraction.
 *
 * Returns the first match found, or null if nothing is found.
 * Unit priority: L > kWh > GJ > m3 > t > kg (most common first).
 */
export function extractAnyUnit(text: string): MultiUnitMatch | null {
  const priority: ExtractableUnit[] = ["L", "kWh", "GJ", "m3", "t", "kg"];
  for (const unit of priority) {
    const value = extractViaRegex(text, unit);
    if (value !== null) return { value, unit };
  }
  return null;
}
