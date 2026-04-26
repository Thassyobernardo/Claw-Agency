-- =============================================================================
-- Migration 014 — Refresh emission factors to NGA Factors 2024 (DCCEEW)
--
-- Why: Scope 2 electricity factors are updated ANNUALLY by DCCEEW. Each state
-- factor changes 2-3% per year as the grid decarbonises. Reporting under
-- AASB S2 must use the LATEST NGA Factors edition published before the end
-- of the reporting period.
--
-- Source: National Greenhouse Accounts Factors 2024 (DCCEEW, August 2024)
-- URL:    https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024
--
-- IMPORTANT: NGA Factors 2025 was released in August 2025 and applies to
-- NGER reports for the 2025-26 reporting year (FY 2025-26). This migration
-- moves to NGA 2024 (FY 2023-24 reporting). When you upgrade to NGA 2025,
-- create migration 015 mirroring this structure.
--
-- Verified Scope 2 location-based values (NGA 2024 Table 5):
--   NSW:  0.66 kg CO2-e/kWh   (was 0.73 in older seed)
--   VIC:  0.79 kg CO2-e/kWh   (was 0.81)
--   QLD:  0.71 kg CO2-e/kWh   (was 0.83)
--   SA:   0.20 kg CO2-e/kWh   (was 0.36)
--   WA:   0.51 kg CO2-e/kWh   (was 0.72)
--   TAS:  0.13 kg CO2-e/kWh   (was 0.17)
--   ACT:  0.66 kg CO2-e/kWh   (interconnected with NSW)
--   NT:   0.61 kg CO2-e/kWh   (was 0.62)
-- =============================================================================

-- Step 1: Mark old (2024-edition-tagged-as-current) factors as superseded
UPDATE emission_factors
SET    is_current = FALSE
WHERE  is_current = TRUE
  AND  scope = 2
  AND  unit  = 'kWh';

-- Step 2: Insert verified NGA 2024 Scope 2 location-based factors
INSERT INTO emission_factors (
    nga_year, is_current, scope, category, subcategory, activity, unit,
    co2e_factor, co2_factor, ch4_factor, n2o_factor,
    calculation_method, match_keywords, source_table, source_url, state_specific, state
) VALUES

-- New South Wales
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — NSW Grid', 'kWh',
 0.66, 0.660, 0.0, 0.0, 'activity_based',
 ARRAY['ausgrid','endeavour energy','essential energy','electricity nsw','agl nsw','origin nsw'],
 'NGA 2024 Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024',
 TRUE, 'NSW'),

-- Victoria
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — VIC Grid', 'kWh',
 0.79, 0.790, 0.0, 0.0, 'activity_based',
 ARRAY['citipower','powercor','jemena electricity','ausnet','united energy','electricity vic','agl vic','origin vic'],
 'NGA 2024 Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024',
 TRUE, 'VIC'),

-- Queensland
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — QLD Grid', 'kWh',
 0.71, 0.710, 0.0, 0.0, 'activity_based',
 ARRAY['energex','ergon','electricity qld','agl qld','origin qld'],
 'NGA 2024 Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024',
 TRUE, 'QLD'),

-- South Australia
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — SA Grid', 'kWh',
 0.20, 0.200, 0.0, 0.0, 'activity_based',
 ARRAY['sa power networks','sapn','electricity sa','agl sa','origin sa'],
 'NGA 2024 Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024',
 TRUE, 'SA'),

-- Western Australia (SWIS)
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — SWIS', 'Electricity — WA Grid', 'kWh',
 0.51, 0.510, 0.0, 0.0, 'activity_based',
 ARRAY['western power','synergy','electricity wa'],
 'NGA 2024 Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024',
 TRUE, 'WA'),

-- Tasmania
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — TAS Grid', 'kWh',
 0.13, 0.130, 0.0, 0.0, 'activity_based',
 ARRAY['tasnetworks','aurora energy','electricity tas'],
 'NGA 2024 Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024',
 TRUE, 'TAS'),

-- ACT (interconnected with NSW grid)
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — NEM', 'Electricity — ACT Grid', 'kWh',
 0.66, 0.660, 0.0, 0.0, 'activity_based',
 ARRAY['evoenergy','electricity act','actewagl'],
 'NGA 2024 Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024',
 TRUE, 'ACT'),

-- Northern Territory (Darwin-Katherine + isolated grids)
(2024, TRUE, 2, 'Purchased Electricity', 'Grid — Isolated', 'Electricity — NT Grid', 'kWh',
 0.61, 0.610, 0.0, 0.0, 'activity_based',
 ARRAY['power and water corporation','jacana energy','electricity nt'],
 'NGA 2024 Table 5', 'https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2024',
 TRUE, 'NT')

ON CONFLICT (nga_year, activity, unit, COALESCE(state, 'ALL'))
DO UPDATE SET
    is_current        = EXCLUDED.is_current,
    co2e_factor       = EXCLUDED.co2e_factor,
    co2_factor        = EXCLUDED.co2_factor,
    match_keywords    = EXCLUDED.match_keywords,
    source_table      = EXCLUDED.source_table,
    source_url        = EXCLUDED.source_url;

-- Step 3: Audit log entry — note the factor refresh in case the question
-- "what factors did this report use?" comes up during audit.
COMMENT ON TABLE emission_factors IS
'Australian emission factors. Source: DCCEEW NGA Factors workbook. Updated annually each August. Run a fresh migration each year matching the new edition.';
