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

    -- Temp lookup for state names (housing_stats.state_name is NULL for most states)
    CREATE TEMP TABLE _state_names (abbr VARCHAR(2) PRIMARY KEY, name VARCHAR(50) NOT NULL);
    INSERT INTO _state_names (abbr, name) VALUES
      ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),('CA','California'),
      ('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),('DC','District of Columbia'),
      ('FL','Florida'),('GA','Georgia'),('HI','Hawaii'),('ID','Idaho'),('IL','Illinois'),
      ('IN','Indiana'),('IA','Iowa'),('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),
      ('ME','Maine'),('MD','Maryland'),('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),
      ('MS','Mississippi'),('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),
      ('NH','New Hampshire'),('NJ','New Jersey'),('NM','New Mexico'),('NY','New York'),
      ('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),('OK','Oklahoma'),('OR','Oregon'),
      ('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),('SD','South Dakota'),
      ('TN','Tennessee'),('TX','Texas'),('UT','Utah'),('VT','Vermont'),('VA','Virginia'),
      ('WA','Washington'),('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming'),
      ('PR','Puerto Rico'),('GU','Guam'),('VI','Virgin Islands');

    -- 1. Insert states (aggregated from zip-level data)
    INSERT INTO housing_states (state_abbr, state_name, population, median_income, median_home_value, median_rent, homeownership_rate)
    SELECT
      d.state_abbr,
      COALESCE(MAX(d.state_name), sn.name, d.state_abbr) AS state_name,
      SUM(d.population) AS population,
      ROUND(AVG(d.median_household_income), 2) AS median_income,
      ROUND(AVG(d.median_home_price), 2) AS median_home_value,
      ROUND(AVG(d.median_rent), 2) AS median_rent,
      LEAST(ROUND(AVG(d.homeownership_rate), 4), 99.9999) AS homeownership_rate
    FROM (
      SELECT DISTINCT ON (zip_code) *
      FROM housing_stats
      WHERE state_abbr IS NOT NULL
      ORDER BY zip_code, population DESC NULLS LAST
    ) d
    LEFT JOIN _state_names sn ON sn.abbr = d.state_abbr
    GROUP BY d.state_abbr, sn.name
    ON CONFLICT (state_abbr) DO NOTHING;

    DROP TABLE _state_names;

    RAISE NOTICE 'States populated from housing_stats';

    -- 2. Insert counties (aggregated from zip-level data)
    INSERT INTO housing_counties (county_name, state_abbr, population, median_income, median_home_value, median_rent, homeownership_rate)
    SELECT
      county_name,
      state_abbr,
      SUM(population) AS population,
      ROUND(AVG(median_household_income), 2) AS median_income,
      ROUND(AVG(median_home_price), 2) AS median_home_value,
      ROUND(AVG(median_rent), 2) AS median_rent,
      LEAST(ROUND(AVG(homeownership_rate), 4), 99.9999) AS homeownership_rate
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
      LEAST(homeownership_rate, 99.9999) AS homeownership_rate
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
