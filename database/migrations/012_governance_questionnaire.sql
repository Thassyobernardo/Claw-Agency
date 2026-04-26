-- =============================================================================
-- Migration 012 — Governance, Strategy & Risk questionnaire (AASB S2 §6-25)
--
-- Why: AASB S2 mandatory disclosures require qualitative narrative for:
--   - Governance (§6-9)         — board oversight, accountability, frequency
--   - Strategy (§10-22)         — physical risks, transition risks, opportunities,
--                                 scenario analysis (1.5°C and 2°C minimum),
--                                 financial impact
--   - Risk Management (§23-25)  — process for identifying climate risk,
--                                 integration into overall risk management
--
-- Without these answers, the PDF report has placeholder text → not compliant.
-- The customer fills this once during onboarding (or annually).
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_governance (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL UNIQUE REFERENCES companies (id) ON DELETE CASCADE,

    -- ── AASB S2 §6-9: Governance ──────────────────────────────────────────
    board_oversight_body         TEXT,    -- e.g. "Board of Directors", "Climate Sub-Committee"
    accountable_person_role      TEXT,    -- e.g. "CEO", "CFO", "Head of Sustainability"
    review_frequency             TEXT     -- "monthly" | "quarterly" | "biannual" | "annual"
        CHECK (review_frequency IS NULL OR review_frequency IN ('monthly','quarterly','biannual','annual')),
    governance_notes             TEXT,    -- free-form narrative

    -- ── AASB S2 §10-22: Strategy ──────────────────────────────────────────
    -- Physical risks (extreme heat, flood, bushfire, drought, sea-level rise)
    physical_risks_identified    TEXT[],
    physical_risks_narrative     TEXT,

    -- Transition risks (carbon pricing, market shift, technology, reputation, legal)
    transition_risks_identified  TEXT[],
    transition_risks_narrative   TEXT,

    -- Opportunities (resource efficiency, energy source, products/services, markets)
    opportunities_identified     TEXT[],
    opportunities_narrative      TEXT,

    -- Scenario analysis (AASB S2 §22)
    scenario_15c_completed       BOOLEAN NOT NULL DEFAULT FALSE,
    scenario_15c_narrative       TEXT,
    scenario_2c_completed        BOOLEAN NOT NULL DEFAULT FALSE,
    scenario_2c_narrative        TEXT,
    scenario_3c_completed        BOOLEAN NOT NULL DEFAULT FALSE,  -- optional 3°C disorderly
    scenario_3c_narrative        TEXT,

    -- Financial impact (current + anticipated)
    financial_impact_current     TEXT,    -- e.g. "$X carbon tax exposure"
    financial_impact_anticipated TEXT,
    business_model_resilience    TEXT,    -- narrative on resilience to scenarios

    -- ── AASB S2 §23-25: Risk Management ──────────────────────────────────
    risk_identification_process  TEXT,    -- narrative
    risk_integration_process     TEXT,    -- how it's integrated into overall ERM
    risk_priority_method         TEXT,    -- e.g. "Likelihood × Impact matrix"

    -- ── AASB S2 §26-42: Targets ──────────────────────────────────────────
    target_base_year             SMALLINT CHECK (target_base_year IS NULL OR target_base_year BETWEEN 2000 AND 2050),
    target_target_year           SMALLINT CHECK (target_target_year IS NULL OR target_target_year BETWEEN 2025 AND 2070),
    target_reduction_pct         NUMERIC(5,2) CHECK (target_reduction_pct IS NULL OR target_reduction_pct BETWEEN 0 AND 100),
    target_scope_coverage        TEXT[],  -- ['scope_1','scope_2','scope_3']
    target_methodology           TEXT,    -- e.g. "SBTi 1.5°C aligned"
    target_narrative             TEXT,

    -- AASB S2 §29: Cross-industry metrics
    energy_total_mwh             NUMERIC(14,2),
    energy_renewable_pct         NUMERIC(5,2) CHECK (energy_renewable_pct IS NULL OR energy_renewable_pct BETWEEN 0 AND 100),
    internal_carbon_price_aud    NUMERIC(10,2),  -- AUD per tonne CO2e
    exec_remuneration_climate_pct NUMERIC(5,2) CHECK (exec_remuneration_climate_pct IS NULL OR exec_remuneration_climate_pct BETWEEN 0 AND 100),

    -- AASB S2 §B17: Connectivity to Financial Statements
    fs_consistency_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
    fs_inconsistencies_narrative TEXT,    -- explain any divergence

    -- Audit
    completed_at                 TIMESTAMP WITH TIME ZONE,
    last_reviewed_at             TIMESTAMP WITH TIME ZONE,
    completed_by_user_id         UUID REFERENCES users (id) ON DELETE SET NULL,

    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_company ON company_governance (company_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION trg_governance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_governance_updated_at ON company_governance;
CREATE TRIGGER trg_governance_updated_at
    BEFORE UPDATE ON company_governance
    FOR EACH ROW
    EXECUTE FUNCTION trg_governance_updated_at();
