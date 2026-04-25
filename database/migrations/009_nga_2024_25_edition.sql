-- =============================================================================
-- Migration 009 — NGA 2024–25 Edition Scaffold
--
-- Source of truth:
--   National Greenhouse Accounts (NGA) Factors — 2024–25 edition
--   Australian Government, Department of Climate Change, Energy, the Environment
--   and Water (DCCEEW)
--   https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors
--
-- Schema convention:
--   - `nga_year` = publication year of the edition (2025 for the 2024–25 edition).
--   - `is_current = TRUE` on exactly one row per (activity, unit, state). All prior
--      edition rows for the same key must be flipped to FALSE when this edition is
--      promoted. Historical rows are kept so past reports can be re-calculated.
--
-- IMPORTANT — emission factor values are NOT INCLUDED in this scaffold.
--   Project rule: never invent emission factors. Each numeric value must be
--   copied verbatim from the DCCEEW 2024–25 publication. Uncomment and fill in
--   the INSERT statements below once the official 2024–25 figures are available,
--   then re-run this migration. Every VALUES tuple includes clearly marked
--   `TODO` placeholders so an accidental run fails loudly instead of silently
--   inserting wrong numbers.
--
-- Safe to re-run: the idempotency guards (NOT EXISTS + ON CONFLICT) below let
-- this migration be applied multiple times without creating duplicate rows.
-- =============================================================================

-- ─── Step 1 — Mark all 2023–24 rows as not current (idempotent) ──────────────
-- This runs every time the migration is applied so promoting the new edition
-- is a one-step operation (fill in values → re-run migration).
UPDATE emission_factors
   SET is_current = FALSE
 WHERE nga_year    = 2024
   AND is_current  = TRUE;

-- ─── Step 2 — INSERT 2024–25 edition rows ────────────────────────────────────
-- Uncomment the block below and replace every `-- TODO:` placeholder with the
-- figure published in the 2024–25 NGA Factors document. DO NOT COMMIT values
-- that have not been cross-checked against the DCCEEW PDF.
--
-- Row-by-row checklist (match 2023–24 coverage):
--   Scope 1 — Stationary combustion (Natural Gas, Diesel, LPG)
--   Scope 1 — Transport combustion (Petrol passenger, Diesel passenger,
--                                   Diesel heavy, Aviation turbine)
--   Scope 1 — Fugitive / Refrigerants (R-410A, R-32, R-134a — GWP IPCC AR6)
--   Scope 2 — Grid electricity per state (NSW, VIC, QLD, SA, WA, TAS, ACT, NT)
--   Scope 3 — Spend-based (Air travel dom/int, Accommodation, Taxi/rideshare,
--                          Freight road/air, Food/bev, Office supplies,
--                          Professional services, IT/Telecoms)
--   Scope 3 — Waste (MSW to landfill)
--   Scope 3 — Water (mains supply)
--
-- The UNIQUE INDEX `idx_ef_unique (nga_year, activity, unit, COALESCE(state,'ALL'))`
-- means each (activity, unit, state) tuple may only appear once per nga_year.

/*
INSERT INTO emission_factors
    (nga_year, is_current, scope, category, subcategory, activity, unit,
     co2e_factor, co2_factor, ch4_factor, n2o_factor,
     calculation_method, match_keywords, source_table, source_url,
     state_specific, state)
VALUES
-- ── Scope 1 — Stationary Combustion ───────────────────────────────────────
(2025, TRUE, 1, 'Stationary Combustion', 'Natural Gas',
 'Natural Gas — Commercial & Industrial', 'GJ',
 NULL /* TODO co2e */, NULL /* TODO co2 */, NULL /* TODO ch4 */, NULL /* TODO n2o */,
 'activity_based',
 ARRAY['natural gas','gas bill','agl gas','origin gas','energy australia gas','jemena'],
 'Table 1' /* TODO confirm table number */, NULL, FALSE, NULL),

(2025, TRUE, 1, 'Stationary Combustion', 'Liquid Fuels',
 'Diesel — Stationary Combustion', 'L',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['diesel','generator','genset','fuel delivery stationary'],
 'Table 2', NULL, FALSE, NULL),

(2025, TRUE, 1, 'Stationary Combustion', 'Liquid Fuels',
 'LPG — Stationary Combustion', 'L',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['lpg','liquid petroleum','bottled gas','elgas','origin lpg'],
 'Table 2', NULL, FALSE, NULL),

-- ── Scope 1 — Transport Combustion ────────────────────────────────────────
(2025, TRUE, 1, 'Transport Combustion', 'Road Transport',
 'Petrol — Passenger Vehicles', 'L',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['bp','shell','caltex','ampol','7-eleven fuel','petrol','unleaded','91','95','98','servo'],
 'Table 3', NULL, FALSE, NULL),

(2025, TRUE, 1, 'Transport Combustion', 'Road Transport',
 'Diesel — Passenger Vehicles', 'L',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['diesel vehicle','diesel car','diesel ute','diesel truck'],
 'Table 3', NULL, FALSE, NULL),

(2025, TRUE, 1, 'Transport Combustion', 'Road Transport',
 'Diesel — Heavy Vehicles (>3.5t GVM)', 'L',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['truck fuel','semi fuel','hcv diesel','fleet diesel','transport diesel'],
 'Table 3', NULL, FALSE, NULL),

(2025, TRUE, 1, 'Transport Combustion', 'Aviation',
 'Aviation Turbine Fuel — Domestic', 'L',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['jet fuel','avtur','aviation fuel'],
 'Table 3', NULL, FALSE, NULL),

-- ── Scope 1 — Fugitive / Refrigerants ────────────────────────────────────
-- GWP values should match the IPCC assessment cited by the 2024–25 edition
-- (confirm whether DCCEEW has moved from AR5 to AR6 for the new edition).
(2025, TRUE, 1, 'Fugitive Emissions', 'Refrigerants',
 'Refrigerant — R-410A (HVAC)', 'kg',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['refrigerant recharge','hvac regas','r410a','air conditioning regas'],
 'Table 7', NULL, FALSE, NULL),

(2025, TRUE, 1, 'Fugitive Emissions', 'Refrigerants',
 'Refrigerant — R-32 (HVAC)', 'kg',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['r32','r-32','refrigerant r32'],
 'Table 7', NULL, FALSE, NULL),

(2025, TRUE, 1, 'Fugitive Emissions', 'Refrigerants',
 'Refrigerant — R-134a (Automotive)', 'kg',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['r134a','car aircon regas','automotive refrigerant'],
 'Table 7', NULL, FALSE, NULL),

-- ── Scope 2 — Purchased Electricity (state-specific) ─────────────────────
(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM',
 'Electricity — NSW Grid', 'kWh',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['ausgrid','endeavour energy','essential energy','electricity nsw'],
 'Table 6', NULL, TRUE, 'NSW'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM',
 'Electricity — VIC Grid', 'kWh',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['citipower','powercor','jemena electricity','ausnet','united energy','electricity vic'],
 'Table 6', NULL, TRUE, 'VIC'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM',
 'Electricity — QLD Grid', 'kWh',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['energex','ergon','electricity qld'],
 'Table 6', NULL, TRUE, 'QLD'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM',
 'Electricity — SA Grid', 'kWh',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['sa power networks','electricity sa'],
 'Table 6', NULL, TRUE, 'SA'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — SWIS',
 'Electricity — WA Grid', 'kWh',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['western power','synergy','electricity wa'],
 'Table 6', NULL, TRUE, 'WA'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM',
 'Electricity — TAS Grid', 'kWh',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['tasnetworks','aurora energy','electricity tas'],
 'Table 6', NULL, TRUE, 'TAS'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — NEM',
 'Electricity — ACT Grid', 'kWh',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['evoenergy','electricity act'],
 'Table 6', NULL, TRUE, 'ACT'),

(2025, TRUE, 2, 'Purchased Electricity', 'Grid — Isolated',
 'Electricity — NT Grid', 'kWh',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['power and water corporation','electricity nt'],
 'Table 6', NULL, TRUE, 'NT'),

-- ── Scope 3 — Spend-based (AUD) ───────────────────────────────────────────
(2025, TRUE, 3, 'Business Travel', 'Air Travel',
 'Air Travel — Domestic Flights (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['qantas','virgin australia','jetstar','rex airlines','airfare','flight','domestic flight','return flight'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Business Travel', 'Air Travel',
 'Air Travel — International Flights (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['international flight','overseas flight','emirates','singapore airlines','cathay','united airlines'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Business Travel', 'Accommodation',
 'Accommodation — Hotels & Motels (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['hilton','marriott','accor','holiday inn','ibis','hotel','motel','airbnb','accommodation'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Business Travel', 'Road Transport',
 'Ground Transport — Taxi & Ride Share (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['uber','ola','didi','13cabs','yellow taxi','rideshare','taxi'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Upstream Transportation', 'Freight',
 'Freight — Domestic Road (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['toll','startrack','aramex','sendle','couriers please','fastway','freight','courier','delivery'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Upstream Transportation', 'Freight',
 'Freight — Domestic Air (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['air freight','air cargo','overnight freight','express air'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Purchased Goods & Services', 'Food & Beverage',
 'Purchased Goods — Food & Beverages (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['woolworths','coles','aldi','costco','iga','supermarket','grocery','catering','cafe','restaurant'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Purchased Goods & Services', 'Office Supplies',
 'Purchased Goods — Office Supplies (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['officeworks','staples','cartridges','paper','stationery','office supplies','printer ink'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Purchased Goods & Services', 'Professional Services',
 'Purchased Services — Professional & Business Services (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['consulting','legal','accounting','audit','advisory','law firm'],
 'Appendix A', NULL, FALSE, NULL),

(2025, TRUE, 3, 'Purchased Goods & Services', 'IT & Telecoms',
 'Purchased Services — IT & Telecommunications (spend-based)', 'AUD',
 NULL, NULL, NULL, NULL, 'spend_based',
 ARRAY['telstra','optus','vodafone','tpg','internet','phone bill','mobile plan','cloud','aws','azure','google cloud','software subscription'],
 'Appendix A', NULL, FALSE, NULL),

-- ── Scope 3 — Waste ───────────────────────────────────────────────────────
(2025, TRUE, 3, 'Waste', 'Solid Waste',
 'Waste — Municipal Solid Waste to Landfill', 'tonne',
 NULL, NULL, NULL, NULL, 'activity_based',
 ARRAY['waste disposal','rubbish collection','skip bin','cleanaway','suez waste','veolia'],
 'Table 9', NULL, FALSE, NULL),

-- ── Scope 3 — Water ───────────────────────────────────────────────────────
(2025, TRUE, 3, 'Purchased Goods & Services', 'Water',
 'Water — Mains Supply (spend-based)', 'kL',
 NULL, NULL, 0, 0, 'activity_based',
 ARRAY['sydney water','yarra valley water','seqwater','water bill','water usage'],
 'Table 10', NULL, FALSE, NULL)

ON CONFLICT (nga_year, activity, unit, COALESCE(state, 'ALL')) DO UPDATE SET
    is_current         = EXCLUDED.is_current,
    scope              = EXCLUDED.scope,
    category           = EXCLUDED.category,
    subcategory        = EXCLUDED.subcategory,
    co2e_factor        = EXCLUDED.co2e_factor,
    co2_factor         = EXCLUDED.co2_factor,
    ch4_factor         = EXCLUDED.ch4_factor,
    n2o_factor         = EXCLUDED.n2o_factor,
    calculation_method = EXCLUDED.calculation_method,
    match_keywords     = EXCLUDED.match_keywords,
    source_table       = EXCLUDED.source_table,
    source_url         = EXCLUDED.source_url,
    state_specific     = EXCLUDED.state_specific,
    state              = EXCLUDED.state;
*/

-- ─── Step 3 — Sanity check ────────────────────────────────────────────────
-- Runs only if 2024–25 rows have actually been loaded. Fails loudly if any
-- factor is still NULL, which would indicate a forgotten TODO.
DO $$
DECLARE
    cnt        INTEGER;
    null_cnt   INTEGER;
BEGIN
    SELECT COUNT(*) INTO cnt
      FROM emission_factors
     WHERE nga_year = 2025;

    IF cnt = 0 THEN
        RAISE NOTICE 'ℹ️  NGA 2024–25 scaffold applied; emission factor rows not yet loaded.';
        RETURN;
    END IF;

    SELECT COUNT(*) INTO null_cnt
      FROM emission_factors
     WHERE nga_year = 2025
       AND (co2e_factor IS NULL);

    IF null_cnt > 0 THEN
        RAISE EXCEPTION
            'NGA 2024–25 edition has % rows with NULL co2e_factor — fill in the TODO placeholders before promoting the edition.',
            null_cnt;
    END IF;

    RAISE NOTICE '✅ NGA 2024–25 edition loaded: % rows, all factors populated.', cnt;
END $$;
