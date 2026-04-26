/**
 * EcoLink Australia — Activity-Based Transaction Classifier
 *
 * AASB S2 / NGER-compliant classification engine. Maps transaction descriptions
 * to GHG Protocol categories using keyword matching, then attempts to extract
 * a physical activity quantity (litres, kWh, passenger-km) so emissions are
 * calculated from real units — NOT from AUD spend.
 *
 * RULES (per user spec, August 2026):
 *
 *  1. Activity-based ONLY. NGA Factors 2023-24 do not publish AUD spend-based
 *     factors. If we cannot extract a physical quantity, we return needs_review
 *     and flag the transaction as missing activity data.
 *
 *  2. Scope 2 electricity REQUIRES a state. The caller must supply company.state
 *     (or per-transaction electricity_state). Without it we return needs_review.
 *
 *  3. Cat 6 Business Travel: Uber/taxi/rideshare/train/bus/ferry/flights → Cat 6.
 *     Cat 4 Upstream Transport: ONLY courier/freight moving purchased goods.
 *
 *  4. We DO NOT classify ambiguous spend (groceries, meals, generic services).
 *     Those go to needs_review with flag "no activity data — supplier disclosure
 *     required".
 *
 * The actual emission_factor values come from the database (emission_factors
 * table, seeded from NGA Factors 2023-24 Workbook). This file holds only the
 * keyword → category mapping and the activity-extraction regex helpers.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Scope = 1 | 2 | 3;

/**
 * Physical units accepted by NGA Factors 2023-24.
 * "AUD" is intentionally absent — spend-based is not allowed.
 */
export type ActivityUnit =
  | "L"             // litres (fuel)
  | "kWh"           // electricity
  | "GJ"            // natural gas (commercial billing)
  | "m3"            // natural gas (residential billing)
  | "passenger_km"  // air, train, bus, ferry
  | "vehicle_km"    // taxi, rideshare, rental
  | "tonne_km"      // freight (only when known)
  | "kg"            // refrigerant top-up
  | "tonne";        // waste

export interface ClassificationRule {
  /** GHG Protocol category code — must exist in emission_categories.code */
  category:        string;
  /** GHG Protocol scope */
  scope:           Scope;
  /** Cat 1-15 number for Scope 3 (null for Scope 1/2) */
  ghgCategoryNum:  number | null;
  /** Physical unit required for activity-based calc */
  unit:            ActivityUnit;
  /** Whether this category requires state for the location-based factor */
  requiresState:   boolean;
  /** Lowercased keywords matched against transaction description */
  keywords:        string[];
  /** Base confidence — boosted by additional keyword hits */
  baseConfidence:  number;
}

// ─── Activity quantity extraction ─────────────────────────────────────────────
// Regex helpers to pull physical quantities out of free-text descriptions.

/** Match "62.5L", "62.5 L", "62L", "62 litres" → returns { value, unit:"L" } */
function extractLitres(desc: string): number | null {
  const m = desc.match(/(\d+(?:\.\d+)?)\s*(?:L|l|litres?|liters?)\b/);
  return m ? parseFloat(m[1]) : null;
}

/** Match "1,240 kWh", "850 kwh" → returns kWh number */
function extractKwh(desc: string): number | null {
  const m = desc.match(/(\d+(?:[,.]?\d+)*(?:\.\d+)?)\s*(?:kWh|kwh|KWH)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

/** Match "230 km", "1,500km" — for vehicle/passenger distance */
function extractKm(desc: string): number | null {
  const m = desc.match(/(\d+(?:[,.]?\d+)*(?:\.\d+)?)\s*km\b/i);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

/** Match "500 GJ", "2.5 m³", "2.5 m3" — natural gas */
function extractGasUnits(desc: string): { value: number; unit: "GJ" | "m3" } | null {
  const gj = desc.match(/(\d+(?:\.\d+)?)\s*GJ\b/i);
  if (gj) return { value: parseFloat(gj[1]), unit: "GJ" };
  const m3 = desc.match(/(\d+(?:\.\d+)?)\s*(?:m³|m3|cubic\s*metre)/i);
  if (m3) return { value: parseFloat(m3[1]), unit: "m3" };
  return null;
}

// ─── Classification rules — keyword → category mapping only ──────────────────
// IMPORTANT: ordered most specific → most general. First match wins.

export const RULES: ClassificationRule[] = [

  // ═════════════════════════════════════════════════════════════════════════
  // SCOPE 1 — DIRECT EMISSIONS
  // ═════════════════════════════════════════════════════════════════════════

  // Petrol — passenger vehicles
  {
    category: "fuel_petrol", scope: 1, ghgCategoryNum: null,
    unit: "L", requiresState: false,
    keywords: [
      "unleaded","ulp","91 octane","95 octane","98 octane","e10","e85",
      "premium unleaded","mogas","petrol",
    ],
    baseConfidence: 0.85,
  },

  // Diesel — fleet, generators, equipment
  {
    category: "fuel_diesel", scope: 1, ghgCategoryNum: null,
    unit: "L", requiresState: false,
    keywords: [
      "diesel","b5 diesel","b20","ulsd","gasoil","fuel card diesel",
      "wex diesel","motorpass diesel","fleet diesel","truck fuel","semi fuel",
    ],
    baseConfidence: 0.85,
  },

  // LPG / Autogas
  {
    category: "fuel_lpg", scope: 1, ghgCategoryNum: null,
    unit: "L", requiresState: false,
    keywords: ["lpg","autogas","liquid petroleum gas","gas bottle","elgas","propane"],
    baseConfidence: 0.88,
  },

  // Natural Gas — commercial billing (almost always GJ in AU)
  {
    category: "natural_gas", scope: 1, ghgCategoryNum: null,
    unit: "GJ", requiresState: false,
    keywords: [
      "natural gas","gas supply","gas usage","agn","atco gas","jemena gas",
      "agl gas","origin gas","alinta gas","energy australia gas","gas bill",
    ],
    baseConfidence: 0.85,
  },

  // Refrigerants — fugitive emissions, NGA Table 7
  {
    category: "refrigerants", scope: 1, ghgCategoryNum: null,
    unit: "kg", requiresState: false,
    keywords: [
      "refrigerant","r-410a","r410a","r-32","r32","r-134a","r134a",
      "hvac regas","aircon regas","aircon recharge","car aircon regas",
    ],
    baseConfidence: 0.82,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // SCOPE 2 — PURCHASED ELECTRICITY (state-specific factor REQUIRED)
  // ═════════════════════════════════════════════════════════════════════════

  {
    category: "electricity", scope: 2, ghgCategoryNum: null,
    unit: "kWh", requiresState: true,
    keywords: [
      // Retailers
      "agl electricity","origin electricity","energy australia","energyaustralia",
      "red energy","lumo energy","simply energy","momentum energy","powershop",
      "amber electric","alinta electricity","1st energy","powerclub","enova",
      "globird","kogan energy","tango energy","sumo power","diamond energy",
      "discover energy","reamped","social energy","nectr","ovo energy",

      // Distributors / network charges
      "ausgrid","endeavour energy","essential energy","evoenergy",
      "citipower","powercor","jemena electricity","ausnet electricity","united energy",
      "energex","ergon energy","sa power networks","sapn","western power",
      "synergy","horizon power","tasnetworks","aurora energy","power and water",

      // Generic
      "electricity bill","electricity usage","power bill",
    ],
    baseConfidence: 0.90,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // SCOPE 3 — VALUE CHAIN (split by GHG Protocol category)
  // ═════════════════════════════════════════════════════════════════════════

  // Cat 6 — Air Travel (DOMESTIC) — IATA passenger-km from booking detail
  {
    category: "air_travel_domestic", scope: 3, ghgCategoryNum: 6,
    unit: "passenger_km", requiresState: false,
    keywords: [
      "qantas dom","jetstar dom","virgin australia dom","rex airline","bonza",
      "qantaslink","qantas group dom","flight syd","flight mel","flight bne",
      "domestic flight","domestic airfare",
    ],
    baseConfidence: 0.78,
  },

  // Cat 6 — Air Travel (INTERNATIONAL)
  {
    category: "air_travel_international", scope: 3, ghgCategoryNum: 6,
    unit: "passenger_km", requiresState: false,
    keywords: [
      "qantas intl","singapore airlines","cathay pacific","emirates","etihad",
      "qatar airways","united airlines","american airlines","delta","british airways",
      "air new zealand","fiji airways","air canada","ana","jal","lufthansa",
      "international flight","international airfare","intl flight",
    ],
    baseConfidence: 0.78,
  },

  // Cat 6 — Rideshare & Taxi
  {
    category: "rideshare_taxi", scope: 3, ghgCategoryNum: 6,
    unit: "vehicle_km", requiresState: false,
    keywords: [
      "uber","didi","ola rideshare","13cabs","silver service","cabcharge",
      "blackcabs","gocatch","shebah","taxi","rideshare","limousine",
    ],
    baseConfidence: 0.85,
  },

  // Cat 6 — Public Transport
  {
    category: "public_transport", scope: 3, ghgCategoryNum: 6,
    unit: "passenger_km", requiresState: false,
    keywords: [
      "myki","opal card","go card","metrocard","translink","transperth",
      "metro tasmania","action canberra","sydney trains","metro trains",
      "v/line","cityrail","train ticket","bus ticket","ferry ticket",
      "manly fast ferry","sealink","spirit of tasmania",
    ],
    baseConfidence: 0.85,
  },

  // Cat 6 — Rental Vehicle
  {
    category: "rental_vehicle", scope: 3, ghgCategoryNum: 6,
    unit: "vehicle_km", requiresState: false,
    keywords: [
      "hertz","avis","budget rent","thrifty","europcar","sixt","alamo",
      "enterprise rent","redspot","car hire","vehicle hire","ute hire",
    ],
    baseConfidence: 0.78,
  },

  // Cat 6 — Business Accommodation (passenger-night)
  {
    category: "accommodation_business", scope: 3, ghgCategoryNum: 6,
    unit: "passenger_km",  // placeholder — accommodation uses passenger-night, but unit is informational
    requiresState: false,
    keywords: [
      "hilton","marriott","hyatt","accor","ibis","novotel","mercure","sofitel",
      "intercontinental","crowne plaza","holiday inn","quest apartments",
      "mantra group","meriton suites","best western","stamford","langham",
      "hotel","motel","airbnb business","accommodation",
    ],
    baseConfidence: 0.65,
  },

  // Cat 4 — Upstream Transport of PURCHASED GOODS (couriers/freight only)
  {
    category: "road_freight", scope: 3, ghgCategoryNum: 4,
    unit: "tonne_km", requiresState: false,
    keywords: [
      "auspost business","auspost parcel","sendle","fastway","aramex",
      "fedex","dhl","ups","tnt express","startrack","couriers please",
      "toll group","linfox","mainfreight","k&s freighters","kennards transport",
      "northline","gibb group","qube logistics","freight","goods delivery",
    ],
    baseConfidence: 0.70,
  },

  // Scope 3.5 — Waste
  {
    category: "waste", scope: 3, ghgCategoryNum: 5,
    unit: "tonne", requiresState: false,
    keywords: [
      "cleanaway","suez","veolia","remondis","jj's waste","jjs waste",
      "council waste","skip bin","commercial waste","landfill","recycling collection",
    ],
    baseConfidence: 0.78,
  },
];

// ─── Result types ────────────────────────────────────────────────────────────

export type ClassificationFlag =
  | "no_activity_data"
  | "state_required"
  | "outside_reporting_period"
  | "personal_expense"
  | "low_confidence"
  | "deprecated_category";

export interface ClassificationResult {
  category:       string;
  scope:          Scope;
  ghgCategoryNum: number | null;
  unit:           ActivityUnit;
  requiresState:  boolean;
  /** Activity quantity extracted from description, or null if not extractable. */
  activityValue:  number | null;
  confidence:     number;
  matchedKeywords: string[];
  /** Diagnostic flags — any present means the transaction needs human review. */
  flags:          ClassificationFlag[];
}

// ─── Classify ─────────────────────────────────────────────────────────────────

/**
 * Match a transaction description against keyword rules and attempt to extract
 * the physical activity quantity. Returns null if no rule matches with confidence
 * above `minConfidence`.
 *
 * NOTE: This function does NOT compute kg CO2e. The caller is responsible for:
 *   1. Looking up the matching emission_factor in the database
 *      (filtered by category, year=current, and state if requiresState)
 *   2. Multiplying activityValue × factor.co2e_factor
 *   3. Persisting electricity_state on the transaction row.
 *
 * If `result.activityValue` is null, the transaction MUST go to needs_review.
 */
export function classify(
  description: string,
  minConfidence = 0.50,
): ClassificationResult | null {
  const lower = description.toLowerCase();

  let bestRule: ClassificationRule | null = null;
  let bestScore = 0;
  let bestMatched: string[] = [];

  for (const rule of RULES) {
    const matched = rule.keywords.filter((kw) => lower.includes(kw.toLowerCase()));
    if (matched.length === 0) continue;

    // Boost confidence based on number of keywords that hit
    const boost = Math.min(0.10, (matched.length - 1) * 0.04);
    const score = Math.min(1.0, rule.baseConfidence + boost);

    if (score > bestScore) {
      bestScore   = score;
      bestRule    = rule;
      bestMatched = matched;
    }
  }

  if (!bestRule || bestScore < minConfidence) return null;

  // ── Extract activity quantity per unit type ──────────────────────────────
  let activityValue: number | null = null;
  switch (bestRule.unit) {
    case "L":             activityValue = extractLitres(description); break;
    case "kWh":           activityValue = extractKwh(description); break;
    case "GJ":
    case "m3": {
      const gas = extractGasUnits(description);
      activityValue = gas?.value ?? null;
      break;
    }
    case "passenger_km":
    case "vehicle_km":
    case "tonne_km":      activityValue = extractKm(description); break;
    // refrigerant kg, waste tonne — typically not in transaction description, manual entry only
    case "kg":
    case "tonne":         activityValue = null; break;
  }

  // ── Diagnostic flags ──────────────────────────────────────────────────────
  const flags: ClassificationFlag[] = [];
  if (activityValue == null)        flags.push("no_activity_data");
  if (bestRule.requiresState)       flags.push("state_required");
  if (bestScore < 0.75)             flags.push("low_confidence");

  return {
    category:        bestRule.category,
    scope:           bestRule.scope,
    ghgCategoryNum:  bestRule.ghgCategoryNum,
    unit:            bestRule.unit,
    requiresState:   bestRule.requiresState,
    activityValue,
    confidence:      Math.round(bestScore * 100) / 100,
    matchedKeywords: bestMatched,
    flags,
  };
}

// ─── Personal expense detector ───────────────────────────────────────────────
// Per user spec: "Personal expenses (clothing, Netflix personal, non-business
// meals) → EXCLUDE from boundary"

const PERSONAL_KEYWORDS = [
  "netflix","spotify","disney+","apple music","apple tv","stan",
  "binge","kayo","amazon prime",
  "cotton on","kmart personal","target personal","ikea personal",
  "myer personal","david jones personal",
  "personal grocery","woolworths personal","coles personal","aldi personal",
  "personal pharmacy","chemist warehouse personal",
];

export function detectPersonalExpense(description: string): boolean {
  const lower = description.toLowerCase();
  return PERSONAL_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Out-of-period detector ──────────────────────────────────────────────────

export function isOutsideReportingPeriod(
  txDate: Date | string,
  periodStart: Date | string,
  periodEnd:   Date | string,
): boolean {
  const t  = new Date(txDate).getTime();
  const s  = new Date(periodStart).getTime();
  const e  = new Date(periodEnd).getTime();
  return t < s || t > e;
}

// ─── Re-export rules for downstream consumers (e.g. ensemble allowed-list) ───
export const VALID_CATEGORY_CODES = Array.from(new Set(RULES.map((r) => r.category)));

// ─── Batch helper (kept for backward compatibility with classify route) ─────
// Returns one result per transaction. Caller still needs to look up emission_factor
// and compute kg CO2e from activityValue.

export interface BatchInput {
  id:          string;
  description: string;
}

export function classifyBatch(transactions: BatchInput[]): Array<{
  id:     string;
  result: ClassificationResult | null;
}> {
  return transactions.map((tx) => ({
    id: tx.id,
    result: classify(tx.description),
  }));
}
