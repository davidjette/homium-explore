-- Housing data tables for ArcGIS 2025 data
-- Replaces external unabashed-empathy API with local PostgreSQL queries

CREATE TABLE IF NOT EXISTS housing_states (
  state_abbr    VARCHAR(2) PRIMARY KEY,
  state_name    VARCHAR(50) NOT NULL,
  population    INTEGER,
  median_income NUMERIC(12,2),
  median_home_value NUMERIC(12,2),
  median_rent   NUMERIC(10,2),
  homeownership_rate NUMERIC(6,4),
  data_year     INTEGER DEFAULT 2025,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS housing_counties (
  id            SERIAL PRIMARY KEY,
  county_name   VARCHAR(100) NOT NULL,
  state_abbr    VARCHAR(2) REFERENCES housing_states(state_abbr),
  population    INTEGER,
  median_income NUMERIC(12,2),
  median_home_value NUMERIC(12,2),
  median_rent   NUMERIC(10,2),
  homeownership_rate NUMERIC(6,4),
  data_year     INTEGER DEFAULT 2025,
  UNIQUE(county_name, state_abbr)
);

CREATE TABLE IF NOT EXISTS housing_zips (
  zip_code      VARCHAR(5) PRIMARY KEY,
  city          VARCHAR(100),
  county_name   VARCHAR(100),
  state_abbr    VARCHAR(2) REFERENCES housing_states(state_abbr),
  population    INTEGER,
  median_income NUMERIC(12,2),
  median_home_value NUMERIC(12,2),
  median_rent   NUMERIC(10,2),
  homeownership_rate NUMERIC(6,4),
  data_year     INTEGER DEFAULT 2025
);

CREATE INDEX IF NOT EXISTS idx_counties_state ON housing_counties(state_abbr);
CREATE INDEX IF NOT EXISTS idx_zips_state ON housing_zips(state_abbr);
CREATE INDEX IF NOT EXISTS idx_zips_city ON housing_zips(city);
CREATE INDEX IF NOT EXISTS idx_zips_county ON housing_zips(county_name, state_abbr);
