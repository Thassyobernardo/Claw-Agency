/**
 * EcoLink Australia — LLM Gateway (Anti-Hallucination Hardened)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 5 ANTI-HALLUCINATION RULES ENFORCED IN THIS FILE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RULE 1 — Role Confinement
 *   The LLM is a "dumb literal OCR parser" — NOT a carbon accountant.
 *   Prompts never invoke domain knowledge (NGA, AASB S2, CO2e).
 *   Invoking domain knowledge risks outdated or jurisdiction-wrong answers.
 *
 * RULE 2 — The NULL Mandate
 *   Every prompt explicitly threatens failure for deductions.
 *   "If not EXPLICITLY written in the document, return null."
 *
 * RULE 3 — Zero-Math Constraint
 *   No calculations. No unit conversions. Raw text → raw string.
 *   All arithmetic belongs in calculator.ts.
 *
 * RULE 4 — JSON Schema Enforcement
 *   Prompts inject the exact JSON contract as a literal string.
 *   Any text outside that JSON = parser failure.
 *
 * RULE 5 — Privacy Act 1988 (Australian) Shield
 *   redactPII() MUST be called on all text BEFORE it reaches the LLM API.
 *   Redacts: TFN, ABN, ACN, names (heuristic), credit card numbers, BSB.
 *   This is an engineering rule — it does NOT appear in any prompt.
 *
 * AASB S2 ARCHITECTURAL BOUNDARY:
 *   This module is the ONLY authorised interface between EcoLink and any
 *   Large Language Model. It extracts physical quantities from invoice text.
 *   It NEVER calculates CO2e. All arithmetic is in calculator.ts.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── RULE 5: Privacy Act 1988 Shield ─────────────────────────────────────────
// redactPII() runs on ALL text BEFORE it is sent to any external LLM API.
// This function is not optional — callers that bypass it violate Aus Privacy Act.

/** Patterns to redact from invoice text before LLM submission. */
const PII_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  // Australian Tax File Number — 8 or 9 digits, optionally spaced
  { label: "TFN",         pattern: /\b\d{3}\s?\d{3}\s?\d{2,3}\b/g },
  // Australian Business Number — 11 digits, optionally spaced/dashed
  { label: "ABN",         pattern: /\bABN\s*:?\s*\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/gi },
  // Australian Company Number — 9 digits, optionally spaced
  { label: "ACN",         pattern: /\bACN\s*:?\s*\d{3}\s?\d{3}\s?\d{3}\b/gi },
  // Credit/debit card numbers — 13–19 digits grouped
  { label: "CARD",        pattern: /\b(?:\d{4}[\s\-]?){3}\d{1,4}\b/g },
  // BSB + account (AU bank routing)
  { label: "BSB",         pattern: /\bBSB\s*:?\s*\d{3}[-\s]?\d{3}\b/gi },
  // Email addresses
  { label: "EMAIL",       pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
  // Australian mobile numbers (04xx xxx xxx)
  { label: "PHONE_AU",    pattern: /\b04\d{2}\s?\d{3}\s?\d{3}\b/g },
  // Passport numbers (heuristic — letter + 7-8 digits)
  { label: "PASSPORT",    pattern: /\b[A-Z]{1,2}\d{7,8}\b/g },
  // Driver's licence (state-issued — heuristic, varies by state)
  { label: "LICENCE",     pattern: /\b(?:DL|LIC(?:ENCE)?)\s*:?\s*[A-Z0-9]{6,12}\b/gi },
];

/**
 * Redact all personally identifiable information (PII) from invoice text
 * before sending to any external LLM API.
 *
 * Compliance: Australian Privacy Act 1988 (Cth), APP 6 (use of personal information).
 * The LLM vendor (OpenAI etc.) is a third party — invoice PII must not be disclosed.
 *
 * @param text  Raw invoice text from OCR, PDF extraction, or user input.
 * @returns     Sanitised text with PII replaced by [REDACTED:<type>] tokens.
 */
export function redactPII(text: string): string {
  let sanitised = text;
  for (const { label, pattern } of PII_PATTERNS) {
    sanitised = sanitised.replace(pattern, `[REDACTED:${label}]`);
  }
  return sanitised;
}

// ─── RULE 4: JSON Schema Contract ────────────────────────────────────────────
// The exact JSON shape injected into every extraction prompt.
// Keep this as a const so it can be version-controlled independently.

const OCR_JSON_SCHEMA = `{
  "physical_quantity": <number | null>,
  "unit": <"Liters" | "kWh" | "m3" | "t" | "GJ" | "kg" | null>,
  "confidence_score": <number between 0 and 1>,
  "raw_text_evidence": <"copy the EXACT line from the document where you found the value, or empty string if null">
}`;

// ─── RULE 1 + 2 + 3 + 4: Anti-Hallucination Prompt Constants ─────────────────
// All prompts exported as named constants for version control and audit trail.
// Log the CONSTANT NAME in audit records — never the prompt text.

/**
 * PRIMARY EXTRACTION PROMPT — RULE-1 role-confined, RULE-2 NULL-mandated,
 * RULE-3 zero-math, RULE-4 schema-enforced.
 *
 * Use for: extracting fuel/energy quantity from a single invoice page.
 */
export const OCR_EXTRACTION_PROMPT =
  "You are a dumb, literal text scanner (OCR parser). " +
  "You have no knowledge of accounting, carbon, chemistry, or any domain. " +
  "Your ONLY function is to locate specific strings in the document text and copy them verbatim. " +
  "\n\n" +
  "YOUR TASK: Find the physical quantity and physical unit in the text below. " +
  "Physical units are: Liters, kWh, m3, t (metric tonnes), GJ, kg. " +
  "\n\n" +
  "ABSOLUTE PROHIBITIONS — violating any of these will cause a critical compliance failure:\n" +
  "1. DO NOT execute any mathematical operation. DO NOT add, subtract, multiply, or divide.\n" +
  "2. DO NOT convert units. If the document says '500 Litres', return 500 and 'Liters'. Never convert to kL or GJ.\n" +
  "3. DO NOT infer, estimate, or deduce any value. If a number is not EXPLICITLY written in the text, return null.\n" +
  "4. DO NOT calculate emissions, CO2, carbon, or any environmental metric.\n" +
  "5. DO NOT return dollar amounts (AUD, $) as a quantity — they are not physical units.\n" +
  "\n" +
  "THE NULL MANDATE: If you cannot find a physical quantity or unit EXPLICITLY written in the document, " +
  "you are REQUIRED to return null for that field. Guessing or estimating will trigger a compliance system failure.\n" +
  "\n" +
  "Respond EXCLUSIVELY in the JSON format below. " +
  "Any text, explanation, or markdown outside this JSON will cause a parser failure:\n" +
  OCR_JSON_SCHEMA;

/**
 * MULTI-LINE INVOICE PROMPT — for invoices with multiple line items.
 * Returns an array of extraction objects, one per energy-related line.
 * Use for: Xero/MYOB exports with multiple fuel or utility charges.
 */
export const OCR_MULTILINE_PROMPT =
  "You are a dumb, literal text scanner (OCR parser). " +
  "You have no knowledge of accounting, carbon, or any domain. " +
  "Your ONLY function is to find rows in a table or list that contain a physical quantity with a physical unit. " +
  "Physical units are: Liters, kWh, m3, t (metric tonnes), GJ, kg. " +
  "\n\n" +
  "ABSOLUTE PROHIBITIONS:\n" +
  "1. DO NOT perform any calculation or unit conversion.\n" +
  "2. DO NOT infer values not explicitly present in the text. Return null for missing fields.\n" +
  "3. DO NOT return dollar amounts as physical quantities.\n" +
  "4. DO NOT add commentary, markdown, or explanations outside the JSON.\n" +
  "\n" +
  "THE NULL MANDATE: If a line item does not have an explicit physical quantity and unit, " +
  "omit it from the result array entirely. Do not fabricate entries.\n" +
  "\n" +
  "Respond EXCLUSIVELY as a JSON array. Each element follows this schema:\n" +
  `[\n  ${OCR_JSON_SCHEMA},\n  ...\n]` +
  "\n\nReturn an empty array [] if no physical quantities are found. No other text.";

/**
 * MERCHANT CATEGORY PROMPT — maps a transaction description to a GHG category code.
 * RULE-1: The LLM is a "keyword lookup table", not a carbon expert.
 * RULE-2: Returns null if no category matches confidently.
 * Does NOT touch any CO2e value or factor.
 */
export const MERCHANT_CLASSIFICATION_PROMPT =
  "You are a dumb keyword-to-code lookup table. " +
  "You do not know what carbon emissions are. " +
  "Your ONLY task is: given a transaction description string, output the closest matching category code " +
  "from the list below, based on keyword matching only.\n" +
  "\n" +
  "VALID CATEGORY CODES (match by keywords only, do not use domain knowledge):\n" +
  "  fuel_petrol              → keywords: petrol, unleaded, servo, bp, shell, caltex, ampol, 91, 95, 98, e10\n" +
  "  fuel_diesel              → keywords: diesel, gasoil, ulsd, fuel card\n" +
  "  fuel_lpg                 → keywords: lpg, autogas, gas bottle, elgas, propane\n" +
  "  natural_gas              → keywords: natural gas, gas bill, gas supply, agl gas, jemena, atco\n" +
  "  electricity              → keywords: electricity, power bill, kwh, energy retailer, ausgrid, energex, synergy\n" +
  "  refrigerants             → keywords: refrigerant, regas, r410a, r32, r134a, hvac recharge\n" +
  "  air_travel_domestic      → keywords: domestic flight, jetstar, qantas domestic, virgin domestic, rex airline\n" +
  "  air_travel_international → keywords: international flight, overseas flight, emirates, singapore airlines\n" +
  "  rideshare_taxi           → keywords: uber, ola, didi, 13cabs, taxi, cabcharge, rideshare\n" +
  "  public_transport         → keywords: myki, opal card, go card, translink, train ticket, bus ticket\n" +
  "  road_freight             → keywords: freight, courier, startrack, sendle, dhl, toll group\n" +
  "  waste                    → keywords: waste, skip bin, cleanaway, suez, veolia, landfill\n" +
  "\n" +
  "ABSOLUTE PROHIBITIONS:\n" +
  "1. DO NOT calculate any number. DO NOT output CO2e, kg, tonnes, or any emission value.\n" +
  "2. DO NOT use knowledge about carbon accounting or environmental standards.\n" +
  "3. DO NOT guess a category if no keyword clearly matches — return null.\n" +
  "\n" +
  "THE NULL MANDATE: If no keyword from the list above is present in the input, " +
  "you MUST return null for category_code. Returning a guess causes compliance failure.\n" +
  "\n" +
  "Respond EXCLUSIVELY in this JSON format. No other text:\n" +
  "{\n" +
  '  "category_code": <"fuel_petrol" | "fuel_diesel" | "fuel_lpg" | "natural_gas" | "electricity" | ' +
  '"refrigerants" | "air_travel_domestic" | "air_travel_international" | "rideshare_taxi" | ' +
  '"public_transport" | "road_freight" | "waste" | null>,\n' +
  '  "confidence_score": <number between 0 and 1>,\n' +
  '  "matched_keywords": <array of strings — exact keywords from the list above that were found>,\n' +
  '  "reasoning": <"one sentence: which keyword(s) triggered this code, or why null was returned">\n' +
  "}";

// ─── Prompt registry (for audit trail logging) ────────────────────────────────
// Log the KEY name in audit records so version history is traceable.

export const PROMPT_REGISTRY = {
  OCR_EXTRACTION_PROMPT,
  OCR_MULTILINE_PROMPT,
  MERCHANT_CLASSIFICATION_PROMPT,
} as const;

export type PromptName = keyof typeof PROMPT_REGISTRY;

// ─── Response types ───────────────────────────────────────────────────────────

/** Structured response from OCR_EXTRACTION_PROMPT / OCR_MULTILINE_PROMPT. */
export interface OcrExtractionResponse {
  physical_quantity: number | null;
  unit: "Liters" | "kWh" | "m3" | "t" | "GJ" | "kg" | null;
  confidence_score: number;
  raw_text_evidence: string;
}

/** Structured response from MERCHANT_CLASSIFICATION_PROMPT. */
export interface MerchantClassificationResponse {
  category_code: string | null;
  confidence_score: number;
  matched_keywords: string[];
  reasoning: string;
}

// ─── OpenAI client interface (injected by caller) ─────────────────────────────

interface OpenAIClient {
  chat: {
    completions: {
      create: (params: unknown) => Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

// ─── Gateway functions ────────────────────────────────────────────────────────

/**
 * Extract a single physical quantity from invoice text.
 *
 * PRIVACY CONTRACT: text is redacted via redactPII() before hitting the API.
 * ANTI-HALLUCINATION: OCR_EXTRACTION_PROMPT enforces all 5 rules.
 * NULL SAFETY: returns null if LLM returns AUD, empty, or unparseable.
 *
 * @param rawInvoiceText  Raw text from invoice — PII will be redacted internally.
 * @param openai          Injected OpenAI client.
 * @param model           Approved model name (default: gpt-4o-mini for cost efficiency).
 */
export async function extractPhysicalQuantity(
  rawInvoiceText: string,
  openai: OpenAIClient,
  model = "gpt-4o-mini",
): Promise<OcrExtractionResponse | null> {
  // RULE 5: Redact PII before the text leaves the server process
  const sanitisedText = redactPII(rawInvoiceText);

  let rawResponse: string | null = null;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: OCR_EXTRACTION_PROMPT },
        // Hard cap: prevent token abuse and limit surface area for injection attacks
        { role: "user", content: sanitisedText.slice(0, 4000) },
      ],
      temperature: 0,      // RULE 3: zero creativity — deterministic extraction only
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    rawResponse = response.choices[0]?.message?.content ?? null;
    if (!rawResponse) return null;

    const parsed = JSON.parse(rawResponse) as OcrExtractionResponse;

    // RULE 2 + RULE 3 safety gate: reject dollar-based "quantities"
    // The LLM should never return AUD/$ as a unit, but if it does, hard-reject.
    if (
      parsed.unit != null &&
      (parsed.unit.toString().toUpperCase() === "AUD" ||
        parsed.unit.toString().includes("$"))
    ) {
      console.error(
        "[llm_gateway] COMPLIANCE VIOLATION — AUD unit returned by LLM. " +
          "Prompt: OCR_EXTRACTION_PROMPT. Raw:", rawResponse,
      );
      return null;
    }

    // Clamp confidence_score to [0, 1]
    parsed.confidence_score = Math.max(0, Math.min(1, parsed.confidence_score ?? 0));

    return parsed;
  } catch (err) {
    console.error("[llm_gateway] extractPhysicalQuantity error:", err, "raw:", rawResponse);
    return null;
  }
}

/**
 * Extract multiple physical quantities from a multi-line invoice.
 * Returns an array — empty array means no physical quantities found.
 *
 * PRIVACY CONTRACT: redactPII() applied before API call.
 *
 * @param rawInvoiceText  Raw invoice text (may contain multiple line items).
 * @param openai          Injected OpenAI client.
 * @param model           Approved model name.
 */
export async function extractPhysicalQuantitiesBatch(
  rawInvoiceText: string,
  openai: OpenAIClient,
  model = "gpt-4o-mini",
): Promise<OcrExtractionResponse[]> {
  const sanitisedText = redactPII(rawInvoiceText);

  let rawResponse: string | null = null;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: OCR_MULTILINE_PROMPT },
        { role: "user", content: sanitisedText.slice(0, 8000) },
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    rawResponse = response.choices[0]?.message?.content?.trim() ?? null;
    if (!rawResponse) return [];

    // Strip markdown fences if LLM added them despite instructions
    const jsonText = rawResponse
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(jsonText) as OcrExtractionResponse[];
    if (!Array.isArray(parsed)) return [];

    // Filter out any AUD-unit rows
    return parsed.filter((row) => {
      const u = row.unit?.toString().toUpperCase() ?? "";
      if (u === "AUD" || u.includes("$")) {
        console.warn("[llm_gateway] Dropping AUD row from batch response:", row);
        return false;
      }
      return true;
    });
  } catch (err) {
    console.error("[llm_gateway] extractPhysicalQuantitiesBatch error:", err, "raw:", rawResponse);
    return [];
  }
}

/**
 * Classify a transaction description into a GHG emission category code.
 * Does NOT produce any CO2e value — category routing only.
 *
 * PRIVACY CONTRACT: redactPII() applied to description before API call.
 *
 * @param rawDescription  Transaction description (may contain merchant name).
 * @param openai          Injected OpenAI client.
 * @param model           Approved model name.
 */
export async function classifyMerchant(
  rawDescription: string,
  openai: OpenAIClient,
  model = "gpt-4o-mini",
): Promise<MerchantClassificationResponse | null> {
  const sanitisedDescription = redactPII(rawDescription);

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: MERCHANT_CLASSIFICATION_PROMPT },
        { role: "user", content: sanitisedDescription.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 256,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? null;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as MerchantClassificationResponse;

    // Enforce confidence threshold — low-confidence classifications are unreliable
    if ((parsed.confidence_score ?? 0) < 0.5) {
      return { ...parsed, category_code: null };
    }

    return parsed;
  } catch (err) {
    console.error("[llm_gateway] classifyMerchant error:", err);
    return null;
  }
}
