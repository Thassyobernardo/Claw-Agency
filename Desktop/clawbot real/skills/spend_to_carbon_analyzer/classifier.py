"""
EcoLink Australia — Spend-to-Carbon AI Classifier.

Uses Groq (primary) or Gemini (fallback) to classify financial transactions
against the National Greenhouse Accounts (NGA) emission factor table.

Classification pipeline per transaction:
  1. Keyword pre-match  — fast O(1) lookup against match_keywords[] arrays.
  2. Groq LLM match     — if keyword match confidence < threshold.
  3. Gemini fallback    — if Groq fails or returns no match.
  4. NEEDS_REVIEW flag  — if confidence < CONFIDENCE_THRESHOLD.
  5. FACTOR_NOT_FOUND   — if no factor can be matched at all.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

logger = logging.getLogger("ecolink.classifier")

# Minimum confidence to accept a classification as final.
CONFIDENCE_THRESHOLD = 0.70

# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an expert Australian greenhouse gas accounting specialist.
Your task is to classify financial transactions against the National Greenhouse Accounts (NGA) emission factors.

Rules:
- Return ONLY valid JSON — no markdown, no explanation outside the JSON.
- Choose the MOST SPECIFIC matching factor from the provided list.
- If you are uncertain, lower your confidence score rather than guessing.
- If no factor is a reasonable match, set matched_factor_id to null.
- confidence must be a float between 0.0 and 1.0.
- All monetary values are AUD (Australian dollars).
"""

def _build_user_prompt(transaction: dict, factors: list[dict]) -> str:
    """Build the classification prompt for a single transaction."""

    factors_json = json.dumps(
        [
            {
                "id":       str(f["id"]),
                "scope":    f["scope"],
                "category": f["category"],
                "activity": f["activity"],
                "unit":     f["unit"],
                "method":   f["calculation_method"],
                "keywords": f.get("match_keywords") or [],
            }
            for f in factors
        ],
        indent=None,
        separators=(",", ":"),
    )

    tx_json = json.dumps(
        {
            "description":    transaction.get("description", ""),
            "supplier_name":  transaction.get("supplier_name", ""),
            "amount_aud":     transaction.get("amount_aud", 0),
            "account_name":   transaction.get("account_name", ""),
        },
        separators=(",", ":"),
    )

    return f"""Classify this transaction against the NGA emission factors list.

Transaction:
{tx_json}

Available NGA Emission Factors:
{factors_json}

Respond with ONLY this JSON structure:
{{
  "matched_factor_id": "<UUID or null>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence>",
  "quantity_hint": {{
    "value": <number or null>,
    "unit": "<unit string or null>"
  }}
}}
"""


# ---------------------------------------------------------------------------
# Keyword pre-matcher (fast path — avoids LLM call for obvious matches)
# ---------------------------------------------------------------------------

def _keyword_prematch(
    transaction: dict,
    factors: list[dict],
) -> Optional[tuple[dict, float]]:
    """
    Try to match a transaction using the factor's match_keywords array.
    Returns (factor, confidence) or None.
    """
    haystack = " ".join(
        filter(None, [
            (transaction.get("description") or "").lower(),
            (transaction.get("supplier_name") or "").lower(),
            (transaction.get("account_name") or "").lower(),
        ])
    )

    best_factor  = None
    best_score   = 0.0

    for factor in factors:
        keywords: list[str] = factor.get("match_keywords") or []
        if not keywords:
            continue

        matched_kw = [kw for kw in keywords if kw.lower() in haystack]
        if not matched_kw:
            continue

        # Score = proportion of keywords matched, capped at 0.92
        # (leave room for LLM to override with higher confidence)
        score = min(len(matched_kw) / max(len(keywords), 1) * 0.95, 0.92)

        # Bonus: longer keyword match = more specific
        score += min(max(len(kw) for kw in matched_kw) * 0.005, 0.05)

        if score > best_score:
            best_score  = score
            best_factor = factor

    if best_factor and best_score >= CONFIDENCE_THRESHOLD:
        return best_factor, round(best_score, 3)

    return None


# ---------------------------------------------------------------------------
# Groq classifier
# ---------------------------------------------------------------------------

def _classify_with_groq(
    transaction: dict,
    factors: list[dict],
) -> Optional[dict]:
    """Call Groq API to classify a transaction. Returns parsed JSON or None."""
    try:
        from groq import Groq  # lazy import

        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set.")

        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": _build_user_prompt(transaction, factors)},
            ],
            temperature=0.1,       # Low temperature = deterministic classification
            max_tokens=256,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        return json.loads(raw)

    except Exception as exc:
        logger.warning("Groq classification failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Gemini fallback classifier
# ---------------------------------------------------------------------------

def _classify_with_gemini(
    transaction: dict,
    factors: list[dict],
) -> Optional[dict]:
    """Call Gemini API as fallback. Returns parsed JSON or None."""
    try:
        import google.generativeai as genai  # lazy import

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set.")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                max_output_tokens=256,
                response_mime_type="application/json",
            ),
        )
        response = model.generate_content(_build_user_prompt(transaction, factors))
        raw = response.text.strip()

        # Strip accidental markdown fences
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        return json.loads(raw)

    except Exception as exc:
        logger.warning("Gemini classification failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Factor lookup helper
# ---------------------------------------------------------------------------

def _find_factor_by_id(factor_id: str, factors: list[dict]) -> Optional[dict]:
    for f in factors:
        if str(f["id"]) == factor_id:
            return f
    return None


# ---------------------------------------------------------------------------
# Main classifier function
# ---------------------------------------------------------------------------

def classify_transaction(
    transaction: dict,
    factors: list[dict],
) -> dict:
    """
    Classify a single transaction against the NGA emission factors.

    Returns a dict with:
        matched_factor  : dict | None
        confidence      : float | None
        status          : ClassificationStatus string
        notes           : str | None
        quantity_hint   : dict | None  { value, unit }
    """
    result = {
        "matched_factor": None,
        "confidence":     None,
        "status":         "pending",
        "notes":          None,
        "quantity_hint":  None,
    }

    # ── Step 1: Keyword pre-match (fast path) ────────────────────────────────
    prematch = _keyword_prematch(transaction, factors)
    if prematch:
        factor, confidence = prematch
        result.update({
            "matched_factor": factor,
            "confidence":     confidence,
            "status":         "classified",
            "notes":          f"Keyword match on '{factor['activity']}'.",
        })
        logger.debug(
            "Keyword match: '%s' → %s (%.2f)",
            transaction.get("description", ""),
            factor["activity"],
            confidence,
        )
        return result

    # ── Step 2: Groq LLM classification ──────────────────────────────────────
    llm_result = _classify_with_groq(transaction, factors)

    # ── Step 3: Gemini fallback ───────────────────────────────────────────────
    if llm_result is None:
        logger.info("Falling back to Gemini for: %s", transaction.get("description"))
        llm_result = _classify_with_gemini(transaction, factors)

    # ── Step 4: No LLM response at all ───────────────────────────────────────
    if llm_result is None:
        result.update({
            "status": "factor_not_found",
            "notes":  "Both Groq and Gemini failed to respond. Manual review required.",
        })
        return result

    # ── Step 5: Parse LLM response ───────────────────────────────────────────
    factor_id  = llm_result.get("matched_factor_id")
    confidence = float(llm_result.get("confidence", 0.0))
    reasoning  = llm_result.get("reasoning", "")
    qty_hint   = llm_result.get("quantity_hint") or {}

    if not factor_id:
        result.update({
            "status": "factor_not_found",
            "notes":  f"No matching NGA factor found. LLM reasoning: {reasoning}",
        })
        return result

    matched_factor = _find_factor_by_id(factor_id, factors)
    if not matched_factor:
        result.update({
            "status": "factor_not_found",
            "notes":  f"LLM returned unknown factor ID '{factor_id}'. Possible hallucination.",
        })
        return result

    # ── Step 6: Confidence gate ───────────────────────────────────────────────
    if confidence < CONFIDENCE_THRESHOLD:
        result.update({
            "matched_factor": matched_factor,
            "confidence":     confidence,
            "status":         "needs_review",
            "notes":          (
                f"Low confidence ({confidence:.0%}). LLM says: {reasoning}. "
                "Manual review recommended before including in final report."
            ),
            "quantity_hint": qty_hint,
        })
        return result

    result.update({
        "matched_factor": matched_factor,
        "confidence":     confidence,
        "status":         "classified",
        "notes":          reasoning,
        "quantity_hint":  qty_hint,
    })
    return result


# ---------------------------------------------------------------------------
# Batch classifier
# ---------------------------------------------------------------------------

def classify_batch(
    transactions: list[dict],
    factors: list[dict],
) -> list[dict]:
    """
    Classify a list of transactions against the NGA emission factors.
    Returns a list of classification result dicts (same order as input).
    """
    results = []
    for i, tx in enumerate(transactions):
        logger.debug("Classifying transaction %d/%d: %s", i + 1, len(transactions), tx.get("description"))
        try:
            result = classify_transaction(tx, factors)
        except Exception as exc:
            logger.error("Unexpected error classifying transaction %d: %s", i, exc)
            result = {
                "matched_factor": None,
                "confidence":     None,
                "status":         "factor_not_found",
                "notes":          f"Internal error during classification: {exc}",
                "quantity_hint":  None,
            }
        results.append(result)
    return results
