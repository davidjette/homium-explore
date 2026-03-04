/**
 * Seed housing_counties and housing_zips tables from the external housing API.
 *
 * Usage: npx tsx server/db/seed/seed-housing.ts [STATE]
 * Example: npx tsx server/db/seed/seed-housing.ts UT
 * No args = seed all states that exist in housing_states.
 */

import { pool } from '../../src/db/pool';

const API = process.env.HOUSING_API_URL || 'https://unabashed-empathy.onrender.com';

async function fetchJson(url: string): Promise<any> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText} for ${url}`);
  return resp.json();
}

async function seedState(stateAbbr: string) {
  console.log(`\n── Seeding ${stateAbbr} ──`);

  // Ensure the state row exists in housing_states (required by FK)
  const stateExists = await pool.query('SELECT 1 FROM housing_states WHERE state_abbr = $1', [stateAbbr]);
  if (stateExists.rows.length === 0) {
    console.log(`  State ${stateAbbr} not in housing_states, fetching from API...`);
    const json = await fetchJson(`${API}/api/v1/research/stats/state/${stateAbbr}`);
    const d = json.data;
    await pool.query(
      `INSERT INTO housing_states (state_abbr, state_name, population, median_income, median_home_value, median_rent, homeownership_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (state_abbr) DO NOTHING`,
      [
        stateAbbr,
        d.state_name || stateAbbr,
        parseInt(d.total_population || '0') || null,
        parseFloat(d.avg_income || '0') || null,
        parseFloat(d.avg_home_price || '0') || null,
        parseFloat(d.avg_rent || '0') || null,
        parseFloat(d.avg_homeownership || '0') || null,
      ]
    );
    console.log(`  Inserted state ${stateAbbr}`);
  }

  // Get all zip codes for this state by searching zip prefixes
  // The external API requires a `q` param, so we search by state zip prefixes
  const zipPrefixes = STATE_ZIP_PREFIXES[stateAbbr];
  if (!zipPrefixes) {
    console.log(`  No known zip prefixes for ${stateAbbr}, skipping`);
    return;
  }

  const allZips: any[] = [];
  const seen = new Set<string>();

  for (const prefix of zipPrefixes) {
    let offset = 0;
    const limit = 50;
    while (true) {
      try {
        const json = await fetchJson(
          `${API}/api/v1/research/search?q=${prefix}&limit=${limit}&offset=${offset}`
        );
        const zips = (json.data || []).filter((z: any) => z.state_abbr === stateAbbr && !seen.has(z.zip_code));
        if (zips.length === 0) break;
        for (const z of zips) {
          seen.add(z.zip_code);
          allZips.push(z);
        }
        offset += limit;
        // If we got fewer than limit, we've exhausted this prefix
        if (json.data.length < limit) break;
      } catch (e: any) {
        console.log(`  Warning: search prefix ${prefix} offset ${offset}: ${e.message}`);
        break;
      }
    }
  }

  console.log(`  Found ${allZips.length} ZIPs`);

  // Enrich with individual zip stats for better data
  let enriched = 0;
  for (const z of allZips) {
    if (!z.median_home_price && !z.median_household_income) {
      try {
        const detail = await fetchJson(`${API}/api/v1/research/stats/zip/${z.zip_code}`);
        if (detail.data) {
          Object.assign(z, detail.data);
          enriched++;
        }
      } catch { /* skip */ }
    }
  }
  if (enriched > 0) console.log(`  Enriched ${enriched} ZIPs with detail data`);

  // Insert ZIPs
  let zipInserted = 0;
  for (const z of allZips) {
    try {
      await pool.query(
        `INSERT INTO housing_zips (zip_code, city, county_name, state_abbr, population, median_income, median_home_value, median_rent, homeownership_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (zip_code) DO UPDATE SET
           city = EXCLUDED.city,
           county_name = EXCLUDED.county_name,
           population = EXCLUDED.population,
           median_income = EXCLUDED.median_income,
           median_home_value = EXCLUDED.median_home_value,
           median_rent = EXCLUDED.median_rent,
           homeownership_rate = EXCLUDED.homeownership_rate`,
        [
          z.zip_code,
          z.city || z.metro_area?.split(',')[0] || '',
          z.county_name || '',
          stateAbbr,
          parseInt(z.population || z.total_population || '0') || null,
          parseFloat(z.median_household_income || z.median_income || '0') || null,
          parseFloat(z.median_home_price || z.median_home_value || z.redfin_median_sale_price || '0') || null,
          parseFloat(z.median_rent || '0') || null,
          Math.min(parseFloat(z.homeownership_rate || '0') || 0, 99.9999) || null,
        ]
      );
      zipInserted++;
    } catch (e: any) {
      console.log(`  Warning: zip ${z.zip_code}: ${e.message}`);
    }
  }
  console.log(`  Inserted/updated ${zipInserted} ZIPs`);

  // Aggregate counties from ZIP data
  const countyMap = new Map<string, { pop: number; incomes: number[]; homes: number[]; rents: number[]; rates: number[] }>();
  for (const z of allZips) {
    const county = z.county_name;
    if (!county) continue;
    if (!countyMap.has(county)) countyMap.set(county, { pop: 0, incomes: [], homes: [], rents: [], rates: [] });
    const c = countyMap.get(county)!;
    c.pop += parseInt(z.population || z.total_population || '0') || 0;
    const inc = parseFloat(z.median_household_income || z.median_income || '0');
    const hv = parseFloat(z.median_home_price || z.median_home_value || '0');
    const rent = parseFloat(z.median_rent || '0');
    const rate = parseFloat(z.homeownership_rate || '0');
    if (inc > 0) c.incomes.push(inc);
    if (hv > 0) c.homes.push(hv);
    if (rent > 0) c.rents.push(rent);
    if (rate > 0) c.rates.push(rate);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  let countyInserted = 0;
  for (const [countyName, data] of countyMap) {
    try {
      await pool.query(
        `INSERT INTO housing_counties (county_name, state_abbr, population, median_income, median_home_value, median_rent, homeownership_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (county_name, state_abbr) DO UPDATE SET
           population = EXCLUDED.population,
           median_income = EXCLUDED.median_income,
           median_home_value = EXCLUDED.median_home_value,
           median_rent = EXCLUDED.median_rent,
           homeownership_rate = EXCLUDED.homeownership_rate`,
        [
          countyName,
          stateAbbr,
          data.pop || null,
          avg(data.incomes) || null,
          avg(data.homes) || null,
          avg(data.rents) || null,
          avg(data.rates) || null,
        ]
      );
      countyInserted++;
    } catch (e: any) {
      console.log(`  Warning: county ${countyName}: ${e.message}`);
    }
  }
  console.log(`  Inserted/updated ${countyInserted} counties`);
}

// ZIP code prefix ranges by state (first 2-3 digits)
const STATE_ZIP_PREFIXES: Record<string, string[]> = {
  UT: ['840', '841', '842', '843', '844', '845', '846', '847'],
  AZ: ['850', '851', '852', '853', '855', '856', '857', '859', '860', '863', '864', '865'],
  CA: ['900', '901', '902', '903', '904', '905', '906', '907', '908', '909', '910', '911', '912', '913', '914', '915', '916', '917', '918', '919', '920', '921', '922', '923', '924', '925', '926', '927', '928', '930', '931', '932', '933', '934', '935', '936', '937', '938', '939', '940', '941', '942', '943', '944', '945', '946', '947', '948', '949', '950', '951', '952', '953', '954', '955', '956', '957', '958', '959', '960', '961'],
  CO: ['800', '801', '802', '803', '804', '805', '806', '807', '808', '809', '810', '811', '812', '813', '814', '815', '816'],
  TX: ['750', '751', '752', '753', '754', '755', '756', '757', '758', '759', '760', '761', '762', '763', '764', '765', '766', '767', '768', '769', '770', '771', '772', '773', '774', '775', '776', '777', '778', '779', '780', '781', '782', '783', '784', '785', '786', '787', '788', '789', '790', '791', '792', '793', '794', '795', '796', '797', '798', '799'],
  NY: ['100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127', '128', '129', '130', '131', '132', '133', '134', '135', '136', '137', '138', '139', '140', '141', '142', '143', '144', '145', '146', '147', '148', '149'],
  FL: ['320', '321', '322', '323', '324', '325', '326', '327', '328', '329', '330', '331', '332', '333', '334', '335', '336', '337', '338', '339', '340', '341', '342', '344', '346', '347', '349'],
  ID: ['832', '833', '834', '835', '836', '837', '838'],
  NV: ['889', '890', '891', '893', '894', '895', '897', '898'],
  GA: ['300', '301', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311', '312', '313', '314', '315', '316', '317', '318', '319'],
  NC: ['270', '271', '272', '273', '274', '275', '276', '277', '278', '279', '280', '281', '282', '283', '284', '285', '286', '287', '288', '289'],
  TN: ['370', '371', '372', '373', '374', '375', '376', '377', '378', '379', '380', '381', '382', '383', '384', '385'],
  SC: ['290', '291', '292', '293', '294', '295', '296', '297', '298', '299'],
  WA: ['980', '981', '982', '983', '984', '985', '986', '988', '989', '990', '991', '992', '993', '994'],
  OR: ['970', '971', '972', '973', '974', '975', '976', '977', '978', '979'],
};

async function main() {
  const targetState = process.argv[2]?.toUpperCase();

  if (targetState) {
    // Seed a single state
    await seedState(targetState);
  } else {
    // Seed all states that have entries in housing_states
    const result = await pool.query('SELECT state_abbr FROM housing_states ORDER BY state_abbr');
    const states = result.rows.map((r: any) => r.state_abbr as string);
    console.log(`Found ${states.length} states in housing_states. Seeding counties/zips for states with known zip prefixes...`);
    for (const s of states) {
      if (STATE_ZIP_PREFIXES[s]) {
        await seedState(s);
      }
    }
  }

  console.log('\nDone!');
  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
