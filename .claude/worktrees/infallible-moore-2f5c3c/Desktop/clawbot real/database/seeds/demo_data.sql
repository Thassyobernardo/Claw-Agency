-- =============================================================================
-- EcoLink Australia — Demo Data Seed
-- Creates a sample company + realistic FY 2023-24 transactions
-- Run with: npm run migrate:seed:demo
-- =============================================================================

-- Upsert demo company
INSERT INTO companies (
  id, name, abn, industry_anzsic_code, industry_description,
  city, state, plan, reporting_currency, baseline_year, fy_start_month
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Acme Building Supplies Pty Ltd',
  '51824753556',
  'F',
  'Construction',
  'Sydney', 'NSW', 'professional', 'AUD', 2022, 7
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Clear existing demo transactions
DELETE FROM transactions WHERE company_id = '00000000-0000-0000-0000-000000000001';

-- =============================================================================
-- SCOPE 1 — Direct Emissions (petrol, diesel, LPG)
-- =============================================================================
INSERT INTO transactions
  (company_id, source, transaction_date, description, supplier_name,
   amount_aud, account_code, account_name,
   emission_factor_id, classification_status, classification_confidence,
   quantity_value, quantity_unit, co2e_kg, scope,
   reporting_year, reporting_quarter, classified_by, classified_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'xero', d::date,
  desc_text, supplier,
  amount, '420', 'Motor Vehicle Expenses',
  ef.id, 'classified', 0.94,
  qty, 'L',
  ROUND((qty * ef.co2e_factor)::numeric, 2), 1,
  2024,
  CASE WHEN EXTRACT(MONTH FROM d::date) BETWEEN 7 AND 9 THEN 1
       WHEN EXTRACT(MONTH FROM d::date) BETWEEN 10 AND 12 THEN 2
       WHEN EXTRACT(MONTH FROM d::date) BETWEEN 1 AND 3 THEN 3
       ELSE 4 END,
  'ai', NOW()
FROM (VALUES
  ('2023-07-08', 'BP Station — Parramatta Rd',      'BP Australia',        185.40, 65.0),
  ('2023-07-22', 'Ampol — Penrith',                 'Ampol',               220.50, 75.0),
  ('2023-08-05', 'Shell — North Sydney',            'Shell',               198.60, 70.0),
  ('2023-08-19', 'Caltex — Blacktown',              'Caltex',              210.30, 74.0),
  ('2023-09-03', 'BP Station — Liverpool',          'BP Australia',        175.20, 62.0),
  ('2023-09-17', 'Ampol — Campbelltown',            'Ampol',               230.80, 80.0),
  ('2023-10-01', '7-Eleven Fuel — Homebush',        '7-Eleven',            192.40, 68.0),
  ('2023-10-15', 'Caltex — Parramatta',             'Caltex',              205.70, 72.0),
  ('2023-11-02', 'BP Station — Chatswood',          'BP Australia',        188.90, 66.0),
  ('2023-11-20', 'Shell — Ryde',                    'Shell',               215.60, 76.0),
  ('2023-12-04', 'Ampol — Hornsby',                 'Ampol',               225.10, 78.0),
  ('2023-12-18', 'BP Station — Manly',              'BP Australia',        178.30, 63.0),
  ('2024-01-08', 'Caltex — Bondi Junction',         'Caltex',              201.50, 71.0),
  ('2024-01-22', 'Shell — Surry Hills',             'Shell',               195.80, 69.0),
  ('2024-02-06', 'BP Station — Newtown',            'BP Australia',        183.20, 64.0),
  ('2024-02-20', 'Ampol — Marrickville',            'Ampol',               218.90, 77.0),
  ('2024-03-05', '7-Eleven Fuel — Redfern',         '7-Eleven',            190.10, 67.0),
  ('2024-03-19', 'Caltex — Leichhardt',             'Caltex',              208.40, 73.0),
  ('2024-04-02', 'Shell — Glebe',                   'Shell',               212.70, 75.0),
  ('2024-04-16', 'BP Station — Ultimo',             'BP Australia',        180.60, 63.5),
  ('2024-05-01', 'Ampol — Pyrmont',                 'Ampol',               222.30, 78.0),
  ('2024-05-15', 'Caltex — Zetland',                'Caltex',              197.40, 70.0),
  ('2024-06-03', 'Shell — Waterloo',                'Shell',               203.80, 72.0),
  ('2024-06-17', 'BP Station — Alexandria',         'BP Australia',        187.50, 66.0)
) AS t(d, desc_text, supplier, amount, qty)
CROSS JOIN emission_factors ef
WHERE ef.activity = 'Petrol — Passenger Vehicles' AND ef.nga_year = 2024;

-- =============================================================================
-- SCOPE 2 — Purchased Electricity
-- =============================================================================
INSERT INTO transactions
  (company_id, source, transaction_date, description, supplier_name,
   amount_aud, account_code, account_name,
   emission_factor_id, classification_status, classification_confidence,
   quantity_value, quantity_unit, co2e_kg, scope,
   reporting_year, reporting_quarter, classified_by, classified_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'xero', d::date,
  desc_text, supplier,
  amount, '423', 'Electricity',
  ef.id, 'classified', 0.97,
  qty, 'kWh',
  ROUND((qty * ef.co2e_factor)::numeric, 2), 2,
  2024,
  CASE WHEN EXTRACT(MONTH FROM d::date) BETWEEN 7 AND 9 THEN 1
       WHEN EXTRACT(MONTH FROM d::date) BETWEEN 10 AND 12 THEN 2
       WHEN EXTRACT(MONTH FROM d::date) BETWEEN 1 AND 3 THEN 3
       ELSE 4 END,
  'ai', NOW()
FROM (VALUES
  ('2023-07-01', 'Ausgrid — July 2023 Invoice',    'Ausgrid', 420.30, 580.0),
  ('2023-08-01', 'Ausgrid — August 2023 Invoice',  'Ausgrid', 398.70, 545.0),
  ('2023-09-01', 'Ausgrid — September 2023',       'Ausgrid', 385.20, 528.0),
  ('2023-10-01', 'Ausgrid — October 2023',         'Ausgrid', 412.80, 565.0),
  ('2023-11-01', 'Ausgrid — November 2023',        'Ausgrid', 445.60, 610.0),
  ('2023-12-01', 'Ausgrid — December 2023',        'Ausgrid', 468.90, 642.0),
  ('2024-01-01', 'Ausgrid — January 2024',         'Ausgrid', 479.40, 657.0),
  ('2024-02-01', 'Ausgrid — February 2024',        'Ausgrid', 461.20, 632.0),
  ('2024-03-01', 'Ausgrid — March 2024',           'Ausgrid', 425.50, 583.0),
  ('2024-04-01', 'Ausgrid — April 2024',           'Ausgrid', 390.80, 535.0),
  ('2024-05-01', 'Ausgrid — May 2024',             'Ausgrid', 372.60, 510.0),
  ('2024-06-01', 'Ausgrid — June 2024',            'Ausgrid', 395.10, 541.0)
) AS t(d, desc_text, supplier, amount, qty)
CROSS JOIN emission_factors ef
WHERE ef.activity = 'Electricity — NSW Grid' AND ef.nga_year = 2024;

-- =============================================================================
-- SCOPE 3 — Air Travel
-- =============================================================================
INSERT INTO transactions
  (company_id, source, transaction_date, description, supplier_name,
   amount_aud, account_code, account_name,
   emission_factor_id, classification_status, classification_confidence,
   quantity_value, quantity_unit, co2e_kg, scope,
   reporting_year, reporting_quarter, classified_by, classified_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'xero', d::date,
  desc_text, supplier,
  amount, '404', 'Travel — Domestic',
  ef.id, 'classified', 0.88,
  amount, 'AUD',
  ROUND((amount * ef.co2e_factor)::numeric, 2), 3,
  2024,
  CASE WHEN EXTRACT(MONTH FROM d::date) BETWEEN 7 AND 9 THEN 1
       WHEN EXTRACT(MONTH FROM d::date) BETWEEN 10 AND 12 THEN 2
       WHEN EXTRACT(MONTH FROM d::date) BETWEEN 1 AND 3 THEN 3
       ELSE 4 END,
  'ai', NOW()
FROM (VALUES
  ('2023-07-15', 'Qantas — SYD-MEL Return (J Smith)',     'Qantas',          654.00),
  ('2023-08-22', 'Virgin Australia — SYD-BNE Return',     'Virgin Australia', 487.00),
  ('2023-09-10', 'Jetstar — SYD-ADL Return (Conference)', 'Jetstar',          312.00),
  ('2023-10-18', 'Qantas — SYD-MEL Return (Board Mtg)',  'Qantas',           720.00),
  ('2023-11-05', 'Virgin Australia — SYD-PER Return',    'Virgin Australia',  1240.00),
  ('2023-12-12', 'Qantas — SYD-BNE Return (Client)',     'Qantas',           598.00),
  ('2024-01-24', 'Jetstar — SYD-MEL Return',             'Jetstar',           289.00),
  ('2024-02-14', 'Qantas — SYD-CBR Return (Gov Meeting)','Qantas',           445.00),
  ('2024-03-08', 'Virgin Australia — SYD-MEL Return',    'Virgin Australia',  512.00),
  ('2024-04-19', 'Qantas — SYD-BNE Return',              'Qantas',           634.00),
  ('2024-05-07', 'Rex Airlines — SYD-OOL Return',        'Rex Airlines',     395.00),
  ('2024-06-21', 'Qantas — SYD-MEL Return (Yr End)',     'Qantas',           678.00)
) AS t(d, desc_text, supplier, amount)
CROSS JOIN emission_factors ef
WHERE ef.activity = 'Air Travel — Domestic Flights (spend-based)' AND ef.nga_year = 2024;

-- =============================================================================
-- SCOPE 3 — Freight & Couriers
-- =============================================================================
INSERT INTO transactions
  (company_id, source, transaction_date, description, supplier_name,
   amount_aud, account_code, account_name,
   emission_factor_id, classification_status, classification_confidence,
   quantity_value, quantity_unit, co2e_kg, scope,
   reporting_year, reporting_quarter, classified_by, classified_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'xero', d::date,
  desc_text, supplier,
  amount, '413', 'Freight & Couriers',
  ef.id, 'classified', 0.91,
  amount, 'AUD',
  ROUND((amount * ef.co2e_factor)::numeric, 2), 3,
  2024,
  CASE WHEN EXTRACT(MONTH FROM d::date) BETWEEN 7 AND 9 THEN 1
       WHEN EXTRACT(MONTH FROM d::date) BETWEEN 10 AND 12 THEN 2
       WHEN EXTRACT(MONTH FROM d::date) BETWEEN 1 AND 3 THEN 3
       ELSE 4 END,
  'ai', NOW()
FROM (VALUES
  ('2023-07-12', 'Toll Priority — Building Materials Delivery', 'Toll',          1240.00),
  ('2023-08-03', 'StarTrack — Equipment Freight SYD-MEL',      'StarTrack',      890.00),
  ('2023-09-25', 'Aramex — Courier Services',                  'Aramex',         345.00),
  ('2023-10-14', 'Toll Priority — Steel Delivery',             'Toll',          1560.00),
  ('2023-11-28', 'Sendle — Online Orders Fulfillment',         'Sendle',         278.00),
  ('2023-12-08', 'StarTrack — Christmas Rush Deliveries',      'StarTrack',     1120.00),
  ('2024-01-19', 'Toll Priority — Site Materials',             'Toll',          1380.00),
  ('2024-02-09', 'Couriers Please — Document Delivery',        'Couriers Please', 156.00),
  ('2024-03-22', 'Aramex — Equipment Parts',                   'Aramex',          422.00),
  ('2024-04-11', 'Toll Priority — Bulk Delivery',              'Toll',           1690.00),
  ('2024-05-24', 'StarTrack — Urgent Freight',                 'StarTrack',       745.00),
  ('2024-06-14', 'Sendle — Ecommerce Deliveries',              'Sendle',          312.00)
) AS t(d, desc_text, supplier, amount)
CROSS JOIN emission_factors ef
WHERE ef.activity = 'Freight — Domestic Road (spend-based)' AND ef.nga_year = 2024;

-- =============================================================================
-- SCOPE 3 — Office Supplies (needs_review to show that status)
-- =============================================================================
INSERT INTO transactions
  (company_id, source, transaction_date, description, supplier_name,
   amount_aud, account_code, account_name,
   classification_status, scope, reporting_year, reporting_quarter,
   classified_by)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'xero', '2023-08-14',
   'Officeworks — Office Supplies July', 'Officeworks', 287.40, '400', 'Office Supplies',
   'needs_review', 3, 2024, 1, 'ai'),
  ('00000000-0000-0000-0000-000000000001', 'xero', '2023-10-22',
   'Staples — Stationery & Printer Ink', 'Staples', 154.90, '400', 'Office Supplies',
   'needs_review', 3, 2024, 2, 'ai'),
  ('00000000-0000-0000-0000-000000000001', 'xero', '2024-02-28',
   'Officeworks — Laptop Accessories', 'Officeworks', 445.20, '400', 'Office Supplies',
   'needs_review', 3, 2024, 3, 'ai'),
  ('00000000-0000-0000-0000-000000000001', 'xero', '2024-05-10',
   'Harvey Norman — Office Equipment', 'Harvey Norman', 2340.00, '710', 'Computer Equipment',
   'factor_not_found', NULL, 2024, 4, 'ai');

-- =============================================================================
-- Verify
-- =============================================================================
DO $$
DECLARE
  tx_count INTEGER;
  co2e_total NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(co2e_kg)/1000, 0)
  INTO tx_count, co2e_total
  FROM transactions
  WHERE company_id = '00000000-0000-0000-0000-000000000001';

  RAISE NOTICE '✅ Demo data: % transactions, % t CO2e total', tx_count, ROUND(co2e_total, 1);
END $$;
