-- =============================================================================
-- Migration 010 — Add verify_expires_at to users table
--
-- Email verification tokens were unbounded in time. The verification email
-- promises a 24-hour expiry but the schema and code didn't enforce it.
-- This migration adds the expiry column. The /api/auth/register route now
-- writes NOW() + 24 hours into it, and /api/auth/verify-email rejects
-- tokens whose verify_expires_at is in the past.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verify_expires_at TIMESTAMP WITH TIME ZONE;

-- Backfill: existing tokens get a fresh 24h window from now (they were
-- unbounded before, so no token is "expired" right now).
UPDATE users
SET    verify_expires_at = NOW() + INTERVAL '24 hours'
WHERE  verify_token IS NOT NULL
  AND  verify_expires_at IS NULL
  AND  email_verified = FALSE;
