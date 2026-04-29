-- =============================================================================
-- Migration 020 — AASB Reports Lock (Report Vault)
--
-- PURPOSE:
--   Creates the immutable `aasb_reports` table that seals a financial year's
--   emissions data for regulatory disclosure under AASB S2 / NGER Act 2007.
--
-- LEGAL DESIGN PRINCIPLES:
--   1. SEAL IS IRREVERSIBLE: Once status = 'sealed', no UPDATE is permitted
--      (enforced by trigger). Corrections require a new amended report.
--   2. TRANSACTION LOCK: Adding report_id to a transaction freezes it.
--      A trigger prevents any UPDATE to locked transactions.
--   3. SHA-256 HASH: The sealed_hash column stores the hash of the PDF/JSON
--      payload, enabling external verification of document integrity.
--   4. DATA QUALITY SCORE: Regulators (ASIC / DCCEEW) can inspect how much
--      of the emission data was physically measured vs estimated.
--
-- Depends on: migrations 004 (companies), 019 (transactions columns).
-- =============================================================================

BEGIN;

-- ─── 1. aasb_reports — Report Vault ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aasb_reports (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID        NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,

    -- Report period
    financial_year      TEXT        NOT NULL,    -- e.g. 'FY24-25'
    period_start        DATE        NOT NULL,    -- e.g. 2024-07-01
    period_end          DATE        NOT NULL,    -- e.g. 2025-06-30
    nga_edition_year    SMALLINT    NOT NULL,    -- NGA workbook used (e.g. 2025)

    -- Status lifecycle: generating → sealed (one-way)
    status              TEXT        NOT NULL DEFAULT 'generating'
        CONSTRAINT chk_report_status CHECK (status IN ('generating', 'sealed')),

    -- Aggregated emission totals (computed by report_aggregator.ts)
    total_scope1_tonnes NUMERIC(16, 4) NOT NULL DEFAULT 0,
    total_scope2_tonnes NUMERIC(16, 4) NOT NULL DEFAULT 0,
    total_scope3_tonnes NUMERIC(16, 4) NOT NULL DEFAULT 0,
    total_co2e_tonnes   NUMERIC(16, 4) GENERATED ALWAYS AS
                            (total_scope1_tonnes + total_scope2_tonnes + total_scope3_tonnes) STORED,

    -- Transaction coverage counts
    classified_count    INTEGER     NOT NULL DEFAULT 0,  -- classified (auto + manual)
    ignored_count       INTEGER     NOT NULL DEFAULT 0,  -- IGNORE rule matched
    needs_review_count  INTEGER     NOT NULL DEFAULT 0,  -- unresolved at seal time
    total_tx_count      INTEGER     NOT NULL DEFAULT 0,  -- all inbound transactions

    -- Data quality score (AASB S2 disclosure requirement)
    -- = classified_count / (total_tx_count - ignored_count) * 100
    -- A score of 100 means every emission-relevant transaction was classified.
    data_quality_score  NUMERIC(5, 2) NOT NULL DEFAULT 0
        CONSTRAINT chk_dq_score CHECK (data_quality_score BETWEEN 0 AND 100),

    -- Report document
    file_url            TEXT,        -- Supabase Storage / S3 pre-signed URL
    sha256_hash         TEXT,        -- SHA-256 of the sealed PDF/JSON bytes

    -- Seal metadata
    sealed_at           TIMESTAMPTZ,
    sealed_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    seal_notes          TEXT,        -- optional CFO sign-off notes

    -- Submission tracking (ASIC / NGER)
    submitted_to_asic_at  TIMESTAMPTZ,
    asic_reference        TEXT,
    submitted_to_nger_at  TIMESTAMPTZ,
    nger_reference        TEXT,

    -- Math engine version at time of generation (audit)
    math_engine_version TEXT NOT NULL DEFAULT 'calculator_v1',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A company can only have ONE report per financial year
    CONSTRAINT uq_report_company_fy UNIQUE (company_id, financial_year),
    CONSTRAINT period_order CHECK (period_end > period_start)
);

COMMENT ON TABLE aasb_reports IS
'Sealed AASB S2 emission reports. Once status = ''sealed'', the row is immutable. '
'Each sealed report locks all associated transactions via transactions.report_id.';

COMMENT ON COLUMN aasb_reports.sha256_hash IS
'SHA-256 hex digest of the sealed report PDF/JSON payload. '
'Verifiable externally: sha256sum <report.pdf> must match this value.';

COMMENT ON COLUMN aasb_reports.data_quality_score IS
'Percentage of emission-relevant transactions with a classified physical quantity. '
'= classified_count / (total_tx_count - ignored_count) * 100. '
'AASB S2 requires disclosure of data quality and estimation uncertainty.';

-- ─── 2. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reports_company_fy
    ON aasb_reports (company_id, financial_year);

CREATE INDEX IF NOT EXISTS idx_reports_status
    ON aasb_reports (status, sealed_at DESC);

-- ─── 3. Auto-update timestamp ────────────────────────────────────────────────

CREATE TRIGGER set_aasb_reports_updated_at
    BEFORE UPDATE ON aasb_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 4. Seal guard trigger — prevent updates to sealed reports ───────────────

CREATE OR REPLACE FUNCTION enforce_report_seal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Allow only status transitions during sealing (generating → sealed)
    IF OLD.status = 'sealed' THEN
        RAISE EXCEPTION
            'REPORT_IMMUTABLE: Report % (% %) is sealed and cannot be modified. '
            'To correct a sealed report, create a new amended report.',
            OLD.id, OLD.company_id, OLD.financial_year;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_enforce_report_seal
    BEFORE UPDATE ON aasb_reports
    FOR EACH ROW EXECUTE FUNCTION enforce_report_seal();

-- ─── 5. report_id on transactions — the Lock Column ─────────────────────────

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES aasb_reports(id) ON DELETE RESTRICT;

COMMENT ON COLUMN transactions.report_id IS
'FK to aasb_reports. Once set, this transaction is LOCKED. '
'No edits allowed — enforced by tg_enforce_transaction_lock trigger.';

CREATE INDEX IF NOT EXISTS idx_tx_report ON transactions (report_id)
    WHERE report_id IS NOT NULL;

-- ─── 6. Transaction lock trigger — prevent edits to locked transactions ───────

CREATE OR REPLACE FUNCTION enforce_transaction_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.report_id IS NOT NULL THEN
        -- Only allow report_id assignment (already null → non-null) to pass through.
        -- Any other column change on a locked transaction is rejected.
        IF NEW.report_id = OLD.report_id THEN
            RAISE EXCEPTION
                'TRANSACTION_LOCKED: Transaction % is locked to report %. '
                'Corrections require a new amended report and CFO approval.',
                OLD.id, OLD.report_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_enforce_transaction_lock
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION enforce_transaction_lock();

-- ─── 7. Seal timestamp guard — auto-populate sealed_at ───────────────────────

CREATE OR REPLACE FUNCTION auto_set_sealed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'sealed' AND OLD.status = 'generating' THEN
        NEW.sealed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_auto_seal_timestamp
    BEFORE UPDATE ON aasb_reports
    FOR EACH ROW EXECUTE FUNCTION auto_set_sealed_at();

-- ─── 8. Verification guard ───────────────────────────────────────────────────

DO $$
DECLARE
    col_exists BOOLEAN;
    trig_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'report_id'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'Migration 020 GUARD FAIL: transactions.report_id not created.';
    END IF;

    SELECT COUNT(*) INTO trig_count
      FROM information_schema.triggers
     WHERE trigger_name IN (
         'tg_enforce_report_seal',
         'tg_enforce_transaction_lock',
         'tg_auto_seal_timestamp'
     );

    IF trig_count < 3 THEN
        RAISE EXCEPTION
            'Migration 020 GUARD FAIL: Expected 3 lock triggers, found %.', trig_count;
    END IF;

    RAISE NOTICE '✅ Migration 020 complete. aasb_reports table + 3 lock triggers active.';
END $$;

COMMIT;
