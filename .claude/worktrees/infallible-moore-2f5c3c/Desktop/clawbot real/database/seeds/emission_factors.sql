-- =============================================================================
-- EcoLink Australia — Emission Factors Seed Data
-- Source: National Greenhouse Accounts (NGA) Factors 2023–24 Edition
--         Australian Government, DCCEEW
--         https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors
--
-- Units:  All co2e_factor values are in kg CO2e per stated unit.
-- Notes:
--   - Electricity factors vary by state (NEM vs SWIS vs isolated grids).
--   - Spend-based factors use AUD as the unit (kg CO2e per AUD spent).
--   - match_keywords are used by the AI classifier to auto-match transactions.
-- =============================================================================

-- Mark all existing factors for this year as not current (idempotent re-run)
UPDATE emission_factors SET is_current = FALSE WHERE nga_year = 2024;

-- =============================================================================
-- SCOPE 1 — STATIONARY COMBUSTION
-- =============================================================================
INSERT INTO emission_factors
    (nga_year, is_current, scope, category, subcategory, activity, unit,
     co2e_factor, co2_factor, ch4_factor, n2o_factor,
     calculation_method, match_keywords, source_table, source_url, state_specific, state)
VALUES
-- Natural Gas (commercial/residential)
(2024, TRUE, 1, 'Stationary Combustion', 'Natural Gas', 'Natural Gas — Commercial & Industrial', 'GJ',
 51.53, 51.22, 0.19, 0.12, 'activity_based',
 ARRAY['natural gas','gas bill','agl gas','origin gas','energy australia gas','jemena'], 'Table 1', NULL, FALSE, NULL),

-- Diesel — Stationary (generators, equipment)
(2024, TRUE, 1, 'Stationary Combustion', 'Liquid Fuels', 'Diesel — Stationary Combustion', 'L',
 2.703, 2.657, 0.026, 0.020, 'activity_based',
 ARRAY['diesel','generator','genset','fuel delivery stationary'], 'Table 2', NULL, FALSE, NULL),

-- LPG — Stationary
(2024, TRUE, 1, 'Stationary Combustion', 'Liquid Fuels', 'LPG — Stationary Combustion', 'L',
 1.603, 1.555, 0.031, 0.016, 'activity_based',
 ARRAY['lpg','liquid petroleum','bottled gas','elgas','origin lpg'], 'Table 2', NULL, FALSE, NULL),

-- =============================================================================
-- SCOPE 1 — TRANSPORT COMBUSTION
-- =============================================================================

-- Petrol — Passenger Vehicles
(2024, TRUE, 1, 'Transport Combustion', 'Road Transport', 'Petrol — Passenger Vehicles', 'L',
 2.289, 2.261, 0.015, 0.013, 'activity_based',
 ARRAY['bp','shell','caltex','ampol','7-eleven fuel','petrol','unleaded','91','95','98','servo'], 'Table 3', NULL, FALSE, NULL),

-- Diesel — Passenger Vehicles
(2024, TRUE, 1, 'Transport Combustion', 'Road Transport', 'Diesel — Passenger Vehicles', 'L',
 2.703, 2.657, 0.026, 0.020, 'activity_based',
 ARRAY['diesel vehicle','diesel car','diesel ute','diesel truck'], 'Table 3', NULL, FALSE, NULL),

-- Diesel — Heavy Commercial Vehicles
(2024, TRUE, 1, 'Transport Combustion', 'Road Transport', 'Diesel — Heavy Vehicles (>3.5t GVM)', 'L',
 2.703, 2.657, 0.036, 0.010, 'activity_based',
 ARRAY['truck fuel','semi fuel','hcv diesel','fleet diesel','transport diesel'], 'Table 3', NULL, FALSE, NULL),

-- Aviation — Domestic Jet Fuel
(2024, TRUE, 1, 'Transport Combustion', 'Aviation', 'Aviation Turbine Fuel — Domestic', 'L',
 2.533, 2.521, 0.005, 0.007, 'activity_based',
 ARRAY['jet fuel','avtur','aviation fuel'], 'Table 3', NULL, FALSE, NULL),

-- =============================================================================
-- SCOPE 2 — PURCHASED ELECTRICITY (State-specific, kg CO2e per kWh)
-- Australian Energy Market — 2023–24 NGA grid emission factors
-- =============================================================================

-- New South Wales & ACT (interconnected)
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — NSW Grid', 'kWh',
 0.73, 0.730, 0.0, 0.0, 'activity_based',
 ARRAY['ausgrid','endeavour energy','essential energy','electricity nsw'], 'Table 6', NULL, TRUE, 'NSW'),

-- Victoria
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — VIC Grid', 'kWh',
 0.81, 0.810, 0.0, 0.0, 'activity_based',
 ARRAY['citipower','powercor','jemena electricity','ausnet','united energy','electricity vic'], 'Table 6', NULL, TRUE, 'VIC'),

-- Queensland
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — QLD Grid', 'kWh',
 0.83, 0.830, 0.0, 0.0, 'activity_based',
 ARRAY['energex','ergon','electricity qld'], 'Table 6', NULL, TRUE, 'QLD'),

-- South Australia
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — SA Grid', 'kWh',
 0.36, 0.360, 0.0, 0.0, 'activity_based',
 ARRAY['sa power networks','electricity sa'], 'Table 6', NULL, TRUE, 'SA'),

-- Western Australia (SWIS)
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — SWIS', 'Electricity — WA Grid', 'kWh',
 0.72, 0.720, 0.0, 0.0, 'activity_based',
 ARRAY['western power','synergy','electricity wa'], 'Table 6', NULL, TRUE, 'WA'),

-- Tasmania
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — TAS Grid', 'kWh',
 0.17, 0.170, 0.0, 0.0, 'activity_based',
 ARRAY['tasnetworks','aurora energy','electricity tas'], 'Table 6', NULL, TRUE, 'TAS'),

-- ACT (same as NSW interconnect, but ACT sources high renewable %)
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — ACT Grid', 'kWh',
 0.73, 0.730, 0.0, 0.0, 'activity_based',
 ARRAY['evoenergy','electricity act'], 'Table 6', NULL, TRUE, 'ACT'),

-- Northern Territory (isolated grid)
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — Isolated', 'Electricity — NT Grid', 'kWh',
 0.62, 0.620, 0.0, 0.0, 'activity_based',
 ARRAY['power and water corporation','electricity nt'], 'Table 6', NULL, TRUE, 'NT'),

-- =============================================================================
-- SCOPE 3 — SPEND-BASED FACTORS (kg CO2e per AUD)
-- Used when quantity data is unavailable — AI falls back to spend-based.
-- Source: Derived from Australian EEIO tables & NGA spend-based factors.
-- =============================================================================

-- Air Travel — Domestic (per AUD spent on flights)
(2024, TRUE, 3, 'Business Travel', 'Air Travel', 'Air Travel — Domestic Flights (spend-based)', 'AUD',
 0.00185, NULL, NULL, NULL, 'spend_based',
 ARRAY['qantas','virgin australia','jetstar','rex airlines','airfare','flight','domestic flight','return flight'], 'Appendix A', NULL, FALSE, NULL),

-- Air Travel — International (per AUD spent)
(2024, TRUE, 3, 'Business Travel', 'Air Travel', 'Air Travel — International Flights (spend-based)', 'AUD',
 0.00120, NULL, NULL, NULL, 'spend_based',
 ARRAY['international flight','overseas flight','emirates','singapore airlines','cathay','united airlines'], 'Appendix A', NULL, FALSE, NULL),

-- Accommodation — Hotels (per AUD)
(2024, TRUE, 3, 'Business Travel', 'Accommodation', 'Accommodation — Hotels & Motels (spend-based)', 'AUD',
 0.00048, NULL, NULL, NULL, 'spend_based',
 ARRAY['hilton','marriott','accor','holiday inn','ibis','hotel','motel','airbnb','accommodation'], 'Appendix A', NULL, FALSE, NULL),

-- Road Transport — Ride Share / Taxis (per AUD)
(2024, TRUE, 3, 'Business Travel', 'Road Transport', 'Ground Transport — Taxi & Ride Share (spend-based)', 'AUD',
 0.00062, NULL, NULL, NULL, 'spend_based',
 ARRAY['uber','ola','didi','13cabs','yellow taxi','rideshare','taxi'], 'Appendix A', NULL, FALSE, NULL),

-- Freight — Domestic Road (per AUD)
(2024, TRUE, 3, 'Upstream Transportation', 'Freight', 'Freight — Domestic Road (spend-based)', 'AUD',
 0.00091, NULL, NULL, NULL, 'spend_based',
 ARRAY['toll','startrack','aramex','sendle','couriers please','fastway','freight','courier','delivery'], 'Appendix A', NULL, FALSE, NULL),

-- Freight — Domestic Air (per AUD)
(2024, TRUE, 3, 'Upstream Transportation', 'Freight', 'Freight — Domestic Air (spend-based)', 'AUD',
 0.00310, NULL, NULL, NULL, 'spend_based',
 ARRAY['air freight','air cargo','overnight freight','express air'], 'Appendix A', NULL, FALSE, NULL),

-- Purchased Goods — Food & Beverages (per AUD)
(2024, TRUE, 3, 'Purchased Goods & Services', 'Food & Beverage', 'Purchased Goods — Food & Beverages (spend-based)', 'AUD',
 0.00290, NULL, NULL, NULL, 'spend_based',
 ARRAY['woolworths','coles','aldi','costco','iga','supermarket','grocery','catering','cafe','restaurant'], 'Appendix A', NULL, FALSE, NULL),

-- Purchased Goods — Office Supplies & Paper (per AUD)
(2024, TRUE, 3, 'Purchased Goods & Services', 'Office Supplies', 'Purchased Goods — Office Supplies (spend-based)', 'AUD',
 0.00150, NULL, NULL, NULL, 'spend_based',
 ARRAY['officeworks','staples','cartridges','paper','stationery','office supplies','printer ink'], 'Appendix A', NULL, FALSE, NULL),

-- Purchased Services — Professional Services (per AUD)
(2024, TRUE, 3, 'Purchased Goods & Services', 'Professional Services', 'Purchased Services — Professional & Business Services (spend-based)', 'AUD',
 0.00032, NULL, NULL, NULL, 'spend_based',
 ARRAY['consulting','legal','accounting','audit','advisory','law firm'], 'Appendix A', NULL, FALSE, NULL),

-- Purchased Services — IT & Telecoms (per AUD)
(2024, TRUE, 3, 'Purchased Goods & Services', 'IT & Telecoms', 'Purchased Services — IT & Telecommunications (spend-based)', 'AUD',
 0.00028, NULL, NULL, NULL, 'spend_based',
 ARRAY['telstra','optus','vodafone','tpg','internet','phone bill','mobile plan','cloud','aws','azure','google cloud','software subscription'], 'Appendix A', NULL, FALSE, NULL),

-- Waste — Landfill (per tonne)
(2024, TRUE, 3, 'Waste', 'Solid Waste', 'Waste — Municipal Solid Waste to Landfill', 'tonne',
 467.0, 10.0, 457.0, 0.0, 'activity_based',
 ARRAY['waste disposal','rubbish collection','skip bin','cleanaway','suez waste','veolia'], 'Table 9', NULL, FALSE, NULL),

-- Water Supply (per kL)
(2024, TRUE, 3, 'Purchased Goods & Services', 'Water', 'Water — Mains Supply (spend-based)', 'kL',
 0.299, 0.299, 0.0, 0.0, 'activity_based',
 ARRAY['sydney water','yarra valley water','seqwater','water bill','water usage'], 'Table 10', NULL, FALSE, NULL);


-- =============================================================================
-- SCOPE 1 — REFRIGERANTS (F-gases, GWP from IPCC AR6)
-- =============================================================================
INSERT INTO emission_factors
    (nga_year, is_current, scope, category, subcategory, activity, unit,
     co2e_factor, co2_factor, ch4_factor, n2o_factor,
     calculation_method, match_keywords, source_table, source_url, state_specific, state)
VALUES
(2024, TRUE, 1, 'Fugitive Emissions', 'Refrigerants', 'Refrigerant — R-410A (HVAC)', 'kg',
 2088.0, NULL, NULL, NULL, 'activity_based',
 ARRAY['refrigerant recharge','hvac regas','r410a','air conditioning regas'], 'Table 7', NULL, FALSE, NULL),

(2024, TRUE, 1, 'Fugitive Emissions', 'Refrigerants', 'Refrigerant — R-32 (HVAC)', 'kg',
 675.0, NULL, NULL, NULL, 'activity_based',
 ARRAY['r32','r-32','refrigerant r32'], 'Table 7', NULL, FALSE, NULL),

(2024, TRUE, 1, 'Fugitive Emissions', 'Refrigerants', 'Refrigerant — R-134a (Automotive)', 'kg',
 1430.0, NULL, NULL, NULL, 'activity_based',
 ARRAY['r134a','car aircon regas','automotive refrigerant'], 'Table 7', NULL, FALSE, NULL);


-- =============================================================================
-- Verify row count
-- =============================================================================
DO $$
DECLARE cnt INTEGER;
BEGIN
    SELECT COUNT(*) INTO cnt FROM emission_factors WHERE nga_year = 2024;
    RAISE NOTICE '✅ Inserted % emission factor rows for NGA 2023–24 edition.', cnt;
END $$;
