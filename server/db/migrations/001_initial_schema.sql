-- UDF Pro Forma — Initial Schema
-- 7 tables + 1 materialized view

CREATE TABLE IF NOT EXISTS udf_model_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version     VARCHAR(50) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  notes       TEXT,
  is_active   BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS udf_scenarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id      UUID REFERENCES udf_model_versions(id) ON DELETE CASCADE,
  name                  VARCHAR(20) NOT NULL,
  weight                NUMERIC(5,4),
  initial_raise         NUMERIC(15,2) NOT NULL,
  program_fee_pct       NUMERIC(6,4) DEFAULT 0.0500,
  mgmt_fee_pct          NUMERIC(6,4) DEFAULT 0.0050,
  utah_hpa_pct          NUMERIC(6,4) DEFAULT 0.0500,
  interest_rate         NUMERIC(6,4) DEFAULT 0.0700,
  median_income         NUMERIC(12,2),
  median_home_value     NUMERIC(12,2),
  down_payment_pct      NUMERIC(6,4) DEFAULT 0.0300,
  homium_sa_pct         NUMERIC(6,4) DEFAULT 0.2500,
  reinvest_proceeds     BOOLEAN DEFAULT false,
  annual_contrib_pct    NUMERIC(6,4) DEFAULT 0.0000,
  max_front_ratio       NUMERIC(6,4) DEFAULT 0.3000,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS udf_payoff_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID REFERENCES udf_scenarios(id) ON DELETE CASCADE,
  year_number     INTEGER NOT NULL CHECK (year_number BETWEEN 1 AND 30),
  annual_pct      NUMERIC(8,6) NOT NULL,
  cumulative_pct  NUMERIC(8,6) NOT NULL,
  UNIQUE (scenario_id, year_number)
);

CREATE TABLE IF NOT EXISTS udf_cohorts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id          UUID REFERENCES udf_scenarios(id) ON DELETE CASCADE,
  cohort_year          INTEGER NOT NULL,
  homeowner_count      INTEGER NOT NULL,
  home_value_0         NUMERIC(12,2) NOT NULL,
  mortgage_principal_0 NUMERIC(12,2) NOT NULL,
  homium_principal_0   NUMERIC(12,2) NOT NULL,
  down_payment         NUMERIC(12,2) NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS udf_cohort_waterfall (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id         UUID REFERENCES udf_cohorts(id) ON DELETE CASCADE,
  model_year        INTEGER NOT NULL CHECK (model_year BETWEEN 1 AND 30),
  calendar_year     INTEGER NOT NULL,
  home_value        NUMERIC(15,2),
  mortgage_balance  NUMERIC(15,2),
  homium_position   NUMERIC(15,2),
  homeowner_equity  NUMERIC(15,2),
  ltv               NUMERIC(8,6),
  cltv              NUMERIC(8,6),
  payoff_amount     NUMERIC(15,2) DEFAULT 0,
  payoff_count      INTEGER DEFAULT 0,
  UNIQUE (cohort_id, model_year)
);

CREATE TABLE IF NOT EXISTS udf_fund_results (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id             UUID REFERENCES udf_scenarios(id) ON DELETE CASCADE,
  year_number             INTEGER NOT NULL,
  calendar_year           INTEGER NOT NULL,
  new_donations           NUMERIC(15,2) DEFAULT 0,
  program_fee             NUMERIC(15,2) DEFAULT 0,
  management_fee          NUMERIC(15,2) DEFAULT 0,
  new_homeowners          INTEGER DEFAULT 0,
  total_homeowners_cum    INTEGER DEFAULT 0,
  active_homeowners       INTEGER DEFAULT 0,
  exiting_homeowners      INTEGER DEFAULT 0,
  returned_capital        NUMERIC(15,2) DEFAULT 0,
  roi_annual              NUMERIC(10,8),
  roi_cumulative          NUMERIC(10,8),
  fund_balance            NUMERIC(15,2),
  total_equity_created    NUMERIC(15,2) DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scenario_id, year_number)
);

CREATE TABLE IF NOT EXISTS udf_impact_metrics (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id                   UUID REFERENCES udf_scenarios(id) ON DELETE CASCADE,
  timeframe_years               INTEGER NOT NULL,
  total_homes_purchased         NUMERIC(15,2),
  total_homeowners_created      INTEGER,
  total_equity_created          NUMERIC(15,2),
  private_capital_leverage      NUMERIC(8,2),
  affordability_gap_before      NUMERIC(10,2),
  affordability_gap_after       NUMERIC(10,2),
  created_at                    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scenarios_version ON udf_scenarios(model_version_id);
CREATE INDEX IF NOT EXISTS idx_payoff_scenario ON udf_payoff_schedule(scenario_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_scenario ON udf_cohorts(scenario_id);
CREATE INDEX IF NOT EXISTS idx_waterfall_cohort ON udf_cohort_waterfall(cohort_id);
CREATE INDEX IF NOT EXISTS idx_fund_results_scenario ON udf_fund_results(scenario_id);
