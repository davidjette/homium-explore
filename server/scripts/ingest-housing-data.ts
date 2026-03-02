/**
 * ArcGIS Housing Data Ingestion Script
 *
 * Parses XLSX files from ArcGIS 2025 data and upserts into Neon PostgreSQL.
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/ingest-housing-data.ts --dir <path-to-xlsx-directory>
 *
 * Expected files in directory:
 *   - "ArcGIS State Level Data - 2025.xlsx" (51 rows: states + DC)
 *   - "ArcGIS State Datapoints by County - 2025.xlsx" (3,144 rows)
 *   - "[State Name] Zip Codes - 2025.xlsx" (50+ files, ~41K ZIPs total)
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// xlsx is a CommonJS module
const XLSX = require('xlsx');

const pool = new Pool({
  connectionString: process.env.NEON_UDF_DATABASE_URL
    || process.env.DATABASE_URL
    || 'postgresql://neondb_owner:npg_gNhrxuR1Uv8S@ep-bold-star-aeeibsjz-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

// State abbreviation lookup
const STATE_ABBRS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
  'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
  'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
  'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

function parseNum(val: any): number | null {
  if (val == null || val === '' || val === 'N/A' || val === '-') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function parseInt2(val: any): number | null {
  const n = parseNum(val);
  return n != null ? Math.round(n) : null;
}

function parseRate(val: any): number | null {
  const n = parseNum(val);
  if (n == null) return null;
  // If > 1, assume percentage (e.g. 65.3 → 0.653)
  return n > 1 ? n / 100 : n;
}

/** Find a column value by checking multiple possible header names */
function findCol(row: any, ...candidates: string[]): any {
  for (const c of candidates) {
    const lc = c.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes(lc)) return row[key];
    }
  }
  return undefined;
}

async function ingestStates(dir: string) {
  const file = fs.readdirSync(dir).find(f => /state level data/i.test(f) && f.endsWith('.xlsx'));
  if (!file) { console.log('⚠ State-level file not found, skipping'); return; }

  console.log(`📊 Ingesting states from: ${file}`);
  const wb = XLSX.readFile(path.join(dir, file));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);
  console.log(`   Found ${rows.length} rows`);

  let inserted = 0;
  for (const row of rows) {
    const stateName = findCol(row, 'state', 'state_name', 'name');
    if (!stateName) continue;
    const abbr = STATE_ABBRS[stateName] || findCol(row, 'abbr', 'state_abbr', 'abbreviation');
    if (!abbr) { console.log(`   ⚠ Unknown state: ${stateName}`); continue; }

    await pool.query(`
      INSERT INTO housing_states (state_abbr, state_name, population, median_income, median_home_value, median_rent, homeownership_rate, data_year)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 2025)
      ON CONFLICT (state_abbr) DO UPDATE SET
        state_name = EXCLUDED.state_name,
        population = EXCLUDED.population,
        median_income = EXCLUDED.median_income,
        median_home_value = EXCLUDED.median_home_value,
        median_rent = EXCLUDED.median_rent,
        homeownership_rate = EXCLUDED.homeownership_rate,
        data_year = EXCLUDED.data_year,
        updated_at = NOW()
    `, [
      abbr,
      stateName,
      parseInt2(findCol(row, 'population', 'total_population', 'pop')),
      parseNum(findCol(row, 'median_income', 'income', 'median_household_income', 'hh_income')),
      parseNum(findCol(row, 'median_home_value', 'home_value', 'home_price', 'median_home_price')),
      parseNum(findCol(row, 'median_rent', 'rent', 'median_gross_rent')),
      parseRate(findCol(row, 'homeownership', 'homeownership_rate', 'owner_occupied')),
    ]);
    inserted++;
  }
  console.log(`   ✅ ${inserted} states upserted`);
}

async function ingestCounties(dir: string) {
  const file = fs.readdirSync(dir).find(f => /county/i.test(f) && /2025/i.test(f) && f.endsWith('.xlsx'));
  if (!file) { console.log('⚠ County-level file not found, skipping'); return; }

  console.log(`📊 Ingesting counties from: ${file}`);
  const wb = XLSX.readFile(path.join(dir, file));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);
  console.log(`   Found ${rows.length} rows`);

  let inserted = 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: any[] = [];
    const placeholders: string[] = [];

    for (const row of batch) {
      const countyName = findCol(row, 'county', 'county_name', 'name');
      const stateName = findCol(row, 'state', 'state_name');
      if (!countyName || !stateName) continue;

      const abbr = STATE_ABBRS[stateName] || findCol(row, 'abbr', 'state_abbr');
      if (!abbr) continue;

      const idx = values.length;
      placeholders.push(`($${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7})`);
      values.push(
        countyName, abbr,
        parseInt2(findCol(row, 'population', 'total_population')),
        parseNum(findCol(row, 'median_income', 'income', 'median_household_income')),
        parseNum(findCol(row, 'median_home_value', 'home_value', 'home_price')),
        parseNum(findCol(row, 'median_rent', 'rent')),
        parseRate(findCol(row, 'homeownership', 'homeownership_rate')),
      );
    }

    if (placeholders.length === 0) continue;

    await pool.query(`
      INSERT INTO housing_counties (county_name, state_abbr, population, median_income, median_home_value, median_rent, homeownership_rate)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (county_name, state_abbr) DO UPDATE SET
        population = EXCLUDED.population,
        median_income = EXCLUDED.median_income,
        median_home_value = EXCLUDED.median_home_value,
        median_rent = EXCLUDED.median_rent,
        homeownership_rate = EXCLUDED.homeownership_rate
    `, values);
    inserted += batch.length;
  }
  console.log(`   ✅ ${inserted} counties upserted`);
}

async function ingestZips(dir: string) {
  const files = fs.readdirSync(dir).filter(f => /zip\s*code/i.test(f) && f.endsWith('.xlsx'));
  if (files.length === 0) { console.log('⚠ No ZIP code files found, skipping'); return; }

  console.log(`📊 Ingesting ZIPs from ${files.length} files`);
  let totalInserted = 0;

  for (const file of files) {
    const wb = XLSX.readFile(path.join(dir, file));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    // Extract state from filename (e.g. "Alabama Zip Codes - 2025.xlsx")
    const stateMatch = file.match(/^(.+?)\s*Zip\s*Code/i);
    const stateName = stateMatch ? stateMatch[1].trim() : null;
    const fileStateAbbr = stateName ? STATE_ABBRS[stateName] : null;

    let inserted = 0;
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values: any[] = [];
      const placeholders: string[] = [];

      for (const row of batch) {
        const zip = String(findCol(row, 'zip', 'zip_code', 'zipcode') || '').padStart(5, '0');
        if (zip.length !== 5 || !/^\d{5}$/.test(zip)) continue;

        const stateAbbr = fileStateAbbr
          || STATE_ABBRS[findCol(row, 'state', 'state_name') || '']
          || findCol(row, 'state_abbr', 'abbr');
        if (!stateAbbr) continue;

        const idx = values.length;
        placeholders.push(`($${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9})`);
        values.push(
          zip,
          findCol(row, 'city', 'place', 'place_name') || null,
          findCol(row, 'county', 'county_name') || null,
          stateAbbr,
          parseInt2(findCol(row, 'population', 'total_population')),
          parseNum(findCol(row, 'median_income', 'income', 'median_household_income')),
          parseNum(findCol(row, 'median_home_value', 'home_value', 'home_price')),
          parseNum(findCol(row, 'median_rent', 'rent')),
          parseRate(findCol(row, 'homeownership', 'homeownership_rate')),
        );
      }

      if (placeholders.length === 0) continue;

      await pool.query(`
        INSERT INTO housing_zips (zip_code, city, county_name, state_abbr, population, median_income, median_home_value, median_rent, homeownership_rate)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (zip_code) DO UPDATE SET
          city = EXCLUDED.city,
          county_name = EXCLUDED.county_name,
          state_abbr = EXCLUDED.state_abbr,
          population = EXCLUDED.population,
          median_income = EXCLUDED.median_income,
          median_home_value = EXCLUDED.median_home_value,
          median_rent = EXCLUDED.median_rent,
          homeownership_rate = EXCLUDED.homeownership_rate
      `, values);
      inserted += batch.length;
    }

    console.log(`   ${file}: ${inserted} ZIPs`);
    totalInserted += inserted;
  }
  console.log(`   ✅ ${totalInserted} total ZIPs upserted`);
}

async function main() {
  const dirArg = process.argv.find((a, i) => process.argv[i-1] === '--dir') || process.argv[2];
  if (!dirArg || !fs.existsSync(dirArg)) {
    console.error('Usage: npx tsx scripts/ingest-housing-data.ts --dir <path-to-xlsx-directory>');
    console.error('  Directory should contain ArcGIS 2025 XLSX files');
    process.exit(1);
  }

  console.log(`\n🏠 Housing Data Ingestion — ArcGIS 2025\n`);
  console.log(`Source directory: ${dirArg}`);
  console.log(`Files found: ${fs.readdirSync(dirArg).filter(f => f.endsWith('.xlsx')).length} XLSX files\n`);

  await ingestStates(dirArg);
  await ingestCounties(dirArg);
  await ingestZips(dirArg);

  // Verify counts
  const stateCount = await pool.query('SELECT COUNT(*) FROM housing_states');
  const countyCount = await pool.query('SELECT COUNT(*) FROM housing_counties');
  const zipCount = await pool.query('SELECT COUNT(*) FROM housing_zips');

  console.log(`\n📊 Final counts:`);
  console.log(`   States:   ${stateCount.rows[0].count}`);
  console.log(`   Counties: ${countyCount.rows[0].count}`);
  console.log(`   ZIPs:     ${zipCount.rows[0].count}`);

  await pool.end();
  console.log(`\n✅ Ingestion complete.\n`);
}

main().catch(e => { console.error('Ingestion failed:', e); process.exit(1); });
