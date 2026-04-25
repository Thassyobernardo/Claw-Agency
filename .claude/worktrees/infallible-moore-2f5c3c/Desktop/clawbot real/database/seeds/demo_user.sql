-- =============================================================================
-- Demo User Seed
-- Creates a login for the existing Acme Building Supplies demo company.
-- Password: demo1234  (bcrypt hash below)
-- =============================================================================

INSERT INTO users (
    id,
    company_id,
    email,
    name,
    password_hash,
    role,
    email_verified
)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',   -- Acme Building Supplies demo company
    'demo@acmebuilding.com.au',
    'Alex Demo',
    -- bcrypt hash of 'demo1234' (cost factor 10)
    '$2b$10$rTaPNxI021NOJijT3dwGJeljisM/gyyxYcyUbq3emzLe1.JzzV2hu',
    'owner',
    TRUE
)
ON CONFLICT (email) DO UPDATE
SET
    password_hash  = EXCLUDED.password_hash,
    name           = EXCLUDED.name,
    role           = EXCLUDED.role,
    email_verified = EXCLUDED.email_verified;

DO $$
BEGIN
    RAISE NOTICE '✅ Demo user seeded: demo@acmebuilding.com.au / demo1234';
END;
$$;
