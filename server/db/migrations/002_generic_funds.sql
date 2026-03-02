-- Generic Fund Model Schema
-- Extends the UDF-specific schema to support any Homium fund

CREATE TABLE IF NOT EXISTS fund_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  state           VARCHAR(5),
  county          VARCHAR(100),
  zip_codes       TEXT[],
  geography_label VARCHAR(200),
  total_raise     NUMERIC(15,2) NOT NULL,
  annual_contribution_pct NUMERIC(6,4) DEFAULT 0.0000,
  reinvest_proceeds BOOLEAN DEFAULT false,
  base_year       INTEGER DEFAULT 2025,
  program_fee_pct NUMERIC(6,4) DEFAULT 0.0500,
  mgmt_fee_pct    NUMERIC(6,4) DEFAULT 0.0050,
  hpa_pct         NUMERIC(6,4) DEFAULT 0.0500,
  interest_rate   NUMERIC(6,4) DEFAULT 0.0700,
  homium_sa_pct   NUMERIC(6,4) DEFAULT 0.2500,
  down_payment_pct NUMERIC(6,4) DEFAULT 0.0300,
  max_front_ratio NUMERIC(6,4) DEFAULT 0.3000,
  max_hold_years  INTEGER DEFAULT 30,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fund_scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id         UUID REFERENCES fund_configs(id) ON DELETE CASCADE,
  name            VARCHAR(50) NOT NULL,
  weight          NUMERIC(5,4) NOT NULL,
  raise_allocation NUMERIC(15,2) NOT NULL,
  median_income   NUMERIC(12,2),
  median_home_value NUMERIC(12,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fund_id, name)
);

CREATE TABLE IF NOT EXISTS fund_payoff_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id         UUID REFERENCES fund_configs(id) ON DELETE CASCADE,
  year_number     INTEGER NOT NULL CHECK (year_number BETWEEN 1 AND 30),
  annual_pct      NUMERIC(8,6) NOT NULL,
  cumulative_pct  NUMERIC(8,6) NOT NULL,
  UNIQUE (fund_id, year_number)
);

CREATE TABLE IF NOT EXISTS fund_run_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id         UUID REFERENCES fund_configs(id) ON DELETE CASCADE,
  run_at          TIMESTAMPTZ DEFAULT NOW(),
  total_homeowners INTEGER,
  total_raise     NUMERIC(15,2),
  blended_json    JSONB,          -- Full blended 30-year array
  scenarios_json  JSONB,          -- Per-scenario summary
  metadata        JSONB           -- Compute time, version, etc.
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fund_scenarios_fund ON fund_scenarios(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_payoff_fund ON fund_payoff_schedules(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_results_fund ON fund_run_results(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_configs_state ON fund_configs(state);
