/**
 * Housing Data Integration
 *
 * Queries local PostgreSQL tables (housing_states, housing_counties, housing_zips)
 * populated from ArcGIS 2025 data. Falls back to external API if local data is empty.
 */

import { pool } from '../db/pool';

const HOUSING_API_BASE = process.env.HOUSING_API_URL || 'https://unabashed-empathy.onrender.com';

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

// ── Local DB Queries ──

/** Check if local housing data is populated */
async function hasLocalData(): Promise<boolean> {
  const result = await pool.query('SELECT COUNT(*) FROM housing_states');
  return parseInt(result.rows[0].count) > 0;
}

/** Fetch state-level housing statistics from local DB */
async function getStateStatsLocal(stateAbbr: string): Promise<HousingStateData | null> {
  const stateResult = await pool.query(
    'SELECT * FROM housing_states WHERE state_abbr = $1',
    [stateAbbr.toUpperCase()]
  );
  if (stateResult.rows.length === 0) return null;

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

/** Fetch ZIP-level housing data from local DB */
async function getZipStatsLocal(zipCode: string): Promise<HousingZipData | null> {
  const result = await pool.query(
    'SELECT * FROM housing_zips WHERE zip_code = $1',
    [zipCode]
  );
  if (result.rows.length === 0) return null;

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

/** Search housing data from local DB */
async function searchHousingDataLocal(params: {
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

// ── External API Fallback ──

async function fetchWithRetry(url: string, retries = 2, delayMs = 3000): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) return resp;
      if (resp.status >= 500 && i < retries) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return resp;
    } catch (e: any) {
      if (i < retries) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Request failed after retries');
}

async function getStateStatsExternal(stateAbbr: string): Promise<HousingStateData> {
  const resp = await fetchWithRetry(`${HOUSING_API_BASE}/api/v1/research/stats/state/${stateAbbr}`);
  if (!resp.ok) throw new Error(`Housing API error: ${resp.status} ${resp.statusText}`);
  const json: any = await resp.json();
  if (!json.success) throw new Error(`Housing API error: ${JSON.stringify(json)}`);
  const d = json.data;
  return {
    stateAbbr: d.state_abbr,
    stateName: d.state_name || stateAbbr,
    zipCount: parseInt(d.zip_count),
    avgHomeownership: parseFloat(d.avg_homeownership),
    avgHomePrice: parseFloat(d.avg_home_price),
    avgRent: parseFloat(d.avg_rent),
    avgIncome: parseFloat(d.avg_income),
    totalPopulation: parseInt(d.total_population),
  };
}

// ── Public API (auto-selects local vs external) ──

let _hasLocal: boolean | null = null;

async function useLocal(): Promise<boolean> {
  if (_hasLocal === null) {
    try {
      _hasLocal = await hasLocalData();
    } catch {
      _hasLocal = false;
    }
  }
  return _hasLocal;
}

/** Fetch state-level housing statistics */
export async function getStateStats(stateAbbr: string): Promise<HousingStateData> {
  if (await useLocal()) {
    const local = await getStateStatsLocal(stateAbbr);
    if (local) return local;
  }
  return getStateStatsExternal(stateAbbr);
}

/** Fetch ZIP-level housing data */
export async function getZipStats(zipCode: string): Promise<HousingZipData> {
  if (await useLocal()) {
    const local = await getZipStatsLocal(zipCode);
    if (local) return local;
  }
  // Fall back to external
  const resp = await fetch(`${HOUSING_API_BASE}/api/v1/research/stats/zip/${zipCode}`);
  if (!resp.ok) throw new Error(`Housing API error: ${resp.status} ${resp.statusText}`);
  const json: any = await resp.json();
  if (!json.success) throw new Error(`Housing API error: ${JSON.stringify(json)}`);
  const d = json.data;
  return {
    zipCode: d.zip_code,
    state: d.state_abbr,
    county: d.county || '',
    city: d.city || '',
    medianHomeValue: parseFloat(d.zhvi_home_value || d.median_home_value || '0'),
    medianIncome: parseFloat(d.median_household_income || d.median_income || '0'),
    homeownershipRate: parseFloat(d.homeownership_rate || '0'),
    population: parseInt(d.total_population || '0'),
    medianRent: parseFloat(d.median_rent || '0'),
    medianAge: parseFloat(d.median_age || '0'),
    vacancyRate: parseFloat(d.vacancy_rate || '0'),
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
  if (await useLocal()) {
    return searchHousingDataLocal(params);
  }
  // Fall back to external
  const queryParts: string[] = [];
  if (params.state) queryParts.push(`state=${params.state}`);
  if (params.county) queryParts.push(`county=${encodeURIComponent(params.county)}`);
  if (params.minIncome) queryParts.push(`min_income=${params.minIncome}`);
  if (params.maxIncome) queryParts.push(`max_income=${params.maxIncome}`);
  if (params.minHomeValue) queryParts.push(`min_home_value=${params.minHomeValue}`);
  if (params.maxHomeValue) queryParts.push(`max_home_value=${params.maxHomeValue}`);
  queryParts.push(`limit=${params.limit || 50}`);
  if (params.offset) queryParts.push(`offset=${params.offset}`);

  const resp = await fetch(`${HOUSING_API_BASE}/api/v1/research/search?${queryParts.join('&')}`);
  if (!resp.ok) throw new Error(`Housing API error: ${resp.status} ${resp.statusText}`);
  const json: any = await resp.json();

  return {
    results: (json.data || []).map((d: any) => ({
      zipCode: d.zip_code,
      state: d.state_abbr,
      county: d.county || '',
      city: d.city || '',
      medianHomeValue: parseFloat(d.zhvi_home_value || d.median_home_value || '0'),
      medianIncome: parseFloat(d.median_household_income || d.median_income || '0'),
      homeownershipRate: parseFloat(d.homeownership_rate || '0'),
      population: parseInt(d.total_population || '0'),
      medianRent: parseFloat(d.median_rent || '0'),
      medianAge: parseFloat(d.median_age || '0'),
      vacancyRate: parseFloat(d.vacancy_rate || '0'),
    })),
    total: json.meta?.total || 0,
  };
}

// ── New: County-level queries (local only) ──

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
