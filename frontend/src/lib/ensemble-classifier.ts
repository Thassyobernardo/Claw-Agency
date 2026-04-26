/**
 * EcoLink Australia — AASB S2 / NGER-compliant AI Ensemble Classifier
 *
 * Fans out a transaction to 3 cheap-but-strong LLMs in parallel via OpenRouter,
 * then aggregates the responses to reduce single-model error.
 *
 *   ┌──> openai/gpt-4o-mini      ──┐
 *   ├──> google/gemini-2.5-flash ──┼──> aggregate ──> result
 *   └──> deepseek/deepseek-chat  ──┘
 *
 * AGGREGATION RULES:
 *   - category code  → majority vote (mode)
 *   - scope (1/2/3)  → majority vote
 *   - activity_value → median (ignores a single hallucinated outlier)
 *   - confidence     → 70% from agreement rate + 30% from mean self-rating
 *
 * COMPLIANCE GATES:
 *   The prompt enforces user spec for AASB S2:
 *     - Activity-based ONLY (no AUD spend factors)
 *     - State REQUIRED for Scope 2 electricity
 *     - GHG Protocol Cat 6 vs Cat 4 split (Uber → Cat 6, courier → Cat 4)
 *     - Reporting period validation (caller passes period_start/end)
 *     - Personal expense exclusion
 *
 * The route layer should fall back to this only when keyword classifier fails
 * or returns confidence < AUTO_THRESHOLD, since each call costs money.
 */

import OpenAI from "openai";
import { VALID_CATEGORY_CODES } from "./classifier";

const CATEGORIES_LIST = VALID_CATEGORY_CODES.join(" | ") +
  " | excluded_personal | excluded_finance";

const DEFAULT_MODELS = [
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat",
];

function getModels(): string[] {
  const env = process.env.OPENROUTER_MODELS;
  if (!env) return DEFAULT_MODELS;
  return env.split(",").map((s) => s.trim()).filter(Boolean);
}

function getClient(): OpenAI {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({
    apiKey:  key,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://claw-agency.vercel.app",
      "X-Title":      "EcoLink Australia",
    },
    timeout: 25_000,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnsembleInput {
  description:        string;
  amount_aud:         number;
  transaction_date:   string;        // ISO date
  /** FY period for the report — transactions outside this range get excluded */
  reporting_period_start: string;    // ISO date
  reporting_period_end:   string;    // ISO date
  /** Australian state where the company operates — used for Scope 2 electricity */
  company_state?:     "NSW"|"VIC"|"QLD"|"WA"|"SA"|"TAS"|"ACT"|"NT";
}

export interface SingleClassification {
  category:           string;        // emission_categories.code
  scope:              1 | 2 | 3;
  ghg_category_num:   number | null; // 1-15 for Scope 3, null for 1/2
  activity_value:     number | null; // physical quantity (L, kWh, km, etc.)
  activity_unit:      string;        // "L" | "kWh" | "GJ" | "passenger_km" | "vehicle_km" | "tonne_km" | "kg" | "tonne" | "none"
  electricity_state:  string | null; // NSW/VIC/... only for Scope 2
  confidence:         number;        // 0..1
  excluded:           boolean;
  exclusion_reason:   string | null; // 'personal_expense' | 'outside_reporting_period' | 'not_emission_relevant' | null
  flags:              string[];      // ['no_activity_data','state_required','low_confidence', ...]
}

export interface EnsembleResult {
  category:           string;
  scope:              1 | 2 | 3;
  ghg_category_num:   number | null;
  activity_value:     number | null;
  activity_unit:      string;
  electricity_state:  string | null;
  confidence:         number;
  excluded:           boolean;
  exclusion_reason:   string | null;
  flags:              string[];
  needs_review:       boolean;
  models_used:        number;
  raw:                SingleClassification[];
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an Australian carbon-accounting classifier for AASB S2 mandatory disclosure
under NGA Factors 2023-24 (DCCEEW) and the GHG Protocol Corporate Standard.

Your output is used in legal disclosures submitted to ASIC. Errors create regulatory
risk for our customers. Follow these rules WITHOUT EXCEPTION.

═══════════════════════════════════════════════════════════════════════════════
RULE 1 — METHODOLOGY: Activity-based ONLY
═══════════════════════════════════════════════════════════════════════════════
NGA 2023-24 publishes NO AUD spend-based factors. You must extract a physical
quantity (litres, kWh, GJ, passenger-km, vehicle-km, tonne-km, kg) from the
description. If you cannot extract one, set activity_value: null and add
"no_activity_data" to flags. NEVER fabricate a quantity from the AUD amount.

═══════════════════════════════════════════════════════════════════════════════
RULE 2 — SCOPE 2 ELECTRICITY: State is MANDATORY
═══════════════════════════════════════════════════════════════════════════════
Australian grids vary 5x in carbon intensity (TAS hydro vs VIC brown coal).
Every Scope 2 electricity transaction MUST have electricity_state set to one
of: NSW, VIC, QLD, WA, SA, TAS, ACT, NT.

If the description names a retailer/distributor that operates in only one state
(e.g. "Energex" → QLD, "Synergy" → WA, "Tasnetworks" → TAS, "Evoenergy" → ACT,
"Ausgrid" → NSW, "Citipower"/"Powercor"/"Jemena Electricity" → VIC), use that.
Otherwise fall back to company_state. If neither is available, return:
  scope: 2, electricity_state: null, flags: ["state_required"]

═══════════════════════════════════════════════════════════════════════════════
RULE 3 — GHG PROTOCOL CATEGORY MAPPING (CRITICAL)
═══════════════════════════════════════════════════════════════════════════════
Cat 6 — Business Travel (passenger transport for staff):
  - Uber, Didi, Ola, 13cabs, taxi, rideshare         → rideshare_taxi
  - Train, bus, ferry, tram, Myki, Opal, Go Card     → public_transport
  - Hertz, Avis, Budget, Thrifty, Europcar, car hire → rental_vehicle
  - Domestic flights (within Australia)               → air_travel_domestic
  - International flights                             → air_travel_international
  - Hotels (Hilton, Marriott, Ibis, Quest, etc)      → accommodation_business

Cat 4 — Upstream Transport of GOODS (only):
  - Auspost Business, Sendle, FedEx, DHL, UPS, TNT, Aramex, StarTrack,
    Toll, Linfox, Mainfreight, K&S Freighters, Northline → road_freight
  - DO NOT use road_freight for staff transport — that is Cat 6.

Scope 1 fuels — extract litres from description if possible:
  - Petrol/ULP/Unleaded → fuel_petrol
  - Diesel              → fuel_diesel
  - LPG / Autogas       → fuel_lpg
  - Natural Gas (GJ)    → natural_gas

Scope 2 — electricity (state required, see Rule 2)        → electricity

Scope 3.5 — Waste (Cleanaway, Suez, Veolia, Remondis)     → waste

═══════════════════════════════════════════════════════════════════════════════
RULE 4 — EXCLUSIONS (Operational Control Boundary)
═══════════════════════════════════════════════════════════════════════════════
Set excluded: true and provide exclusion_reason for:
  - "personal_expense"           — Netflix personal, Spotify personal, personal
                                    clothing, personal groceries, non-business meals
  - "not_emission_relevant"      — bank fees, interest, GST, insurance, rent (no
                                    direct emission), payroll, software subscriptions
                                    (treat as Cat 1 only if cloud compute disclosed)
  - "outside_reporting_period"   — transaction_date is OUTSIDE the FY period
                                    [reporting_period_start, reporting_period_end]
                                    given to you. STRICT inequality on both ends.

Excluded transactions still need a category for audit trail — use
"excluded_personal" or "excluded_finance".

═══════════════════════════════════════════════════════════════════════════════
RULE 5 — CONFIDENCE
═══════════════════════════════════════════════════════════════════════════════
confidence is YOUR self-rated certainty 0..1.
  - 0.9-1.0  : description names a known retailer/category clearly + activity extracted
  - 0.7-0.89 : known retailer/category, activity NOT extracted (will need human review)
  - 0.5-0.69 : ambiguous description with one strong keyword
  - 0.0-0.49 : description too vague — DO NOT assign a category, return excluded:true
               with exclusion_reason: "not_emission_relevant"

═══════════════════════════════════════════════════════════════════════════════
RULE 6 — OUTPUT
═══════════════════════════════════════════════════════════════════════════════
Allowed category codes (return EXACTLY one): __CATEGORIES__

Return ONLY this JSON object, no prose, no code fences:

{
  "category":           "<one of the allowed codes>",
  "scope":              1 | 2 | 3,
  "ghg_category_num":   1-15 | null,
  "activity_value":     <number> | null,
  "activity_unit":      "L" | "kWh" | "GJ" | "m3" | "passenger_km" | "vehicle_km" | "tonne_km" | "kg" | "tonne" | "none",
  "electricity_state":  "NSW"|"VIC"|"QLD"|"WA"|"SA"|"TAS"|"ACT"|"NT" | null,
  "confidence":         <0..1>,
  "excluded":           true | false,
  "exclusion_reason":   "personal_expense" | "outside_reporting_period" | "not_emission_relevant" | null,
  "flags":              ["no_activity_data" | "state_required" | "low_confidence" | "outside_reporting_period" | "personal_expense"]
}`.replace("__CATEGORIES__", CATEGORIES_LIST);

// ─── Single-model call ───────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([...VALID_CATEGORY_CODES, "excluded_personal", "excluded_finance"]);
const VALID_STATES     = new Set(["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"]);
const VALID_REASONS    = new Set([null, "personal_expense", "outside_reporting_period", "not_emission_relevant", "duplicate", "manual_review_excluded"]);

async function classifyOne(
  client: OpenAI,
  model: string,
  input: EnsembleInput,
): Promise<SingleClassification> {
  const userMsg = `Description: "${input.description}"
Amount AUD: ${input.amount_aud.toFixed(2)}
Transaction date: ${input.transaction_date}
Reporting period: ${input.reporting_period_start} to ${input.reporting_period_end}
Company state (fallback for Scope 2): ${input.company_state ?? "UNKNOWN"}`;

  const r = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 350,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userMsg },
    ],
  });

  const raw = r.choices[0]?.message?.content;
  if (!raw) throw new Error(`${model} returned empty content`);
  const p = JSON.parse(raw) as Partial<SingleClassification>;

  // ── Validate + coerce ──────────────────────────────────────────────────
  const category = String(p.category ?? "").toLowerCase().trim();
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(`${model} returned invalid category "${category}"`);
  }

  const scope = Number(p.scope);
  if (![1, 2, 3].includes(scope)) {
    throw new Error(`${model} returned invalid scope "${p.scope}"`);
  }

  const ghgRaw = p.ghg_category_num;
  const ghg_category_num = (typeof ghgRaw === "number" && ghgRaw >= 1 && ghgRaw <= 15) ? ghgRaw : null;

  const avRaw = p.activity_value;
  const activity_value =
    typeof avRaw === "number" && Number.isFinite(avRaw) && avRaw >= 0 ? avRaw : null;

  const activity_unit = typeof p.activity_unit === "string" ? p.activity_unit : "none";

  let electricity_state: string | null = null;
  if (scope === 2) {
    const s = (p.electricity_state ?? "").toString().toUpperCase();
    electricity_state = VALID_STATES.has(s) ? s : (input.company_state ?? null);
  }

  const conf = Number(p.confidence);
  const confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5;

  const excluded = p.excluded === true;
  const reason   = p.exclusion_reason ?? null;
  const exclusion_reason = VALID_REASONS.has(reason) ? reason : null;

  const flags = Array.isArray(p.flags) ? p.flags.filter((f) => typeof f === "string") : [];

  // ── Server-side enforcement of period rule (cheap insurance) ─────────────
  const txDate = new Date(input.transaction_date).getTime();
  const start  = new Date(input.reporting_period_start).getTime();
  const end    = new Date(input.reporting_period_end).getTime();
  if (txDate < start || txDate > end) {
    return {
      category,
      scope: scope as 1 | 2 | 3,
      ghg_category_num,
      activity_value,
      activity_unit,
      electricity_state,
      confidence,
      excluded: true,
      exclusion_reason: "outside_reporting_period",
      flags: ["outside_reporting_period", ...flags],
    };
  }

  // ── Server-side enforcement: missing activity for fuels/electricity ──────
  if (!excluded && activity_value == null && ["L","kWh","GJ","m3","passenger_km","vehicle_km","tonne_km"].includes(activity_unit)) {
    flags.push("no_activity_data");
  }

  // ── Server-side enforcement: Scope 2 without state ───────────────────────
  if (!excluded && scope === 2 && !electricity_state) {
    flags.push("state_required");
  }

  return {
    category,
    scope: scope as 1 | 2 | 3,
    ghg_category_num,
    activity_value,
    activity_unit,
    electricity_state,
    confidence,
    excluded,
    exclusion_reason,
    flags,
  };
}

// ─── Aggregation helpers ─────────────────────────────────────────────────────

function mode<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  let best: T = arr[0];
  let bestN = 0;
  for (const v of arr) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) { bestN = n; best = v; }
  }
  return best;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / Math.max(nums.length, 1);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Threshold for needs_review. 0.7 ≈ at least 2 of 3 models agreed AND
 * mean self-confidence is decent.
 */
export const ENSEMBLE_REVIEW_THRESHOLD = 0.70;

export async function classifyEnsemble(input: EnsembleInput): Promise<EnsembleResult> {
  const client = getClient();
  const models = getModels();

  const settled = await Promise.allSettled(
    models.map((m) => classifyOne(client, m, input)),
  );

  const ok: SingleClassification[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      ok.push(s.value);
    } else {
      const reason = s.reason instanceof Error ? s.reason.message : String(s.reason);
      console.warn(`[ensemble] ${models[i]} failed: ${reason}`);
    }
  }

  if (ok.length === 0) throw new Error("ensemble_all_models_failed");

  // ── 1. Majority vote on (category, scope) compound key ──────────────────
  const combos = ok.map((r) => `${r.category}|${r.scope}`);
  const winningCombo = mode(combos);
  const [winCategory, winScopeStr] = winningCombo.split("|");
  const winScope = Number(winScopeStr) as 1 | 2 | 3;

  const winningResults = ok.filter(
    (r) => r.category === winCategory && r.scope === winScope,
  );

  // ── 2. Median activity_value across winning models (only if extracted) ──
  const activities = winningResults.map((r) => r.activity_value).filter((v): v is number => v != null);
  const activity_value = activities.length > 0 ? median(activities) : null;

  // ── 3. State — majority vote among winning Scope 2 models ───────────────
  let electricity_state: string | null = null;
  if (winScope === 2) {
    const states = winningResults.map((r) => r.electricity_state).filter((s): s is string => !!s);
    electricity_state = states.length > 0 ? mode(states) : (input.company_state ?? null);
  }

  // ── 4. Exclusion — if majority excluded, treat as excluded ──────────────
  const excludedCount = ok.filter((r) => r.excluded).length;
  const excluded = excludedCount > ok.length / 2;
  const exclusion_reason = excluded
    ? mode(ok.filter((r) => r.excluded).map((r) => r.exclusion_reason ?? "not_emission_relevant"))
    : null;

  // ── 5. Confidence aggregation ────────────────────────────────────────────
  const agreementRate = winningResults.length / ok.length;
  const meanSelfConf  = avg(winningResults.map((r) => r.confidence));
  const confidence    = 0.70 * agreementRate + 0.30 * meanSelfConf;

  // ── 6. Flags — union of flags from winning models ───────────────────────
  const flagSet = new Set<string>();
  for (const r of winningResults) for (const f of r.flags) flagSet.add(f);
  if (winScope === 2 && !electricity_state)            flagSet.add("state_required");
  if (activity_value == null && !excluded)             flagSet.add("no_activity_data");
  if (confidence < ENSEMBLE_REVIEW_THRESHOLD)          flagSet.add("low_confidence");

  // ── 7. ghg_category_num — first non-null among winning ──────────────────
  const ghg_category_num =
    winningResults.find((r) => r.ghg_category_num != null)?.ghg_category_num ?? null;

  const activity_unit =
    winningResults.find((r) => r.activity_unit && r.activity_unit !== "none")?.activity_unit ?? "none";

  return {
    category:          winCategory,
    scope:             winScope,
    ghg_category_num,
    activity_value:    activity_value != null ? Math.round(activity_value * 1000) / 1000 : null,
    activity_unit,
    electricity_state,
    confidence:        Math.round(confidence * 100) / 100,
    excluded,
    exclusion_reason,
    flags:             Array.from(flagSet),
    needs_review:      excluded ? false : (confidence < ENSEMBLE_REVIEW_THRESHOLD || flagSet.size > 0),
    models_used:       ok.length,
    raw:               ok,
  };
}

/** Soft wrapper — returns null instead of throwing, for batch use. */
export async function tryClassifyEnsemble(input: EnsembleInput): Promise<EnsembleResult | null> {
  try {
    return await classifyEnsemble(input);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ensemble] failed for "${input.description.slice(0, 40)}":`, msg);
    return null;
  }
}
