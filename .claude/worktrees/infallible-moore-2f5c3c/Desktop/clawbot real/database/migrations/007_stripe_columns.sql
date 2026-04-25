-- Migration 007: Add Stripe customer columns to companies
-- (plan + plan_expires_at already exist in schema.sql)
-- Run via GET /api/admin/migrate007 (development only)

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer
  ON companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
