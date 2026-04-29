/**
 * EcoLink Australia — Transaction Router (Zero-AI Edition)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE: 100% Deterministic Pre-Filter Gate
 *
 *   Xero Transaction
 *        │
 *        ▼
 *   [routeTransaction()]  ← this module
 *        │
 *        ├─ IGNORE       → { status: 'ignored' }        [0 API calls]
 *        ├─ NEEDS_REVIEW → { status: 'needs_review' }   [0 API calls]
 *        └─ EXTRACT_VOLUME
 *               │
 *               ▼
 *        [extractViaRegex()]  ← regex_extractor.ts
 *               │
 *               ├─ match  → { status: 'extracted', quantity: number }
 *               └─ null   → { status: 'needs_review', reason: "..." }
 *
 * NO LLM. NO OPENAI. NO EXTERNAL API CALLS OF ANY KIND.
 *
 * DESIGN RATIONALE (AASB S2):
 *   Regex extraction is MORE compliant than LLM extraction:
 *   (a) Reproducible — any auditor can re-run the same regex on the same text.
 *   (b) Cannot hallucinate — match or null, no invented values.
 *   (c) Null path always triggers human review (ManualEntryPayload).
 *   (d) Zero token cost, zero latency variance, zero vendor dependency.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  extractViaRegex,
  type ExtractableUnit,
} from "./regex_extractor";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single rule row from merchant_classification_rules. */
export interface MerchantRule {
  id: string;
  merchant_name: string;
  pattern: string;
  match_type: "contains" | "starts_with" | "exact";
  category_code: string;
  scope: 0 | 1 | 2 | 3;
  activity_unit: string | null;
  requires_state: boolean;
  notes_citation: string | null;
  priority: number;
  action: "EXTRACT_VOLUME" | "IGNORE" | "NEEDS_REVIEW";
}

/** Input transaction from Xero / MYOB / manual entry. */
export interface XeroTransaction {
  /** Merchant/contact name from Xero (e.g. "Ampol Fuel Card Service"). */
  merchantName: string;
  /** Full description or narration from Xero line item. */
  description: string;
  /** Amount in AUD — used for audit trail only, NEVER for CO2e calculation. */
  amountAud: number;
  /** Xero transaction ID for audit traceability. */
  xeroTransactionId?: string;
}

// ─── Router result variants ───────────────────────────────────────────────────

export interface IgnoredResult {
  status: "ignored";
  reason: string;
  matchedRule: Pick<MerchantRule, "merchant_name" | "category_code" | "action">;
}

export interface ExtractedResult {
  status: "extracted";
  categoryCode: string;
  scope: 1 | 2 | 3;
  /** Physical quantity extracted by regex — feeds directly into calculator.ts. */
  quantity: number;
  /** Physical unit matching the rule's activity_unit. */
  unit: ExtractableUnit;
  requiresState: boolean;
  matchedRule: Pick<MerchantRule, "merchant_name" | "category_code" | "action">;
  notesCitation: string | null;
}

export interface NeedsReviewResult {
  status: "needs_review";
  reason: string;
  categoryCode?: string;
  scope?: 1 | 2 | 3;
  matchedRule?: Pick<MerchantRule, "merchant_name" | "category_code" | "action">;
}

export type RouterResult = IgnoredResult | ExtractedResult | NeedsReviewResult;

// ─── DB client interface (injected by caller) ─────────────────────────────────

interface DbClient {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

// ─── Unit mapping helper ──────────────────────────────────────────────────────

/**
 * Map `activity_unit` from merchant_classification_rules to an ExtractableUnit.
 * Returns null if the unit is not supported by the regex extractor
 * (e.g. 'passenger_km', 'vehicle_km', 'tonne_km' — which require human entry).
 */
function toExtractableUnit(activityUnit: string | null): ExtractableUnit | null {
  const MAP: Record<string, ExtractableUnit> = {
    L:    "L",
    kWh:  "kWh",
    GJ:   "GJ",
    m3:   "m3",
    t:    "t",
    tonne:"t",
    kg:   "kg",
  };
  return activityUnit ? (MAP[activityUnit] ?? null) : null;
}

// ─── Core matching logic ──────────────────────────────────────────────────────

/**
 * Match a transaction string against a single rule.
 * Always case-insensitive. No regex — plain string matching only.
 */
function ruleMatches(rule: MerchantRule, subject: string): boolean {
  const haystack = subject.toLowerCase();
  const needle   = rule.pattern.toLowerCase();
  switch (rule.match_type) {
    case "contains":    return haystack.includes(needle);
    case "starts_with": return haystack.startsWith(needle);
    case "exact":       return haystack === needle;
    default:            return false;
  }
}

/**
 * Find the highest-priority matching rule.
 * Rules must be pre-sorted by priority DESC — first match wins.
 */
function findMatchingRule(
  rules: MerchantRule[],
  merchantName: string,
  description: string,
): MerchantRule | null {
  const subject = `${merchantName} ${description}`;
  for (const rule of rules) {
    if (ruleMatches(rule, subject)) return rule;
  }
  return null;
}

// ─── Shared routing logic (used by both DB and static variants) ───────────────

function buildIgnoredResult(matched: MerchantRule): IgnoredResult {
  return {
    status: "ignored",
    reason: matched.notes_citation ?? "Not emission-relevant under GHG Protocol.",
    matchedRule: {
      merchant_name: matched.merchant_name,
      category_code: matched.category_code,
      action: matched.action,
    },
  };
}

function buildNeedsReviewFromRule(
  matched: MerchantRule,
  reason: string,
): NeedsReviewResult {
  return {
    status: "needs_review",
    reason,
    categoryCode: matched.category_code,
    scope: matched.scope as 1 | 2 | 3,
    matchedRule: {
      merchant_name: matched.merchant_name,
      category_code: matched.category_code,
      action: matched.action,
    },
  };
}

function buildNoMatchResult(merchantName: string): NeedsReviewResult {
  return {
    status: "needs_review",
    reason:
      `Merchant "${merchantName}" did not match any rule in merchant_classification_rules. ` +
      "Transaction routed to human review queue. " +
      "Add a new rule via the admin panel to automate future classifications.",
  };
}

/**
 * Core routing logic — operates on a pre-loaded, sorted rule array.
 * No I/O. No external calls. Pure function over data.
 */
function applyRules(
  transaction: XeroTransaction,
  sortedRules: MerchantRule[],
): RouterResult {
  const { merchantName, description, xeroTransactionId } = transaction;

  const matched = findMatchingRule(sortedRules, merchantName, description);

  if (!matched) {
    console.info(
      `[router] NO_MATCH xeroId=${xeroTransactionId ?? "?"} merchant="${merchantName}"`,
    );
    return buildNoMatchResult(merchantName);
  }

  if (matched.action === "IGNORE") {
    console.info(
      `[router] IGNORE xeroId=${xeroTransactionId ?? "?"} ` +
      `rule="${matched.merchant_name}" category="${matched.category_code}"`,
    );
    return buildIgnoredResult(matched);
  }

  if (matched.action === "NEEDS_REVIEW") {
    console.info(
      `[router] NEEDS_REVIEW (rule) xeroId=${xeroTransactionId ?? "?"} ` +
      `category="${matched.category_code}"`,
    );
    return buildNeedsReviewFromRule(
      matched,
      `Merchant "${merchantName}" matched rule "${matched.merchant_name}" ` +
      `(${matched.category_code}), but this category requires manual physical quantity entry. ` +
      (matched.notes_citation ?? ""),
    );
  }

  // ── EXTRACT_VOLUME: deterministic regex extraction ──────────────────────────
  const extractableUnit = toExtractableUnit(matched.activity_unit);

  if (!extractableUnit) {
    // Unit exists in DB but is not extractable by regex (e.g. passenger_km)
    console.info(
      `[router] NEEDS_REVIEW (non-extractable unit="${matched.activity_unit}") ` +
      `xeroId=${xeroTransactionId ?? "?"}`,
    );
    return buildNeedsReviewFromRule(
      matched,
      `Category "${matched.category_code}" uses unit "${matched.activity_unit}" ` +
      "which requires manual entry (physical count not available in invoice text). " +
      "Unidade física não encontrada no texto. Preenchimento manual necessário.",
    );
  }

  const quantity = extractViaRegex(description, extractableUnit);

  if (quantity === null) {
    console.info(
      `[router] NEEDS_REVIEW (regex_no_match) xeroId=${xeroTransactionId ?? "?"} ` +
      `unit="${extractableUnit}" description="${description.slice(0, 60)}"`,
    );
    return buildNeedsReviewFromRule(
      matched,
      "Unidade física não encontrada no texto. Preenchimento manual necessário.",
    );
  }

  console.info(
    `[router] EXTRACTED xeroId=${xeroTransactionId ?? "?"} ` +
    `quantity=${quantity} ${extractableUnit} category="${matched.category_code}"`,
  );

  return {
    status: "extracted",
    categoryCode: matched.category_code,
    scope: matched.scope as 1 | 2 | 3,
    quantity,
    unit: extractableUnit,
    requiresState: matched.requires_state,
    notesCitation: matched.notes_citation,
    matchedRule: {
      merchant_name: matched.merchant_name,
      category_code: matched.category_code,
      action: matched.action,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Route a Xero transaction using live rules from the database.
 * No LLM, no OpenAI, no external API calls.
 *
 * @param transaction  Xero transaction data.
 * @param db           PostgreSQL client (injected).
 */
export async function routeTransaction(
  transaction: XeroTransaction,
  db: DbClient,
): Promise<RouterResult> {
  const { rows: rules } = await db.query<MerchantRule>(
    `SELECT id, merchant_name, pattern, match_type, category_code, scope,
            activity_unit, requires_state, notes_citation, priority, action
       FROM merchant_classification_rules
      WHERE is_active = TRUE
      ORDER BY priority DESC`,
  );
  return applyRules(transaction, rules);
}

/**
 * Route a Xero transaction using an in-memory rule array.
 * Use in: unit tests, edge function cold-start (cached rules), benchmarks.
 * No DB required. No external calls. Synchronous routing logic, async signature
 * for API symmetry with the DB variant.
 *
 * @param transaction  Xero transaction data.
 * @param rules        Pre-loaded rule array (any order — sorted internally).
 */
export async function routeTransactionStatic(
  transaction: XeroTransaction,
  rules: MerchantRule[],
): Promise<RouterResult> {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  return applyRules(transaction, sorted);
}
