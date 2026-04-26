-- =============================================================================
-- Migration 013 — GHG Protocol Cat 6 (Business Travel) split + cleanup
--
-- Why: Migration 005 lumped Uber/taxi/train/bus/ferry into either road_freight
-- (Cat 4) or "transport" generic — both incorrect under GHG Protocol.
--
-- GHG Protocol Scope 3 Standard mandates these splits:
--   Cat 4 — Upstream transportation:  ONLY courier/freight transporting goods
--                                      the entity has PURCHASED (not personnel)
--   Cat 6 — Business travel:           ALL passenger transport for staff:
--                                      flights, taxi, rideshare, train, bus,
--                                      ferry, hotel travel days
--
-- We split air travel into domestic vs international (NGA publishes separate
-- factors for each — IATA/ICAO methodology requires this).
-- =============================================================================

-- ── 1. Add new categories ─────────────────────────────────────────────────────
INSERT INTO emission_categories (code, label, scope, description) VALUES

  -- Cat 6 — Business Travel (Scope 3.6)
  ('air_travel_domestic',  'Air Travel — Domestic',     3, 'Domestic flights within Australia (NGA Table 38, IATA passenger-km)'),
  ('air_travel_international', 'Air Travel — International', 3, 'International flights (DEFRA passenger-km, RFI included)'),
  ('rideshare_taxi',       'Rideshare & Taxi',          3, 'Uber, taxi, rideshare for business travel (Cat 6)'),
  ('public_transport',     'Public Transport',          3, 'Train, bus, ferry, tram for business travel (Cat 6)'),
  ('rental_vehicle',       'Rental Vehicle',            3, 'Hire car for business travel (Cat 6)'),
  ('accommodation_business','Business Accommodation',   3, 'Hotels for business travel (Cat 6 — passenger nights)'),

  -- Cat 4 — Upstream transportation of GOODS (only)
  -- (the existing road_freight entry stays but description tightened below)

  -- Cat 1 — Purchased Goods & Services (activity-based via supplier emissions)
  ('purchased_goods',      'Purchased Goods',           3, 'Physical goods purchased for business operations (Cat 1)'),
  ('purchased_services',   'Purchased Services',        3, 'Professional services, consulting, software (Cat 1)'),

  -- Scope 1 — Refrigerants (fugitive emissions, NGA Table 7)
  ('refrigerants',         'Refrigerant Recharge',      1, 'HVAC and automotive refrigerant top-ups (NGA Table 7, GWP-weighted)'),

  -- Excluded — for transactions that should not count toward emissions
  ('excluded_personal',    'Excluded — Personal Expense', 3, 'Outside operational control boundary'),
  ('excluded_finance',     'Excluded — Finance/Tax',    3, 'Bank fees, interest, GST, payroll — not emission-relevant')

ON CONFLICT (code) DO NOTHING;

-- ── 2. Tighten descriptions on existing categories that were ambiguous ───────
UPDATE emission_categories
SET    description = 'Courier/freight services transporting goods purchased by the entity (Cat 4). NOT for staff transport — use rideshare_taxi/public_transport for that.'
WHERE  code = 'road_freight';

UPDATE emission_categories
SET    description = 'DEPRECATED — split into air_travel_domestic and air_travel_international. New transactions should use the split codes.'
WHERE  code = 'air_travel';

UPDATE emission_categories
SET    description = 'DEPRECATED — split into accommodation_business (Cat 6) and purchased_services for non-travel hospitality.'
WHERE  code = 'accommodation';

UPDATE emission_categories
SET    description = 'DEPRECATED — meals are not directly emission-relevant under GHG Protocol unless catering scale. Consider purchased_services or excluded.'
WHERE  code = 'meals_entertainment';

UPDATE emission_categories
SET    description = 'DEPRECATED — water is typically excluded for SMEs under operational control boundary unless metered.'
WHERE  code = 'water';

UPDATE emission_categories
SET    description = 'DEPRECATED — IT/cloud activity-based requires kWh from supplier (Scope 3.1). Reclassify on supplier disclosure.'
WHERE  code = 'it_cloud';

UPDATE emission_categories
SET    description = 'DEPRECATED — office supplies activity-based requires supplier-specific factors (Scope 3.1). Reclassify on supplier disclosure.'
WHERE  code = 'office_supplies';
