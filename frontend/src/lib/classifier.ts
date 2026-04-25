/**
 * EcoLink Australia — Automatic Transaction Classifier
 *
 * Maps raw Xero/bank transaction descriptions to emission categories using
 * keyword matching with confidence scoring. Each rule carries:
 *   - keywords: strings to look for (case-insensitive) in the description
 *   - category: the emission_categories.code to assign
 *   - scope: GHG Protocol scope (1 = direct, 2 = electricity, 3 = indirect)
 *   - unit: the physical unit used to calculate kg CO2e
 *   - confidence: base confidence score (0–1). Boosted when multiple keywords match.
 *
 * Australian price benchmarks (used to convert AUD spend → physical units):
 *   - Electricity: AUD 0.30 / kWh (avg SME rate, AEMC 2024)
 *   - Diesel:      AUD 2.10 / L   (avg retail, FuelWatch Apr 2024)
 *   - Petrol:      AUD 1.95 / L
 *   - LPG:         AUD 0.85 / L
 *   - Natural gas: AUD 0.033 / MJ (avg commercial, ACCC 2024)
 *   - Air travel:  AUD 0.25 / km  (avg domestic fare per km)
 *   - Road freight: AUD 3.50 / km (avg semi-trailer rate)
 *
 * Emission factors (kg CO2e per unit) from NGA 2023-24 (DCCEEW):
 *   - Electricity (national avg): 0.79 kg CO2e / kWh
 *   - Diesel:                     2.68 kg CO2e / L
 *   - Petrol:                     2.31 kg CO2e / L
 *   - LPG:                        1.51 kg CO2e / L
 *   - Natural gas:                0.0514 kg CO2e / MJ
 *   - Air travel (domestic):      0.255 kg CO2e / km (ICAO method)
 *   - Road freight:               0.113 kg CO2e / tonne-km (assumes 10t avg)
 */

export type Scope = 1 | 2 | 3;

export interface ClassificationRule {
  keywords: string[];
  category: string;         // emission_categories.code
  scope: Scope;
  unit: "kWh" | "L_diesel" | "L_petrol" | "L_lpg" | "MJ_gas" | "km_air" | "km_road" | "tonne_waste" | "spend_aud";
  pricePerUnit: number;     // AUD per physical unit (for spend → unit conversion)
  kgCo2ePerUnit: number;    // kg CO2e per physical unit
  confidence: number;       // base confidence 0.0–1.0
}

/** All classification rules, ordered from most specific to most general */
export const RULES: ClassificationRule[] = [
  // ── Scope 2 — Electricity ──────────────────────────────────────────────
  {
    keywords: ["electricity", "energy", "power", "aurora energy", "agl", "origin energy",
               "energex", "ergon", "citipower", "powercor", "jemena", "ausgrid",
               "endeavour energy", "essential energy", "horizon power", "synergy",
               "united energy", "evoenergy", "actew", "sa power", "sapn",
               "red energy", "lumo", "simply energy", "momentum energy",
               "1st energy", "enova", "powerclub", "amber electric"],
    category: "electricity",
    scope: 2,
    unit: "kWh",
    pricePerUnit: 0.30,
    kgCo2ePerUnit: 0.79,
    confidence: 0.90,
  },

  // ── Scope 1 — Diesel / Fleet ───────────────────────────────────────────
  {
    keywords: ["diesel", "fuel", "petro", "bp", "shell", "caltex", "ampol",
               "united petroleum", "liberty oil", "puma energy", "viva energy",
               "mobil", "7-eleven fuel", "metro petroleum", "flexi fleet",
               "motorpass", "fuel card", "fleet card", "wex"],
    category: "fuel_diesel",
    scope: 1,
    unit: "L_diesel",
    pricePerUnit: 2.10,
    kgCo2ePerUnit: 2.68,
    confidence: 0.80,
  },

  // ── Scope 1 — Petrol ──────────────────────────────────────────────────
  {
    keywords: ["petrol", "unleaded", "ulp", "premium unleaded", "e10", "e85",
               "98 octane", "95 octane"],
    category: "fuel_petrol",
    scope: 1,
    unit: "L_petrol",
    pricePerUnit: 1.95,
    kgCo2ePerUnit: 2.31,
    confidence: 0.85,
  },

  // ── Scope 1 — LPG ─────────────────────────────────────────────────────
  {
    keywords: ["lpg", "autogas", "liquid petroleum gas", "gas bottle"],
    category: "fuel_lpg",
    scope: 1,
    unit: "L_lpg",
    pricePerUnit: 0.85,
    kgCo2ePerUnit: 1.51,
    confidence: 0.88,
  },

  // ── Scope 1 — Natural Gas ─────────────────────────────────────────────
  {
    keywords: ["natural gas", "gas supply", "gas usage", "agn", "evoenergy gas",
               "jemena gas", "atco gas", "simply energy gas", "agl gas",
               "origin gas", "alinta gas", "gas bill"],
    category: "natural_gas",
    scope: 1,
    unit: "MJ_gas",
    pricePerUnit: 0.033,
    kgCo2ePerUnit: 0.0514,
    confidence: 0.85,
  },

  // ── Scope 3 — Air Travel ──────────────────────────────────────────────
  {
    keywords: ["qantas", "virgin australia", "jetstar", "rex airline", "bonza",
               "tigerair", "flight", "airfare", "airline", "aviation",
               "boarding pass", "air travel", "international air"],
    category: "air_travel",
    scope: 3,
    unit: "km_air",
    pricePerUnit: 0.25,
    kgCo2ePerUnit: 0.255,
    confidence: 0.88,
  },

  // ── Scope 3 — Road Freight / Logistics ────────────────────────────────
  {
    keywords: ["toll", "mainfreight", "startrack", "toll group", "linfox",
               "northline", "k&s freighters", "gibb group", "qube logistics",
               "sadleirs", "team global", "freight", "courier", "logistics",
               "delivery", "transport", "auspost business", "dhl", "fedex",
               "ups", "sendle", "shippit", "fastway", "aramex"],
    category: "road_freight",
    scope: 3,
    unit: "km_road",
    pricePerUnit: 3.50,
    kgCo2ePerUnit: 0.113,
    confidence: 0.72,
  },

  // ── Scope 3 — Waste ───────────────────────────────────────────────────
  {
    keywords: ["waste", "rubbish", "recycling", "bin", "skip bin", "cleanaway",
               "suez", "remondis", "veolia", "jj's waste", "j.j's",
               "council waste", "disposal", "landfill"],
    category: "waste",
    scope: 3,
    unit: "tonne_waste",
    pricePerUnit: 280,    // AUD per tonne (avg commercial landfill)
    kgCo2ePerUnit: 467,   // kg CO2e per tonne general waste (NGA 2023-24)
    confidence: 0.78,
  },

  // ── Scope 3 — Water ───────────────────────────────────────────────────
  {
    keywords: ["water usage", "water supply", "sydney water", "melbourne water",
               "sa water", "water corporation wa", "icon water", "unitywater",
               "seqwater", "coliban water", "wannon water"],
    category: "water",
    scope: 3,
    unit: "spend_aud",
    pricePerUnit: 1,
    kgCo2ePerUnit: 0.344,  // kg CO2e per AUD (spend-based, EPA Vic factor)
    confidence: 0.75,
  },

  // ── Scope 3 — Accommodation / Hotels ──────────────────────────────────
  {
    keywords: ["hotel", "motel", "ibis", "novotel", "mercure", "hilton",
               "marriott", "hyatt", "accor", "quest apartments", "airbnb",
               "accommodation", "lodging", "serviced apartment"],
    category: "accommodation",
    scope: 3,
    unit: "spend_aud",
    pricePerUnit: 1,
    kgCo2ePerUnit: 0.198,  // kg CO2e per AUD (DEFRA spend-based)
    confidence: 0.70,
  },

  // ── Scope 3 — Meals / Catering ────────────────────────────────────────
  {
    keywords: ["restaurant", "cafe", "catering", "food & bev", "meal",
               "lunch", "dinner", "breakfast", "mcdonald", "kfc", "subway",
               "dominos", "pizza", "hungry jacks", "grill'd"],
    category: "meals_entertainment",
    scope: 3,
    unit: "spend_aud",
    pricePerUnit: 1,
    kgCo2ePerUnit: 0.262,  // kg CO2e per AUD (food service sector)
    confidence: 0.65,
  },

  // ── Scope 3 — IT / Cloud / Telecoms ───────────────────────────────────
  {
    keywords: ["aws", "amazon web services", "google cloud", "azure", "microsoft",
               "telstra", "optus", "tpg", "iinet", "aussie broadband",
               "internet", "broadband", "mobile plan", "cloud hosting",
               "datacentre", "data centre", "hosting"],
    category: "it_cloud",
    scope: 3,
    unit: "spend_aud",
    pricePerUnit: 1,
    kgCo2ePerUnit: 0.12,   // kg CO2e per AUD (ICT sector spend-based)
    confidence: 0.62,
  },

  // ── Scope 3 — Office Supplies / Printing ──────────────────────────────
  {
    keywords: ["officeworks", "staples", "cartridge world", "printing",
               "stationery", "paper", "toner", "ink cartridge"],
    category: "office_supplies",
    scope: 3,
    unit: "spend_aud",
    pricePerUnit: 1,
    kgCo2ePerUnit: 0.15,
    confidence: 0.60,
  },
];

export interface ClassificationResult {
  category: string;
  scope: Scope;
  unit: ClassificationRule["unit"];
  confidence: number;
  estimatedPhysicalQty: number;   // converted from AUD spend
  estimatedKgCo2e: number;
  matchedKeywords: string[];
}

/**
 * Classify a single transaction description + amount.
 *
 * Returns the best matching rule, or null if no rule reaches the
 * minimum confidence threshold (0.40).
 */
export function classify(
  description: string,
  amountAud: number,
  minConfidence = 0.40
): ClassificationResult | null {
  const lower = description.toLowerCase();

  let bestRule: ClassificationRule | null = null;
  let bestScore = 0;
  let bestMatched: string[] = [];

  for (const rule of RULES) {
    const matched = rule.keywords.filter((kw) => lower.includes(kw.toLowerCase()));
    if (matched.length === 0) continue;

    // Boost confidence based on how many keywords matched
    const boost = Math.min(0.15, (matched.length - 1) * 0.05);
    const score = Math.min(1.0, rule.confidence + boost);

    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
      bestMatched = matched;
    }
  }

  if (!bestRule || bestScore < minConfidence) return null;

  const physicalQty = amountAud / bestRule.pricePerUnit;
  const kgCo2e = physicalQty * bestRule.kgCo2ePerUnit;

  return {
    category: bestRule.category,
    scope: bestRule.scope,
    unit: bestRule.unit,
    confidence: Math.round(bestScore * 100) / 100,
    estimatedPhysicalQty: Math.round(physicalQty * 100) / 100,
    estimatedKgCo2e: Math.round(kgCo2e * 1000) / 1000,
    matchedKeywords: bestMatched,
  };
}

/**
 * Classify a batch of transactions.
 * Returns one result per transaction (null = unclassified).
 */
export function classifyBatch(
  transactions: Array<{ id: string; description: string; amount_aud: number }>
): Array<{ id: string; result: ClassificationResult | null }> {
  return transactions.map((tx) => ({
    id: tx.id,
    result: classify(tx.description, tx.amount_aud),
  }));
}
