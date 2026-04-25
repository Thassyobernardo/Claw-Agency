/**
 * EcoLink Australia — AI Ensemble Classifier (OpenRouter)
 *
 * Fans out a transaction description to 3 cheap-but-strong LLMs in parallel
 * via OpenRouter, then aggregates the responses to reduce single-model error:
 *
 *   ┌──> openai/gpt-4o-mini      ──┐
 *   ├──> google/gemini-2.5-flash ──┼──> aggregate ──> result
 *   └──> deepseek/deepseek-chat  ──┘
 *
 * Aggregation rules:
 *   - category code → majority vote (mode)
 *   - scope (1/2/3)  → majority vote
 *   - kg CO2e        → median (ignores a single hallucinated outlier)
 *   - confidence     → 70% from agreement rate + 30% from mean self-reported
 *
 * The route layer should fall back to this only when the keyword classifier
 * fails or returns confidence < AUTO_THRESHOLD, since each call costs money.
 *
 * Required env: OPENROUTER_API_KEY
 * Optional env: OPENROUTER_MODELS  (comma-separated override of MODELS)
 *
 * Cost @ 2025-04 OpenRouter pricing (~500 in / 100 out tokens per call):
 *   ~US$ 0.00015 per transaction across all 3 models
 *   ~US$ 1.50 per 10,000 transactions
 */

import OpenAI from "openai";
import { RULES } from "./classifier";

// ── Allowed values come from the keyword classifier rules ────────────────
// This guarantees the AI returns codes that exist in emission_categories.
const VALID_CATEGORIES = Array.from(new Set(RULES.map((r) => r.category)));
const CATEGORIES_LIST = VALID_CATEGORIES.join(" | ");

// Approximate kg CO2e per AUD spend, by category — used as a sanity bound
// so we can clamp wildly hallucinated emission numbers.
const KG_PER_AUD_BOUNDS: Record<string, { min: number; max: number }> = {};
for (const r of RULES) {
  // crude upper bound: assume cheapest reasonable price → highest physical qty
  const max = (r.kgCo2ePerUnit / r.pricePerUnit) * 3;
  KG_PER_AUD_BOUNDS[r.category] = { min: 0, max: Math.max(max, 0.01) };
}

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
    timeout: 20_000,
  });
}

// ── Types ────────────────────────────────────────────────────────────────

export interface SingleClassification {
  category:   string;            // emission_categories.code
  scope:      1 | 2 | 3;
  kg_co2e:    number;            // estimated emissions
  confidence: number;            // self-reported 0..1
}

export interface EnsembleResult {
  category:     string;
  scope:        1 | 2 | 3;
  kg_co2e:      number;
  confidence:   number;
  needs_review: boolean;         // true when models disagreed or low confidence
  models_used:  number;          // how many of the 3 succeeded
  raw:          SingleClassification[]; // for audit / debug
}

// ── Prompt ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an Australian carbon-accounting classifier for AASB S2 / NGER reporting.

Given a single SME transaction (description + amount in AUD), classify it for emissions:
  - Use NGA 2023-24 emission factors (DCCEEW).
  - Scope 1 = direct fuel burn (diesel, petrol, LPG, natural gas).
  - Scope 2 = purchased electricity.
  - Scope 3 = everything else (freight, travel, waste, water, IT, supplies, food).

Allowed category codes (return EXACTLY one): ${CATEGORIES_LIST}

Rules:
  - kg_co2e MUST be a non-negative number, plausible for the AUD amount.
  - confidence is YOUR self-rated certainty 0..1.
  - If the description is too vague to classify, set confidence ≤ 0.3.

Return ONLY this JSON object, no prose, no code fences:
{ "category": "<one of the allowed codes>", "scope": 1, "kg_co2e": 0.0, "confidence": 0.0 }`;

// ── Single-model call ────────────────────────────────────────────────────

async function classifyOne(
  client: OpenAI,
  model: string,
  description: string,
  amountAud: number,
): Promise<SingleClassification> {
  const r = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: `Description: "${description}"\nAmount AUD: ${amountAud.toFixed(2)}` },
    ],
  });

  const raw = r.choices[0]?.message?.content;
  if (!raw) throw new Error(`${model} returned empty content`);
  const parsed = JSON.parse(raw) as Partial<SingleClassification>;

  // Validate + coerce
  const category = String(parsed.category ?? "").toLowerCase().trim();
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`${model} returned invalid category "${category}"`);
  }
  const scope = Number(parsed.scope);
  if (![1, 2, 3].includes(scope)) {
    throw new Error(`${model} returned invalid scope "${parsed.scope}"`);
  }
  const kgRaw = Number(parsed.kg_co2e);
  const kg = Number.isFinite(kgRaw) && kgRaw >= 0 ? kgRaw : 0;
  const confidenceRaw = Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.5;

  // Clamp absurd kg values to per-category bound
  const bound = KG_PER_AUD_BOUNDS[category];
  const clampedKg =
    bound && amountAud > 0 ? Math.min(kg, bound.max * amountAud) : kg;

  return { category, scope: scope as 1 | 2 | 3, kg_co2e: clampedKg, confidence };
}

// ── Aggregation helpers ──────────────────────────────────────────────────

function mode<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  let best: T = arr[0];
  let bestN = 0;
  for (const v of arr) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best  = v;
    }
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

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Threshold below which a result is flagged needs_review.
 * 0.7 ≈ "at least 2 of 3 models agreed AND average self-confidence is decent".
 */
export const ENSEMBLE_REVIEW_THRESHOLD = 0.70;

/**
 * Classify a single transaction with the 3-model ensemble.
 * Throws only if ALL models fail (caller should fall back to needs_review).
 */
export async function classifyEnsemble(
  description: string,
  amountAud: number,
): Promise<EnsembleResult> {
  const client = getClient();
  const models = getModels();

  const settled = await Promise.allSettled(
    models.map((m) => classifyOne(client, m, description, amountAud)),
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

  if (ok.length === 0) {
    throw new Error("ensemble_all_models_failed");
  }

  // 1. majority vote on category + scope (combined as compound key)
  const combos = ok.map((r) => `${r.category}|${r.scope}`);
  const winningCombo = mode(combos);
  const [winCategory, winScopeStr] = winningCombo.split("|");
  const winScope = Number(winScopeStr) as 1 | 2 | 3;

  // 2. median kg_co2e ONLY among models that voted for the winning combo
  //    (mixing scope-1 and scope-3 numbers wouldn't make sense)
  const winningResults = ok.filter(
    (r) => r.category === winCategory && r.scope === winScope,
  );
  const winningKg = median(winningResults.map((r) => r.kg_co2e));

  // 3. Confidence: 70% from how many models agreed, 30% from mean self-rating
  const agreementRate = winningResults.length / ok.length;
  const meanSelfConf  = avg(winningResults.map((r) => r.confidence));
  const confidence    = 0.70 * agreementRate + 0.30 * meanSelfConf;

  return {
    category:     winCategory,
    scope:        winScope,
    kg_co2e:      Math.round(winningKg * 1000) / 1000,
    confidence:   Math.round(confidence * 100) / 100,
    needs_review: confidence < ENSEMBLE_REVIEW_THRESHOLD,
    models_used:  ok.length,
    raw:          ok,
  };
}

/**
 * Soft wrapper — returns null instead of throwing, for use in batch loops.
 */
export async function tryClassifyEnsemble(
  description: string,
  amountAud: number,
): Promise<EnsembleResult | null> {
  try {
    return await classifyEnsemble(description, amountAud);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ensemble] failed for "${description.slice(0, 40)}":`, msg);
    return null;
  }
}
