/**
 * Generate sample Excel files to disk for manual inspection.
 * Run: npx tsx src/reports/excel-export-samples.ts
 * Output: test-output/*.xlsx
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateFormulaExcel } from './excel-generator-formula';
import { runFundModel } from '../engine/fund-model';
import { FundConfig, GeoAllocation, DEFAULT_PAYOFF_SCHEDULE, UDF_FUND_CONFIG } from '../engine/types';
import { ProformaData } from './proforma-report';

const OUT_DIR = path.resolve(__dirname, '../../test-output');

function makeMultiGeoFund(geoCount: number, overrides?: Partial<FundConfig>): FundConfig {
  const counties = [
    'Salt Lake County', 'Utah County', 'Davis County', 'Weber County',
    'Washington County', 'Cache County', 'Summit County', 'Iron County',
    'Tooele County', 'Box Elder County',
  ];
  const geos: GeoAllocation[] = [];
  const pct = 1 / geoCount;
  for (let i = 0; i < geoCount; i++) {
    geos.push({
      geoId: `geo-${i}`,
      geoType: 'county',
      geoLabel: counties[i % counties.length],
      state: 'UT',
      county: counties[i % counties.length],
      allocationPct: pct,
      medianIncome: 75000 + i * 5000,
      medianHomeValue: 350000 + i * 25000,
    });
  }
  return {
    name: `Test Fund (${geoCount} geo)`,
    geography: { state: 'UT', label: 'Utah Multi-Geo', allocations: geos },
    raise: { totalRaise: 10_000_000, annualContributionPct: 0, reinvestNetProceeds: false, baseYear: 2025 },
    fees: { programFeePct: 0.05, managementFeePct: 0.005 },
    assumptions: { hpaPct: 0.05, interestRate: 0.07 },
    program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30 },
    payoffSchedule: DEFAULT_PAYOFF_SCHEDULE,
    scenarios: [
      { name: 'LO',  weight: 0.20, raiseAllocation: 2_000_000, medianIncome: 76000, medianHomeValue: 350000 },
      { name: 'MID', weight: 0.60, raiseAllocation: 6_000_000, medianIncome: 98000, medianHomeValue: 440000 },
      { name: 'HI',  weight: 0.20, raiseAllocation: 2_000_000, medianIncome: 132000, medianHomeValue: 600000 },
    ],
    ...overrides,
  };
}

function buildProformaData(fund: FundConfig): ProformaData {
  const result = runFundModel(fund);
  return {
    fund,
    result,
    blended: result.blended,
    affordability: result.scenarioResults[0]?.affordability || {
      mortgagePrincipal: 0, maxPITI: 0, pitiBeforeHomium: 0, pitiAfterHomium: 0,
      gapBefore: 0, gapAfter: 0, homiumPrincipal: 0, downPayment: 0, reducedMortgage: 0,
    },
    programName: fund.name,
    geoLabel: fund.geography.label,
    geoBreakdown: result.geoBreakdown,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const samples: Array<[string, FundConfig]> = [
    ['single-geo-udf', UDF_FUND_CONFIG],
    ['multi-geo-3', makeMultiGeoFund(3)],
    ['multi-geo-5', makeMultiGeoFund(5)],
    ['multi-geo-10', makeMultiGeoFund(10)],
    ['multi-geo-3-reinvest', makeMultiGeoFund(3, {
      name: 'Reinvest Fund (3 geo)',
      raise: { totalRaise: 5_000_000, annualContributionPct: 0.10, reinvestNetProceeds: true, baseYear: 2026 },
    })],
  ];

  for (const [name, fund] of samples) {
    const data = buildProformaData(fund);
    const buf = await generateFormulaExcel(data);
    const outPath = path.join(OUT_DIR, `${name}.xlsx`);
    fs.writeFileSync(outPath, buf);
    console.log(`✓ ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  console.log(`\nDone — ${samples.length} files in ${OUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
