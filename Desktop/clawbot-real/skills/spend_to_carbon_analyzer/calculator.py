"""
EcoLink Australia — CO2e Calculator.

Applies NGA emission factors to classified transactions and
computes final kg CO2e values.

Two calculation methods are supported:
  - activity_based : quantity × co2e_factor  (e.g. 62.5 L petrol × 2.289 = 143.1 kg CO2e)
  - spend_based    : amount_aud × co2e_factor (e.g. $150 × 0.00185 = 0.278 kg CO2e)

For activity_based factors, the calculator tries to extract a quantity from:
  1. Explicit quantity_hint from the AI classifier.
  2. Heuristic parsing of the transaction description (e.g. "62.5L").
  3. Falls back to spend_based if no quantity can be determined.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger("ecolink.calculator")

# ---------------------------------------------------------------------------
# Unit extractors — heuristics for common Australian transaction descriptions
# ---------------------------------------------------------------------------

# Patterns: match quantities like "62.5L", "62.5 litres", "200 kWh", etc.
_QUANTITY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:litre|liter|litres|liters|L\b)", re.I), "L"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:kWh|kilowatt.hour)", re.I),             "kWh"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:GJ|gigajoule)", re.I),                  "GJ"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:km|kilometre|kilometer)", re.I),         "km"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:tonne|ton\b)", re.I),                   "tonne"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:kL|kilolitre)", re.I),                  "kL"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:kg\b)", re.I),                          "kg"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:m3|cubic metre|cubic meter)", re.I),    "m3"),
]


def _extract_quantity_from_description(
    description: str,
    expected_unit: str,
) -> Optional[float]:
    """
    Attempt to extract a numeric quantity from the transaction description
    for the given expected unit.
    """
    for pattern, unit in _QUANTITY_PATTERNS:
        if unit.lower() != expected_unit.lower():
            continue
        match = pattern.search(description)
        if match:
            return float(match.group(1))
    return None


def _estimate_fuel_litres_from_spend(amount_aud: float, fuel_type: str) -> Optional[float]:
    """
    Rough estimate of fuel volume from spend, based on Australian average pump prices.
    Used only when no explicit quantity is available.
    """
    # Average Australian pump prices (approximate, AUD/L)
    price_per_litre = {
        "petrol":  2.10,
        "diesel":  2.20,
        "lpg":     0.90,
    }
    key = fuel_type.lower()
    for fuel_key, price in price_per_litre.items():
        if fuel_key in key:
            return round(amount_aud / price, 2)
    return None


# ---------------------------------------------------------------------------
# Main calculation function
# ---------------------------------------------------------------------------

def calculate_co2e(
    transaction: dict,
    classification: dict,
) -> dict:
    """
    Compute the CO2e emission for a single classified transaction.

    Parameters
    ----------
    transaction    : dict — the input transaction (from AnalyseRequest)
    classification : dict — result from classifier.classify_transaction()

    Returns
    -------
    dict with keys:
        co2e_kg         : float | None
        quantity_value  : float | None
        quantity_unit   : str   | None
        calculation_method_used : str
        notes           : str | None  (appended to classification notes)
    """
    calc_result = {
        "co2e_kg":                  None,
        "quantity_value":           None,
        "quantity_unit":            None,
        "calculation_method_used":  "none",
        "calc_notes":               None,
    }

    factor = classification.get("matched_factor")
    if not factor:
        return calc_result

    co2e_per_unit: float       = float(factor["co2e_factor"])
    factor_unit: str           = factor["unit"]
    method: str                = factor.get("calculation_method", "spend_based")
    description: str           = transaction.get("description", "")
    amount_aud: float          = float(transaction.get("amount_aud", 0))
    qty_hint: dict             = classification.get("quantity_hint") or {}

    # ── A. Activity-based calculation ────────────────────────────────────────
    if method == "activity_based":
        quantity: Optional[float] = None

        # Priority 1: explicit quantity from transaction input
        if transaction.get("quantity_value") and transaction.get("quantity_unit"):
            if transaction["quantity_unit"].lower() == factor_unit.lower():
                quantity = float(transaction["quantity_value"])
                source = "input"

        # Priority 2: quantity hint from AI classifier
        if quantity is None and qty_hint.get("value") and qty_hint.get("unit"):
            if str(qty_hint["unit"]).lower() == factor_unit.lower():
                quantity = float(qty_hint["value"])
                source = "ai_hint"

        # Priority 3: heuristic extraction from description
        if quantity is None:
            quantity = _extract_quantity_from_description(description, factor_unit)
            if quantity:
                source = "description_parse"

        # Priority 4: estimate litres from spend for fuel transactions
        if quantity is None and factor_unit == "L":
            quantity = _estimate_fuel_litres_from_spend(amount_aud, factor.get("activity", ""))
            if quantity:
                source = "spend_estimate"

        # Priority 5: fall back to spend-based if quantity unavailable
        if quantity is None:
            logger.debug(
                "Activity-based factor '%s' has no quantity — falling back to spend-based.",
                factor["activity"],
            )
            co2e_kg = round(amount_aud * co2e_per_unit, 4)
            calc_result.update({
                "co2e_kg":                 co2e_kg,
                "quantity_value":          amount_aud,
                "quantity_unit":           "AUD",
                "calculation_method_used": "spend_based_fallback",
                "calc_notes": (
                    f"Activity-based factor applied via spend fallback. "
                    f"${amount_aud:.2f} AUD × {co2e_per_unit} kg CO2e/AUD = {co2e_kg:.4f} kg CO2e. "
                    f"Provide quantity in {factor_unit} for a more accurate result."
                ),
            })
            return calc_result

        # Activity-based calculation
        co2e_kg = round(quantity * co2e_per_unit, 4)
        calc_result.update({
            "co2e_kg":                 co2e_kg,
            "quantity_value":          quantity,
            "quantity_unit":           factor_unit,
            "calculation_method_used": f"activity_based ({source})",
            "calc_notes": (
                f"{quantity} {factor_unit} × {co2e_per_unit} kg CO2e/{factor_unit} "
                f"= {co2e_kg:.4f} kg CO2e "
                f"[NGA factor: {factor.get('activity')}, source: {source}]"
            ),
        })
        return calc_result

    # ── B. Spend-based calculation ────────────────────────────────────────────
    if method in ("spend_based", "hybrid"):
        co2e_kg = round(amount_aud * co2e_per_unit, 4)
        calc_result.update({
            "co2e_kg":                 co2e_kg,
            "quantity_value":          amount_aud,
            "quantity_unit":           "AUD",
            "calculation_method_used": "spend_based",
            "calc_notes": (
                f"${amount_aud:.2f} AUD × {co2e_per_unit} kg CO2e/AUD "
                f"= {co2e_kg:.4f} kg CO2e "
                f"[NGA factor: {factor.get('activity')}]"
            ),
        })
        return calc_result

    # Fallback — unknown method
    calc_result["calc_notes"] = f"Unknown calculation method '{method}' — skipped."
    return calc_result


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def aggregate_results(
    classified_transactions: list[dict],
) -> dict:
    """
    Aggregate CO2e totals by scope and by NGA category.

    Returns:
        total_co2e_kg   : float
        scope_totals    : dict { 1: float, 2: float, 3: float }
        by_category     : list[dict] { category, scope, co2e_kg, tx_count }
    """
    scope_totals: dict[int, float]          = {1: 0.0, 2: 0.0, 3: 0.0}
    category_map: dict[tuple, dict]         = {}

    for tx in classified_transactions:
        co2e = tx.get("co2e_kg") or 0.0
        scope = tx.get("scope")
        factor = tx.get("matched_factor")

        if co2e <= 0 or scope is None:
            continue

        scope_totals[scope] = scope_totals.get(scope, 0.0) + co2e

        if factor:
            key = (factor.get("category", "Uncategorised"), scope)
            if key not in category_map:
                category_map[key] = {
                    "category": key[0],
                    "scope":    scope,
                    "co2e_kg":  0.0,
                    "tx_count": 0,
                }
            category_map[key]["co2e_kg"]  += co2e
            category_map[key]["tx_count"] += 1

    total = sum(scope_totals.values())

    return {
        "total_co2e_kg": round(total, 4),
        "scope_totals":  {k: round(v, 4) for k, v in scope_totals.items()},
        "by_category":   [
            {**v, "co2e_kg": round(v["co2e_kg"], 4)}
            for v in sorted(category_map.values(), key=lambda x: -x["co2e_kg"])
        ],
    }
