-- =============================================================================
-- Migration 005: Emission Categories + Transaction Category Column
-- EcoLink Australia — Phase 10: Classification Engine
--
-- Adds a lightweight emission_categories lookup table that the classifier
-- uses to tag transactions without requiring an exact emission_factor_id match.
-- Also adds category_id and date alias to transactions for convenience.
-- =============================================================================

-- ── 1. Emission categories ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emission_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE NOT NULL,       -- e.g. 'electricity', 'fuel_diesel'
    label       TEXT NOT NULL,              -- e.g. 'Electricity', 'Diesel'
    scope       SMALLINT NOT NULL CHECK (scope IN (1, 2, 3)),
    description TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed all categories used by the classifier
INSERT INTO emission_categories (code, label, scope, description) VALUES
  ('electricity',        'Electricity',               2, 'Grid electricity purchased from retailer'),
  ('fuel_diesel',        'Diesel',                    1, 'Diesel combustion — fleet, equipment, generators'),
  ('fuel_petrol',        'Petrol',                    1, 'Petrol combustion — company vehicles'),
  ('fuel_lpg',           'LPG / Autogas',             1, 'Liquefied petroleum gas combustion'),
  ('natural_gas',        'Natural Gas',               1, 'Natural gas combustion for heating/cooking'),
  ('air_travel',         'Air Travel',                3, 'Domestic and international flights'),
  ('road_freight',       'Road Freight',              3, 'Courier, freight and logistics services'),
  ('waste',              'Waste Disposal',            3, 'Commercial waste sent to landfill or recycling'),
  ('water',              'Water',                     3, 'Municipal water consumption'),
  ('accommodation',      'Accommodation',             3, 'Hotels and serviced apartments'),
  ('meals_entertainment','Meals & Entertainment',     3, 'Catering, client meals, staff functions'),
  ('it_cloud',           'IT & Cloud Services',       3, 'Cloud hosting, telecoms, data centres'),
  ('office_supplies',    'Office Supplies',           3, 'Stationery, printing, consumables')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Add category_id to transactions ────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES emission_categories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category_id);

-- ── 3. Add date alias column (view-friendly shorthand) ─────────────────────────
-- Some query patterns expect a `date` column. We expose it as a generated column.
-- Requires PostgreSQL 12+.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS date DATE GENERATED ALWAYS AS (transaction_date) STORED;

-- ── 4. Index on unclassified transactions (speeds up classify endpoint) ─────────
CREATE INDEX IF NOT EXISTS idx_tx_unclassified
  ON transactions (company_id, transaction_date DESC)
  WHERE category_id IS NULL AND classification_status = 'pending';
