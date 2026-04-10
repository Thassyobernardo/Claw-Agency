"""
EcoLink Australia — Pydantic models for the Spend-to-Carbon API.
All monetary values are AUD. All emission values are kg CO2e.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ClassificationStatus(str, Enum):
    PENDING          = "pending"
    CLASSIFIED       = "classified"
    NEEDS_REVIEW     = "needs_review"
    FACTOR_NOT_FOUND = "factor_not_found"
    EXCLUDED         = "excluded"


class CalculationMethod(str, Enum):
    ACTIVITY_BASED = "activity_based"
    SPEND_BASED    = "spend_based"
    HYBRID         = "hybrid"


class EmissionScope(int, Enum):
    SCOPE_1 = 1
    SCOPE_2 = 2
    SCOPE_3 = 3


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------

class TransactionInput(BaseModel):
    """A single financial transaction to be classified and measured."""

    # Required
    description: str = Field(
        ...,
        min_length=2,
        max_length=500,
        examples=["BP Station Sydney - Petrol $150.00"],
    )
    amount_aud: float = Field(
        ...,
        gt=0,
        description="Transaction amount in Australian dollars (excl. GST preferred).",
        examples=[150.00],
    )
    transaction_date: date = Field(
        ...,
        examples=["2024-07-15"],
    )

    # Optional — enriches classification accuracy
    supplier_name: Optional[str] = Field(None, max_length=200, examples=["BP Australia"])
    account_code:  Optional[str] = Field(None, max_length=50,  examples=["6-1200"])
    account_name:  Optional[str] = Field(None, max_length=200, examples=["Motor Vehicle Expenses"])
    external_id:   Optional[str] = Field(None, max_length=100, description="ID from source system (Xero, MYOB).")

    # Optional hint from source system
    quantity_value: Optional[float] = Field(None, gt=0, examples=[62.5])
    quantity_unit:  Optional[str]   = Field(None, max_length=20, examples=["L"])

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        return v.strip()


class AnalyseRequest(BaseModel):
    """Request body for POST /analyse."""

    company_id: UUID = Field(..., description="EcoLink company UUID.")
    transactions: list[TransactionInput] = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Array of financial transactions to classify and measure.",
    )
    nga_year: int = Field(
        2024,
        description="NGA Factors publication year to use (default: 2024 = 2023–24 edition).",
    )
    state: Optional[str] = Field(
        None,
        description="Australian state for state-specific electricity factors (NSW, VIC, QLD, etc.).",
        pattern=r"^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$",
    )


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------

class EmissionFactorSummary(BaseModel):
    """Snapshot of the matched emission factor — returned in results."""
    factor_id:   UUID
    activity:    str
    category:    str
    scope:       int
    unit:        str
    co2e_factor: float
    nga_year:    int
    method:      CalculationMethod


class ClassifiedTransaction(BaseModel):
    """Result for a single classified transaction."""

    # Echo inputs
    description:      str
    amount_aud:       float
    transaction_date: date
    supplier_name:    Optional[str]
    external_id:      Optional[str]

    # Classification result
    status:                  ClassificationStatus
    confidence:              Optional[float] = Field(None, ge=0, le=1)
    classification_notes:    Optional[str]

    # Matched factor
    emission_factor:         Optional[EmissionFactorSummary]

    # Quantities used in calculation
    quantity_value:          Optional[float]
    quantity_unit:           Optional[str]

    # Calculated emissions
    co2e_kg:                 Optional[float] = Field(None, description="kg CO2e for this transaction.")
    scope:                   Optional[int]


class ScopeSummary(BaseModel):
    """Emission totals grouped by scope."""
    scope:      int
    co2e_kg:    float
    tx_count:   int
    percentage: float


class CategorySummary(BaseModel):
    """Emission totals grouped by NGA category."""
    category:   str
    scope:      int
    co2e_kg:    float
    tx_count:   int


class AnalyseResponse(BaseModel):
    """Response from POST /analyse."""

    company_id:             UUID
    nga_year:               int
    state:                  Optional[str]

    # Per-transaction results
    results:                list[ClassifiedTransaction]

    # Aggregated totals
    total_co2e_kg:          float
    total_scope1_co2e_kg:   float
    total_scope2_co2e_kg:   float
    total_scope3_co2e_kg:   float

    # Breakdowns
    by_scope:               list[ScopeSummary]
    by_category:            list[CategorySummary]

    # Quality metrics
    total_transactions:     int
    classified_count:       int
    needs_review_count:     int
    factor_not_found_count: int
    coverage_pct:           float = Field(
        ..., description="Percentage of total AUD spend successfully classified."
    )
