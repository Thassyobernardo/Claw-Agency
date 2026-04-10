"""
EcoLink Australia — FastAPI Application
Spend-to-Carbon Analysis Engine

Endpoints:
  POST /analyse          — classify transactions and return CO2e totals
  GET  /factors          — list available NGA emission factors
  GET  /factors/{id}     — get a single emission factor
  GET  /health           — health check

Run locally:
  uvicorn skills.spend_to_carbon_analyzer.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional
from uuid import UUID

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .calculator import aggregate_results, calculate_co2e
from .classifier import classify_batch
from .db import fetch_all_factors, fetch_factor_by_id, upsert_transactions
from .models import (
    AnalyseRequest,
    AnalyseResponse,
    CategorySummary,
    ClassificationStatus,
    ClassifiedTransaction,
    EmissionFactorSummary,
    ScopeSummary,
)

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ecolink.api")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="EcoLink Australia — Carbon Analysis API",
    description=(
        "Spend-to-Carbon AI engine for Australian SMEs. "
        "Classifies financial transactions against National Greenhouse Accounts (NGA) "
        "emission factors and returns kg CO2e totals by scope."
    ),
    version="1.0.0",
    contact={
        "name":  "EcoLink Australia",
        "email": "support@ecolink.com.au",
        "url":   "https://ecolink.com.au",
    },
    license_info={
        "name": "Proprietary",
    },
)

# CORS — Next.js frontend (localhost:3000 in dev, production domain in prod)
_allowed_origins = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:18789",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
def health_check() -> dict:
    return {
        "status":    "ok",
        "service":   "EcoLink Carbon Analysis API",
        "version":   "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


# ---------------------------------------------------------------------------
# Emission factors
# ---------------------------------------------------------------------------

@app.get("/factors", tags=["Emission Factors"])
def list_factors(
    nga_year: int           = Query(2024, description="NGA publication year."),
    scope:    Optional[int] = Query(None, ge=1, le=3, description="Filter by scope (1, 2 or 3)."),
    state:    Optional[str] = Query(None, description="Filter by Australian state for electricity factors."),
) -> dict:
    """
    List all available NGA emission factors.
    Optionally filter by scope or state.
    """
    try:
        factors = fetch_all_factors(nga_year=nga_year, state=state)
    except Exception as exc:
        logger.error("Failed to fetch emission factors: %s", exc)
        raise HTTPException(status_code=503, detail="Database unavailable.")

    if scope is not None:
        factors = [f for f in factors if f["scope"] == scope]

    return {
        "nga_year":     nga_year,
        "state_filter": state,
        "count":        len(factors),
        "factors": [
            {
                "id":           str(f["id"]),
                "scope":        f["scope"],
                "category":     f["category"],
                "subcategory":  f.get("subcategory"),
                "activity":     f["activity"],
                "unit":         f["unit"],
                "co2e_factor":  float(f["co2e_factor"]),
                "method":       f["calculation_method"],
                "state":        f.get("state"),
                "source_table": f.get("source_table"),
            }
            for f in factors
        ],
    }


@app.get("/factors/{factor_id}", tags=["Emission Factors"])
def get_factor(factor_id: UUID) -> dict:
    """Retrieve a single emission factor by UUID."""
    try:
        factor = fetch_factor_by_id(str(factor_id))
    except Exception as exc:
        logger.error("DB error fetching factor %s: %s", factor_id, exc)
        raise HTTPException(status_code=503, detail="Database unavailable.")

    if not factor:
        raise HTTPException(status_code=404, detail=f"Emission factor '{factor_id}' not found.")

    return {
        "id":          str(factor["id"]),
        "scope":       factor["scope"],
        "category":    factor["category"],
        "activity":    factor["activity"],
        "unit":        factor["unit"],
        "co2e_factor": float(factor["co2e_factor"]),
        "nga_year":    factor["nga_year"],
    }


# ---------------------------------------------------------------------------
# Core: Spend-to-Carbon Analysis
# ---------------------------------------------------------------------------

@app.post("/analyse", response_model=AnalyseResponse, tags=["Carbon Analysis"])
def analyse_transactions(body: AnalyseRequest) -> AnalyseResponse:
    """
    **Main endpoint** — Classify financial transactions and calculate CO2e emissions.

    Accepts an array of financial transactions (from Xero, MYOB, or manual entry)
    and returns:
    - Per-transaction classification result and kg CO2e figure
    - Aggregated totals by Scope 1 / 2 / 3
    - Breakdown by NGA emission category
    - Coverage quality metrics

    The engine uses a two-stage pipeline:
    1. Keyword pre-matching (fast, deterministic)
    2. Groq LLM classification (Gemini fallback)
    """
    logger.info(
        "Analyse request: company=%s, %d transactions, NGA year=%d, state=%s",
        body.company_id,
        len(body.transactions),
        body.nga_year,
        body.state,
    )

    # ── 1. Load emission factors from DB ─────────────────────────────────────
    try:
        factors = fetch_all_factors(nga_year=body.nga_year, state=body.state)
    except Exception as exc:
        logger.error("DB error loading factors: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Unable to load emission factors from database.",
        )

    if not factors:
        raise HTTPException(
            status_code=404,
            detail=f"No emission factors found for NGA year {body.nga_year}. "
                   "Run the database seed first.",
        )

    # ── 2. Classify transactions (AI) ────────────────────────────────────────
    tx_dicts = [tx.model_dump() for tx in body.transactions]
    classifications = classify_batch(tx_dicts, factors)

    # ── 3. Calculate CO2e for each transaction ───────────────────────────────
    enriched: list[dict] = []
    for tx_dict, clf in zip(tx_dicts, classifications):
        calc = calculate_co2e(tx_dict, clf)
        factor = clf.get("matched_factor")
        enriched.append({
            **tx_dict,
            "matched_factor":          factor,
            "classification_status":   clf["status"],
            "classification_confidence": clf.get("confidence"),
            "classification_notes":    clf.get("notes"),
            "emission_factor_id":      str(factor["id"]) if factor else None,
            "quantity_value":          calc.get("quantity_value"),
            "quantity_unit":           calc.get("quantity_unit"),
            "co2e_kg":                 calc.get("co2e_kg"),
            "scope":                   factor["scope"] if factor else None,
        })

    # ── 4. Persist to database (best-effort — don't fail the API if DB is down) ──
    try:
        saved = upsert_transactions(str(body.company_id), enriched)
        logger.info("Persisted %d transactions for company %s", saved, body.company_id)
    except Exception as exc:
        logger.warning("Non-fatal: failed to persist transactions: %s", exc)

    # ── 5. Aggregate totals ───────────────────────────────────────────────────
    aggregation = aggregate_results(enriched)
    scope_totals = aggregation["scope_totals"]
    total_co2e   = aggregation["total_co2e_kg"]

    # ── 6. Build response objects ─────────────────────────────────────────────
    classified_amount_aud = sum(
        tx["amount_aud"]
        for tx, e in zip(tx_dicts, enriched)
        if e["classification_status"] == "classified"
    )
    total_amount_aud = sum(tx["amount_aud"] for tx in tx_dicts)
    coverage_pct = (
        round(classified_amount_aud / total_amount_aud * 100, 1)
        if total_amount_aud > 0 else 0.0
    )

    results: list[ClassifiedTransaction] = []
    for e in enriched:
        factor = e.get("matched_factor")
        ef_summary: Optional[EmissionFactorSummary] = None
        if factor:
            ef_summary = EmissionFactorSummary(
                factor_id   = factor["id"],
                activity    = factor["activity"],
                category    = factor["category"],
                scope       = factor["scope"],
                unit        = factor["unit"],
                co2e_factor = float(factor["co2e_factor"]),
                nga_year    = factor.get("nga_year", body.nga_year),
                method      = factor.get("calculation_method", "spend_based"),
            )

        results.append(
            ClassifiedTransaction(
                description             = e["description"],
                amount_aud              = e["amount_aud"],
                transaction_date        = e["transaction_date"],
                supplier_name           = e.get("supplier_name"),
                external_id             = e.get("external_id"),
                status                  = ClassificationStatus(e["classification_status"]),
                confidence              = e.get("classification_confidence"),
                classification_notes    = e.get("classification_notes"),
                emission_factor         = ef_summary,
                quantity_value          = e.get("quantity_value"),
                quantity_unit           = e.get("quantity_unit"),
                co2e_kg                 = e.get("co2e_kg"),
                scope                   = e.get("scope"),
            )
        )

    # Scope summary
    by_scope: list[ScopeSummary] = []
    for s in [1, 2, 3]:
        co2e = scope_totals.get(s, 0.0)
        count = sum(1 for e in enriched if e.get("scope") == s and e.get("co2e_kg"))
        pct = round(co2e / total_co2e * 100, 1) if total_co2e > 0 else 0.0
        by_scope.append(ScopeSummary(scope=s, co2e_kg=co2e, tx_count=count, percentage=pct))

    # Category summary
    by_category: list[CategorySummary] = [
        CategorySummary(
            category  = c["category"],
            scope     = c["scope"],
            co2e_kg   = c["co2e_kg"],
            tx_count  = c["tx_count"],
        )
        for c in aggregation["by_category"]
    ]

    # Status counts
    status_counts = {s.value: 0 for s in ClassificationStatus}
    for e in enriched:
        status_counts[e["classification_status"]] = (
            status_counts.get(e["classification_status"], 0) + 1
        )

    return AnalyseResponse(
        company_id              = body.company_id,
        nga_year                = body.nga_year,
        state                   = body.state,
        results                 = results,
        total_co2e_kg           = total_co2e,
        total_scope1_co2e_kg    = scope_totals.get(1, 0.0),
        total_scope2_co2e_kg    = scope_totals.get(2, 0.0),
        total_scope3_co2e_kg    = scope_totals.get(3, 0.0),
        by_scope                = by_scope,
        by_category             = by_category,
        total_transactions      = len(enriched),
        classified_count        = status_counts.get("classified", 0),
        needs_review_count      = status_counts.get("needs_review", 0),
        factor_not_found_count  = status_counts.get("factor_not_found", 0),
        coverage_pct            = coverage_pct,
    )
