-- =============================================================================
-- Migration 015 — NGA edition selector + reporting frequency
--
-- Why:
--   1. The NGA Factors workbook is published ANNUALLY (each August). At any
--      time, multiple editions are valid for different reporting periods:
--        - NGA 2024 Workbook → reports for FY 2023-24 (lodged Oct 2024)
--        - NGA 2025 Workbook → reports for FY 2024-25 (lodged Oct 2025)
--        - NGA 2026 Workbook → reports for FY 2025-26 (lodged Oct 2026)
--      Each company picks WHICH workbook applies to their reporting period.
--
--   2. Today the system assumes one annual report per company. But CFOs
--      want to MONITOR emissions continuously (daily/weekly) to avoid
--      surprise spikes. Reporting frequency is now a per-company setting
--      that drives the dashboard period comparison + email digests.
-- =============================================================================

-- ── 1. NGA edition the company is reporting under ───────────────────────────
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS nga_edition_year SMALLINT NOT NULL DEFAULT 2024
        CHECK (nga_edition_year BETWEEN 2020 AND 2050);

COMMENT ON COLUMN companies.nga_edition_year IS
'Which NGA Factors workbook edition applies to the company''s reporting period. The classifier looks up emission_factors WHERE nga_year = this value AND is_current = TRUE.';

-- ── 2. Reporting frequency for dashboard rollups + email digests ─────────────
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS reporting_frequency TEXT NOT NULL DEFAULT 'annual'
        CHECK (reporting_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual'));

COMMENT ON COLUMN companies.reporting_frequency IS
'How often the company reviews/closes its emission reporting period. Drives dashboard "current period vs previous period" comparison and scheduled email digest cadence.';

-- ── 3. Email digest preference ───────────────────────────────────────────────
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS digest_recipients TEXT[];   -- emails of stakeholders

-- ── 4. Period snapshots — store closed periods for historical comparison ────
-- When a reporting period closes (e.g. end of week / month / quarter),
-- write a row here to freeze the totals. The dashboard reads from this for
-- "how am I doing this period vs last period" charts without recomputing.
CREATE TABLE IF NOT EXISTS reporting_period_snapshots (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id               UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,

    period_start             DATE NOT NULL,
    period_end               DATE NOT NULL,
    frequency                TEXT NOT NULL
        CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual')),

    -- Snapshot of emissions at close time
    nga_edition_year         SMALLINT NOT NULL,
    scope1_co2e_kg           NUMERIC(14, 4) NOT NULL DEFAULT 0,
    scope2_co2e_kg           NUMERIC(14, 4) NOT NULL DEFAULT 0,
    scope3_co2e_kg           NUMERIC(14, 4) NOT NULL DEFAULT 0,
    total_co2e_kg            NUMERIC(14, 4) NOT NULL DEFAULT 0,
    transaction_count        INTEGER NOT NULL DEFAULT 0,
    excluded_count           INTEGER NOT NULL DEFAULT 0,

    -- Submission tracking
    pdf_generated_at         TIMESTAMP WITH TIME ZONE,
    submitted_to_asic_at     TIMESTAMP WITH TIME ZONE,    -- when filed with ASIC
    submitted_to_nger_at     TIMESTAMP WITH TIME ZONE,    -- when filed via EERS
    submission_reference     TEXT,                         -- ASIC lodgement / NGER ref
    submitted_by_user_id     UUID REFERENCES users (id) ON DELETE SET NULL,

    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT period_dates_check CHECK (period_end > period_start),
    UNIQUE (company_id, period_start, period_end, frequency)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_company_period
    ON reporting_period_snapshots (company_id, period_end DESC);
