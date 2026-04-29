-- =============================================================================
-- Migration 018 — Merchant Rules Engine v2
--
-- PURPOSE:
--   Extends merchant_classification_rules (created in 016) with an explicit
--   `action` column that drives the Transaction Router in transaction_router.ts.
--   This enables zero-LLM routing for IGNORE transactions and structured
--   pre-classification before any OCR call is made.
--
-- NEW COLUMN: action
--   'EXTRACT_VOLUME'  → forward to LLM Gateway (OCR_EXTRACTION_PROMPT)
--   'IGNORE'          → drop immediately; zero LLM calls; not emission-relevant
--   'NEEDS_REVIEW'    → route to human queue; physical data cannot be extracted
--
-- AASB S2 COMPLIANCE NOTE:
--   The `action` column implements a deterministic pre-filter gate. No LLM
--   is consulted for IGNORE transactions — this is an engineering control,
--   not a compliance override. IGNORE rows are not emission sources under
--   the GHG Protocol Corporate Standard or AASB S2.
--
-- Safe to re-run: all DDL uses IF NOT EXISTS / DO NOTHING.
-- =============================================================================

BEGIN;

-- ─── Step 1: Add `action` column to existing table ───────────────────────────
ALTER TABLE merchant_classification_rules
    ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'EXTRACT_VOLUME'
        CONSTRAINT chk_action CHECK (action IN ('EXTRACT_VOLUME', 'IGNORE', 'NEEDS_REVIEW'));

COMMENT ON COLUMN merchant_classification_rules.action IS
'Router directive for transaction_router.ts:
  EXTRACT_VOLUME → call LLM Gateway (OCR_EXTRACTION_PROMPT) to extract physical quantity
  IGNORE         → drop immediately (not emission-relevant) — zero LLM calls
  NEEDS_REVIEW   → physical unit not extractable; route to human review queue';

-- ─── Step 2: Back-fill existing rows with correct action ─────────────────────
-- Fuel / Electricity / Travel / Freight / Waste → EXTRACT_VOLUME (default, already set)
-- Accommodation → NEEDS_REVIEW (no standard physical unit per NGA 2025)
-- Finance exclusions (scope = 0) → IGNORE

UPDATE merchant_classification_rules
   SET action = 'NEEDS_REVIEW'
 WHERE category_code = 'accommodation_business'
   AND action = 'EXTRACT_VOLUME';

UPDATE merchant_classification_rules
   SET action = 'IGNORE'
 WHERE scope = 0                      -- excluded_finance category
    OR category_code = 'excluded_finance';

-- ─── Step 3: SEED — SaaS / Software (IGNORE) ─────────────────────────────────
-- These are not emission-relevant under GHG Protocol Scopes 1–3 for most
-- Australian SMEs. They produce zero CO2e in the EcoLink data model.
-- Inserting them as IGNORE prevents 100% of spurious LLM calls for software.

INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit,
   requires_state, notes_citation, priority, action)
VALUES
  -- Accounting / Tax
  ('Xero',             'xero',               'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS accounting — not emission-relevant per GHG Protocol', 500, 'IGNORE'),
  ('MYOB',             'myob',               'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS accounting — not emission-relevant per GHG Protocol', 500, 'IGNORE'),
  ('QuickBooks',       'quickbooks',         'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS accounting — not emission-relevant per GHG Protocol', 500, 'IGNORE'),
  ('ATO (tax)',        'australian tax off', 'contains', 'excluded_software', 0, NULL, FALSE, 'Tax office payment — not an emission event',                500, 'IGNORE'),
  ('ATO BAS',         'ato bas',            'contains', 'excluded_software', 0, NULL, FALSE, 'BAS payment — not an emission event',                       500, 'IGNORE'),
  ('ATO',              ' ato ',              'contains', 'excluded_software', 0, NULL, FALSE, 'ATO generic — not an emission event',                       490, 'IGNORE'),

  -- Microsoft stack
  ('Microsoft 365',   'microsoft 365',      'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS productivity — not emission-relevant', 500, 'IGNORE'),
  ('Microsoft Azure', 'microsoft azure',    'contains', 'excluded_software', 0, NULL, FALSE, 'Cloud PaaS — Scope 3 Cat 1 only if material; flagged IGNORE by default', 500, 'IGNORE'),
  ('Microsoft',       'microsoft',          'contains', 'excluded_software', 0, NULL, FALSE, 'Microsoft generic — not emission-relevant', 480, 'IGNORE'),
  ('GitHub',          'github',             'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS DevOps — not emission-relevant', 500, 'IGNORE'),

  -- Adobe
  ('Adobe Creative',  'adobe creative',     'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS creative — not emission-relevant', 500, 'IGNORE'),
  ('Adobe',           'adobe',              'contains', 'excluded_software', 0, NULL, FALSE, 'Adobe generic — not emission-relevant',  480, 'IGNORE'),

  -- Google
  ('Google Workspace','google workspace',   'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS productivity — not emission-relevant', 500, 'IGNORE'),
  ('Google Ads',      'google ads',         'contains', 'excluded_software', 0, NULL, FALSE, 'Digital advertising — not emission-relevant', 500, 'IGNORE'),
  ('Google',          'google',             'contains', 'excluded_software', 0, NULL, FALSE, 'Google generic — not emission-relevant', 470, 'IGNORE'),

  -- Communications / Telecoms
  ('Slack',           'slack',              'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS comms — not emission-relevant', 500, 'IGNORE'),
  ('Zoom',            'zoom',               'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS comms — not emission-relevant', 500, 'IGNORE'),
  ('Teams',           ' teams ',            'contains', 'excluded_software', 0, NULL, FALSE, 'SaaS comms — not emission-relevant', 500, 'IGNORE'),

  -- Insurance / Legal / HR
  ('Seek (jobs)',     'seek.com',           'contains', 'excluded_software', 0, NULL, FALSE, 'HR platform — not emission-relevant', 500, 'IGNORE'),
  ('LinkedIn',        'linkedin',           'contains', 'excluded_software', 0, NULL, FALSE, 'Professional network — not emission-relevant', 500, 'IGNORE'),

  -- Bank & Finance (extends 016 seed)
  ('Stripe',          'stripe',             'contains', 'excluded_finance',  0, NULL, FALSE, 'Payment gateway fee — not emission-relevant', 500, 'IGNORE'),
  ('Square',          'square',             'contains', 'excluded_finance',  0, NULL, FALSE, 'Payment gateway fee — not emission-relevant', 500, 'IGNORE'),
  ('PayPal',          'paypal',             'contains', 'excluded_finance',  0, NULL, FALSE, 'Payment processor — not emission-relevant', 500, 'IGNORE'),
  ('CommBank fee',    'commbank',           'contains', 'excluded_finance',  0, NULL, FALSE, 'Bank fee — not emission-relevant', 490, 'IGNORE'),
  ('ANZ fee',         'anz bank',           'contains', 'excluded_finance',  0, NULL, FALSE, 'Bank fee — not emission-relevant', 490, 'IGNORE'),
  ('NAB fee',         'nab ',               'contains', 'excluded_finance',  0, NULL, FALSE, 'Bank fee — not emission-relevant', 490, 'IGNORE'),
  ('Westpac fee',     'westpac',            'contains', 'excluded_finance',  0, NULL, FALSE, 'Bank fee — not emission-relevant', 490, 'IGNORE')

ON CONFLICT DO NOTHING;

-- ─── Step 4: Add composite index on action for fast router pre-filter ─────────
CREATE INDEX IF NOT EXISTS idx_mcr_action_priority
  ON merchant_classification_rules(action, priority DESC)
  WHERE is_active = TRUE;

-- ─── Step 5: Verification guard ───────────────────────────────────────────────
DO $$
DECLARE
  ignore_count        INTEGER;
  extract_count       INTEGER;
  needs_review_count  INTEGER;
  invalid_count       INTEGER;
BEGIN
  SELECT COUNT(*) INTO ignore_count
    FROM merchant_classification_rules WHERE action = 'IGNORE'   AND is_active = TRUE;
  SELECT COUNT(*) INTO extract_count
    FROM merchant_classification_rules WHERE action = 'EXTRACT_VOLUME' AND is_active = TRUE;
  SELECT COUNT(*) INTO needs_review_count
    FROM merchant_classification_rules WHERE action = 'NEEDS_REVIEW'  AND is_active = TRUE;

  -- Guard: no row should be missing an action
  SELECT COUNT(*) INTO invalid_count
    FROM merchant_classification_rules WHERE action IS NULL;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'Migration 018 GUARD FAIL: % rows have NULL action. This should never happen — check DEFAULT constraint.',
      invalid_count;
  END IF;

  RAISE NOTICE '✅ Migration 018 complete. Rules: EXTRACT_VOLUME=%, IGNORE=%, NEEDS_REVIEW=%',
    extract_count, ignore_count, needs_review_count;
END $$;

COMMIT;
