-- ============================================================
-- 016_merchant_classification_rules.sql
--
-- Deterministic merchant → GHG Protocol category mapping.
-- Replaces AI ensemble for known Australian merchants.
--
-- Design principles (AASB S2 / NGA Factors 2024 compliance):
--   • Category is rule-assigned (100% confidence, auditable)
--   • Quantity/unit must still come from transaction data
--   • No quantity found → needs_review with category pre-filled
--   • All rules cite the NGA Factors 2024 table they use
--   • AI fallback is REMOVED from classify route after this migration
--
-- Run on: Supabase Sydney (ap-southeast-2) — project mezuhbjwkksfxgvhwvwx
-- ============================================================

CREATE TABLE IF NOT EXISTS merchant_classification_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_name   TEXT        NOT NULL,                    -- human-readable (display/admin)
  pattern         TEXT        NOT NULL,                    -- matched against LOWER(description)
  match_type      TEXT        NOT NULL DEFAULT 'contains', -- 'contains' | 'starts_with' | 'exact'
  category_code   TEXT        NOT NULL,                    -- FK-equivalent to emission_categories.code
  scope           SMALLINT    NOT NULL,                    -- 1 | 2 | 3 (0 = excluded, no scope)
  activity_unit   TEXT,                                    -- L | kWh | km | tonne | NULL
  requires_state  BOOLEAN     NOT NULL DEFAULT FALSE,      -- TRUE for Scope 2 electricity (NGA state factors)
  notes_citation  TEXT,                                    -- audit trail: NGA table reference
  priority        SMALLINT    NOT NULL DEFAULT 100,        -- higher = checked first
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast rule lookups on every classify call
CREATE INDEX IF NOT EXISTS idx_mcr_active_priority
  ON merchant_classification_rules(is_active, priority DESC);

-- Auto-update timestamp
CREATE TRIGGER set_merchant_rules_updated_at
  BEFORE UPDATE ON merchant_classification_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── SEED: Australian fuel stations (Scope 1 — Stationary / Mobile Combustion) ─
-- Note: rule identifies merchant type only. Quantity (litres) + fuel type (petrol/diesel)
--       must come from transaction description or manual entry.
--       category defaults to fuel_petrol; reviewer may change to fuel_diesel.
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('BP Australia',          'bp ',          'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('BP Australia',          ' bp',          'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 199),
  ('Ampol (fmr. Caltex)',   'ampol',        'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('Caltex (legacy)',       'caltex',       'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('Viva Energy (Shell)',   'viva energy',  'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 205),
  ('Shell',                 'shell ',       'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('Coles Express',         'coles express','contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 210),
  ('7-Eleven (fuel)',       '7-eleven',     'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('United Petroleum',      'united petro', 'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('Puma Energy',           'puma energy',  'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('OTR (On The Run)',      'otr ',         'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('EG Group',              'eg group',     'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('Metro Petroleum',       'metro petrol', 'contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200),
  ('Petstock (fuel)',       'petstock fuel','contains', 'fuel_petrol', 1, 'L', FALSE, 'NGA Factors 2024, Table 4 – Liquid fuels', 200)
ON CONFLICT DO NOTHING;

-- ── SEED: Electricity retailers (Scope 2 — Location-based, state-specific) ───
-- CRITICAL: requires_state = TRUE. Without company.state, transaction → needs_review.
-- NGA 2024 factors differ by state: NSW 0.66, VIC 0.79, QLD 0.71, SA 0.20,
-- WA 0.51, TAS 0.13, ACT 0.66, NT 0.61 kg CO2e/kWh.
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('EnergyAustralia',      'energyaustralia',    'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Origin Energy',        'origin energy',      'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('AGL Energy',           'agl',                'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('ActewAGL',             'actewagl',           'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 310),
  ('Synergy (WA)',         'synergy',            'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Aurora Energy (TAS)',  'aurora energy',      'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Ergon Energy (QLD)',   'ergon',              'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Red Energy',           'red energy',         'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Powershop',            'powershop',          'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Lumo Energy',          'lumo energy',        'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Alinta Energy',        'alinta',             'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Click Energy',         'click energy',       'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Simply Energy',        'simply energy',      'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Momentum Energy',      'momentum energy',    'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('GloBird Energy',       'globird',            'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Tango Energy',         'tango energy',       'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Ausgrid',              'ausgrid',            'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Endeavour Energy',     'endeavour energy',   'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Essential Energy',     'essential energy',   'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('CitiPower',            'citipower',          'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Powercor',             'powercor',           'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('Western Power (WA)',   'western power',      'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('SA Power Networks',    'sa power networks',  'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300),
  ('TasNetworks',          'tasnetworks',        'contains', 'electricity', 2, 'kWh', TRUE, 'NGA Factors 2024, Table 5 – Electricity (state grid)', 300)
ON CONFLICT DO NOTHING;

-- ── SEED: Domestic air travel (Scope 3, Cat 6) ───────────────────────────────
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('Qantas (domestic)',        'qantas',          'contains', 'air_travel_domestic', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (domestic)', 300),
  ('Virgin Australia',         'virgin australia','contains', 'air_travel_domestic', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (domestic)', 300),
  ('Jetstar',                  'jetstar',         'contains', 'air_travel_domestic', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (domestic)', 300),
  ('Rex Airlines',             'rex airlines',    'contains', 'air_travel_domestic', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (domestic)', 300),
  ('Regional Express',         'regional express','contains', 'air_travel_domestic', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (domestic)', 300),
  ('Bonza Airlines',           'bonza',           'contains', 'air_travel_domestic', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (domestic)', 300)
ON CONFLICT DO NOTHING;

-- ── SEED: International air travel (Scope 3, Cat 6) ─────────────────────────
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('Singapore Airlines',  'singapore air',   'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Emirates',            'emirates',        'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Cathay Pacific',      'cathay',          'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Air New Zealand',     'air new zealand', 'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Malaysia Airlines',   'malaysia airline','contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Thai Airways',        'thai airways',    'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('United Airlines',     'united airlines', 'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('American Airlines',   'american airline','contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Lufthansa',           'lufthansa',       'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('British Airways',     'british airways', 'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Air France',          'air france',      'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('KLM',                 ' klm ',           'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Korean Air',          'korean air',      'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('Japan Airlines',      'japan airlines',  'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300),
  ('ANA',                 'ana ',            'contains', 'air_travel_international', 3, 'passenger_km', FALSE, 'NGA Factors 2024, Table 9 – Aviation (international)', 300)
ON CONFLICT DO NOTHING;

-- ── SEED: Rideshare / Taxi (Scope 3, Cat 6) ──────────────────────────────────
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('Uber',             'uber',       'contains', 'rideshare_taxi', 3, 'vehicle_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (taxi)', 300),
  ('Ola Cabs',         'ola cabs',   'contains', 'rideshare_taxi', 3, 'vehicle_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (taxi)', 300),
  ('DiDi',             'didi',       'contains', 'rideshare_taxi', 3, 'vehicle_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (taxi)', 300),
  ('13cabs',           '13cabs',     'contains', 'rideshare_taxi', 3, 'vehicle_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (taxi)', 300),
  ('Silver Top Taxis', 'silver top', 'contains', 'rideshare_taxi', 3, 'vehicle_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (taxi)', 300),
  ('A2B Australia',    'a2b austr',  'contains', 'rideshare_taxi', 3, 'vehicle_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (taxi)', 300),
  ('ingogo',           'ingogo',     'contains', 'rideshare_taxi', 3, 'vehicle_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (taxi)', 300)
ON CONFLICT DO NOTHING;

-- ── SEED: Business accommodation (Scope 3, Cat 6) ────────────────────────────
-- Note: No standard physical unit for accommodation → always needs_review.
-- activity_unit = NULL signals the classifier to always flag needs_review.
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('Accor Hotels',      'accor',        'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Ibis Hotels',       'ibis',         'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Novotel',           'novotel',      'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Mercure Hotels',    'mercure',      'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Pullman Hotels',    'pullman',      'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Sofitel',           'sofitel',      'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Hilton',            'hilton',       'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Marriott',          'marriott',     'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Hyatt',             'hyatt',        'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Holiday Inn (IHG)', 'holiday inn',  'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Crowne Plaza',      'crowne plaza', 'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Quest Apartments',  'quest apart',  'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Mantra Hotels',     'mantra',       'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Peppers Hotels',    'peppers',      'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Rydges Hotels',     'rydges',       'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Vibe Hotels',       'vibe hotel',   'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Meriton Suites',    'meriton',      'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Radisson',          'radisson',     'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Crown Hotels',      'crown hotel',  'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Booking.com',       'booking.com',  'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200),
  ('Airbnb',            'airbnb',       'contains', 'accommodation_business', 3, NULL, FALSE, 'NGA Factors 2024, Table 9 – Accommodation', 200)
ON CONFLICT DO NOTHING;

-- ── SEED: Road freight / courier (Scope 3, Cat 4) ────────────────────────────
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('Australia Post',  'australia post', 'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('StarTrack',       'startrack',      'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('Toll Group',      'toll group',     'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('TNT Australia',   'tnt',            'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('DHL',             'dhl',            'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('FedEx',           'fedex',          'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('CourierPlease',   'courierplease',  'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('Aramex Australia','aramex',         'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('Sendle',          'sendle',         'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('Pack & Send',     'pack & send',    'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200),
  ('Pack & Send',     'pack and send',  'contains', 'road_freight', 3, 'tonne_km', FALSE, 'NGA Factors 2024, Table 9 – Road transport (freight)', 200)
ON CONFLICT DO NOTHING;

-- ── SEED: Waste management (Scope 3, Cat 5) ──────────────────────────────────
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('Cleanaway',         'cleanaway',     'contains', 'waste', 3, 'tonne', FALSE, 'NGA Factors 2024, Table 9 – Waste', 200),
  ('SUEZ Australia',    'suez',          'contains', 'waste', 3, 'tonne', FALSE, 'NGA Factors 2024, Table 9 – Waste', 200),
  ('Veolia Australia',  'veolia',        'contains', 'waste', 3, 'tonne', FALSE, 'NGA Factors 2024, Table 9 – Waste', 200),
  ('JJ Waste',          'jj waste',      'contains', 'waste', 3, 'tonne', FALSE, 'NGA Factors 2024, Table 9 – Waste', 200),
  ('Solo Resource',     'solo resource', 'contains', 'waste', 3, 'tonne', FALSE, 'NGA Factors 2024, Table 9 – Waste', 200),
  ('Stericycle',        'stericycle',    'contains', 'waste', 3, 'tonne', FALSE, 'NGA Factors 2024, Table 9 – Waste', 200),
  ('REMONDIS',          'remondis',      'contains', 'waste', 3, 'tonne', FALSE, 'NGA Factors 2024, Table 9 – Waste', 200)
ON CONFLICT DO NOTHING;

-- ── SEED: Finance / BNPL — excluded (not emission-relevant) ──────────────────
-- Scope = 0 convention for excluded rows (no physical scope applies).
-- These are excluded with exclusion_reason = 'not_emission_relevant'.
INSERT INTO merchant_classification_rules
  (merchant_name, pattern, match_type, category_code, scope, activity_unit, requires_state, notes_citation, priority)
VALUES
  ('Afterpay',           'afterpay',        'contains', 'excluded_finance', 0, NULL, FALSE, 'BNPL — not emission-relevant per GHG Protocol', 400),
  ('Zip Co',             'zip co',          'contains', 'excluded_finance', 0, NULL, FALSE, 'BNPL — not emission-relevant per GHG Protocol', 400),
  ('Latitude Financial', 'latitude',        'contains', 'excluded_finance', 0, NULL, FALSE, 'Financial service — not emission-relevant', 400),
  ('Humm / Flexigroup',  'humm',            'contains', 'excluded_finance', 0, NULL, FALSE, 'BNPL — not emission-relevant per GHG Protocol', 400),
  ('Bank Interest',      'interest charge', 'contains', 'excluded_finance', 0, NULL, FALSE, 'Bank interest — not emission-relevant', 400),
  ('Bank Account Fee',   'account fee',     'contains', 'excluded_finance', 0, NULL, FALSE, 'Bank fee — not emission-relevant', 400),
  ('Bank Monthly Fee',   'monthly fee',     'contains', 'excluded_finance', 0, NULL, FALSE, 'Bank fee — not emission-relevant', 400),
  ('ATO Tax Refund',     'ato refund',      'contains', 'excluded_finance', 0, NULL, FALSE, 'Tax refund — not emission-relevant', 400),
  ('ATO Payment',        'ato payment',     'contains', 'excluded_finance', 0, NULL, FALSE, 'Tax payment — not emission-relevant', 400)
ON CONFLICT DO NOTHING;

-- ── Verify seed count ─────────────────────────────────────────────────────────
DO $$
DECLARE
  rule_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rule_count FROM merchant_classification_rules WHERE is_active = TRUE;
  RAISE NOTICE 'merchant_classification_rules seeded: % active rules', rule_count;
END $$;
