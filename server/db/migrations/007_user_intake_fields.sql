-- Migration 007: Additional user intake fields for profile setup
-- Captures program interest details during onboarding

ALTER TABLE users ADD COLUMN IF NOT EXISTS timing VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS funding_range VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS geographic_focus VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS program_type VARCHAR(50);
