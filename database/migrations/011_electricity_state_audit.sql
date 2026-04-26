-- =============================================================================
-- Migration 011 — Per-transaction electricity state audit trail
--
-- Why: AASB S2 / NGER requires Scope 2 emissions to be calculated using the
-- LOCATION-BASED grid factor for the Australian state where electricity was
-- consumed. NGA Factors 2023-24 publishes 8 state-level factors (NSW, VIC,
-- QLD, SA, WA, TAS, ACT, NT) with up to 5x variance between TAS (low) and
-- VIC (high).
--
-- Without recording WHICH state was used per electricity transaction,
-- the report cannot be audited and the company cannot withstand AUASB GS 100
-- limited assurance.
--
-- Scope:
--   1. Add transactions.electricity_state to record which state factor applied.
--   2. Add a CHECK constraint mirroring companies.state and emission_factors.state.
--   3. Add an exclusion flag with reason for personal/out-of-period transactions.
--   4. Add a reporting_period_start / reporting_period_end pair on companies so
--      we can reject transactions outside the declared FY.
-- =============================================================================

-- ── 1. Per-transaction electricity state ─────────────────────────────────────
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS electricity_state TEXT
        CHECK (electricity_state IN ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT'));

COMMENT ON COLUMN transactions.electricity_state IS
    'Australian state whose grid factor (NGA Table 6) was applied to compute co2e_kg. Required for Scope 2 transactions; NULL otherwise.';

-- ── 2. Exclusion flag — for personal expenses or out-of-period transactions ──
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS excluded BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS exclusion_reason TEXT
        CHECK (exclusion_reason IN (
            'personal_expense',          -- not under operational control
            'outside_reporting_period',  -- before/after FY
            'duplicate',                 -- imported twice
            'not_emission_relevant',     -- e.g., bank fee, interest, GST refund
            'manual_review_excluded'     -- user marked as out-of-scope
        ));

CREATE INDEX IF NOT EXISTS idx_tx_excluded
    ON transactions (company_id, excluded)
    WHERE excluded = TRUE;

-- ── 3. Reporting period on companies ─────────────────────────────────────────
-- AASB S2 mandates the report covers a defined annual reporting period.
-- For Australia, default FY is 1 July → 30 June. Companies can override.
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS reporting_period_start DATE,
    ADD COLUMN IF NOT EXISTS reporting_period_end   DATE,
    ADD CONSTRAINT companies_reporting_period_check
        CHECK (reporting_period_end IS NULL OR reporting_period_start IS NULL
               OR reporting_period_end > reporting_period_start);

-- Backfill: set FY 2023-24 (1 July 2023 → 30 June 2024) for existing companies.
UPDATE companies
SET    reporting_period_start = DATE '2023-07-01',
       reporting_period_end   = DATE '2024-06-30'
WHERE  reporting_period_start IS NULL;

-- ── 4. Companies: mark whether independent assurance has been obtained ──────
-- AASB S2 / AUASB GS 100. Required disclosure on the report cover.
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS assurance_status TEXT NOT NULL DEFAULT 'none'
        CHECK (assurance_status IN ('none', 'limited', 'reasonable')),
    ADD COLUMN IF NOT EXISTS assurance_provider     TEXT,    -- audit firm name
    ADD COLUMN IF NOT EXISTS assurance_asic_reg     TEXT,    -- ASIC company auditor number
    ADD COLUMN IF NOT EXISTS assurance_standard     TEXT DEFAULT 'AUASB GS 100',
    ADD COLUMN IF NOT EXISTS assurance_obtained_at  DATE;

-- ── 5. Refresh the updated_at trigger so all the new columns track changes ──
-- (uses existing trigger, no change needed if companies already has one)
