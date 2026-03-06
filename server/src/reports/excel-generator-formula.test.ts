/**
 * Excel Formula Generator — Test Suite
 *
 * Tests single-geo and multi-geo formula Excel generation using the real
 * fund model engine for realistic data. Validates:
 * - Buffer output (non-empty, valid .xlsx)
 * - Sheet names and count
 * - Cross-sheet formula references (quoting for spaces)
 * - Key cell values and formulas on scenario, blended, geo sheets
 * - Edge cases (1 geo, 3 geo, 10+ geo, long geo names, duplicate names)
 */

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { generateFormulaExcel } from './excel-generator-formula';
import { runFundModel } from '../engine/fund-model';
import {
  FundConfig, GeoAllocation, GeoBreakdownResult, FundYearState,
  DEFAULT_PAYOFF_SCHEDULE, UDF_FUND_CONFIG,
} from '../engine/types';
import { ProformaData } from './proforma-report';

// ── Helpers ──

/** Build a multi-geo FundConfig with N geographies */
function makeMultiGeoFund(geoCount: number, overrides?: Partial<FundConfig>): FundConfig {
  const geos: GeoAllocation[] = [];
  const pct = 1 / geoCount;
  const counties = [
    'Salt Lake County', 'Utah County', 'Davis County', 'Weber County',
    'Washington County', 'Cache County', 'Summit County', 'Iron County',
    'Tooele County', 'Box Elder County', 'Wasatch County', 'Duchesne County',
    'Uintah County', 'Sanpete County', 'Sevier County', 'Carbon County',
    'Emery County', 'Grand County', 'San Juan County', 'Millard County',
  ];

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
    name: 'Test Multi-Geo Fund',
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

/** Run model and build ProformaData for the generator */
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

/** Parse buffer back into ExcelJS workbook for inspection */
async function parseWorkbook(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

function getSheetNames(wb: ExcelJS.Workbook): string[] {
  return wb.worksheets.map(ws => ws.name);
}

// ── Tests ──

describe('generateFormulaExcel', () => {

  // ════════════════════════════════════════════════════════════════
  // SINGLE-GEO (existing behavior — regression)
  // ════════════════════════════════════════════════════════════════

  describe('single-geo (LO/MID/HI)', () => {
    let buf: Buffer;
    let wb: ExcelJS.Workbook;

    it('generates a non-empty buffer', async () => {
      const data = buildProformaData(UDF_FUND_CONFIG);
      buf = await generateFormulaExcel(data);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(10000); // xlsx should be at least ~10KB
    });

    it('produces valid xlsx with correct sheet names', async () => {
      wb = await parseWorkbook(buf);
      const names = getSheetNames(wb);
      expect(names).toContain('Scenarios');
      expect(names).toContain('LO');
      expect(names).toContain('MID');
      expect(names).toContain('HI');
      expect(names).toContain('Blended');
      expect(names).toContain('Charts');
      expect(names).toContain('Share Conversion');
      expect(names.length).toBe(7);
    });

    it('has editable inputs on scenario sheets', () => {
      const lo = wb.getWorksheet('LO')!;
      // C6 = Initial Raise (blue input value)
      const raiseCell = lo.getCell('C6');
      expect(raiseCell.value).toBe(2_000_000); // LO allocation
      // C47 = Median Income
      const incomeCell = lo.getCell('C47');
      expect(incomeCell.value).toBe(76_000);
      // C48 = Median Home Value
      const mhvCell = lo.getCell('C48');
      expect(mhvCell.value).toBe(350_000);
    });

    it('has formulas (not values) in fund model rows', () => {
      const mid = wb.getWorksheet('MID')!;
      // Row 46 col F (year 1): New Originations — should be a formula
      const origCell = mid.getCell('F46');
      expect(origCell.value).toHaveProperty('formula');
      // Row 51: Fund NAV
      const navCell = mid.getCell('G51');
      expect(navCell.value).toHaveProperty('formula');
    });

    it('Blended sheet has cross-sheet SUM formulas referencing LO/MID/HI', () => {
      const blended = wb.getWorksheet('Blended')!;
      // Row 6, col F: New Donations = sum of LO+MID+HI
      const cell = blended.getCell('F6');
      const formula = (cell.value as any)?.formula || '';
      expect(formula).toContain("'LO'!");
      expect(formula).toContain("'MID'!");
      expect(formula).toContain("'HI'!");
    });

    it('Blended subtitle says "Blended" (not multi-geo)', () => {
      const blended = wb.getWorksheet('Blended')!;
      expect(blended.getCell(4, 1).value).toBe('Pro Forma — Blended');
    });

    it('year headers span 31 years', () => {
      const lo = wb.getWorksheet('LO')!;
      expect(lo.getCell(3, 6).value).toBe(1);  // Year 1
      // Year 31 = col AJ (36)
      const yr31Cell = lo.getCell(3, 36);
      const yr31Val = (yr31Cell.value as any)?.formula ? 31 : yr31Cell.value;
      // It's a formula, so we just check it exists
      expect(yr31Cell.value).toBeTruthy();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // MULTI-GEO: 3 GEOGRAPHIES
  // ════════════════════════════════════════════════════════════════

  describe('multi-geo (3 geos)', () => {
    let buf: Buffer;
    let wb: ExcelJS.Workbook;
    let sheetNames: string[];

    it('generates a non-empty buffer', async () => {
      const fund = makeMultiGeoFund(3);
      const data = buildProformaData(fund);
      buf = await generateFormulaExcel(data);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(10000);
    });

    it('produces correct sheet structure', async () => {
      wb = await parseWorkbook(buf);
      sheetNames = getSheetNames(wb);
      // Should have: Scenarios + 3 geo sheets + Blended + Charts + Share Conversion + Geo Summary = 8
      expect(sheetNames).toContain('Scenarios');
      expect(sheetNames).toContain('Salt Lake County');
      expect(sheetNames).toContain('Utah County');
      expect(sheetNames).toContain('Davis County');
      expect(sheetNames).toContain('Blended');
      expect(sheetNames).toContain('Charts');
      expect(sheetNames).toContain('Share Conversion');
      expect(sheetNames).toContain('Geo Summary');
      expect(sheetNames.length).toBe(8);
    });

    it('does NOT have LO/MID/HI sheets', () => {
      expect(sheetNames).not.toContain('LO');
      expect(sheetNames).not.toContain('MID');
      expect(sheetNames).not.toContain('HI');
    });

    it('geo sheets are formula-based with editable inputs', () => {
      const slc = wb.getWorksheet('Salt Lake County')!;
      // C6 = raise allocation (totalRaise * allocationPct)
      const raise = slc.getCell('C6').value as number;
      expect(raise).toBeCloseTo(10_000_000 / 3, -2);
      // C47 = median income
      expect(slc.getCell('C47').value).toBe(75000);
      // C48 = median home value
      expect(slc.getCell('C48').value).toBe(350000);
      // Fund model rows should be formulas
      expect(slc.getCell('F46').value).toHaveProperty('formula');
      expect(slc.getCell('G49').value).toHaveProperty('formula');
      expect(slc.getCell('F51').value).toHaveProperty('formula');
    });

    it('Blended sheet references geo sheets with cross-sheet SUMs', () => {
      const blended = wb.getWorksheet('Blended')!;
      const formula = (blended.getCell('F6').value as any)?.formula || '';
      // Should reference geo sheet names (with quotes for spaces)
      expect(formula).toContain("'Salt Lake County'!");
      expect(formula).toContain("'Utah County'!");
      expect(formula).toContain("'Davis County'!");
    });

    it('Blended subtitle reflects multi-geo mode', () => {
      const blended = wb.getWorksheet('Blended')!;
      const subtitle = blended.getCell(4, 1).value as string;
      expect(subtitle).toContain('3 Geographies');
    });

    it('Geo Summary has cross-sheet formula refs (not static values)', () => {
      const summary = wb.getWorksheet('Geo Summary')!;
      // Raise Amount row (row 7 in our layout: row 5=section, 6=state, 7=alloc%, 8=raise)
      // Find the raise row by searching for cross-sheet ref
      let foundCrossRef = false;
      for (let r = 5; r <= 30; r++) {
        const cell = summary.getCell(r, 2); // first geo col
        const formula = (cell.value as any)?.formula;
        if (formula && formula.includes("'Salt Lake County'!")) {
          foundCrossRef = true;
          break;
        }
      }
      expect(foundCrossRef).toBe(true);
    });

    it('Geo Summary Total column uses SUM formulas', () => {
      const summary = wb.getWorksheet('Geo Summary')!;
      // Total column = dataStartCol + geoCount = 2 + 3 = 5
      let foundSumFormula = false;
      for (let r = 5; r <= 30; r++) {
        const cell = summary.getCell(r, 5);
        const formula = (cell.value as any)?.formula;
        if (formula && formula.includes('SUM(')) {
          foundSumFormula = true;
          break;
        }
      }
      expect(foundSumFormula).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // MULTI-GEO: 10 GEOGRAPHIES (stress test)
  // ════════════════════════════════════════════════════════════════

  describe('multi-geo (10 geos)', () => {
    let buf: Buffer;
    let wb: ExcelJS.Workbook;

    it('generates successfully', async () => {
      const fund = makeMultiGeoFund(10);
      const data = buildProformaData(fund);
      buf = await generateFormulaExcel(data);
      expect(buf.length).toBeGreaterThan(10000);
    });

    it('has 10 geo sheets + Scenarios + Blended + Charts + Share Conv + Geo Summary = 15', async () => {
      wb = await parseWorkbook(buf);
      expect(wb.worksheets.length).toBe(15);
    });

    it('Blended cross-sheet formula references all 10 geo sheets', () => {
      const blended = wb.getWorksheet('Blended')!;
      const formula = (blended.getCell('F6').value as any)?.formula || '';
      // Should have 10 terms joined by +
      const plusCount = (formula.match(/\+/g) || []).length;
      expect(plusCount).toBe(9); // 10 refs = 9 plus signs
    });
  });

  // ════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ════════════════════════════════════════════════════════════════

  describe('edge cases', () => {

    it('single allocation (1 geo) still uses single-geo LO/MID/HI path', async () => {
      // 1 geo in allocations array = not multi-geo (len <= 1)
      const fund = makeMultiGeoFund(1);
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      const wb = await parseWorkbook(buf);
      const names = getSheetNames(wb);
      // Should have LO/MID/HI (single-geo mode), not geo sheet names
      expect(names).toContain('LO');
      expect(names).toContain('Blended');
      expect(names).not.toContain('Geo Summary');
    });

    it('handles duplicate geo labels via deduplication', async () => {
      const fund = makeMultiGeoFund(2);
      // Make both geos have the same label
      fund.geography.allocations![0].geoLabel = 'Salt Lake County';
      fund.geography.allocations![1].geoLabel = 'Salt Lake County';
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      const wb = await parseWorkbook(buf);
      const names = getSheetNames(wb);
      // One should be "Salt Lake County", other deduped with suffix
      const slcSheets = names.filter(n => n.includes('Salt Lake'));
      expect(slcSheets.length).toBe(2);
      // They should be different names
      expect(slcSheets[0]).not.toBe(slcSheets[1]);
    });

    it('handles long geo labels (>31 chars) via truncation', async () => {
      const fund = makeMultiGeoFund(2);
      fund.geography.allocations![0].geoLabel = 'Very Long County Name That Exceeds The 31 Character Excel Limit';
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      const wb = await parseWorkbook(buf);
      const names = getSheetNames(wb);
      // All sheet names should be <= 31 chars
      for (const name of names) {
        expect(name.length).toBeLessThanOrEqual(31);
      }
    });

    it('2-geo fund with reinvestment enabled', async () => {
      const fund = makeMultiGeoFund(2, {
        raise: { totalRaise: 5_000_000, annualContributionPct: 0.10, reinvestNetProceeds: true, baseYear: 2026 },
      });
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      const wb = await parseWorkbook(buf);
      expect(wb.worksheets.length).toBe(7); // Scenarios + 2 geo + Blended + Charts + ShareConv + GeoSummary

      // Check reinvest flag is set on geo sheets
      const geoSheet = wb.worksheets.find(ws => !['Scenarios', 'Blended', 'Charts', 'Share Conversion', 'Geo Summary'].includes(ws.name))!;
      expect(geoSheet.getCell('C11').value).toBe(1); // reinvest = 1
    });

    it('large raise ($100M) with 5 geos', async () => {
      const fund = makeMultiGeoFund(5, {
        raise: { totalRaise: 100_000_000, annualContributionPct: 0, reinvestNetProceeds: false, baseYear: 2025 },
      });
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      expect(buf.length).toBeGreaterThan(10000);
      const wb = await parseWorkbook(buf);
      expect(wb.worksheets.length).toBe(10); // Scenarios + 5 geo + Blended + Charts + ShareConv + GeoSummary
    });
  });

  // ════════════════════════════════════════════════════════════════
  // FORMULA INTEGRITY
  // ════════════════════════════════════════════════════════════════

  describe('formula integrity', () => {
    let wb: ExcelJS.Workbook;

    it('sets up workbook', async () => {
      const fund = makeMultiGeoFund(3);
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      wb = await parseWorkbook(buf);
    });

    it('geo sheet payoff waterfall rows have formulas', () => {
      const slc = wb.getWorksheet('Salt Lake County')!;
      // Rows 13-42 col G (year 2+): should have payoff waterfall formulas
      const cell = slc.getCell('G13');
      expect(cell.value).toHaveProperty('formula');
    });

    it('geo sheet row 49 (Notes Outstanding) has formula', () => {
      const slc = wb.getWorksheet('Salt Lake County')!;
      const cell = slc.getCell('G49');
      const formula = (cell.value as any)?.formula || '';
      expect(formula).toContain('49'); // references prev notes outstanding
    });

    it('geo sheet row 53 (New Homeowners) has formula', () => {
      const slc = wb.getWorksheet('Salt Lake County')!;
      const cell = slc.getCell('F53');
      const formula = (cell.value as any)?.formula || '';
      expect(formula).toContain('46'); // originations
      expect(formula).toContain('47'); // avg loan
    });

    it('Blended row 53 (New Homeowners) sums across geo sheets', () => {
      const blended = wb.getWorksheet('Blended')!;
      const formula = (blended.getCell('F53').value as any)?.formula || '';
      expect(formula).toContain("'Salt Lake County'!F53");
      expect(formula).toContain("'Utah County'!F53");
      expect(formula).toContain("'Davis County'!F53");
    });

    it('Blended row 49 (Notes Outstanding) uses own formula, not cross-sheet', () => {
      const blended = wb.getWorksheet('Blended')!;
      // Row 49 year 1 should reference F46 on the same sheet
      const cell = blended.getCell('F49');
      const formula = (cell.value as any)?.formula || '';
      expect(formula).toBe('F46');
    });

    it('cross-sheet refs use single-quoted sheet names', () => {
      const blended = wb.getWorksheet('Blended')!;
      const formula = (blended.getCell('F6').value as any)?.formula || '';
      // All sheet names with spaces should be quoted
      expect(formula).toMatch(/'Salt Lake County'!/);
      expect(formula).toMatch(/'Utah County'!/);
    });

    it('Scenarios sheet shows geo allocation table', () => {
      const scenarios = wb.getWorksheet('Scenarios')!;
      // Row 19 should have "Geography Allocation" for multi-geo
      expect(scenarios.getCell(19, 1).value).toBe('Geography Allocation');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // GEO SUMMARY CROSS-SHEET REFS
  // ════════════════════════════════════════════════════════════════

  describe('Geo Summary cross-sheet refs', () => {
    let wb: ExcelJS.Workbook;

    it('sets up workbook', async () => {
      const fund = makeMultiGeoFund(3);
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      wb = await parseWorkbook(buf);
    });

    it('Raise Amount references geo sheet C6', () => {
      const summary = wb.getWorksheet('Geo Summary')!;
      // Find the row with C6 cross-ref
      let found = false;
      for (let r = 5; r <= 15; r++) {
        const formula = (summary.getCell(r, 2).value as any)?.formula;
        if (formula && formula.includes('!C6')) {
          found = true;
          expect(formula).toBe("'Salt Lake County'!C6");
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('Median Income references geo sheet C47', () => {
      const summary = wb.getWorksheet('Geo Summary')!;
      let found = false;
      for (let r = 5; r <= 15; r++) {
        const formula = (summary.getCell(r, 2).value as any)?.formula;
        if (formula && formula.includes('!C47')) {
          found = true;
          expect(formula).toBe("'Salt Lake County'!C47");
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('Year 10 snapshot has cross-sheet refs to year 10 column', () => {
      const summary = wb.getWorksheet('Geo Summary')!;
      // Year 10 = COL_F + 9 = column 15 = col letter "O"
      let found = false;
      for (let r = 10; r <= 25; r++) {
        const formula = (summary.getCell(r, 2).value as any)?.formula;
        if (formula && formula.includes('!O')) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('Annual Homeowners section has cross-sheet refs to row 53', () => {
      const summary = wb.getWorksheet('Geo Summary')!;
      let found = false;
      for (let r = 20; r <= 60; r++) {
        const formula = (summary.getCell(r, 2).value as any)?.formula;
        if (formula && formula.includes('53')) {
          found = true;
          // Should reference geo sheet row 53 (New Homeowners)
          expect(formula).toMatch(/'Salt Lake County'!\w+53/);
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // CONSISTENCY: Engine values vs Excel structure
  // ════════════════════════════════════════════════════════════════

  describe('consistency checks', () => {

    it('total raise across geo sheets equals fund total', async () => {
      const fund = makeMultiGeoFund(4);
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      const wb = await parseWorkbook(buf);

      let totalRaise = 0;
      const geoSheetNames = getSheetNames(wb).filter(n =>
        !['Scenarios', 'Blended', 'Charts', 'Share Conversion', 'Geo Summary'].includes(n)
      );
      expect(geoSheetNames.length).toBe(4);

      for (const name of geoSheetNames) {
        const ws = wb.getWorksheet(name)!;
        totalRaise += ws.getCell('C6').value as number;
      }
      expect(totalRaise).toBeCloseTo(10_000_000, -1);
    });

    it('Blended sheet initial raise equals fund total', async () => {
      const fund = makeMultiGeoFund(3);
      const data = buildProformaData(fund);
      const buf = await generateFormulaExcel(data);
      const wb = await parseWorkbook(buf);
      const blended = wb.getWorksheet('Blended')!;
      expect(blended.getCell('C6').value).toBe(10_000_000);
    });

    it('Charts sheet has data for all years', async () => {
      const data = buildProformaData(UDF_FUND_CONFIG);
      const buf = await generateFormulaExcel(data);
      const wb = await parseWorkbook(buf);
      const charts = wb.getWorksheet('Charts')!;
      // Data starts at row 41, should have 31 years of data
      // calendarYear starts at baseYear+1 (year 1 of the model)
      const firstYear = charts.getCell(41, 1).value as number;
      expect(firstYear).toBe(2026);
      // Last data row = 41 + 29 = 70 (30 years)
      expect(charts.getCell(70, 1).value).toBe(2055);
    });
  });
});
