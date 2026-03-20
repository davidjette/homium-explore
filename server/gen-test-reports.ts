/**
 * gen-test-reports.ts — Generate PDF + PPTX pairs for multiple fund configs
 *
 * Usage:
 *   1. Start the server: npx tsx src/api/server.ts
 *   2. Run this script:  npx tsx gen-test-reports.ts
 *   3. Compare outputs in test-reports/
 */

import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const BASE = 'http://localhost:3001/api/v2/funds';
const OUT_DIR = path.join(__dirname, 'test-reports');

interface TestCase {
  slug: string;
  programName?: string;
  includeAffordabilitySensitivity?: boolean;
  fund: Record<string, unknown>;
}

const cases: TestCase[] = [
  // 1. Single-geo small fund — UT, $5.5M, 46 homes
  {
    slug: 'small-ut-46',
    programName: 'SLC 46-Home Program',
    fund: {
      name: 'SLC 46-Home Program',
      geography: { state: 'UT', label: 'Salt Lake City' },
      raise: { totalRaise: 5_500_000, annualContributionPct: 0, reinvestNetProceeds: true, baseYear: 2026 },
      fees: { programFeePct: 0.05, managementFeePct: 0.005 },
      assumptions: { hpaPct: 0.05, interestRate: 0.07, wageGrowthPct: 0.03 },
      program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30, fixedHomeCount: 46 },
      scenarios: [
        { name: 'LO', weight: 0.20, raiseAllocation: 1_100_000, medianIncome: 76_000, medianHomeValue: 350_000 },
        { name: 'MID', weight: 0.60, raiseAllocation: 3_300_000, medianIncome: 98_000, medianHomeValue: 440_000 },
        { name: 'HI', weight: 0.20, raiseAllocation: 1_100_000, medianIncome: 132_000, medianHomeValue: 600_000 },
      ],
    },
  },

  // 2. Single-geo large fund — CO, $25M, 200 homes
  {
    slug: 'large-co-200',
    programName: 'Colorado Opportunity Fund',
    fund: {
      name: 'Colorado Opportunity Fund',
      geography: { state: 'CO', label: 'Denver Metro' },
      raise: { totalRaise: 25_000_000, annualContributionPct: 0, reinvestNetProceeds: true, baseYear: 2026 },
      fees: { programFeePct: 0.05, managementFeePct: 0.005 },
      assumptions: { hpaPct: 0.05, interestRate: 0.07, wageGrowthPct: 0.03 },
      program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30, fixedHomeCount: 200 },
      scenarios: [
        { name: 'LO', weight: 0.20, raiseAllocation: 5_000_000, medianIncome: 82_000, medianHomeValue: 400_000 },
        { name: 'MID', weight: 0.60, raiseAllocation: 15_000_000, medianIncome: 105_000, medianHomeValue: 520_000 },
        { name: 'HI', weight: 0.20, raiseAllocation: 5_000_000, medianIncome: 145_000, medianHomeValue: 700_000 },
      ],
    },
  },

  // 3. Multi-geo fund — 3 geographies
  {
    slug: 'multi-3geo',
    programName: 'Western States Fund',
    fund: {
      name: 'Western States Fund',
      geography: {
        state: 'UT', label: 'Western States',
        allocations: [
          { geoId: 'slc', geoType: 'county', geoLabel: 'Salt Lake County', state: 'UT', allocationPct: 0.50, medianIncome: 98_000, medianHomeValue: 440_000 },
          { geoId: 'phx', geoType: 'county', geoLabel: 'Maricopa County', state: 'AZ', allocationPct: 0.30, medianIncome: 82_000, medianHomeValue: 380_000 },
          { geoId: 'den', geoType: 'county', geoLabel: 'Denver County', state: 'CO', allocationPct: 0.20, medianIncome: 105_000, medianHomeValue: 520_000 },
        ],
      },
      raise: { totalRaise: 20_000_000, annualContributionPct: 0, reinvestNetProceeds: true, baseYear: 2026 },
      fees: { programFeePct: 0.05, managementFeePct: 0.005 },
      assumptions: { hpaPct: 0.05, interestRate: 0.07 },
      program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30 },
      scenarios: [
        { name: 'LO', weight: 0.20, raiseAllocation: 4_000_000, medianIncome: 76_000, medianHomeValue: 350_000 },
        { name: 'MID', weight: 0.60, raiseAllocation: 12_000_000, medianIncome: 98_000, medianHomeValue: 440_000 },
        { name: 'HI', weight: 0.20, raiseAllocation: 4_000_000, medianIncome: 132_000, medianHomeValue: 600_000 },
      ],
    },
  },

  // 4. Fund with affordability sensitivity enabled
  {
    slug: 'sensitivity',
    programName: 'Utah Dream Fund (Sensitivity)',
    includeAffordabilitySensitivity: true,
    fund: {
      name: 'Utah Dream Fund (Sensitivity)',
      geography: { state: 'UT', label: 'Salt Lake City' },
      raise: { totalRaise: 10_000_000, annualContributionPct: 0, reinvestNetProceeds: true, baseYear: 2026 },
      fees: { programFeePct: 0.05, managementFeePct: 0.005 },
      assumptions: { hpaPct: 0.05, interestRate: 0.07, wageGrowthPct: 0.03 },
      program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30, fixedHomeCount: 80 },
      scenarios: [
        { name: 'LO', weight: 0.20, raiseAllocation: 2_000_000, medianIncome: 76_000, medianHomeValue: 350_000 },
        { name: 'MID', weight: 0.60, raiseAllocation: 6_000_000, medianIncome: 98_000, medianHomeValue: 440_000 },
        { name: 'HI', weight: 0.20, raiseAllocation: 2_000_000, medianIncome: 132_000, medianHomeValue: 600_000 },
      ],
    },
  },
];

async function generate(tc: TestCase, format: 'pdf' | 'pptx'): Promise<void> {
  const url = `${BASE}/report/${format}`;
  const body = {
    fund: tc.fund,
    programName: tc.programName,
    includeAffordabilitySensitivity: tc.includeAffordabilitySensitivity ?? false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${format.toUpperCase()} ${tc.slug}: ${res.status} — ${text}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(OUT_DIR, `${tc.slug}.${format}`);
  writeFileSync(outPath, buf);
  console.log(`  ✓ ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Generating ${cases.length * 2} reports → ${OUT_DIR}\n`);

  for (const tc of cases) {
    console.log(`▸ ${tc.slug}`);
    await generate(tc, 'pdf');
    await generate(tc, 'pptx');
  }

  console.log(`\nDone! Opening output folder...`);
  try {
    execSync(`start "" "${OUT_DIR}"`);
  } catch {
    // non-fatal if explorer fails to open
  }
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
