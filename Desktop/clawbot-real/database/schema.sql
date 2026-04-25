-- =============================================================================
-- EcoLink Australia — PostgreSQL Schema
-- National Greenhouse Accounts (NGA) Carbon Accounting Engine
-- Standard: AASB S1 / S2 (aligned with IFRS S1/S2 and TCFD)
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. COMPANIES
--    Australian SMEs using the platform.
--    ABN is the unique business identifier in Australia (11 digits).
-- =============================================================================
CREATE TABLE IF NOT EXISTS companies (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name                  TEXT NOT NULL,
    abn                   CHAR(11) UNIQUE,                         -- Australian Business Number (no spaces)
    acn                   CHAR(9),                                  -- Australian Company Number (optional)
    industry_anzsic_code  TEXT,                                    -- ANZSIC 2006 Division/Class code
    industry_description  TEXT,

    -- Location
    address_line1         TEXT,
    address_line2         TEXT,
    city                  TEXT,
    state                 TEXT CHECK (state IN ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
    postcode              TEXT,

    -- Financial year settings (Australian FY typically July–June)
    fy_start_month        SMALLINT NOT NULL DEFAULT 7             -- 1=Jan … 12=Dec; AU default = July
        CHECK (fy_start_month BETWEEN 1 AND 12),

    -- Xero OAuth integration
    xero_tenant_id        TEXT UNIQUE,
    xero_token_data       JSONB DEFAULT '{}',                     -- Encrypted OAuth token payload

    -- MYOB integration (future)
    myob_company_file_id  TEXT,

    -- Reporting preferences
    reporting_currency    CHAR(3) NOT NULL DEFAULT 'AUD',
    baseline_year         SMALLINT,                               -- Year chosen as emissions baseline

    -- Subscription
    stripe_customer_id    TEXT UNIQUE,                            -- Stripe Customer ID (cus_...)
    stripe_subscription_id TEXT UNIQUE,                           -- Stripe Subscription ID (sub_...)
    plan                  TEXT NOT NULL DEFAULT 'starter'         -- starter, professional, enterprise
        CHECK (plan IN ('starter', 'professional', 'enterprise')),
    plan_expires_at       TIMESTAMP WITH TIME ZONE,

    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_abn ON companies (abn);


-- =============================================================================
-- 2. USERS
--    People who log in — they belong to a company.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id        UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,

    email             TEXT UNIQUE NOT NULL,
    name              TEXT NOT NULL,
    password_hash     TEXT NOT NULL,

    role              TEXT NOT NULL DEFAULT 'analyst'
        CHECK (role IN ('owner', 'admin', 'analyst', 'viewer')),

    -- Email verification
    email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    verify_token      TEXT,
    verify_expires_at TIMESTAMP WITH TIME ZONE,

    -- Password reset
    reset_token       TEXT,
    reset_expires_at  TIMESTAMP WITH TIME ZONE,

    last_login_at     TIMESTAMP WITH TIME ZONE,

    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users (company_id);
CREATE INDEX IF NOT EXISTS idx_users_email      ON users (email);


-- =============================================================================
-- 3. EMISSION_FACTORS
--    Reference table populated from the Australian Government's
--    National Greenhouse Accounts (NGA) Factors publication (DCCEEW).
--    Updated annually — new rows are inserted each year; old rows remain
--    for historical report re-calculation.
-- =============================================================================
CREATE TABLE IF NOT EXISTS emission_factors (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- NGA publication metadata
    nga_year             SMALLINT NOT NULL,                        -- e.g. 2024 for the 2023–24 edition
    is_current           BOOLEAN NOT NULL DEFAULT FALSE,           -- Only one set per nga_year is current

    -- Scope classification
    scope                SMALLINT NOT NULL CHECK (scope IN (1, 2, 3)),

    -- Category hierarchy (mirrors NGA table structure)
    category             TEXT NOT NULL,                            -- e.g. 'Combustion'
    subcategory          TEXT,                                     -- e.g. 'Transport — Road'
    activity             TEXT NOT NULL,                            -- e.g. 'Petrol — Motor Vehicles'

    -- Activity unit (for spend-based vs activity-based calculation)
    unit                 TEXT NOT NULL,                            -- e.g. 'L', 'kWh', 'km', 'AUD', 'tonne'
    calculation_method   TEXT NOT NULL DEFAULT 'activity_based'   -- activity_based | spend_based | hybrid
        CHECK (calculation_method IN ('activity_based', 'spend_based', 'hybrid')),

    -- Emission factors (kg CO2e per unit)
    co2e_factor          NUMERIC(18,6) NOT NULL,                  -- Combined GWP-weighted factor
    co2_factor           NUMERIC(18,6),                           -- CO2 component
    ch4_factor           NUMERIC(18,6),                           -- CH4 component
    n2o_factor           NUMERIC(18,6),                           -- N2O component

    -- State-specific electricity factors (Scope 2)
    state_specific        BOOLEAN NOT NULL DEFAULT FALSE,
    state                TEXT CHECK (state IN ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),

    -- AI classification helper — keywords the AI uses to match transactions
    match_keywords        TEXT[],                                  -- e.g. ARRAY['bp','shell','petrol','unleaded']

    -- Source reference
    source_table         TEXT,                                     -- NGA table number (e.g. 'Table 8')
    source_url           TEXT,

    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ef_unique
    ON emission_factors (nga_year, activity, unit, COALESCE(state, 'ALL'));

CREATE INDEX IF NOT EXISTS idx_ef_current   ON emission_factors (is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_ef_scope     ON emission_factors (scope);
CREATE INDEX IF NOT EXISTS idx_ef_category  ON emission_factors (category, subcategory);


-- =============================================================================
-- 4. TRANSACTIONS
--    Financial transactions imported from Xero, MYOB, or entered manually.
--    The AI classifies each row against emission_factors.
-- =============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id               UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,

    -- Source system
    source                   TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('xero', 'myob', 'manual', 'csv_import')),
    external_id              TEXT,                                -- ID from source system (for deduplication)

    -- Transaction data
    transaction_date         DATE NOT NULL,
    description              TEXT NOT NULL,                      -- Raw description from source
    supplier_name            TEXT,
    amount_aud               NUMERIC(14,2) NOT NULL,
    currency                 CHAR(3) NOT NULL DEFAULT 'AUD',

    -- Source-system category (before EcoLink classification)
    account_code             TEXT,                               -- Xero/MYOB account code
    account_name             TEXT,                               -- Xero/MYOB account name

    -- EcoLink AI classification
    emission_factor_id       UUID REFERENCES emission_factors (id) ON DELETE SET NULL,
    classification_status    TEXT NOT NULL DEFAULT 'pending'
        CHECK (classification_status IN ('pending', 'classified', 'needs_review', 'factor_not_found', 'excluded')),
    classification_confidence NUMERIC(4,3)                       -- 0.000 to 1.000
        CHECK (classification_confidence BETWEEN 0 AND 1),
    classification_notes     TEXT,                               -- AI explanation / ambiguity flag
    classified_at            TIMESTAMP WITH TIME ZONE,
    classified_by            TEXT NOT NULL DEFAULT 'ai'          -- 'ai' or user UUID
        CHECK (classified_by = 'ai' OR classified_by ~ '^[0-9a-f-]{36}$'),

    -- Activity quantity (extracted or estimated from description/amount)
    quantity_value           NUMERIC(14,4),                      -- e.g. 62.5 (litres of petrol)
    quantity_unit            TEXT,                               -- e.g. 'L', 'kWh', 'km'

    -- Calculated emission result
    co2e_kg                  NUMERIC(14,4),                      -- kg CO2e for this transaction
    scope                    SMALLINT CHECK (scope IN (1, 2, 3)),

    -- Reporting period (populated on report generation)
    reporting_year           SMALLINT,
    reporting_quarter        SMALLINT CHECK (reporting_quarter BETWEEN 1 AND 4),

    -- Audit trail
    reviewed_by_user_id      UUID REFERENCES users (id) ON DELETE SET NULL,
    reviewed_at              TIMESTAMP WITH TIME ZONE,
    review_notes             TEXT,

    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_source_dedup
    ON transactions (company_id, source, external_id)
    WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tx_company_date    ON transactions (company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status          ON transactions (classification_status);
CREATE INDEX IF NOT EXISTS idx_tx_scope           ON transactions (company_id, scope);
CREATE INDEX IF NOT EXISTS idx_tx_reporting       ON transactions (company_id, reporting_year, reporting_quarter);


-- =============================================================================
-- 5. CARBON_REPORTS
--    Finalised reports generated per company per reporting period.
--    Structured to satisfy AASB S1 / S2 disclosure requirements.
-- =============================================================================
CREATE TABLE IF NOT EXISTS carbon_reports (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id                UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    generated_by_user_id      UUID REFERENCES users (id) ON DELETE SET NULL,

    -- Reporting period
    reporting_period_start    DATE NOT NULL,
    reporting_period_end      DATE NOT NULL,
    report_type               TEXT NOT NULL DEFAULT 'annual'
        CHECK (report_type IN ('monthly', 'quarterly', 'annual')),
    nga_factors_year          SMALLINT NOT NULL,                  -- Which NGA edition was used

    -- Report lifecycle
    status                    TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'under_review', 'finalised', 'superseded')),
    finalised_at              TIMESTAMP WITH TIME ZONE,

    -- Aggregated emission totals (kg CO2e)
    total_scope1_co2e_kg      NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_scope2_co2e_kg      NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_scope3_co2e_kg      NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_co2e_kg             NUMERIC(18,4) GENERATED ALWAYS AS
                                  (total_scope1_co2e_kg + total_scope2_co2e_kg + total_scope3_co2e_kg)
                              STORED,

    -- Breakdown by category (JSON array of { category, scope, co2e_kg, transaction_count })
    emissions_by_category     JSONB NOT NULL DEFAULT '[]',

    -- Transaction statistics
    transaction_count         INTEGER NOT NULL DEFAULT 0,
    transactions_classified   INTEGER NOT NULL DEFAULT 0,
    transactions_needs_review INTEGER NOT NULL DEFAULT 0,
    transactions_excluded     INTEGER NOT NULL DEFAULT 0,

    -- AASB S1 — Governance & Strategy (free-form disclosure fields)
    -- Populated by the company admin; validated against the standard
    aasb_s1_governance        JSONB DEFAULT '{}',  -- Board oversight, management roles
    aasb_s1_strategy          JSONB DEFAULT '{}',  -- Risks & opportunities, scenario analysis
    aasb_s1_risk_management   JSONB DEFAULT '{}',  -- Risk identification and integration processes
    aasb_s1_metrics_targets   JSONB DEFAULT '{}',  -- KPIs, base year, reduction targets

    -- AASB S2 — Climate-Related Disclosures
    aasb_s2_physical_risks    JSONB DEFAULT '[]',  -- Physical risk assessments
    aasb_s2_transition_risks  JSONB DEFAULT '[]',  -- Transition risk assessments
    aasb_s2_opportunities     JSONB DEFAULT '[]',  -- Climate-related opportunities
    aasb_s2_targets           JSONB DEFAULT '{}',  -- Net zero targets, interim milestones

    -- Delivery
    pdf_url                   TEXT,                -- URL to generated PDF (stored in cloud)
    pdf_generated_at          TIMESTAMP WITH TIME ZONE,

    created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_company      ON carbon_reports (company_id, reporting_period_end DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status       ON carbon_reports (status);


-- =============================================================================
-- HELPER: auto-update updated_at on row modification
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['companies','users','transactions','carbon_reports']
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
             CREATE TRIGGER trg_set_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
            t, t
        );
    END LOOP;
END $$;
