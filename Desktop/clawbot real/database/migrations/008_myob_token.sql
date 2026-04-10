-- Migration 008: Add MYOB token storage to companies
-- (myob_company_file_id already exists in schema.sql)
-- Run via GET /api/admin/migrate008

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS myob_token_data      JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS myob_company_file_uri TEXT;  -- full URI e.g. "https://api.myob.com/accountright/abc123"
