-- =============================================================================
-- Migration 004: PostgreSQL Row Level Security (RLS)
-- =============================================================================
-- RLS adds a last line of defence at the database level.
-- Even if application code has a bug, the DB will never return rows
-- belonging to a different company.
--
-- How it works:
--   1. RLS is enabled on transactions, users.
--   2. A policy checks that company_id = current_setting('app.company_id').
--   3. The application sets this setting at the start of each query session.
--
-- NOTE: In the current Next.js setup we use a shared connection pool,
-- so we use SET LOCAL (transaction-scoped) to prevent bleed-across.
-- This migration enables the policies but marks them as PERMISSIVE so
-- existing admin queries (migrations, seeds) continue to work via the
-- postgres superuser role which bypasses RLS by default.
-- =============================================================================

-- ── Enable RLS on multi-tenant tables ────────────────────────────────────────

ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;

-- ── Create an application role with restricted privileges ─────────────────────
-- This role is used by the Next.js connection pool (not the superuser).
-- The superuser bypasses RLS, so migrations and seeds are unaffected.
--
-- SECURITY: The password MUST be supplied at migration time via the Postgres
-- custom GUC `app.ecolink_password` (custom GUCs require a dot in the name).
-- Example:
--
--   psql "$DATABASE_URL" \
--     -c "SET SESSION \"app.ecolink_password\" = 'xxx'" \
--     -f database/migrations/004_row_level_security.sql
--
-- The migration runner (scripts/run_migration.mjs) sets this variable from the
-- ECOLINK_APP_DB_PASSWORD env var and fails loudly if it is not set or is
-- still the old placeholder value. Never commit the actual password.

DO $$
DECLARE
  v_password TEXT := current_setting('app.ecolink_password', true);
BEGIN
  IF v_password IS NULL OR length(v_password) < 16 OR v_password = 'CHANGE_ME_IN_PRODUCTION' THEN
    RAISE EXCEPTION
      'app.ecolink_password is not set or is too weak. '
      'Pass it with  SET SESSION "app.ecolink_password" = ...  or set ECOLINK_APP_DB_PASSWORD in your env.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecolink_app') THEN
    EXECUTE format('CREATE ROLE ecolink_app LOGIN PASSWORD %L', v_password);
  ELSE
    EXECUTE format('ALTER ROLE ecolink_app WITH LOGIN PASSWORD %L', v_password);
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE ON transactions TO ecolink_app;
GRANT SELECT, UPDATE ON users TO ecolink_app;
GRANT SELECT ON companies, emission_factors TO ecolink_app;

-- ── RLS policies ─────────────────────────────────────────────────────────────

-- Transactions: only rows belonging to the current company
DROP POLICY IF EXISTS transactions_company_isolation ON transactions;
CREATE POLICY transactions_company_isolation ON transactions
  AS PERMISSIVE
  FOR ALL
  TO ecolink_app
  USING (company_id::text = current_setting('app.company_id', true));

-- Users: only rows belonging to the current company
DROP POLICY IF EXISTS users_company_isolation ON users;
CREATE POLICY users_company_isolation ON users
  AS PERMISSIVE
  FOR ALL
  TO ecolink_app
  USING (company_id::text = current_setting('app.company_id', true));

-- ── Helper function: set company context for a transaction ────────────────────
-- Call: SELECT set_company_context('uuid-here');
-- In Next.js API routes: await sql`SELECT set_company_context(${companyId})`;

CREATE OR REPLACE FUNCTION set_company_context(p_company_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.company_id', p_company_id::text, true); -- true = transaction-local
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_company_context IS
  'Sets the company_id for the current transaction so RLS policies can enforce isolation.';
