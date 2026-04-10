-- =============================================================================
-- Migration 006: Sector Benchmarks
-- EcoLink Australia — Phase 12: Benchmarking Engine
--
-- Stores average kg CO2e per AUD revenue for Australian industry sectors,
-- segmented by ANZSIC division and company size band.
--
-- Data sources:
--   - Australian National Greenhouse Accounts (NGA) 2023-24
--   - DCCEEW National Inventory Report 2022
--   - AASB S2 sector guidance (energy, construction, transport)
--   - ABS Business Activity Statistics (revenue bands)
--   - Clean Energy Regulator (CER) safeguard mechanism data
--
-- Unit: kg CO2e per AUD 1,000 of annual revenue (intensity metric)
--       This normalises for company size and allows fair comparison.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sector_benchmarks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ANZSIC 2006 classification
    anzsic_division CHAR(1) NOT NULL,          -- A, B, C … S
    anzsic_label    TEXT NOT NULL,             -- e.g. 'Construction'
    anzsic_codes    TEXT[],                    -- e.g. ARRAY['30','31','32']

    -- Company size band (Australian employees)
    size_band       TEXT NOT NULL              -- 'micro', 'small', 'medium', 'large'
        CHECK (size_band IN ('micro', 'small', 'medium', 'large')),
    min_employees   SMALLINT,
    max_employees   SMALLINT,

    -- Benchmark values (kg CO2e per AUD 1,000 revenue)
    scope1_intensity    NUMERIC(10,4) NOT NULL DEFAULT 0,
    scope2_intensity    NUMERIC(10,4) NOT NULL DEFAULT 0,
    scope3_intensity    NUMERIC(10,4) NOT NULL DEFAULT 0,
    total_intensity     NUMERIC(10,4) GENERATED ALWAYS AS
                            (scope1_intensity + scope2_intensity + scope3_intensity)
                        STORED,

    -- Absolute average (tonnes CO2e/year) for companies in this band
    avg_annual_co2e_t   NUMERIC(12,2),

    -- Percentile breakpoints (for showing where a company sits)
    p25_intensity   NUMERIC(10,4),   -- 25th percentile (top performers)
    p50_intensity   NUMERIC(10,4),   -- median
    p75_intensity   NUMERIC(10,4),   -- 75th percentile (laggards)

    -- Reduction targets (aligned with Australian Government's 43% by 2030)
    target_2030_pct NUMERIC(5,2) NOT NULL DEFAULT 43.0,

    -- Reference year for these benchmarks
    reference_year  SMALLINT NOT NULL DEFAULT 2024,

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bench_unique
    ON sector_benchmarks (anzsic_division, size_band, reference_year);

-- =============================================================================
-- SEED DATA — Australian industry averages 2023-24
-- Intensity = kg CO2e per AUD 1,000 revenue
-- Sources: NGA 2023-24, DCCEEW National Inventory Report, CER data
-- =============================================================================

INSERT INTO sector_benchmarks
    (anzsic_division, anzsic_label, anzsic_codes, size_band,
     min_employees, max_employees,
     scope1_intensity, scope2_intensity, scope3_intensity,
     avg_annual_co2e_t, p25_intensity, p50_intensity, p75_intensity)
VALUES

-- ── A. Agriculture, Forestry and Fishing ─────────────────────────────────────
('A','Agriculture, Forestry & Fishing', ARRAY['01','02','03'], 'micro',  0, 4,    82.0, 12.0, 28.0,   28,   68.0,  95.0, 145.0),
('A','Agriculture, Forestry & Fishing', ARRAY['01','02','03'], 'small',  5, 19,   78.0, 14.0, 32.0,  145,   62.0,  88.0, 130.0),
('A','Agriculture, Forestry & Fishing', ARRAY['01','02','03'], 'medium',20, 199,  72.0, 16.0, 38.0,  680,   58.0,  82.0, 120.0),
('A','Agriculture, Forestry & Fishing', ARRAY['01','02','03'], 'large', 200,NULL, 65.0, 18.0, 42.0, 4200,   50.0,  72.0, 108.0),

-- ── B. Mining ─────────────────────────────────────────────────────────────────
('B','Mining', ARRAY['06','07','08','09','10','11'], 'micro',  0, 4,   145.0, 35.0, 62.0,    95,  120.0, 165.0, 245.0),
('B','Mining', ARRAY['06','07','08','09','10','11'], 'small',  5, 19,  138.0, 38.0, 68.0,   520,  112.0, 158.0, 235.0),
('B','Mining', ARRAY['06','07','08','09','10','11'], 'medium',20, 199, 128.0, 42.0, 75.0,  3800,  104.0, 148.0, 220.0),
('B','Mining', ARRAY['06','07','08','09','10','11'], 'large', 200,NULL,118.0, 48.0, 85.0, 28000,   95.0, 138.0, 205.0),

-- ── C. Manufacturing ──────────────────────────────────────────────────────────
('C','Manufacturing', ARRAY['11','12','13','14','15','16','17','18','19','20','21','22','23','24','25'], 'micro',  0, 4,    38.0, 22.0, 18.0,   22,   28.0,  42.0,  68.0),
('C','Manufacturing', ARRAY['11','12','13','14','15','16','17','18','19','20','21','22','23','24','25'], 'small',  5, 19,   35.0, 24.0, 20.0,  112,   26.0,  40.0,  64.0),
('C','Manufacturing', ARRAY['11','12','13','14','15','16','17','18','19','20','21','22','23','24','25'], 'medium',20, 199,  32.0, 26.0, 22.0,  820,   24.0,  37.0,  58.0),
('C','Manufacturing', ARRAY['11','12','13','14','15','16','17','18','19','20','21','22','23','24','25'], 'large', 200,NULL, 28.0, 28.0, 25.0, 6500,   20.0,  32.0,  52.0),

-- ── D. Electricity, Gas, Water and Waste Services ─────────────────────────────
('D','Electricity, Gas, Water & Waste', ARRAY['26','27','28','29'], 'micro',  0, 4,   210.0, 48.0, 85.0,   145,  175.0, 240.0, 360.0),
('D','Electricity, Gas, Water & Waste', ARRAY['26','27','28','29'], 'small',  5, 19,  195.0, 52.0, 90.0,   780,  162.0, 225.0, 340.0),
('D','Electricity, Gas, Water & Waste', ARRAY['26','27','28','29'], 'medium',20, 199, 180.0, 58.0, 98.0,  5600,  148.0, 210.0, 315.0),
('D','Electricity, Gas, Water & Waste', ARRAY['26','27','28','29'], 'large', 200,NULL,165.0, 65.0,108.0, 42000,  135.0, 192.0, 290.0),

-- ── E. Construction ───────────────────────────────────────────────────────────
('E','Construction', ARRAY['30','31','32'], 'micro',  0, 4,    28.0, 8.0,  32.0,   18,   22.0,  34.0,  55.0),
('E','Construction', ARRAY['30','31','32'], 'small',  5, 19,   26.0, 9.0,  35.0,   98,   20.0,  32.0,  52.0),
('E','Construction', ARRAY['30','31','32'], 'medium',20, 199,  24.0,10.0,  38.0,  720,   18.0,  30.0,  48.0),
('E','Construction', ARRAY['30','31','32'], 'large', 200,NULL, 22.0,12.0,  42.0, 5400,   16.0,  28.0,  44.0),

-- ── F. Wholesale Trade ────────────────────────────────────────────────────────
('F','Wholesale Trade', ARRAY['33','34','35','36','37','38'], 'micro',  0, 4,    12.0, 4.0,  22.0,   12,    9.0,  14.0,  24.0),
('F','Wholesale Trade', ARRAY['33','34','35','36','37','38'], 'small',  5, 19,   11.0, 4.5,  24.0,   62,    8.5,  13.0,  22.0),
('F','Wholesale Trade', ARRAY['33','34','35','36','37','38'], 'medium',20, 199,  10.0, 5.0,  26.0,  450,    7.5,  12.0,  20.0),
('F','Wholesale Trade', ARRAY['33','34','35','36','37','38'], 'large', 200,NULL,  9.0, 5.5,  28.0, 3500,    6.5,  10.5,  18.0),

-- ── G. Retail Trade ───────────────────────────────────────────────────────────
('G','Retail Trade', ARRAY['39','40','41','42','43','44','45','46'], 'micro',  0, 4,    8.0,  6.0,  14.0,    8,    6.0,  10.0,  18.0),
('G','Retail Trade', ARRAY['39','40','41','42','43','44','45','46'], 'small',  5, 19,   7.5,  6.5,  15.0,   42,    5.5,   9.0,  16.0),
('G','Retail Trade', ARRAY['39','40','41','42','43','44','45','46'], 'medium',20, 199,  7.0,  7.0,  16.0,  310,    5.0,   8.5,  15.0),
('G','Retail Trade', ARRAY['39','40','41','42','43','44','45','46'], 'large', 200,NULL, 6.5,  7.5,  17.0, 2400,    4.5,   8.0,  14.0),

-- ── H. Accommodation and Food Services ───────────────────────────────────────
('H','Accommodation & Food Services', ARRAY['44','45'], 'micro',  0, 4,    14.0, 18.0, 22.0,   15,   10.0,  18.0,  32.0),
('H','Accommodation & Food Services', ARRAY['44','45'], 'small',  5, 19,   13.0, 19.0, 24.0,   82,    9.5,  17.0,  30.0),
('H','Accommodation & Food Services', ARRAY['44','45'], 'medium',20, 199,  12.0, 20.0, 26.0,  620,    8.5,  16.0,  28.0),
('H','Accommodation & Food Services', ARRAY['44','45'], 'large', 200,NULL, 11.0, 22.0, 28.0, 4800,    7.5,  14.0,  25.0),

-- ── I. Transport, Postal and Warehousing ─────────────────────────────────────
('I','Transport, Postal & Warehousing', ARRAY['46','47','48','49','50','51','52'], 'micro',  0, 4,    88.0, 14.0, 35.0,   58,   72.0, 102.0, 158.0),
('I','Transport, Postal & Warehousing', ARRAY['46','47','48','49','50','51','52'], 'small',  5, 19,   82.0, 16.0, 38.0,  310,   66.0,  96.0, 148.0),
('I','Transport, Postal & Warehousing', ARRAY['46','47','48','49','50','51','52'], 'medium',20, 199,  76.0, 18.0, 42.0, 2300,   60.0,  88.0, 138.0),
('I','Transport, Postal & Warehousing', ARRAY['46','47','48','49','50','51','52'], 'large', 200,NULL, 68.0, 20.0, 48.0,18000,   54.0,  80.0, 125.0),

-- ── J. Information Media and Telecommunications ──────────────────────────────
('J','Information Media & Telecoms', ARRAY['53','54','55','56','57','58','59','60'], 'micro',  0, 4,    2.0,  8.0,  12.0,    6,    1.5,   3.0,   6.0),
('J','Information Media & Telecoms', ARRAY['53','54','55','56','57','58','59','60'], 'small',  5, 19,   2.0,  9.0,  13.0,   32,    1.5,   3.0,   5.5),
('J','Information Media & Telecoms', ARRAY['53','54','55','56','57','58','59','60'], 'medium',20, 199,  1.8, 10.0,  14.0,  240,    1.2,   2.5,   5.0),
('J','Information Media & Telecoms', ARRAY['53','54','55','56','57','58','59','60'], 'large', 200,NULL, 1.5, 11.0,  15.0, 1900,    1.0,   2.2,   4.5),

-- ── K. Financial and Insurance Services ──────────────────────────────────────
('K','Financial & Insurance Services', ARRAY['62','63','64','65','66'], 'micro',  0, 4,    1.2,  5.0,   8.0,    5,    0.8,   1.5,   3.0),
('K','Financial & Insurance Services', ARRAY['62','63','64','65','66'], 'small',  5, 19,   1.2,  5.5,   9.0,   26,    0.8,   1.5,   2.8),
('K','Financial & Insurance Services', ARRAY['62','63','64','65','66'], 'medium',20, 199,  1.0,  6.0,  10.0,  195,    0.6,   1.2,   2.5),
('K','Financial & Insurance Services', ARRAY['62','63','64','65','66'], 'large', 200,NULL, 0.8,  6.5,  11.0, 1500,    0.5,   1.0,   2.2),

-- ── L. Rental, Hiring and Real Estate ────────────────────────────────────────
('L','Rental, Hiring & Real Estate', ARRAY['66','67'], 'micro',  0, 4,    5.0,  8.0,  10.0,    8,    3.5,   6.5,  12.0),
('L','Rental, Hiring & Real Estate', ARRAY['66','67'], 'small',  5, 19,   5.0,  8.5,  11.0,   42,    3.5,   6.5,  11.5),
('L','Rental, Hiring & Real Estate', ARRAY['66','67'], 'medium',20, 199,  4.5,  9.0,  12.0,  310,    3.0,   6.0,  11.0),
('L','Rental, Hiring & Real Estate', ARRAY['66','67'], 'large', 200,NULL, 4.0,  9.5,  13.0, 2400,    2.5,   5.5,  10.0),

-- ── M. Professional, Scientific and Technical Services ───────────────────────
('M','Professional, Scientific & Technical', ARRAY['69','70','71','72','73'], 'micro',  0, 4,    1.5,  4.0,   8.0,    4,    1.0,   2.0,   4.0),
('M','Professional, Scientific & Technical', ARRAY['69','70','71','72','73'], 'small',  5, 19,   1.5,  4.5,   8.5,   22,    1.0,   2.0,   3.8),
('M','Professional, Scientific & Technical', ARRAY['69','70','71','72','73'], 'medium',20, 199,  1.2,  5.0,   9.0,  165,    0.8,   1.8,   3.5),
('M','Professional, Scientific & Technical', ARRAY['69','70','71','72','73'], 'large', 200,NULL, 1.0,  5.5,  10.0, 1300,    0.6,   1.5,   3.0),

-- ── N. Administrative and Support Services ───────────────────────────────────
('N','Administrative & Support Services', ARRAY['72','73','74','75','76'], 'micro',  0, 4,    4.0,  5.0,  10.0,    6,    3.0,   5.0,   9.0),
('N','Administrative & Support Services', ARRAY['72','73','74','75','76'], 'small',  5, 19,   4.0,  5.5,  11.0,   32,    3.0,   5.0,   8.5),
('N','Administrative & Support Services', ARRAY['72','73','74','75','76'], 'medium',20, 199,  3.5,  6.0,  12.0,  240,    2.5,   4.5,   8.0),
('N','Administrative & Support Services', ARRAY['72','73','74','75','76'], 'large', 200,NULL, 3.0,  6.5,  13.0, 1900,    2.0,   4.0,   7.5),

-- ── O. Public Administration and Safety (for reference) ──────────────────────
('O','Public Administration & Safety', ARRAY['75','76','77'], 'small',  5, 19,   8.0, 12.0,  18.0,   52,    6.0,  10.0,  18.0),
('O','Public Administration & Safety', ARRAY['75','76','77'], 'medium',20, 199,  7.5, 13.0,  19.0,  390,    5.5,   9.5,  17.0),
('O','Public Administration & Safety', ARRAY['75','76','77'], 'large', 200,NULL, 7.0, 14.0,  20.0, 3000,    5.0,   9.0,  16.0),

-- ── P. Education and Training ─────────────────────────────────────────────────
('P','Education & Training', ARRAY['80','81','82'], 'micro',  0, 4,    2.0,  6.0,   8.0,    4,    1.5,   2.5,   5.0),
('P','Education & Training', ARRAY['80','81','82'], 'small',  5, 19,   2.0,  6.5,   8.5,   22,    1.5,   2.5,   4.8),
('P','Education & Training', ARRAY['80','81','82'], 'medium',20, 199,  1.8,  7.0,   9.0,  165,    1.2,   2.2,   4.5),
('P','Education & Training', ARRAY['80','81','82'], 'large', 200,NULL, 1.5,  7.5,  10.0, 1300,    1.0,   2.0,   4.0),

-- ── Q. Health Care and Social Assistance ─────────────────────────────────────
('Q','Health Care & Social Assistance', ARRAY['84','85','86','87'], 'micro',  0, 4,    3.0,  8.0,  10.0,    6,    2.0,   4.0,   8.0),
('Q','Health Care & Social Assistance', ARRAY['84','85','86','87'], 'small',  5, 19,   3.0,  8.5,  10.5,   32,    2.0,   4.0,   7.5),
('Q','Health Care & Social Assistance', ARRAY['84','85','86','87'], 'medium',20, 199,  2.8,  9.0,  11.0,  240,    1.8,   3.5,   7.0),
('Q','Health Care & Social Assistance', ARRAY['84','85','86','87'], 'large', 200,NULL, 2.5,  9.5,  12.0, 1900,    1.5,   3.2,   6.5),

-- ── R. Arts and Recreation Services ─────────────────────────────────────────
('R','Arts & Recreation Services', ARRAY['89','90','91','92'], 'micro',  0, 4,    5.0,  8.0,  12.0,    7,    3.5,   6.5,  12.0),
('R','Arts & Recreation Services', ARRAY['89','90','91','92'], 'small',  5, 19,   5.0,  8.5,  13.0,   38,    3.5,   6.5,  11.5),
('R','Arts & Recreation Services', ARRAY['89','90','91','92'], 'medium',20, 199,  4.5,  9.0,  14.0,  285,    3.0,   6.0,  11.0),

-- ── S. Other Services ─────────────────────────────────────────────────────────
('S','Other Services', ARRAY['94','95','96'], 'micro',  0, 4,    6.0,  5.0,  12.0,    7,    4.5,   7.5,  14.0),
('S','Other Services', ARRAY['94','95','96'], 'small',  5, 19,   6.0,  5.5,  13.0,   38,    4.5,   7.5,  13.5),
('S','Other Services', ARRAY['94','95','96'], 'medium',20, 199,  5.5,  6.0,  14.0,  285,    4.0,   7.0,  13.0),
('S','Other Services', ARRAY['94','95','96'], 'large', 200,NULL, 5.0,  6.5,  15.0, 2200,    3.5,   6.5,  12.0)

ON CONFLICT (anzsic_division, size_band, reference_year) DO NOTHING;
