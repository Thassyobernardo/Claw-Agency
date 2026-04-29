-- =============================================================================
-- Migration 017 — NGA Factors 2025 + Math Engine Hardening
--
-- Source of truth:
--   National Greenhouse Accounts (NGA) Factors 2025 (DCCEEW, August 2025)
--   https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors
--
-- AASB S2 COMPLIANCE NOTE:
--   Per AASB S2.29, emission factors MUST be sourced from the most recent
--   NGA Factors edition published before the close of the reporting period.
--   This migration promotes the 2025 edition as current for FY 2024-25 reports.
--
-- EXECUTION RULE — THIS FILE MUST NOT BE RUN WITH NULL VALUES:
--   A guard at the end of this script will RAISE EXCEPTION if any inserted
--   row has co2e_factor IS NULL. Fill in all TODO placeholders from the
--   official DCCEEW 2025 workbook BEFORE running this migration.
--
-- NEW COLUMNS added by this migration:
--   emission_factors.energy_content_gj_per_unit — for fuel math engine (GJ per input unit: GJ/kL for liquids, GJ/m3 for gas, GJ/tonne for coal)
--   emission_factors.scope3_co2e_factor         — upstream lifecycle factor (kg CO2e/unit)
--   emission_factors.math_engine_version        — audit: which calculator version computed this
--
-- Safe to re-run: ON CONFLICT DO UPDATE handles idempotency.
-- =============================================================================

BEGIN;

-- ─── Step 0 — Schema additions for the deterministic math engine ──────────────
-- These columns are consumed exclusively by calculator.ts — the LLM never writes here.

ALTER TABLE emission_factors
    ADD COLUMN IF NOT EXISTS energy_content_gj_per_unit NUMERIC(10, 6)
        CONSTRAINT chk_energy_positive CHECK (energy_content_gj_per_unit > 0),
    ADD COLUMN IF NOT EXISTS scope3_co2e_factor          NUMERIC(18, 6)
        CONSTRAINT chk_scope3_positive CHECK (scope3_co2e_factor >= 0),
    ADD COLUMN IF NOT EXISTS math_engine_version         TEXT NOT NULL DEFAULT 'calculator_v1';

COMMENT ON COLUMN emission_factors.energy_content_gj_per_unit IS
'Energy content in GJ per input unit. GJ/kL for liquid fuels, GJ/m3 for piped gas, GJ/tonne for coal. '
'Used by calculator.ts (calculateFuelEmissions) to convert physical quantity → GJ → CO2e. '
'Source: NGA Factors 2025 Appendix A (DCCEEW). NULL for electricity, refrigerants (direct-factor categories).';

COMMENT ON COLUMN emission_factors.scope3_co2e_factor IS
'Scope 3 (upstream lifecycle) emission factor in kg CO2e per GJ. Separate from co2e_factor (Scope 1 direct). Source: NGA Factors 2025 Table 3 (DCCEEW).';

COMMENT ON COLUMN emission_factors.math_engine_version IS
'Version tag of calculator.ts that last processed this factor. Used for audit reproducibility.';

-- ─── Step 1 — Supersede all current 2024 factors ─────────────────────────────
UPDATE emission_factors
   SET is_current = FALSE
 WHERE is_current = TRUE
   AND nga_year < 2025;

-- ─── Step 2 — INSERT NGA 2025 Factors ────────────────────────────────────────
-- ⚠️  INSTRUCTIONS FOR MAINTAINER:
--   1. Open the official NGA Factors 2025 workbook (DCCEEW, August 2025).
--   2. Replace every placeholder comment with the exact value from the workbook.
--   3. Notation:  co2e = combined GWP-AR6; co2/ch4/n2o = individual components.
--   4. For fuel factors: populate energy_content_gj_per_unit AND scope3_co2e_factor.
--      GJ/kL for liquids (petrol/diesel/LPG), GJ/m3 for piped gas, GJ/tonne for coal.
--   5. Remove the /* TODO */ comment from each value once verified.
--   6. The sanity check at Step 3 will FAIL LOUDLY if any co2e_factor is NULL.
--   7. ⛔ AUD SPEND-BASED ROWS ARE PROHIBITED: NGA Factors 2025 does not publish
--      AUD-denominated emission factors. Any such rows in previous migrations
--      must NOT be migrated forward. Method 1 (physical quantities) only.

INSERT INTO emission_factors (
    nga_year, is_current, scope, category, subcategory, activity, unit,
    co2e_factor,    co2_factor,    ch4_factor,    n2o_factor,
    energy_content_gj_per_unit,
    scope3_co2e_factor,
    calculation_method, match_keywords, source_table, source_url,
    state_specific, state
) VALUES

-- ══════════════════════════════════════════════════════════════════════════════
-- SCOPE 1 — TRANSPORT COMBUSTION  (NGA 2025 Table 3)
-- ══════════════════════════════════════════════════════════════════════════════

-- Petrol — Passenger Vehicles
(2025, TRUE, 1,
 'Transport Combustion', 'Road Transport', 'Petrol — Passenger Vehicles', 'L',
 /* co2e    NGA 2025 Tbl 3 */ NULL,
 /* co2     NGA 2025 Tbl 3 */ NULL,
 /* ch4     NGA 2025 Tbl 3 */ NULL,
 /* n2o     NGA 2025 Tbl 3 */ NULL,
 /* GJ/kL   NGA 2025 App A */ NULL,   -- e.g. 34.2 for petrol (confirm 2025 value)
 /* Scope3  NGA 2025 Tbl 3 */ NULL,   -- upstream extraction + refining
 'activity_based',
 ARRAY['bp','shell','caltex','ampol','7-eleven fuel','petrol','unleaded','91','95','98','e10','servo'],
 'Table 3', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- Diesel — Passenger Vehicles
(2025, TRUE, 1,
 'Transport Combustion', 'Road Transport', 'Diesel — Passenger Vehicles', 'L',
 NULL, NULL, NULL, NULL,
 /* GJ/kL */ NULL,   -- e.g. 38.6 for diesel (confirm 2025 value)
 /* Scope3 */ NULL,
 'activity_based',
 ARRAY['diesel vehicle','diesel car','diesel ute','diesel 4wd'],
 'Table 3', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- Diesel — Heavy Vehicles (>3.5t GVM)
(2025, TRUE, 1,
 'Transport Combustion', 'Road Transport', 'Diesel — Heavy Vehicles (>3.5t GVM)', 'L',
 NULL, NULL, NULL, NULL,
 /* GJ/kL */ NULL,
 /* Scope3 */ NULL,
 'activity_based',
 ARRAY['truck fuel','semi fuel','hcv diesel','fleet diesel','transport diesel','diesel truck','b-double'],
 'Table 3', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- Aviation Turbine Fuel
(2025, TRUE, 1,
 'Transport Combustion', 'Aviation', 'Aviation Turbine Fuel — Domestic', 'L',
 NULL, NULL, NULL, NULL,
 /* GJ/kL */ NULL,
 /* Scope3 */ NULL,
 'activity_based',
 ARRAY['jet fuel','avtur','aviation fuel','aircraft fuel'],
 'Table 3', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- ══════════════════════════════════════════════════════════════════════════════
-- SCOPE 1 — STATIONARY COMBUSTION  (NGA 2025 Table 1–2)
-- ══════════════════════════════════════════════════════════════════════════════

-- Natural Gas — Commercial & Industrial (billed in GJ in AU)
(2025, TRUE, 1,
 'Stationary Combustion', 'Natural Gas', 'Natural Gas — Commercial & Industrial', 'GJ',
 NULL, NULL, NULL, NULL,
 NULL,  -- GJ/kL not applicable for gas (already in GJ)
 NULL,
 'activity_based',
 ARRAY['natural gas','gas bill','agl gas','origin gas','energy australia gas','jemena','atco gas','alinta gas'],
 'Table 1', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- Diesel — Stationary (generators)
(2025, TRUE, 1,
 'Stationary Combustion', 'Liquid Fuels', 'Diesel — Stationary Combustion', 'L',
 NULL, NULL, NULL, NULL,
 /* GJ/kL */ NULL,
 /* Scope3 */ NULL,
 'activity_based',
 ARRAY['diesel generator','genset','fuel delivery stationary','diesel pump','irrigation diesel'],
 'Table 2', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- LPG — Stationary
(2025, TRUE, 1,
 'Stationary Combustion', 'Liquid Fuels', 'LPG — Stationary Combustion', 'L',
 NULL, NULL, NULL, NULL,
 /* GJ/kL */ NULL,
 /* Scope3 */ NULL,
 'activity_based',
 ARRAY['lpg','liquid petroleum gas','gas bottle','elgas','propane','autogas'],
 'Table 2', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- ══════════════════════════════════════════════════════════════════════════════
-- SCOPE 1 — FUGITIVE / REFRIGERANTS  (NGA 2025 Table 7, GWP-AR6)
-- ══════════════════════════════════════════════════════════════════════════════

(2025, TRUE, 1,
 'Fugitive Emissions', 'Refrigerants', 'Refrigerant — R-410A (HVAC)', 'kg',
 NULL, 0, NULL, 0,
 NULL, NULL,
 'activity_based',
 ARRAY['refrigerant recharge','hvac regas','r410a','r-410a','aircon regas','air conditioning regas'],
 'Table 7', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

(2025, TRUE, 1,
 'Fugitive Emissions', 'Refrigerants', 'Refrigerant — R-32 (HVAC)', 'kg',
 NULL, 0, NULL, 0,
 NULL, NULL,
 'activity_based',
 ARRAY['r32','r-32','refrigerant r32'],
 'Table 7', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

(2025, TRUE, 1,
 'Fugitive Emissions', 'Refrigerants', 'Refrigerant — R-134a (Automotive)', 'kg',
 NULL, 0, NULL, 0,
 NULL, NULL,
 'activity_based',
 ARRAY['r134a','r-134a','car aircon regas','automotive refrigerant'],
 'Table 7', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- ══════════════════════════════════════════════════════════════════════════════
-- SCOPE 2 — PURCHASED ELECTRICITY  (NGA 2025 Table 5/6, location-based)
-- ══════════════════════════════════════════════════════════════════════════════

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — NSW Grid', 'kWh',
 /* co2e NGA 2025 Tbl 5 */ NULL, NULL, 0, 0,
 NULL, NULL, 'activity_based',
 ARRAY['ausgrid','endeavour energy','essential energy','electricity nsw','agl nsw','origin nsw'],
 'Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 TRUE, 'NSW'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — VIC Grid', 'kWh',
 NULL, NULL, 0, 0, NULL, NULL, 'activity_based',
 ARRAY['citipower','powercor','jemena electricity','ausnet','united energy','electricity vic','agl vic','origin vic'],
 'Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 TRUE, 'VIC'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — QLD Grid', 'kWh',
 NULL, NULL, 0, 0, NULL, NULL, 'activity_based',
 ARRAY['energex','ergon','electricity qld','agl qld','origin qld'],
 'Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 TRUE, 'QLD'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — SA Grid', 'kWh',
 NULL, NULL, 0, 0, NULL, NULL, 'activity_based',
 ARRAY['sa power networks','sapn','electricity sa','agl sa','origin sa'],
 'Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 TRUE, 'SA'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — SWIS', 'Electricity — WA Grid', 'kWh',
 NULL, NULL, 0, 0, NULL, NULL, 'activity_based',
 ARRAY['western power','synergy','electricity wa'],
 'Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 TRUE, 'WA'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — TAS Grid', 'kWh',
 NULL, NULL, 0, 0, NULL, NULL, 'activity_based',
 ARRAY['tasnetworks','aurora energy','electricity tas'],
 'Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 TRUE, 'TAS'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — ACT Grid', 'kWh',
 NULL, NULL, 0, 0, NULL, NULL, 'activity_based',
 ARRAY['evoenergy','electricity act','actewagl'],
 'Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 TRUE, 'ACT'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — Isolated', 'Electricity — NT Grid', 'kWh',
 NULL, NULL, 0, 0, NULL, NULL, 'activity_based',
 ARRAY['power and water corporation','jacana energy','electricity nt'],
 'Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 TRUE, 'NT'),

-- ══════════════════════════════════════════════════════════════════════════════
-- SCOPE 3 — WASTE  (NGA 2025 Table 9)
-- NOTE: Business Travel (air, taxi, accommodation) and Upstream Transport
-- are NOT included here because NGA Factors 2025 does not publish AUD
-- spend-based factors. These categories require physical units (passenger_km,
-- vehicle_km, tonne_km). Transactions without physical data MUST be flagged
-- 'needs_review' by the system (INSUFFICIENT_PHYSICAL_DATA error).
-- ══════════════════════════════════════════════════════════════════════════════

(2025, TRUE, 3,
 'Waste', 'Solid Waste', 'Waste — Municipal Solid Waste to Landfill', 'tonne',
 NULL, NULL, NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['waste disposal','rubbish collection','skip bin','cleanaway','suez waste','veolia','jjs waste'],
 'Table 9', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL),

-- ══════════════════════════════════════════════════════════════════════════════
-- SCOPE 3 — WATER  (NGA 2025 Table 10)
-- ══════════════════════════════════════════════════════════════════════════════

(2025, TRUE, 3,
 'Purchased Goods & Services', 'Water', 'Water — Mains Supply (activity-based)', 'kL',
 NULL, NULL, 0, 0, NULL, NULL, 'activity_based',
 ARRAY['sydney water','yarra valley water','seqwater','water bill','water usage','sa water'],
 'Table 10', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors',
 FALSE, NULL)

ON CONFLICT (nga_year, activity, unit, COALESCE(state, 'ALL')) DO UPDATE SET
    is_current               = EXCLUDED.is_current,
    co2e_factor              = EXCLUDED.co2e_factor,
    co2_factor               = EXCLUDED.co2_factor,
    ch4_factor               = EXCLUDED.ch4_factor,
    n2o_factor               = EXCLUDED.n2o_factor,
    energy_content_gj_per_unit = EXCLUDED.energy_content_gj_per_unit,
    scope3_co2e_factor       = EXCLUDED.scope3_co2e_factor,
    math_engine_version      = EXCLUDED.math_engine_version,
    match_keywords           = EXCLUDED.match_keywords,
    source_table             = EXCLUDED.source_table,
    source_url               = EXCLUDED.source_url;

-- ─── Step 3 — AASB S2 NULL GUARD — WILL RAISE EXCEPTION IF ANY FACTOR IS NULL ─
-- This guard prevents accidental promotion of an incomplete dataset to production.
-- It runs INSIDE the transaction: a failure here triggers a full ROLLBACK.

DO $$
DECLARE
    null_count      INTEGER;
    loaded_count    INTEGER;
    fuel_null_count INTEGER;
BEGIN
    -- Count rows loaded in this migration
    SELECT COUNT(*) INTO loaded_count
      FROM emission_factors
     WHERE nga_year = 2025;

    IF loaded_count = 0 THEN
        RAISE EXCEPTION
            'AASB S2 GUARD FAIL: No NGA 2025 rows found. The INSERT block may still '
            'contain commented-out SQL. Un-comment and fill TODO placeholders before running.';
    END IF;

    -- Check for any NULL co2e_factor
    SELECT COUNT(*) INTO null_count
      FROM emission_factors
     WHERE nga_year    = 2025
       AND co2e_factor IS NULL;

    IF null_count > 0 THEN
        RAISE EXCEPTION
            'AASB S2 GUARD FAIL: % of % NGA 2025 rows have NULL co2e_factor. '
            'Replace every TODO placeholder with the verified DCCEEW value before executing. '
            'This transaction will now ROLLBACK.',
            null_count, loaded_count;
    END IF;

    -- Check physical-fuel rows (L, kL, m3, tonne) have energy_content_gj_per_unit populated
    SELECT COUNT(*) INTO fuel_null_count
      FROM emission_factors
     WHERE nga_year = 2025
       AND unit     IN ('L','kL','m3','tonne')
       AND energy_content_gj_per_unit IS NULL;

    IF fuel_null_count > 0 THEN
        RAISE EXCEPTION
            'AASB S2 GUARD FAIL: % physical-fuel rows (unit IN L,kL,m3,tonne) are missing '
            'energy_content_gj_per_unit. calculator.ts requires this for GJ conversion. '
            'Fill from NGA Factors 2025 Appendix A (DCCEEW).',
            fuel_null_count;
    END IF;

    RAISE NOTICE '✅ NGA 2025 migration validated: % rows loaded, all co2e_factors populated, all fuel energy_content populated.', loaded_count;
END $$;

COMMIT;
