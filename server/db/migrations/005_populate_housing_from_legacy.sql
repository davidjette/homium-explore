-- Populate normalized housing tables from legacy housing_stats table.
-- The housing_stats table (from unabashed-empathy) has 33K+ ZIPs across all 50 states + DC.
-- The normalized tables (003_housing_data.sql) only had Utah data.
-- This migration backfills all states so explore.homium.io works for every state.
--
-- Safe to re-run: all inserts use ON CONFLICT ... DO NOTHING.
-- Safe on fresh installs: checks if housing_stats exists before proceeding.

DO $$
BEGIN
  -- Only run if the legacy housing_stats table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'housing_stats') THEN

    -- 1. Insert states (aggregated from zip-level data)
    INSERT INTO housing_states (state_abbr, state_name, population, median_income, median_home_value, median_rent, homeownership_rate)
    SELECT
      state_abbr,
      MAX(state_name) AS state_name,
      SUM(population) AS population,
      AVG(median_household_income) AS median_income,
      AVG(median_home_price) AS median_home_value,
      AVG(median_rent) AS median_rent,
      AVG(homeownership_rate) AS homeownership_rate
    FROM (
      SELECT DISTINCT ON (zip_code) *
      FROM housing_stats
      WHERE state_abbr IS NOT NULL
      ORDER BY zip_code, population DESC NULLS LAST
    ) deduped
    GROUP BY state_abbr
    ON CONFLICT (state_abbr) DO NOTHING;

    RAISE NOTICE 'States populated from housing_stats';

    -- 2. Insert counties (aggregated from zip-level data)
    INSERT INTO housing_counties (county_name, state_abbr, population, median_income, median_home_value, median_rent, homeownership_rate)
    SELECT
      county_name,
      state_abbr,
      SUM(population) AS population,
      AVG(median_household_income) AS median_income,
      AVG(median_home_price) AS median_home_value,
      AVG(median_rent) AS median_rent,
      AVG(homeownership_rate) AS homeownership_rate
    FROM (
      SELECT DISTINCT ON (zip_code) *
      FROM housing_stats
      WHERE state_abbr IS NOT NULL AND county_name IS NOT NULL AND county_name != ''
      ORDER BY zip_code, population DESC NULLS LAST
    ) deduped
    GROUP BY county_name, state_abbr
    ON CONFLICT (county_name, state_abbr) DO NOTHING;

    RAISE NOTICE 'Counties populated from housing_stats';

    -- 3. Insert zips
    INSERT INTO housing_zips (zip_code, city, county_name, state_abbr, population, median_income, median_home_value, median_rent, homeownership_rate)
    SELECT
      zip_code,
      SPLIT_PART(metro_area, ',', 1) AS city,
      county_name,
      state_abbr,
      population,
      median_household_income AS median_income,
      median_home_price AS median_home_value,
      median_rent,
      homeownership_rate
    FROM (
      SELECT DISTINCT ON (zip_code) *
      FROM housing_stats
      WHERE state_abbr IS NOT NULL
      ORDER BY zip_code, population DESC NULLS LAST
    ) deduped
    ON CONFLICT (zip_code) DO NOTHING;

    RAISE NOTICE 'ZIPs populated from housing_stats';

  ELSE
    RAISE NOTICE 'housing_stats table not found — skipping legacy data migration';
  END IF;
END $$;
