-- =============================================================================
-- Migration 019 — Transactions v2: math engine columns + audit log table
--
-- PURPOSE:
--   Adds columns required by the /api/transactions/review route (route.ts)
--   that did not exist in the original transactions table:
--     - scope1_co2e_kg, scope2_co2e_kg, scope3_co2e_kg (granular scopes)
--     - math_engine_version (which calculator version computed the result)
--     - classification_notes (auditTrail string from calculator.ts)
--     - classified_at (timestamp of classification)
--
--   Also creates `transaction_audit_log` — immutable INSERT-only table
--   required by AASB S2 for manual override traceability.
--
-- Safe to re-run: all DDL uses IF NOT EXISTS / IF NOT EXIST guards.
-- =============================================================================

BEGIN;

-- ─── 1. Granular scope columns on transactions ───────────────────────────────
-- Extends the existing co2e_kg column with per-scope breakdowns.
-- Required for AASB S2 Scope 1 / 2 / 3 disclosure.

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS scope1_co2e_kg      NUMERIC(14, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scope2_co2e_kg      NUMERIC(14, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scope3_co2e_kg      NUMERIC(14, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS math_engine_version TEXT           NOT NULL DEFAULT 'calculator_v1',
    ADD COLUMN IF NOT EXISTS classification_notes TEXT,
    ADD COLUMN IF NOT EXISTS classified_at       TIMESTAMPTZ;

COMMENT ON COLUMN transactions.scope1_co2e_kg IS
'Direct (Scope 1) emissions in kg CO2e computed by calculator.ts. NOT editable after report lock.';
COMMENT ON COLUMN transactions.scope2_co2e_kg IS
'Purchased electricity (Scope 2) emissions in kg CO2e. Location-based, NGA 2025 Table 5.';
COMMENT ON COLUMN transactions.scope3_co2e_kg IS
'Upstream lifecycle (Scope 3) emissions in kg CO2e. Sum of fuel upstream + value chain.';
COMMENT ON COLUMN transactions.math_engine_version IS
'calculator.ts version that produced this result. Enables regression detection post-upgrade.';
COMMENT ON COLUMN transactions.classification_notes IS
'Verbatim auditTrail string from calculator.ts. Must be preserved for AASB S2 audit.';

-- ─── 2. transaction_audit_log — immutable event log ─────────────────────────
-- Every manual override, classification change, or report lock must be recorded
-- here. This table is INSERT-only — no UPDATE or DELETE permitted.
-- Row-level security enforces this in production.

CREATE TABLE IF NOT EXISTS transaction_audit_log (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    event_type     TEXT        NOT NULL
        CONSTRAINT chk_event CHECK (event_type IN (
            'auto_classified',        -- router classified automatically
            'manual_review_resolved', -- human entered physical quantity
            'report_locked',          -- transaction frozen by aasb_reports row
            'correction_submitted'    -- post-lock correction (rare, requires CFO approval)
        )),
    user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
    payload        JSONB       NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No UPDATE trigger — this table is append-only by design.
CREATE INDEX IF NOT EXISTS idx_audit_log_tx   ON transaction_audit_log (transaction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON transaction_audit_log (event_type, created_at DESC);

COMMENT ON TABLE transaction_audit_log IS
'Immutable audit trail for AASB S2 compliance. INSERT-only. '
'Every classification, manual override, and report lock event is recorded here. '
'payload is the full JSON snapshot of the state at time of event.';

-- ─── 3. Verification ─────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'scope1_co2e_kg'
    ) THEN
        RAISE EXCEPTION 'Migration 019 GUARD FAIL: scope1_co2e_kg column not created.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'transaction_audit_log'
    ) THEN
        RAISE EXCEPTION 'Migration 019 GUARD FAIL: transaction_audit_log table not created.';
    END IF;

    RAISE NOTICE '✅ Migration 019 complete. Scope columns + audit log ready.';
END $$;

COMMIT;
