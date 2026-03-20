-- Migration 006: Users table + fund ownership
-- Supports Supabase Auth integration

-- Users table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,          -- matches Supabase auth.users.id
  email         VARCHAR(200) NOT NULL UNIQUE,
  name          VARCHAR(200),
  organization  VARCHAR(200),
  role_type     VARCHAR(20) NOT NULL DEFAULT 'registered',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_type);

-- Add ownership to fund_configs (nullable — existing funds remain unowned)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fund_configs' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE fund_configs ADD COLUMN owner_id UUID REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fund_configs_owner ON fund_configs(owner_id);
