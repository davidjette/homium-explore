/**
 * Excel Pro Forma Generator — Values-Only Version
 *
 * Generates .xlsx with computed values from the fund model engine.
 * Structure mirrors the PTIF Pro Forma spreadsheet layout.
 *
 * Sheets: Scenarios, LO, MID, HI, Blended, Charts, Share Conversion, Affordability Sensitivity
 */

import ExcelJS from 'exceljs';
import { ProformaData } from './proforma-report';
import {
  FundConfig, FundModelResult, ScenarioResult, FundYearState,
} from '../engine/types';
import { TopOffYearState } from '../engine/topoff-calculator';

// ── Styling constants ──
const GREEN = '3D7A58';
const DARK = '1A2930';
const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN}` } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const SECTION_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FFE8F0EB` } };
const SECTION_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: `FF${GREEN}` }, size: 10 };
const INPUT_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF1565C0' }, size: 10 };
const CURRENCY = '$#,##0';
const PCT = '0.0%';
const PCT2 = '0.00%';
const PCT4 = '0.0000%';
const NUM = '#,##0';
const NUM2 = '#,##0.00';
const MULT = '0.00"x"';

function colLetter(c: number): string {
  let s = '';
  while (c > 0) { c--; s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26); }
  return s;
}

const COL_F = 6;
const COL_AJ = 36;

function applyHeaderRow(ws: ExcelJS.Worksheet, row: number, startCol: number, endCol: number) {
  for (let c = startCol; c <= endCol; c++) {
    const cell = ws.getCell(row, c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
}

function setVal(ws: ExcelJS.Worksheet, row: number, col: number, value: any, fmt?: string) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  if (fmt) cell.numFmt = fmt;
  cell.font = { size: 10 };
}

function setLabel(ws: ExcelJS.Worksheet, row: number, col: number, label: string) {
  const cell = ws.getCell(row, col);
  cell.value = label;
  cell.font = { size: 10, color: { argb: 'FF555555' } };
}

function setBoldLabel(ws: ExcelJS.Worksheet, row: number, col: number, label: string) {
  ws.getCell(row, col).value = label;
  ws.getCell(row, col).font = SECTION_FONT;
}

function setInputVal(ws: ExcelJS.Worksheet, row: number, col: number, value: any, fmt?: string) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font = INPUT_FONT;
  if (fmt) cell.numFmt = fmt;
}

// ── Sheet builders ──

function buildScenariosSheet(wb: ExcelJS.Workbook, fund: FundConfig, result: FundModelResult) {
  const ws = wb.addWorksheet('Scenarios');
  const scenarios = result.scenarioResults;

  ws.getCell(1, 1).value = fund.name;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: `FF${DARK}` } };

  const scenNames = ['LO', 'MID', 'HI'];
  const scenColStarts = [3, 6, 9];

  for (let s = 0; s < 3; s++) {
    const sc = s < scenarios.length ? scenarios[s] : scenarios[0];
    const col = scenColStarts[s];

    ws.getCell(3, col - 1).value = sc.scenario.name || scenNames[s];
    ws.getCell(3, col - 1).font = { bold: true, size: 11 };
    setInputVal(ws, 3, col, sc.scenario.weight, PCT);

    setLabel(ws, 5, col - 1, 'Initial Raise');
    setVal(ws, 5, col, sc.scenario.raiseAllocation || fund.raise.totalRaise * sc.scenario.weight, CURRENCY);

    setLabel(ws, 6, col - 1, 'Annual Contributions (% Initial)');
    setInputVal(ws, 6, col, fund.raise.annualContributionPct, PCT2);

    setLabel(ws, 7, col - 1, 'Program Fee');
    setInputVal(ws, 7, col, fund.fees.programFeePct, PCT2);

    setLabel(ws, 8, col - 1, 'Management Fee');
    setInputVal(ws, 8, col, fund.fees.managementFeePct, PCT4);

    setLabel(ws, 9, col - 1, 'Reinvest Net Proceeds?');
    setInputVal(ws, 9, col, fund.raise.reinvestNetProceeds);

    setLabel(ws, 10, col - 1, 'Home Price Appreciation');
    setInputVal(ws, 10, col, fund.assumptions.hpaPct, PCT2);

    setLabel(ws, 11, col - 1, 'Interest Rate');
    setInputVal(ws, 11, col, fund.assumptions.interestRate, PCT2);

    setLabel(ws, 12, col - 1, 'Median Participant Income');
    setInputVal(ws, 12, col, sc.scenario.medianIncome, CURRENCY);

    setLabel(ws, 13, col - 1, 'Median Home Value');
    setInputVal(ws, 13, col, sc.scenario.medianHomeValue, CURRENCY);

    setLabel(ws, 14, col - 1, 'Max Front Ratio');
    setInputVal(ws, 14, col, fund.program.maxFrontRatio, PCT);

    // Derived
    const mhv = sc.scenario.medianHomeValue;
    const dp = mhv * fund.program.downPaymentPct;
    const homPrincipal = mhv * fund.program.homiumSAPct;
    const mortgage = mhv - dp - homPrincipal;

    setLabel(ws, 15, col - 1, '1st Mortgage Principal');
    setVal(ws, 15, col, mortgage, CURRENCY);

    setLabel(ws, 19, col - 1, 'Down Payment %');
    setInputVal(ws, 19, col, fund.program.downPaymentPct, PCT);

    setLabel(ws, 20, col - 1, 'Homium SA%');
    setInputVal(ws, 20, col, fund.program.homiumSAPct, PCT);

    setLabel(ws, 21, col - 1, 'Homium Principal');
    setVal(ws, 21, col, homPrincipal, CURRENCY);

    // Affordability
    if (sc.affordability) {
      const aff = sc.affordability;
      setLabel(ws, 16, col - 1, 'Max PITI Pmt / mo');
      setVal(ws, 16, col, aff.maxPITI || 0, CURRENCY);
      setLabel(ws, 17, col - 1, 'PITI Pmt Before');
      setVal(ws, 17, col, aff.pitiBeforeHomium || 0, CURRENCY);
      setLabel(ws, 18, col - 1, 'Affordability Gap Before');
      setVal(ws, 18, col, (aff.maxPITI || 0) - (aff.pitiBeforeHomium || 0), CURRENCY);
      setLabel(ws, 22, col - 1, 'Mortgage Pmt with HOM');
      setVal(ws, 22, col, aff.pitiAfterHomium || 0, CURRENCY);
      setLabel(ws, 23, col - 1, 'Affordability Gap with HOM');
      setVal(ws, 23, col, (aff.maxPITI || 0) - (aff.pitiAfterHomium || 0), CURRENCY);
    }

    // Impact preview
    setLabel(ws, 25, col - 1, 'Impact Preview');
    ws.getCell(25, col - 1).font = { bold: true, size: 11 };

    const fr = sc.fundResults || [];
    const yr10 = fr[9]; // index 9 = year 10
    const yr30 = fr[29]; // index 29 = year 30

    if (yr10) {
      setLabel(ws, 28, col - 1, 'Total Homeowners (10 Years)');
      setVal(ws, 28, col, yr10.totalHomeownersCum, NUM);
    }
    if (yr30) {
      setLabel(ws, 32, col - 1, 'Total Homeowners (30 Years)');
      setVal(ws, 32, col, yr30.totalHomeownersCum, NUM);
    }
  }

  // Master total raise
  setLabel(ws, 28, 12, 'Total Raise');
  setInputVal(ws, 28, 13, fund.raise.totalRaise, CURRENCY);

  // Column widths
  for (const col of [2, 5, 8]) ws.getColumn(col).width = 28;
  for (const col of [3, 6, 9, 13]) ws.getColumn(col).width = 16;
  ws.getColumn(12).width = 22;

  return ws;
}

/**
 * Write a fund model time-series sheet (scenario or blended).
 * Rows match the PTIF layout. All values are computed, not formulas.
 */
function buildModelSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  fund: FundConfig,
  fundResults: FundYearState[],
  scenResult?: ScenarioResult,
) {
  const ws = wb.addWorksheet(sheetName);
  const maxYears = Math.min(fundResults.length, 31);

  // Title
  ws.getCell(1, 1).value = fund.name;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: `FF${DARK}` } };
  ws.getCell(2, 1).value = `Pro Forma — ${sheetName}`;
  ws.getCell(2, 1).font = { size: 12, color: { argb: 'FF888888' } };

  // Row 3: Year numbers
  ws.getCell(3, 5).value = 'Month No';
  for (let yr = 0; yr < maxYears; yr++) {
    setVal(ws, 3, COL_F + yr, yr + 1);
  }

  // Row 4: Calendar years
  ws.getCell(4, 2).value = 'Assumptions';
  ws.getCell(4, 2).font = { bold: true, size: 11 };
  ws.getCell(4, 5).value = 'Fund Model';
  ws.getCell(4, 5).font = { bold: true, size: 11 };
  for (let yr = 0; yr < maxYears; yr++) {
    setVal(ws, 4, COL_F + yr, fundResults[yr].calendarYear);
  }

  // Parameters (col B-C)
  const params: Array<[number, string, any, string?]> = [
    [6, 'Initial Raise', fund.raise.totalRaise, CURRENCY],
    [7, 'Annual Contributions (% Initial)', fund.raise.annualContributionPct, PCT2],
    [8, 'Program Fee', fund.fees.programFeePct, PCT2],
    [10, 'Management Fee', fund.fees.managementFeePct, PCT4],
    [11, 'Reinvest Net Proceeds?', fund.raise.reinvestNetProceeds],
    [45, 'Home Price Appreciation', fund.assumptions.hpaPct, PCT2],
    [46, 'Interest Rate (for participant)', fund.assumptions.interestRate, PCT2],
    [49, 'Max Front Ratio', fund.program.maxFrontRatio, PCT],
    [54, 'Down Payment', fund.program.downPaymentPct, PCT],
    [55, 'Homium SA%', fund.program.homiumSAPct, PCT],
  ];

  if (scenResult) {
    params.push(
      [47, 'Median Participant Income', scenResult.scenario.medianIncome, CURRENCY],
      [48, 'Median Home Value', scenResult.scenario.medianHomeValue, CURRENCY],
    );
    const mhv = scenResult.scenario.medianHomeValue;
    params.push(
      [50, '1st Mortgage Principal', mhv - mhv * fund.program.downPaymentPct - mhv * fund.program.homiumSAPct, CURRENCY],
      [56, 'Homium Principal', mhv * fund.program.homiumSAPct, CURRENCY],
    );
  }

  for (const [r, label, value, fmt] of params) {
    setLabel(ws, r, 2, label);
    setInputVal(ws, r, 3, value, fmt);
  }

  // Payoff schedule (rows 12-42)
  setLabel(ws, 12, 2, 'Payoff % after years:');
  const schedule = fund.payoffSchedule;
  let totalPct = 0;
  for (let i = 0; i < 30; i++) {
    const r = 13 + i;
    const entry = schedule[i] || { year: i + 1, annualPct: 0, cumulativePct: 0 };
    ws.getCell(r, 2).value = entry.year;
    ws.getCell(r, 3).value = entry.annualPct;
    ws.getCell(r, 3).numFmt = PCT4;
    ws.getCell(r, 4).value = entry.cumulativePct;
    ws.getCell(r, 4).numFmt = PCT2;
    totalPct += entry.annualPct;
  }
  setVal(ws, 12, 3, totalPct, PCT);

  // ── Fund model data grid ──
  const rowDefs: Array<[number, string, (yr: FundYearState) => number, string]> = [
    [6, 'New Donations - Initial', yr => yr.newDonations, CURRENCY],
    [7, 'New Donations - Annual', yr => yr.newContributions, CURRENCY],
    [8, 'Program Fee', yr => yr.programFee, CURRENCY],
    [10, 'Management Fee', yr => yr.managementFee, CURRENCY],
    [44, 'Reinvested Funds', yr => yr.reinvestedFunds, CURRENCY],
    [46, 'New Originations Net Fees', yr => yr.capitalDeployed, CURRENCY],
    [49, 'Notes Outstanding', yr => yr.outstandingPositionValue, CURRENCY],
    [50, 'Cash on Hand', yr => yr.fundBalance, CURRENCY],
    [51, 'Total Fund Value', yr => yr.fundNAV, CURRENCY],
    [53, 'New Homeowners', yr => yr.newHomeowners, NUM2],
    [54, 'Total Homeowners Cum', yr => yr.totalHomeownersCum, NUM2],
    [56, 'Exiting Homeowners', yr => yr.exitingHomeowners, NUM2],
    [58, 'Returned Capital', yr => yr.returnedCapital, CURRENCY],
    [59, '% Return on Investment', yr => yr.roiAnnual, PCT2],
    [60, '% Total Return (Cum)', yr => yr.roiCumulative, PCT2],
  ];

  for (const [r, label, getter, fmt] of rowDefs) {
    ws.getCell(r, 5).value = label;
    ws.getCell(r, 5).font = { size: 10 };
    for (let yr = 0; yr < maxYears; yr++) {
      setVal(ws, r, COL_F + yr, getter(fundResults[yr]), fmt);
    }
  }

  // Derived rows
  ws.getCell(45, 5).value = 'Total Fees Paid to Homium';
  ws.getCell(47, 5).value = 'Average Loan Amount';
  ws.getCell(62, 5).value = 'Cumulative Program Expenses';
  ws.getCell(63, 5).value = '% Total Invested';
  ws.getCell(64, 5).value = '% Trust Value';

  let cumFees = 0;
  const totalInvested = fundResults.reduce((s, yr) => s + yr.newDonations + yr.newContributions, 0);

  for (let yr = 0; yr < maxYears; yr++) {
    const c = COL_F + yr;
    const f = fundResults[yr];

    const totalFees = f.programFee + Math.min(0, f.managementFee);
    setVal(ws, 45, c, totalFees, CURRENCY);

    const avgLoan = f.newHomeowners > 0 ? f.capitalDeployed / f.newHomeowners : 0;
    setVal(ws, 47, c, avgLoan, CURRENCY);

    cumFees += -f.programFee - f.managementFee;
    setVal(ws, 62, c, cumFees, CURRENCY);
    setVal(ws, 63, c, totalInvested > 0 ? cumFees / totalInvested : 0, PCT2);
    setVal(ws, 64, c, f.fundNAV > 0 ? cumFees / f.fundNAV : 0, PCT2);
  }

  // ── Cohort detail sections ──
  if (scenResult && scenResult.cohorts.length > 0) {
    buildCohortDetails(ws, scenResult, fund, maxYears);
  }

  // ── Impact Preview ──
  buildImpactPreview(ws, fundResults, maxYears);

  // Column widths & freeze
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 30;
  for (let c = COL_F; c <= COL_AJ; c++) ws.getColumn(c).width = 14;
  ws.views = [{ state: 'frozen', xSplit: 5, ySplit: 4 }];

  return ws;
}

function buildCohortDetails(
  ws: ExcelJS.Worksheet,
  scenResult: ScenarioResult,
  fund: FundConfig,
  maxYears: number,
) {
  const cohorts = scenResult.cohorts;
  const states = scenResult.cohortStates;
  const hpa = fund.assumptions.hpaPct;
  const numCohorts = Math.min(cohorts.length, 31);

  const REMAINING_START = 67;
  const PRINCIPAL_START = 100;
  const HOME_VALUE_START = 133;
  const HOM_QV_START = 165;
  const EQUITY_START = 197;
  const LTV_START = 229;
  const CLTV_START = 261;

  // Section headers
  setBoldLabel(ws, 66, 2, 'Remaining in Cohort');
  setBoldLabel(ws, 99, 2, '1st Principal Remaining for Cohort');
  ws.getCell(99, 5).value = '1st Principal Remaining for Cohort';
  setBoldLabel(ws, 132, 2, 'Home Value for Cohort');
  ws.getCell(132, 5).value = 'Home Value for Cohort';
  setBoldLabel(ws, 164, 5, 'W/A Home Value');
  setBoldLabel(ws, 196, 5, 'W/A HOM Position');

  for (let ci = 0; ci < numCohorts; ci++) {
    const cohort = cohorts[ci];
    const cohortStates = states.filter(s => s.cohortYear === cohort.cohortYear);
    const rRem = REMAINING_START + ci;
    const rPrin = PRINCIPAL_START + ci;
    const rHV = HOME_VALUE_START + ci;
    const rHom = HOM_QV_START + ci;
    const rEq = EQUITY_START + ci;
    const rLTV = LTV_START + ci;
    const rCLTV = CLTV_START + ci;

    // Col B: cohort year
    ws.getCell(rRem, 2).value = cohort.cohortYear;
    ws.getCell(rPrin, 2).value = cohort.cohortYear;
    ws.getCell(rHV, 2).value = cohort.cohortYear;
    ws.getCell(rHom, 2).value = cohort.cohortYear;
    ws.getCell(rEq, 2).value = cohort.cohortYear;
    ws.getCell(rLTV, 2).value = cohort.cohortYear;
    ws.getCell(rCLTV, 2).value = cohort.cohortYear;

    // Col C: initial values
    ws.getCell(rPrin, 3).value = cohort.mortgagePrincipal0;
    ws.getCell(rPrin, 3).numFmt = CURRENCY;
    ws.getCell(rHV, 3).value = cohort.homeValue0;
    ws.getCell(rHV, 3).numFmt = CURRENCY;

    // Col E: initial homeowner count
    ws.getCell(rRem, 5).value = cohort.homeownerCount;
    ws.getCell(rRem, 5).numFmt = NUM2;

    let remaining = cohort.homeownerCount;

    for (let yr = 0; yr < maxYears; yr++) {
      const modelYear = yr + 1;
      const c = COL_F + yr;
      const cs = cohortStates.find(s => s.modelYear === modelYear);

      if (modelYear < cohort.cohortYear || !cs) {
        // Before cohort starts
        setVal(ws, rRem, c, 0, NUM2);
        setVal(ws, rPrin, c, 0, CURRENCY);
        setVal(ws, rHV, c, 0, CURRENCY);
        setVal(ws, rHom, c, 0, CURRENCY);
        setVal(ws, rEq, c, 0, CURRENCY);
        setVal(ws, rLTV, c, 0, PCT2);
        setVal(ws, rCLTV, c, 0, PCT2);
      } else {
        remaining -= cs.payoffCount;
        setVal(ws, rRem, c, Math.max(0, remaining), NUM2);
        setVal(ws, rPrin, c, cs.mortgageBalance, CURRENCY);
        setVal(ws, rHV, c, cs.homeValue, CURRENCY);
        setVal(ws, rHom, c, cs.homiumPosition, CURRENCY);
        setVal(ws, rEq, c, cs.homeownerEquity, CURRENCY);
        setVal(ws, rLTV, c, cs.ltv, PCT2);
        setVal(ws, rCLTV, c, cs.cltv, PCT2);
      }
    }
  }

  // Summary rows
  const summaryDefs: Array<[number, string, number, number, string]> = [
    [98, 'Active Homeowners all Cohorts', REMAINING_START, REMAINING_START + numCohorts - 1, NUM2],
    [131, 'W/A Outstanding Principal', PRINCIPAL_START, PRINCIPAL_START + numCohorts - 1, CURRENCY],
    [164, 'W/A Home Value', HOME_VALUE_START, HOME_VALUE_START + numCohorts - 1, CURRENCY],
    [196, 'W/A HOM Position', HOM_QV_START, HOM_QV_START + numCohorts - 1, CURRENCY],
    [228, 'W/A Homeowner Equity', EQUITY_START, EQUITY_START + numCohorts - 1, CURRENCY],
    [260, 'W/A LTV %', LTV_START, LTV_START + numCohorts - 1, PCT2],
    [292, 'W/A CLTV %', CLTV_START, CLTV_START + numCohorts - 1, PCT2],
  ];

  for (const [sumRow, label, dataStart, dataEnd, fmt] of summaryDefs) {
    ws.getCell(sumRow, 5).value = label;
    ws.getCell(sumRow, 5).font = { size: 10, bold: true };

    for (let yr = 0; yr < maxYears; yr++) {
      const c = COL_F + yr;
      if (sumRow === 98) {
        // Simple sum for active homeowners
        let total = 0;
        for (let r = dataStart; r <= dataEnd; r++) {
          total += (ws.getCell(r, c).value as number) || 0;
        }
        setVal(ws, sumRow, c, total, fmt);
      } else {
        // Weighted average using remaining homeowners as weights
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i <= dataEnd - dataStart; i++) {
          const weight = (ws.getCell(REMAINING_START + i, c).value as number) || 0;
          const value = (ws.getCell(dataStart + i, c).value as number) || 0;
          weightedSum += weight * value;
          totalWeight += weight;
        }
        setVal(ws, sumRow, c, totalWeight > 0 ? weightedSum / totalWeight : 0, fmt);
      }
    }
  }
}

function buildImpactPreview(ws: ExcelJS.Worksheet, fundResults: FundYearState[], maxYears: number) {
  setBoldLabel(ws, 294, 2, 'Impact Preview');
  ws.getCell(294, 5).value = 'Homeowners Created (Cum)';
  ws.getCell(294, 5).font = { size: 10, bold: true };

  for (let yr = 0; yr < maxYears; yr++) {
    setVal(ws, 294, COL_F + yr, fundResults[yr].totalHomeownersCum, NUM2);
  }

  ws.getCell(296, 5).value = 'Estimated Homeowner Equity';
  for (let yr = 0; yr < maxYears; yr++) {
    setVal(ws, 296, COL_F + yr, fundResults[yr].totalEquityCreated, CURRENCY);
  }

  const yr10 = fundResults[9];
  const yr30 = fundResults[maxYears - 1];
  const totalInvested = fundResults.reduce((s, yr) => s + yr.newDonations + yr.newContributions, 0);

  if (yr10) {
    setLabel(ws, 295, 2, 'Total Homeowners Created (10 Years)');
    setVal(ws, 295, 3, yr10.totalHomeownersCum, NUM2);
    setLabel(ws, 296, 2, 'Total Homeowner Equity Created (10 Years)');
    setVal(ws, 296, 3, yr10.totalEquityCreated, CURRENCY);
    if (totalInvested > 0) {
      setLabel(ws, 297, 2, '$1 Private Cap = $X Homeowner Wealth');
      setVal(ws, 297, 3, yr10.totalEquityCreated / totalInvested, MULT);
    }
  }

  if (yr30) {
    setLabel(ws, 299, 2, 'Total Homeowners Created (30 Years)');
    setVal(ws, 299, 3, yr30.totalHomeownersCum, NUM2);
    setLabel(ws, 300, 2, 'Total Homeowner Equity Created (30 Years)');
    setVal(ws, 300, 3, yr30.totalEquityCreated, CURRENCY);
    if (totalInvested > 0) {
      setLabel(ws, 301, 2, '$1 Private Cap = $X Homeowner Wealth');
      setVal(ws, 301, 3, yr30.totalEquityCreated / totalInvested, MULT);
    }
  }
}

function buildChartsSheet(wb: ExcelJS.Workbook, blended: FundYearState[]) {
  const ws = wb.addWorksheet('Charts');
  ws.getCell(1, 1).value = 'Chart Data';
  ws.getCell(1, 1).font = { bold: true, size: 14 };

  const headers = ['Year', 'Equity Created', 'Active Homeowners', 'Fund NAV', 'Cumulative ROI', 'Returned Capital'];
  headers.forEach((h, i) => ws.getCell(3, i + 1).value = h);
  applyHeaderRow(ws, 3, 1, headers.length);

  const maxYears = Math.min(blended.length, 31);
  for (let yr = 0; yr < maxYears; yr++) {
    const r = 4 + yr;
    const f = blended[yr];
    setVal(ws, r, 1, f.calendarYear, NUM);
    setVal(ws, r, 2, f.totalEquityCreated, CURRENCY);
    setVal(ws, r, 3, f.activeHomeowners, NUM);
    setVal(ws, r, 4, f.fundNAV, CURRENCY);
    setVal(ws, r, 5, f.roiCumulative, MULT);
    setVal(ws, r, 6, f.returnedCapital, CURRENCY);
  }

  headers.forEach((_, i) => ws.getColumn(i + 1).width = 18);
  return ws;
}

function buildShareConversionSheet(wb: ExcelJS.Workbook, fund: FundConfig) {
  const ws = wb.addWorksheet('Share Conversion');
  ws.getCell(1, 1).value = 'Share Conversion';
  ws.getCell(1, 1).font = { bold: true, size: 14 };

  const netToDeploy = fund.raise.totalRaise * (1 - fund.fees.programFeePct);

  setLabel(ws, 3, 1, 'Fund Size');
  setVal(ws, 3, 2, fund.raise.totalRaise, CURRENCY);
  setLabel(ws, 4, 1, 'Program Fee');
  setVal(ws, 4, 2, fund.fees.programFeePct, PCT);
  setLabel(ws, 5, 1, 'Net to Deploy');
  setVal(ws, 5, 2, netToDeploy, CURRENCY);

  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 16;
  return ws;
}

// ── Top-Off / Affordability Sensitivity Sheet ──

function buildTopOffSheet(wb: ExcelJS.Workbook, fund: FundConfig, topOff: TopOffYearState[]) {
  const ws = wb.addWorksheet('Affordability Sensitivity');

  // Title
  ws.getCell(1, 1).value = 'Affordability Sensitivity Analysis';
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: `FF${DARK}` } };
  ws.getCell(2, 1).value = 'Top-off capital needed when HPA outpaces wage growth';
  ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF888888' } };

  // Assumptions block
  setBoldLabel(ws, 4, 1, 'Assumptions');

  const midScenario = fund.scenarios.find(s => s.name === 'MID') || fund.scenarios[0];

  const assumptions: Array<[number, string, any, string?]> = [
    [5, 'Base Year', fund.raise.baseYear],
    [6, 'Home Price Appreciation (HPA)', fund.assumptions.hpaPct, PCT2],
    [7, 'Wage Growth', fund.assumptions.wageGrowthPct, PCT2],
    [8, 'Interest Rate', fund.assumptions.interestRate, PCT2],
    [9, 'Max Front Ratio (DTI)', fund.program.maxFrontRatio, PCT],
    [10, 'Down Payment %', fund.program.downPaymentPct, PCT],
    [11, 'Homium SA%', fund.program.homiumSAPct, PCT],
    [12, 'Fixed Home Count', fund.program.fixedHomeCount || 0, NUM],
    [13, 'Base Home Value (MID)', midScenario.medianHomeValue, CURRENCY],
    [14, 'Base Income (MID)', midScenario.medianIncome, CURRENCY],
    [15, 'Base SAM Amount', midScenario.medianHomeValue * fund.program.homiumSAPct, CURRENCY],
    [16, 'Tax & Insurance Rate', 0.0085, PCT4],
  ];

  for (const [r, label, value, fmt] of assumptions) {
    setLabel(ws, r, 1, label);
    setInputVal(ws, r, 2, value, fmt);
  }

  // Schedule header
  const HDR_ROW = 19;
  const headers = [
    'Year', 'Calendar Year', 'Home Value', '80% AMI Income',
    'Max Affordable Mortgage', 'SAM Required', 'SAM Baseline',
    'Recycled / Home', 'Top-Off / Home', 'Exits',
    'Annual Top-Off', 'Cumulative Top-Off',
  ];
  setBoldLabel(ws, 18, 1, 'Top-Off Schedule');
  for (let i = 0; i < headers.length; i++) {
    ws.getCell(HDR_ROW, i + 1).value = headers[i];
  }
  applyHeaderRow(ws, HDR_ROW, 1, headers.length);

  // Schedule data
  const fmts = [
    NUM, NUM, CURRENCY, CURRENCY,
    CURRENCY, CURRENCY, CURRENCY,
    CURRENCY, CURRENCY, NUM,
    CURRENCY, CURRENCY,
  ];

  for (let i = 0; i < topOff.length; i++) {
    const r = HDR_ROW + 1 + i;
    const y = topOff[i];
    const vals = [
      y.year, y.calendarYear, y.homeValue, y.income80AMI,
      y.maxAffordableMortgage, y.samRequired, y.samBaseline,
      y.recycledPerHome, y.topOffPerHome, y.exitsThisYear,
      y.annualTopOff, y.cumulativeTopOff,
    ];
    for (let c = 0; c < vals.length; c++) {
      setVal(ws, r, c + 1, vals[c], fmts[c]);
    }
  }

  // Summary metrics
  const sumStartRow = HDR_ROW + 1 + topOff.length + 2;
  const last = topOff[topOff.length - 1];
  const totalTopOff = last.cumulativeTopOff;
  const avgAnnual = totalTopOff / topOff.length;
  const peakYear = topOff.reduce((max, y) => y.annualTopOff > max.annualTopOff ? y : max, topOff[0]);

  setBoldLabel(ws, sumStartRow, 1, 'Summary');
  setLabel(ws, sumStartRow + 1, 1, 'Total Top-Off Capital');
  setVal(ws, sumStartRow + 1, 2, totalTopOff, CURRENCY);
  setLabel(ws, sumStartRow + 2, 1, 'Peak Year');
  setVal(ws, sumStartRow + 2, 2, peakYear.calendarYear, NUM);
  setLabel(ws, sumStartRow + 3, 1, 'Peak Annual Top-Off');
  setVal(ws, sumStartRow + 3, 2, peakYear.annualTopOff, CURRENCY);
  setLabel(ws, sumStartRow + 4, 1, 'Average Annual Top-Off');
  setVal(ws, sumStartRow + 4, 2, avgAnnual, CURRENCY);

  // Column widths
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 16;
  for (let c = 3; c <= headers.length; c++) ws.getColumn(c).width = 20;
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: HDR_ROW }];

  return ws;
}

// ── Main export function ──

export async function generateProformaExcel(data: ProformaData): Promise<Buffer> {
  const { fund, result } = data;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Homium Explore';
  wb.created = new Date();

  // Build sheets
  buildScenariosSheet(wb, fund, result);

  // Ensure we have 3 scenarios
  const scenarioResults = result.scenarioResults.slice(0, 3);
  while (scenarioResults.length < 3) {
    scenarioResults.push(scenarioResults[scenarioResults.length - 1]);
  }

  const sheetNames = ['LO', 'MID', 'HI'];
  for (let i = 0; i < 3; i++) {
    buildModelSheet(wb, sheetNames[i], fund, scenarioResults[i].fundResults, scenarioResults[i]);
  }

  buildModelSheet(wb, 'Blended', fund, result.blended);
  buildChartsSheet(wb, result.blended);
  buildShareConversionSheet(wb, fund);

  if (data.topOff && data.topOff.length) {
    buildTopOffSheet(wb, fund, data.topOff);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
