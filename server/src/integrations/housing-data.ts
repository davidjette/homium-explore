/**
 * Housing Data Integration
 *
 * Queries local PostgreSQL tables (housing_states, housing_counties, housing_zips)
 * populated from ArcGIS 2025 data via migration 005.
 */

import { pool } from '../db/pool';

export interface HousingStateData {
  stateAbbr: string;
  stateName: string;
  zipCount: number;
  avgHomeownership: number;
  avgHomePrice: number;
  avgRent: number;
  avgIncome: number;
  totalPopulation: number;
}

export interface HousingCountyData {
  countyName: string;
  stateAbbr: string;
  population: number;
  medianIncome: number;
  medianHomeValue: number;
  medianRent: number;
  homeownershipRate: number;
}

export interface HousingZipData {
  zipCode: string;
  state: string;
  county: string;
  city: string;
  medianHomeValue: number;
  medianIncome: number;
  homeownershipRate: number;
  population: number;
  medianRent: number;
  medianAge: number;
  vacancyRate: number;
}

export interface HousingSearchResult {
  results: HousingZipData[];
  total: number;
}

// ── DB Queries ──

/** Fetch state-level housing statistics */
export async function getStateStats(stateAbbr: string): Promise<HousingStateData> {
  const stateResult = await pool.query(
    'SELECT * FROM housing_states WHERE state_abbr = $1',
    [stateAbbr.toUpperCase()]
  );
  if (stateResult.rows.length === 0) {
    throw new Error(`No housing data for state: ${stateAbbr}`);
  }

  const s = stateResult.rows[0];
  const zipResult = await pool.query(
    'SELECT COUNT(*) FROM housing_zips WHERE state_abbr = $1',
    [stateAbbr.toUpperCase()]
  );

  return {
    stateAbbr: s.state_abbr,
    stateName: s.state_name,
    zipCount: parseInt(zipResult.rows[0].count),
    avgHomeownership: parseFloat(s.homeownership_rate) || 0,
    avgHomePrice: parseFloat(s.median_home_value) || 0,
    avgRent: parseFloat(s.median_rent) || 0,
    avgIncome: parseFloat(s.median_income) || 0,
    totalPopulation: parseInt(s.population) || 0,
  };
}

/** Fetch ZIP-level housing data */
export async function getZipStats(zipCode: string): Promise<HousingZipData> {
  const result = await pool.query(
    'SELECT * FROM housing_zips WHERE zip_code = $1',
    [zipCode]
  );
  if (result.rows.length === 0) {
    throw new Error(`No housing data for ZIP: ${zipCode}`);
  }

  const z = result.rows[0];
  return {
    zipCode: z.zip_code,
    state: z.state_abbr,
    county: z.county_name || '',
    city: z.city || '',
    medianHomeValue: parseFloat(z.median_home_value) || 0,
    medianIncome: parseFloat(z.median_income) || 0,
    homeownershipRate: parseFloat(z.homeownership_rate) || 0,
    population: parseInt(z.population) || 0,
    medianRent: parseFloat(z.median_rent) || 0,
    medianAge: 0,
    vacancyRate: 0,
  };
}

/** Search housing data with filters */
export async function searchHousingData(params: {
  state?: string;
  county?: string;
  minIncome?: number;
  maxIncome?: number;
  minHomeValue?: number;
  maxHomeValue?: number;
  limit?: number;
  offset?: number;
}): Promise<HousingSearchResult> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (params.state) { conditions.push(`state_abbr = $${idx++}`); values.push(params.state.toUpperCase()); }
  if (params.county) { conditions.push(`county_name ILIKE $${idx++}`); values.push(`%${params.county}%`); }
  if (params.minIncome) { conditions.push(`median_income >= $${idx++}`); values.push(params.minIncome); }
  if (params.maxIncome) { conditions.push(`median_income <= $${idx++}`); values.push(params.maxIncome); }
  if (params.minHomeValue) { conditions.push(`median_home_value >= $${idx++}`); values.push(params.minHomeValue); }
  if (params.maxHomeValue) { conditions.push(`median_home_value <= $${idx++}`); values.push(params.maxHomeValue); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  const countResult = await pool.query(`SELECT COUNT(*) FROM housing_zips ${where}`, values);
  const total = parseInt(countResult.rows[0].count);

  const dataResult = await pool.query(
    `SELECT * FROM housing_zips ${where} ORDER BY state_abbr, city LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return {
    results: dataResult.rows.map((z: any) => ({
      zipCode: z.zip_code,
      state: z.state_abbr,
      county: z.county_name || '',
      city: z.city || '',
      medianHomeValue: parseFloat(z.median_home_value) || 0,
      medianIncome: parseFloat(z.median_income) || 0,
      homeownershipRate: parseFloat(z.homeownership_rate) || 0,
      population: parseInt(z.population) || 0,
      medianRent: parseFloat(z.median_rent) || 0,
      medianAge: 0,
      vacancyRate: 0,
    })),
    total,
  };
}

/** Get all counties in a state */
export async function getCountiesByState(stateAbbr: string): Promise<HousingCountyData[]> {
  const result = await pool.query(
    `SELECT * FROM housing_counties WHERE state_abbr = $1 ORDER BY county_name`,
    [stateAbbr.toUpperCase()]
  );
  return result.rows.map((r: any) => ({
    countyName: r.county_name,
    stateAbbr: r.state_abbr,
    population: parseInt(r.population) || 0,
    medianIncome: parseFloat(r.median_income) || 0,
    medianHomeValue: parseFloat(r.median_home_value) || 0,
    medianRent: parseFloat(r.median_rent) || 0,
    homeownershipRate: parseFloat(r.homeownership_rate) || 0,
  }));
}

/** Get a specific county's data */
export async function getCountyStats(stateAbbr: string, countyName: string): Promise<HousingCountyData | null> {
  const result = await pool.query(
    `SELECT * FROM housing_counties WHERE state_abbr = $1 AND county_name ILIKE $2`,
    [stateAbbr.toUpperCase(), `%${countyName}%`]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    countyName: r.county_name,
    stateAbbr: r.state_abbr,
    population: parseInt(r.population) || 0,
    medianIncome: parseFloat(r.median_income) || 0,
    medianHomeValue: parseFloat(r.median_home_value) || 0,
    medianRent: parseFloat(r.median_rent) || 0,
    homeownershipRate: parseFloat(r.homeownership_rate) || 0,
  };
}

/** Get all ZIPs in a state */
export async function getZipsByState(stateAbbr: string): Promise<HousingZipData[]> {
  const result = await pool.query(
    `SELECT * FROM housing_zips WHERE state_abbr = $1 ORDER BY city, zip_code`,
    [stateAbbr.toUpperCase()]
  );
  return result.rows.map((z: any) => ({
    zipCode: z.zip_code,
    state: z.state_abbr,
    county: z.county_name || '',
    city: z.city || '',
    medianHomeValue: parseFloat(z.median_home_value) || 0,
    medianIncome: parseFloat(z.median_income) || 0,
    homeownershipRate: parseFloat(z.homeownership_rate) || 0,
    population: parseInt(z.population) || 0,
    medianRent: parseFloat(z.median_rent) || 0,
    medianAge: 0,
    vacancyRate: 0,
  }));
}

/** Get all states (for listing) */
export async function getAllStates(): Promise<HousingStateData[]> {
  const result = await pool.query(
    `SELECT s.*, (SELECT COUNT(*) FROM housing_zips z WHERE z.state_abbr = s.state_abbr) AS zip_count
     FROM housing_states s ORDER BY s.state_name`
  );
  return result.rows.map((s: any) => ({
    stateAbbr: s.state_abbr,
    stateName: s.state_name,
    zipCount: parseInt(s.zip_count) || 0,
    avgHomeownership: parseFloat(s.homeownership_rate) || 0,
    avgHomePrice: parseFloat(s.median_home_value) || 0,
    avgRent: parseFloat(s.median_rent) || 0,
    avgIncome: parseFloat(s.median_income) || 0,
    totalPopulation: parseInt(s.population) || 0,
  }));
}

/**
 * Auto-populate scenario assumptions from real housing data.
 * Given a state, creates LO/MID/HI scenarios based on actual
 * income/home value distributions.
 */
export async function autoPopulateScenarios(stateAbbr: string, totalRaise: number = 10_000_000): Promise<{
  medianIncome: number;
  medianHomeValue: number;
  scenarios: Array<{ name: string; weight: number; raiseAllocation: number; medianIncome: number; medianHomeValue: number }>;
}> {
  const stateData = await getStateStats(stateAbbr);
  const midIncome = Math.round(stateData.avgIncome);
  const midHome = Math.round(stateData.avgHomePrice);

  return {
    medianIncome: midIncome,
    medianHomeValue: midHome,
    scenarios: [
      {
        name: 'LO',
        weight: 0.20,
        raiseAllocation: totalRaise * 0.20,
        medianIncome: Math.round(midIncome * 0.75),
        medianHomeValue: Math.round(midHome * 0.80),
      },
      {
        name: 'MID',
        weight: 0.60,
        raiseAllocation: totalRaise * 0.60,
        medianIncome: midIncome,
        medianHomeValue: midHome,
      },
      {
        name: 'HI',
        weight: 0.20,
        raiseAllocation: totalRaise * 0.20,
        medianIncome: Math.round(midIncome * 1.35),
        medianHomeValue: Math.round(midHome * 1.40),
      },
    ],
  };
}
