-- =============================================================================
-- Migration 021 — Row Level Security (RLS) para Todas as Tabelas Core
--
-- PURPOSE:
--   Enforces multi-tenant data isolation at the database level.
--   Even if application code has a bug, the DB guarantees a company
--   can NEVER read or write another company's data.
--
-- STRATEGY:
--   Each table uses company_id to isolate rows.
--   The JWT claim 'request.jwt.claims' from Supabase Auth carries the
--   company_id set by our backend after login (via SERVICE_ROLE upsert).
--
-- PATTERN (per table):
--   1. ENABLE ROW LEVEL SECURITY
--   2. FORCE ROW LEVEL SECURITY (applies even to table owner)
--   3. Policy SELECT: company_id = current_company_id()
--   4. Policy INSERT: company_id = current_company_id()
--   5. Policy UPDATE: company_id = current_company_id()
--   6. Policy DELETE: no delete (immutability principle)
--
-- SECURITY MODEL:
--   - All client-facing queries use the 'authenticated' role (anon JWT).
--   - Backend API routes use the SERVICE_ROLE key — bypasses RLS by design.
--   - The SERVICE_ROLE key MUST NEVER be exposed to the client.
--
-- Depends on: migrations 001–020 (all prior tables must exist).
-- =============================================================================

BEGIN;

-- ─── Helper: extract company_id from JWT ─────────────────────────────────────
--
-- Supabase stores custom claims in app_metadata.
-- Our backend sets: { app_metadata: { company_id: "uuid" } }
-- during the Xero OAuth callback (companies.id).

CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', TRUE)::jsonb
      -> 'app_metadata'
      ->> 'company_id',
    ''
  )::UUID
$$;

COMMENT ON FUNCTION current_company_id() IS
'Extract company_id from Supabase JWT app_metadata. '
'Returns NULL if not authenticated or claim is absent.';

-- ─── 1. TABLE: companies ──────────────────────────────────────────────────────

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

-- A company row is only visible to users belonging to it
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies
  FOR SELECT
  USING (id = current_company_id());

-- Backend (SERVICE_ROLE) creates company rows — no INSERT policy for anon
-- UPDATE: only own company
DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies
  FOR UPDATE
  USING      (id = current_company_id())
  WITH CHECK (id = current_company_id());

-- No DELETE: companies are never deleted via the application
COMMENT ON TABLE companies IS
'Multi-tenant root entity. RLS enforces company isolation via current_company_id().';

-- ─── 2. TABLE: transactions ───────────────────────────────────────────────────

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_select ON transactions;
CREATE POLICY transactions_select ON transactions
  FOR SELECT
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS transactions_insert ON transactions;
CREATE POLICY transactions_insert ON transactions
  FOR INSERT
  WITH CHECK (company_id = current_company_id());

-- UPDATE allowed for review/classification (before report lock)
DROP POLICY IF EXISTS transactions_update ON transactions;
CREATE POLICY transactions_update ON transactions
  FOR UPDATE
  USING      (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- No DELETE: locked transactions must stay for audit trail

COMMENT ON TABLE transactions IS
'Xero / MYOB transactions. RLS prevents cross-company data access. '
'DB-level lock trigger (tg_enforce_transaction_lock) prevents edits after report sealing.';

-- ─── 3. TABLE: aasb_reports ───────────────────────────────────────────────────

ALTER TABLE aasb_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE aasb_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aasb_reports_select ON aasb_reports;
CREATE POLICY aasb_reports_select ON aasb_reports
  FOR SELECT
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS aasb_reports_insert ON aasb_reports;
CREATE POLICY aasb_reports_insert ON aasb_reports
  FOR INSERT
  WITH CHECK (company_id = current_company_id());

-- UPDATE allowed only while 'generating' (seal trigger enforces immutability after)
DROP POLICY IF EXISTS aasb_reports_update ON aasb_reports;
CREATE POLICY aasb_reports_update ON aasb_reports
  FOR UPDATE
  USING      (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- No DELETE: sealed reports are legal documents

COMMENT ON TABLE aasb_reports IS
'Sealed AASB S2 reports. RLS prevents cross-company access. '
'DB trigger (tg_enforce_report_seal) prevents mutation after status = sealed.';

-- ─── 4. TABLE: merchant_classification_rules ─────────────────────────────────
--
-- Rules are SHARED across all companies (global seed data).
-- All authenticated users may READ rules; only SERVICE_ROLE writes them.

ALTER TABLE merchant_classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_classification_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rules_select ON merchant_classification_rules;
CREATE POLICY rules_select ON merchant_classification_rules
  FOR SELECT
  TO authenticated
  USING (TRUE);  -- All tenants share the same rule set (global)

-- No INSERT/UPDATE/DELETE policy for 'authenticated' — only SERVICE_ROLE

COMMENT ON TABLE merchant_classification_rules IS
'Global deterministic routing rules. Readable by all tenants. '
'Only writable by SERVICE_ROLE (admin migrations).';

-- ─── 5. TABLE: transaction_audit_log ─────────────────────────────────────────

ALTER TABLE transaction_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_audit_log FORCE ROW LEVEL SECURITY;

-- Join audit log to transactions to enforce company isolation
DROP POLICY IF EXISTS audit_log_select ON transaction_audit_log;
CREATE POLICY audit_log_select ON transaction_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id         = transaction_audit_log.transaction_id
        AND t.company_id = current_company_id()
    )
  );

COMMENT ON TABLE transaction_audit_log IS
'Immutable audit trail. RLS enforces company isolation via transaction FK.';

-- ─── 6. Verification guard ────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  rls_on BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'companies', 'transactions', 'aasb_reports',
    'merchant_classification_rules', 'transaction_audit_log'
  ]
  LOOP
    SELECT rowsecurity INTO rls_on
      FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
     WHERE relname = tbl AND nspname = 'public';

    IF NOT rls_on THEN
      RAISE EXCEPTION
        'Migration 021 GUARD FAIL: RLS not enabled on table "%".', tbl;
    END IF;
  END LOOP;

  RAISE NOTICE
    '✅ Migration 021 complete. RLS enabled + FORCED on 5 tables. '
    'current_company_id() function created.';
END $$;

COMMIT;
