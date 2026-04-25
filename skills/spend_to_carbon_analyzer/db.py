"""
EcoLink Australia — Database layer for the Spend-to-Carbon analyser.
Uses psycopg2 (synchronous) wrapped in a simple connection pool helper.
"""

from __future__ import annotations

import os
import logging
from contextlib import contextmanager
from typing import Generator, Optional

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

logger = logging.getLogger("ecolink.db")

# ---------------------------------------------------------------------------
# Connection pool (lazy-initialised on first request)
# ---------------------------------------------------------------------------
_pool: Optional[ThreadedConnectionPool] = None


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL environment variable is not set.")
        _pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=database_url,
            sslmode="require",
        )
        logger.info("PostgreSQL connection pool initialised.")
    return _pool


@contextmanager
def get_cursor() -> Generator[psycopg2.extensions.cursor, None, None]:
    """Yield a dict-cursor, auto-commit on success, rollback on error."""
    pool = _get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


# ---------------------------------------------------------------------------
# Emission factor queries
# ---------------------------------------------------------------------------

def fetch_all_factors(nga_year: int, state: Optional[str] = None) -> list[dict]:
    """
    Load ALL emission factors for a given NGA year.
    The AI classifier uses these as its knowledge base.
    State-specific electricity factors are included when state is provided;
    otherwise the national average is excluded (to avoid misuse).
    """
    with get_cursor() as cur:
        if state:
            cur.execute(
                """
                SELECT
                    id, scope, category, subcategory, activity,
                    unit, calculation_method, co2e_factor,
                    match_keywords, state, state_specific,
                    source_table
                FROM emission_factors
                WHERE nga_year = %s
                  AND is_current = TRUE
                  AND (state IS NULL OR state = %s)
                ORDER BY scope, category, activity
                """,
                (nga_year, state),
            )
        else:
            cur.execute(
                """
                SELECT
                    id, scope, category, subcategory, activity,
                    unit, calculation_method, co2e_factor,
                    match_keywords, state, state_specific,
                    source_table
                FROM emission_factors
                WHERE nga_year = %s
                  AND is_current = TRUE
                  AND state_specific = FALSE
                ORDER BY scope, category, activity
                """,
                (nga_year,),
            )
        return [dict(row) for row in cur.fetchall()]


def fetch_factor_by_id(factor_id: str) -> Optional[dict]:
    """Fetch a single emission factor by UUID."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, scope, category, subcategory, activity,
                   unit, calculation_method, co2e_factor, nga_year
            FROM emission_factors
            WHERE id = %s
            """,
            (factor_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


# ---------------------------------------------------------------------------
# Transaction persistence
# ---------------------------------------------------------------------------

def upsert_transactions(
    company_id: str,
    classified: list[dict],
) -> int:
    """
    Insert or update classified transactions in the database.
    Returns the number of rows affected.
    """
    if not classified:
        return 0

    rows_affected = 0
    with get_cursor() as cur:
        for tx in classified:
            cur.execute(
                """
                INSERT INTO transactions (
                    company_id, source, external_id,
                    transaction_date, description, supplier_name,
                    amount_aud, account_code, account_name,
                    emission_factor_id, classification_status,
                    classification_confidence, classification_notes,
                    classified_at, classified_by,
                    quantity_value, quantity_unit,
                    co2e_kg, scope
                )
                VALUES (
                    %(company_id)s, %(source)s, %(external_id)s,
                    %(transaction_date)s, %(description)s, %(supplier_name)s,
                    %(amount_aud)s, %(account_code)s, %(account_name)s,
                    %(emission_factor_id)s, %(classification_status)s,
                    %(classification_confidence)s, %(classification_notes)s,
                    NOW(), 'ai',
                    %(quantity_value)s, %(quantity_unit)s,
                    %(co2e_kg)s, %(scope)s
                )
                ON CONFLICT (company_id, source, external_id)
                    WHERE external_id IS NOT NULL
                DO UPDATE SET
                    emission_factor_id       = EXCLUDED.emission_factor_id,
                    classification_status    = EXCLUDED.classification_status,
                    classification_confidence= EXCLUDED.classification_confidence,
                    classification_notes     = EXCLUDED.classification_notes,
                    classified_at            = NOW(),
                    quantity_value           = EXCLUDED.quantity_value,
                    quantity_unit            = EXCLUDED.quantity_unit,
                    co2e_kg                  = EXCLUDED.co2e_kg,
                    scope                    = EXCLUDED.scope,
                    updated_at               = NOW()
                """,
                {
                    "company_id":              company_id,
                    "source":                  tx.get("source", "manual"),
                    "external_id":             tx.get("external_id"),
                    "transaction_date":        tx["transaction_date"],
                    "description":             tx["description"],
                    "supplier_name":           tx.get("supplier_name"),
                    "amount_aud":              tx["amount_aud"],
                    "account_code":            tx.get("account_code"),
                    "account_name":            tx.get("account_name"),
                    "emission_factor_id":      tx.get("emission_factor_id"),
                    "classification_status":   tx["classification_status"],
                    "classification_confidence": tx.get("classification_confidence"),
                    "classification_notes":    tx.get("classification_notes"),
                    "quantity_value":          tx.get("quantity_value"),
                    "quantity_unit":           tx.get("quantity_unit"),
                    "co2e_kg":                 tx.get("co2e_kg"),
                    "scope":                   tx.get("scope"),
                },
            )
            rows_affected += cur.rowcount

    return rows_affected
