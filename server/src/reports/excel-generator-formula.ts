/**
 * Excel Pro Forma Generator — Formula Version
 *
 * Generates .xlsx with LIVE Excel formulas matching the PTIF Pro Forma
 * spreadsheet structure. Users can change input parameters (raise, fees,
 * HPA, etc.) and the model recalculates in Excel.
 *
 * Layout matches PTIF: rows 3-64 fund model, rows 67+ cohort details (values).
 * Blended sheet uses cross-sheet sum formulas referencing LO/MID/HI.
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { ProformaData } from './proforma-report';
import {
  FundConfig, ScenarioResult, FundYearState, GeoBreakdownResult, GeoAllocation,
} from '../engine/types';

// ── Styling constants (matches PDF: GREEN #3D7A58, DARK #1A2930) ──
const GREEN = '3D7A58';
const GREEN_LIGHT = 'E8F0EB';
const GREEN_MED = '7BB394';
const DARK = '1A2930';
const CREAM = 'FAFAF8';
const BORDER_COLOR = 'E5E5E0';

const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN}` } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
const SECTION_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN_LIGHT}` } };
const SECTION_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: `FF${GREEN}` }, size: 10, name: 'Calibri' };
const INPUT_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF1565C0' }, size: 10, name: 'Calibri' };
const FORMULA_FONT: Partial<ExcelJS.Font> = { size: 10, name: 'Calibri' };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 16, color: { argb: `FF${DARK}` }, name: 'Calibri' };
const SUBTITLE_FONT: Partial<ExcelJS.Font> = { size: 11, color: { argb: 'FF888888' }, name: 'Calibri' };
const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } };
const CURRENCY = '$#,##0';
const PCT = '0.0%';
const PCT2 = '0.00%';
const PCT4 = '0.0000%';
const NUM = '#,##0';
const NUM2 = '#,##0.00';
const MULT = '0.00"x"';

// Logo path — resolved at module load
const LOGO_PATH = path.resolve(__dirname, '../../../public/assets/images/HomiumLogo_0721_Wordmark (Blue).png');
const LOGO_EXISTS = fs.existsSync(LOGO_PATH);

function colLetter(c: number): string {
  let s = '';
  while (c > 0) { c--; s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26); }
  return s;
}

const COL_F = 6;  // First data column (year 1)
const COL_AJ = 36; // Last data column (year 31)
const MAX_YEARS = 31;

// ── Cell helpers ──

function setVal(ws: ExcelJS.Worksheet, row: number, col: number, value: any, fmt?: string) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  if (fmt) cell.numFmt = fmt;
  cell.font = { size: 10 };
}

function setFormula(ws: ExcelJS.Worksheet, row: number, col: number, formula: string, fmt?: string) {
  const cell = ws.getCell(row, col);
  cell.value = { formula };
  if (fmt) cell.numFmt = fmt;
  cell.font = FORMULA_FONT;
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

function applyHeaderRow(ws: ExcelJS.Worksheet, row: number, startCol: number, endCol: number) {
  for (let c = startCol; c <= endCol; c++) {
    const cell = ws.getCell(row, c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
}

/** Add logo image to a worksheet — spans rows 1-2, left-justified */
function addLogo(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  if (!LOGO_EXISTS) return;
  const imageId = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
  // Original image is 3001×571 (5.26:1 ratio). Fill rows 1-2 height (~38px)
  ws.addImage(imageId, {
    tl: { col: 0.15, row: 0.2 },
    ext: { width: 190, height: 36 },
  });
}

/** Apply section header formatting to a row across data columns */
function applySectionRow(ws: ExcelJS.Worksheet, row: number, label?: string) {
  for (let c = 2; c <= COL_AJ; c++) {
    const cell = ws.getCell(row, c);
    cell.fill = SECTION_FILL;
    if (c === 5 && label) {
      cell.value = label;
      cell.font = SECTION_FONT;
    } else if (cell.value && !label) {
      cell.font = SECTION_FONT;
    }
    cell.border = { bottom: THIN_BORDER };
  }
}

/** Apply year header bar (row 3-4) with green fill */
function applyYearHeaderBar(ws: ExcelJS.Worksheet) {
  // Row 3: year numbers — dark green header
  for (let c = COL_F; c <= COL_AJ; c++) {
    const cell = ws.getCell(3, c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center' };
  }
  // Row 4: calendar years — lighter green
  for (let c = COL_F; c <= COL_AJ; c++) {
    const cell = ws.getCell(4, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN_LIGHT}` } } as ExcelJS.FillPattern;
    cell.font = { bold: true, size: 10, color: { argb: `FF${GREEN}` }, name: 'Calibri' };
    cell.alignment = { horizontal: 'center' };
    cell.border = { bottom: THIN_BORDER };
  }
  // Labels in col E
  ws.getCell(3, 5).fill = HEADER_FILL;
  ws.getCell(3, 5).font = HEADER_FONT;
  ws.getCell(4, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN_LIGHT}` } } as ExcelJS.FillPattern;
  ws.getCell(4, 5).font = SECTION_FONT;
}

/** Apply alternating row shading for data rows */
function applyAlternateShading(ws: ExcelJS.Worksheet, rows: number[]) {
  const creamFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${CREAM}` } };
  for (let i = 0; i < rows.length; i++) {
    if (i % 2 === 1) {
      for (let c = 5; c <= COL_AJ; c++) {
        const cell = ws.getCell(rows[i], c);
        if (!cell.fill || (cell.fill as ExcelJS.FillPattern).pattern === 'none') {
          cell.fill = creamFill;
        }
      }
    }
  }
}

/** Group and hide a range of rows */
function groupAndHideRows(ws: ExcelJS.Worksheet, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    ws.getRow(r).outlineLevel = 1;
    ws.getRow(r).hidden = true;
  }
}

/** Computed cohort detail row ranges — set by buildCohortDetailsValues */
let lastCohortGroupRanges: number[][] = [];
let lastCohortSectionHeaders: number[] = [];
let lastCohortSummaryRows: number[] = [];

function applySheetFormatting(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook, isScenarioSheet: boolean) {
  // Column widths
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 30;
  for (let c = COL_F; c <= COL_AJ; c++) ws.getColumn(c).width = 14;

  // Freeze panes
  ws.views = [{ state: 'frozen', xSplit: 5, ySplit: 4 }];

  // Year header bar
  applyYearHeaderBar(ws);

  // Section header rows
  applySectionRow(ws, 6);  // Fund inflows start
  applySectionRow(ws, 44); // Reinvested / fees start
  applySectionRow(ws, 49); // NAV section
  applySectionRow(ws, 53); // Homeowner metrics
  applySectionRow(ws, 58); // Returns section

  // Alternating row shading on key data rows
  applyAlternateShading(ws, [6, 7, 8, 9, 10, 11, 44, 45, 46, 47, 49, 50, 51, 53, 54, 56, 58, 59, 60, 62, 63, 64]);

  // Bottom border on key separator rows
  for (const r of [11, 51, 60, 64]) {
    for (let c = 5; c <= COL_AJ; c++) {
      ws.getCell(r, c).border = { ...(ws.getCell(r, c).border || {}), bottom: THIN_BORDER };
    }
  }

  // Parameter column (B-C) light styling
  for (const r of [6, 7, 8, 10, 11, 45, 46, 47, 48, 49, 50, 54, 55, 56]) {
    ws.getCell(r, 2).border = { bottom: THIN_BORDER };
    ws.getCell(r, 3).border = { bottom: THIN_BORDER };
  }

  // Group and hide payoff waterfall rows 13-43
  groupAndHideRows(ws, 13, 43);

  // Group and hide cohort detail rows (scenario sheets only)
  if (isScenarioSheet && lastCohortGroupRanges.length > 0) {
    for (const [start, end] of lastCohortGroupRanges) {
      groupAndHideRows(ws, start, end);
    }
    // Cohort section headers get section styling
    for (const r of lastCohortSectionHeaders) {
      applySectionRow(ws, r);
    }
    // Summary rows get bold + bottom border
    for (const r of lastCohortSummaryRows) {
      for (let c = 5; c <= COL_AJ; c++) {
        const cell = ws.getCell(r, c);
        if (cell.font) cell.font = { ...cell.font, bold: true };
        cell.border = { top: THIN_BORDER, bottom: THIN_BORDER };
      }
    }
  }

  ws.properties.outlineLevelRow = 1;

  // Logo — top-right, past the last data column
  addLogo(wb, ws);
}

// ── Row labels shared between scenario and blended sheets ──

function writeRowLabels(ws: ExcelJS.Worksheet) {
  const labels: Array<[number, string]> = [
    [3, 'Month No'], [4, 'Fund Model'],
    [6, 'New Donations - Initial'], [7, 'New Donations - Annual'],
    [8, 'Program Fee'], [9, 'Accrued Fees Payable'],
    [10, 'Management Fee'], [11, '% Loan Funds Reinvested (Cum)'],
    [12, 'Loan Payoffs after yrs:'],
    [44, 'Reinvested Funds'], [45, 'Total Fees Paid to Homium'],
    [46, 'New Originations Net Fees'], [47, 'Average Loan Amount'],
    [49, 'Notes Outstanding'], [50, 'Cash on Hand'],
    [51, 'Total Fund Value'],
    [53, 'New Homeowners'], [54, 'Total Homeowners Cum'],
    [56, 'Exiting Homeowners'],
    [58, 'Returned Capital'], [59, '% Return on Investment'],
    [60, '% Total Return (Cum)'],
    [62, 'Cumulative Program Expenses'], [63, '% Total Invested'],
    [64, '% Trust Value'],
  ];
  for (const [r, text] of labels) {
    ws.getCell(r, 5).value = text;
    ws.getCell(r, 5).font = { size: 10 };
  }
}

// ── Scenarios sheet (same as values version) ──

function buildScenariosSheet(wb: ExcelJS.Workbook, fund: FundConfig, result: any, geoBreakdown?: GeoBreakdownResult[]) {
  const ws = wb.addWorksheet('Scenarios');
  const scenarios = result.scenarioResults;

  // Rows 1-2 reserved for logo

  // Title — row 3
  ws.getCell(3, 1).value = fund.name;
  ws.getCell(3, 1).font = TITLE_FONT;
  ws.getCell(3, 5).value = 'Total Raise';
  ws.getCell(3, 5).font = { bold: true, size: 11, color: { argb: 'FF555555' } };
  ws.getCell(3, 6).value = fund.raise.totalRaise;
  ws.getCell(3, 6).numFmt = CURRENCY;
  ws.getCell(3, 6).font = { bold: true, size: 14, color: { argb: `FF${GREEN}` } };

  // Shared fund parameters section
  const sharedParams: Array<[string, any, string?]> = [
    ['Annual Contributions (% Initial)', fund.raise.annualContributionPct, PCT2],
    ['Program Fee', fund.fees.programFeePct, PCT2],
    ['Management Fee', fund.fees.managementFeePct, PCT4],
    ['Reinvest Net Proceeds?', fund.raise.reinvestNetProceeds ? 'Yes' : 'No'],
    ['Home Price Appreciation', fund.assumptions.hpaPct, PCT2],
    ['Interest Rate', fund.assumptions.interestRate, PCT2],
  ];

  // Section header row
  ws.getCell(5, 1).value = 'Fund Parameters';
  ws.getCell(5, 1).font = SECTION_FONT;
  for (let c = 1; c <= 8; c++) {
    ws.getCell(5, c).fill = SECTION_FILL;
    ws.getCell(5, c).border = { bottom: THIN_BORDER };
  }

  for (let i = 0; i < sharedParams.length; i++) {
    const [label, value, fmt] = sharedParams[i];
    const r = 6 + i;
    setLabel(ws, r, 1, label);
    if (typeof value === 'string') {
      ws.getCell(r, 2).value = value;
      ws.getCell(r, 2).font = INPUT_FONT;
    } else {
      setInputVal(ws, r, 2, value, fmt);
    }
  }

  // Scenario comparison section
  const scenNames = ['LO', 'MID', 'HI'];
  const scenCols = [3, 5, 7]; // label in col-1, value in col

  ws.getCell(13, 1).value = 'Scenario Comparison';
  ws.getCell(13, 1).font = SECTION_FONT;
  for (let c = 1; c <= 8; c++) {
    ws.getCell(13, c).fill = SECTION_FILL;
    ws.getCell(13, c).border = { bottom: THIN_BORDER };
  }

  // Scenario headers
  for (let s = 0; s < 3; s++) {
    const sc = s < scenarios.length ? scenarios[s] : scenarios[0];
    const col = scenCols[s];
    ws.getCell(13, col).value = sc.scenario.name || scenNames[s];
    ws.getCell(13, col).font = { ...HEADER_FONT, size: 11 };
    ws.getCell(13, col).fill = HEADER_FILL;
    ws.getCell(13, col).alignment = { horizontal: 'center' };
  }

  const scenRows: Array<[string, (sc: any) => any, string?]> = [
    ['Weight', sc => sc.scenario.weight, PCT],
    ['Raise Allocation', sc => sc.scenario.raiseAllocation || fund.raise.totalRaise * sc.scenario.weight, CURRENCY],
    ['Median Participant Income', sc => sc.scenario.medianIncome, CURRENCY],
    ['Median Home Value', sc => sc.scenario.medianHomeValue, CURRENCY],
  ];

  for (let i = 0; i < scenRows.length; i++) {
    const [label, getter, fmt] = scenRows[i];
    const r = 14 + i;
    setLabel(ws, r, 1, label);
    for (let s = 0; s < 3; s++) {
      const sc = s < scenarios.length ? scenarios[s] : scenarios[0];
      const col = scenCols[s];
      setInputVal(ws, r, col, getter(sc), fmt);
      ws.getCell(r, col).alignment = { horizontal: 'center' };
    }
    // Alternate shading
    if (i % 2 === 1) {
      for (let c = 1; c <= 8; c++) {
        ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${CREAM}` } } as ExcelJS.FillPattern;
      }
    }
  }

  // Geography Allocation section (multi-geo only)
  if (geoBreakdown && geoBreakdown.length > 1) {
    const geoStartRow = 19;
    ws.getCell(geoStartRow, 1).value = 'Geography Allocation';
    ws.getCell(geoStartRow, 1).font = SECTION_FONT;
    for (let c = 1; c <= 8; c++) {
      ws.getCell(geoStartRow, c).fill = SECTION_FILL;
      ws.getCell(geoStartRow, c).border = { bottom: THIN_BORDER };
    }

    // Column headers
    const geoHeaders = ['Geography', 'State', 'Allocation %', 'Raise Amount', 'Median Income', 'Median Home Value'];
    for (let h = 0; h < geoHeaders.length; h++) {
      ws.getCell(geoStartRow + 1, h + 1).value = geoHeaders[h];
      ws.getCell(geoStartRow + 1, h + 1).font = HEADER_FONT;
      ws.getCell(geoStartRow + 1, h + 1).fill = HEADER_FILL;
      ws.getCell(geoStartRow + 1, h + 1).alignment = { horizontal: 'center' };
    }

    for (let g = 0; g < geoBreakdown.length; g++) {
      const geo = geoBreakdown[g].geo;
      const r = geoStartRow + 2 + g;
      setLabel(ws, r, 1, geo.geoLabel);
      setLabel(ws, r, 2, geo.state);
      setVal(ws, r, 3, geo.allocationPct, PCT);
      setVal(ws, r, 4, fund.raise.totalRaise * geo.allocationPct, CURRENCY);
      setVal(ws, r, 5, geo.medianIncome, CURRENCY);
      setVal(ws, r, 6, geo.medianHomeValue, CURRENCY);
      if (g % 2 === 1) {
        for (let c = 1; c <= 6; c++) {
          ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${CREAM}` } } as ExcelJS.FillPattern;
        }
      }
    }
  }

  // Column widths
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 16;
  for (const col of scenCols) { ws.getColumn(col).width = 16; }
  ws.getColumn(8).width = 18;

  addLogo(wb, ws);
  return ws;
}

// ══════════════════════════════════════════════════════════════════════════
// FORMULA-BASED SCENARIO SHEET (LO, MID, HI)
// ══════════════════════════════════════════════════════════════════════════

function buildFormulaModelSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  fund: FundConfig,
  scenResult: ScenarioResult,
) {
  const ws = wb.addWorksheet(sheetName);
  const baseYear = fund.raise.baseYear;

  // ── Title — rows 1-2 are logo, title in rows 3-4 ──
  ws.getCell(3, 1).value = fund.name;
  ws.getCell(3, 1).font = TITLE_FONT;
  ws.getCell(4, 1).value = `Pro Forma — ${sheetName}`;
  ws.getCell(4, 1).font = SUBTITLE_FONT;

  // ── Parameters in col B-C (editable inputs) ──
  setLabel(ws, 6, 2, 'Initial Raise');
  setInputVal(ws, 6, 3, scenResult.scenario.raiseAllocation, CURRENCY);

  setLabel(ws, 7, 2, 'Annual Contributions (% Initial)');
  setInputVal(ws, 7, 3, fund.raise.annualContributionPct, PCT2);

  setLabel(ws, 8, 2, 'Program Fee');
  setInputVal(ws, 8, 3, fund.fees.programFeePct, PCT2);

  setLabel(ws, 10, 2, 'Management Fee');
  setInputVal(ws, 10, 3, fund.fees.managementFeePct, PCT4);

  setLabel(ws, 11, 2, 'Reinvest Net Proceeds?');
  setInputVal(ws, 11, 3, fund.raise.reinvestNetProceeds ? 1 : 0);

  setLabel(ws, 45, 2, 'Home Price Appreciation');
  setInputVal(ws, 45, 3, fund.assumptions.hpaPct, PCT2);

  setLabel(ws, 46, 2, 'Interest Rate');
  setInputVal(ws, 46, 3, fund.assumptions.interestRate, PCT2);

  setLabel(ws, 47, 2, 'Median Participant Income');
  setInputVal(ws, 47, 3, scenResult.scenario.medianIncome, CURRENCY);

  setLabel(ws, 48, 2, 'Median Home Value');
  setInputVal(ws, 48, 3, scenResult.scenario.medianHomeValue, CURRENCY);

  setLabel(ws, 49, 2, 'Max Front Ratio');
  setInputVal(ws, 49, 3, fund.program.maxFrontRatio, PCT);

  setLabel(ws, 50, 2, '1st Mortgage Principal');
  setFormula(ws, 50, 3, 'C48*(1-C54-C55)', CURRENCY);
  ws.getCell(50, 3).font = INPUT_FONT;

  setLabel(ws, 54, 2, 'Down Payment');
  setInputVal(ws, 54, 3, fund.program.downPaymentPct, PCT);

  setLabel(ws, 55, 2, 'Homium SA%');
  setInputVal(ws, 55, 3, fund.program.homiumSAPct, PCT);

  setLabel(ws, 56, 2, 'Homium Principal');
  setFormula(ws, 56, 3, 'C48*C55', CURRENCY);
  ws.getCell(56, 3).font = INPUT_FONT;

  // ── Payoff Schedule table (rows 12-42, cols B-D) ──
  setLabel(ws, 12, 2, 'Payoff % after years:');
  for (let i = 0; i < 30; i++) {
    const r = 13 + i;
    const entry = fund.payoffSchedule[i] || { year: i + 1, annualPct: 0, cumulativePct: 0 };
    ws.getCell(r, 2).value = entry.year;    // B: year number (1-30)
    ws.getCell(r, 3).value = entry.annualPct;  // C: annual payoff %
    ws.getCell(r, 3).numFmt = PCT4;
    ws.getCell(r, 4).value = entry.cumulativePct;  // D: cumulative %
    ws.getCell(r, 4).numFmt = PCT2;
  }

  // ── Row labels (col E) ──
  writeRowLabels(ws);

  // ── E column: initial HOM principal per cohort year (rows 13-42) ──
  // E{r} = homium_principal * (1+HPA)^(cohortYear-1)
  for (let i = 0; i < 30; i++) {
    const r = 13 + i;
    setFormula(ws, r, 5, `$C$56*POWER(1+$C$45,$B${r}-1)`, CURRENCY);
  }

  // ── Year headers (row 3: year number, row 4: calendar year) ──
  setVal(ws, 3, COL_F, 1);
  setVal(ws, 4, COL_F, baseYear, '0');
  for (let c = COL_F + 1; c <= COL_AJ; c++) {
    const prev = colLetter(c - 1);
    setFormula(ws, 3, c, `${prev}3+1`);
    setFormula(ws, 4, c, `${prev}4+1`, '0');
  }

  // ══════════════════════════════════════════════════════════════════
  // FUND MODEL FORMULAS (cols F-AJ, rows 6-64)
  // ══════════════════════════════════════════════════════════════════

  for (let c = COL_F; c <= COL_AJ; c++) {
    const cl = colLetter(c);
    const prevCl = c > COL_F ? colLetter(c - 1) : '';

    // ── Row 6: New Donations - Initial (only year 1) ──
    if (c === COL_F) {
      setFormula(ws, 6, c, `IF(F4=${baseYear},$C$6,0)`, CURRENCY);
    } else {
      setVal(ws, 6, c, 0, CURRENCY);
    }

    // ── Row 7: New Donations - Annual (starts year 2) ──
    if (c === COL_F) {
      setVal(ws, 7, c, 0, CURRENCY);
    } else {
      setFormula(ws, 7, c, '$C$6*$C$7', CURRENCY);
    }

    // ── Row 8: Program Fee (applied once to new LP capital only) ──
    // Fee on new donations + contributions only; NOT on reinvested payoffs
    setFormula(ws, 8, c,
      `-SUM(${cl}6:${cl}7)*$C$8`,
      CURRENCY);

    // ── Row 9: Accrued Fees Payable (running unpaid balance) ──
    // Each year: prior unpaid balance + new annual fee obligation
    // Annual fee = mgmtRate * cumulative LP capital / (1 + progFee)
    // Prior balance = prevAccrued + prevPayment (payment is negative, reducing balance)
    if (c === COL_F) {
      setVal(ws, 9, c, 0, CURRENCY);
    } else {
      setFormula(ws, 9, c,
        `$C$10*SUM($F$6:${prevCl}7)/(1+$C$8)+${prevCl}9+${prevCl}10`,
        CURRENCY);
    }

    // ── Row 10: Management Fee Paid ──
    // Pay down accrued fees from payoff cash (before reinvestment)
    // Pays lesser of: available payoff cash OR total accrued balance
    setFormula(ws, 10, c,
      `-MIN(SUM(${cl}13:${cl}42),MAX(0,${cl}9))`,
      CURRENCY);

    // ── Row 11: % Loan Funds Reinvested (Cum) ──
    if (c === COL_F) {
      setVal(ws, 11, c, 0, PCT2);
    } else {
      setFormula(ws, 11, c,
        `IFERROR(${cl}44/SUM($F$6:${cl}8),0)+${prevCl}11`,
        PCT2);
    }

    // ── Rows 13-42: PAYOFF WATERFALL ──
    // Core formula: IF(year > cohortYear,
    //   INDEX(originations_row, 1, cohortYear) * VLOOKUP(age, payoff_table, 2, 0),
    //   0)
    // Col G+: multiply by prev_col_avg_loan / initial_hom_principal (appreciation)
    for (let i = 0; i < 30; i++) {
      const r = 13 + i;
      const basePart = `IF(${cl}$3>$B${r},INDEX($F$46:$AJ$46,1,$B${r})*VLOOKUP(${cl}$3-$B${r},$B$13:$C$42,2,0),0)`;
      if (c === COL_F) {
        setFormula(ws, r, c, basePart, CURRENCY);
      } else {
        // Appreciation multiplier: prev_year_avg_loan / cohort_initial_hom_principal
        setFormula(ws, r, c, `${basePart}*${prevCl}$47/$E${r}`, CURRENCY);
      }
    }

    // ── Row 44: Reinvested Funds ──
    // Payoffs AFTER management fee payment (cl10 is negative)
    setFormula(ws, 44, c, `$C$11*(SUM(${cl}13:${cl}42)+${cl}10)`, CURRENCY);

    // ── Row 45: Total Fees Paid to Homium ──
    // Program fee + management fee paid (both negative = outflows)
    setFormula(ws, 45, c, `${cl}8+${cl}10`, CURRENCY);

    // ── Row 46: New Originations Net Fees ──
    // Reinvested payoffs (after fees) + new capital after program fee
    setFormula(ws, 46, c,
      `MAX(0,${cl}44+${cl}8+SUM(${cl}6:${cl}7))`,
      CURRENCY);

    // ── Row 47: Average Loan Amount (grows with HPA) ──
    setFormula(ws, 47, c,
      `POWER(1+$C$45,${cl}$3-1)*$C$56`,
      CURRENCY);

    // ── Row 49: Notes Outstanding ──
    if (c === COL_F) {
      setFormula(ws, 49, c, 'F46', CURRENCY);
    } else {
      // prev_notes - payoffs, appreciated, + new originations
      setFormula(ws, 49, c,
        `(${prevCl}49-SUM(${cl}13:${cl}42))*(1+$C$45)+${cl}46`,
        CURRENCY);
    }

    // ── Row 50: Cash on Hand ──
    setFormula(ws, 50, c,
      `SUM(${cl}6,${cl}7,${cl}13:${cl}42,${cl}45,-${cl}46)`,
      CURRENCY);

    // ── Row 51: Total Fund Value (NAV = notes + cash) ──
    setFormula(ws, 51, c, `${cl}49+${cl}50`, CURRENCY);

    // ── Row 53: New Homeowners ──
    setFormula(ws, 53, c, `${cl}46/${cl}47`, NUM2);

    // ── Row 54: Total Homeowners Cum (expanding SUM) ──
    setFormula(ws, 54, c, `SUM($F$53:${cl}53)`, NUM2);

    // ── Row 56: Exiting Homeowners ──
    // SUM(payoffs) / avg_loan = number of homeowners whose loans paid off
    setFormula(ws, 56, c, `SUM(${cl}13:${cl}42)/${cl}47`, NUM2);

    // ── Row 58: Returned Capital ──
    if (c === COL_F) {
      // Year 1: payoffs minus reinvested (both 0 in year 1)
      setFormula(ws, 58, c, 'SUM(F13:F42)-F44', CURRENCY);
    } else {
      // Years 2+: returned capital = cash on hand (distributed to LPs)
      setFormula(ws, 58, c, `${cl}50`, CURRENCY);
    }

    // ── Row 59: % Return on Investment ──
    setFormula(ws, 59, c, `${cl}58/SUM($F$6:$AJ$7)`, PCT2);

    // ── Row 60: % Total Return (Cum) ──
    setFormula(ws, 60, c, `SUM($F58:${cl}58)/SUM($F$6:$AJ$7)`, PCT2);

    // ── Row 62: Cumulative Program Expenses ──
    if (c === COL_F) {
      setFormula(ws, 62, c, '-F8-F10', CURRENCY);
    } else {
      setFormula(ws, 62, c, `${prevCl}62-${cl}8-${cl}10`, CURRENCY);
    }

    // ── Row 63: % Total Invested ──
    setFormula(ws, 63, c, `${cl}62/SUM($F$6:$AJ$7)`, PCT2);

    // ── Row 64: % Trust Value ──
    setFormula(ws, 64, c, `${cl}62/${cl}51`, PCT2);
  }

  // ── Cohort detail sections (values from engine, not formulas) ──
  let impactStartRow = 294;
  if (scenResult.cohorts.length > 0) {
    impactStartRow = buildCohortDetailsValues(ws, scenResult, fund);
  }

  // ── Impact preview (values) ──
  buildImpactPreview(ws, scenResult.fundResults, impactStartRow);

  applySheetFormatting(ws, wb, true);
  return ws;
}

// ══════════════════════════════════════════════════════════════════════════
// FORMULA-BASED BLENDED SHEET
// ══════════════════════════════════════════════════════════════════════════

function buildFormulaBlendedSheet(
  wb: ExcelJS.Workbook,
  fund: FundConfig,
  blendedResults: FundYearState[],
  scenarioNames: string[],
  isMultiGeo = false,
) {
  const ws = wb.addWorksheet('Blended');
  const baseYear = fund.raise.baseYear;
  const sn = scenarioNames; // e.g. ['LO', 'MID', 'HI'] or geo sheet names

  // Cross-sheet sum helper: "'LO'!{cl}{r}+'MID'!{cl}{r}+'HI'!{cl}{r}"
  // Sheet names with spaces need single-quoting for valid Excel cross-sheet refs
  const qn = (s: string) => `'${s}'`;
  const xsum = (cl: string, r: number) =>
    sn.map(s => `${qn(s)}!${cl}${r}`).join('+');

  // ── Title — rows 1-2 are logo, title in rows 3-4 ──
  ws.getCell(3, 1).value = fund.name;
  ws.getCell(3, 1).font = TITLE_FONT;
  const subtitle = isMultiGeo
    ? `Pro Forma — Blended (${sn.length} Geographies)`
    : 'Pro Forma — Blended';
  ws.getCell(4, 1).value = subtitle;
  ws.getCell(4, 1).font = SUBTITLE_FONT;

  // ── Parameters in col C (weighted averages as values) ──
  setLabel(ws, 6, 2, 'Initial Raise');
  setInputVal(ws, 6, 3, fund.raise.totalRaise, CURRENCY);

  setLabel(ws, 7, 2, 'Annual Contributions (% Initial)');
  setInputVal(ws, 7, 3, fund.raise.annualContributionPct, PCT2);

  setLabel(ws, 8, 2, 'Program Fee');
  setInputVal(ws, 8, 3, fund.fees.programFeePct, PCT2);

  setLabel(ws, 10, 2, 'Management Fee');
  setInputVal(ws, 10, 3, fund.fees.managementFeePct, PCT4);

  setLabel(ws, 11, 2, 'Reinvest Net Proceeds?');
  setInputVal(ws, 11, 3, fund.raise.reinvestNetProceeds ? 1 : 0);

  setLabel(ws, 45, 2, 'Home Price Appreciation');
  setInputVal(ws, 45, 3, fund.assumptions.hpaPct, PCT2);

  setLabel(ws, 46, 2, 'Interest Rate');
  setInputVal(ws, 46, 3, fund.assumptions.interestRate, PCT2);

  // Weighted average MHV and income for blended
  const totalWeight = fund.scenarios.reduce((s, sc) => s + sc.weight, 0) || 1;
  const wavgIncome = fund.scenarios.reduce((s, sc) => s + sc.medianIncome * sc.weight, 0) / totalWeight;
  const wavgMHV = fund.scenarios.reduce((s, sc) => s + sc.medianHomeValue * sc.weight, 0) / totalWeight;

  setLabel(ws, 47, 2, 'Median Participant Income (W/A)');
  setInputVal(ws, 47, 3, wavgIncome, CURRENCY);

  setLabel(ws, 48, 2, 'Median Home Value (W/A)');
  setInputVal(ws, 48, 3, wavgMHV, CURRENCY);

  setLabel(ws, 54, 2, 'Down Payment');
  setInputVal(ws, 54, 3, fund.program.downPaymentPct, PCT);

  setLabel(ws, 55, 2, 'Homium SA%');
  setInputVal(ws, 55, 3, fund.program.homiumSAPct, PCT);

  setLabel(ws, 56, 2, 'Homium Principal (W/A)');
  setFormula(ws, 56, 3, 'C48*C55', CURRENCY);
  ws.getCell(56, 3).font = INPUT_FONT;

  // ── Payoff Schedule (values) ──
  setLabel(ws, 12, 2, 'Payoff % after years:');
  for (let i = 0; i < 30; i++) {
    const r = 13 + i;
    const entry = fund.payoffSchedule[i] || { year: i + 1, annualPct: 0, cumulativePct: 0 };
    ws.getCell(r, 2).value = entry.year;
    ws.getCell(r, 3).value = entry.annualPct;
    ws.getCell(r, 3).numFmt = PCT4;
    ws.getCell(r, 4).value = entry.cumulativePct;
    ws.getCell(r, 4).numFmt = PCT2;
  }

  // ── Row labels ──
  writeRowLabels(ws);

  // ── Year headers ──
  setVal(ws, 3, COL_F, 1);
  setVal(ws, 4, COL_F, baseYear, '0');
  for (let c = COL_F + 1; c <= COL_AJ; c++) {
    const prev = colLetter(c - 1);
    setFormula(ws, 3, c, `${prev}3+1`);
    setFormula(ws, 4, c, `${prev}4+1`, '0');
  }

  // ══════════════════════════════════════════════════════════════════
  // BLENDED FORMULAS: mix of cross-sheet sums and own calculations
  // ══════════════════════════════════════════════════════════════════

  for (let c = COL_F; c <= COL_AJ; c++) {
    const cl = colLetter(c);
    const prevCl = c > COL_F ? colLetter(c - 1) : '';

    // ── Rows using cross-sheet sums (additive quantities) ──

    // Row 6: New Donations
    setFormula(ws, 6, c, xsum(cl, 6), CURRENCY);
    // Row 7: Annual Contributions
    setFormula(ws, 7, c, xsum(cl, 7), CURRENCY);
    // Row 8: Program Fee
    setFormula(ws, 8, c, xsum(cl, 8), CURRENCY);
    // Row 10: Management Fee
    setFormula(ws, 10, c, xsum(cl, 10), CURRENCY);

    // Row 9: Accrued Fees (own formula from blended data)
    if (c === COL_F) {
      setVal(ws, 9, c, 0, CURRENCY);
    } else {
      setFormula(ws, 9, c, xsum(cl, 9), CURRENCY);
    }

    // Row 11: % Reinvested (own formula)
    if (c === COL_F) {
      setVal(ws, 11, c, 0, PCT2);
    } else {
      setFormula(ws, 11, c,
        `IFERROR(${cl}44/SUM($F$6:${cl}8),0)+${prevCl}11`,
        PCT2);
    }

    // Rows 13-42: Payoff waterfall (cross-sheet sums)
    for (let i = 0; i < 30; i++) {
      const r = 13 + i;
      setFormula(ws, r, c, xsum(cl, r), CURRENCY);
    }

    // Row 44: Reinvested (cross-sheet sum)
    setFormula(ws, 44, c, xsum(cl, 44), CURRENCY);
    // Row 45: Total Fees (cross-sheet sum)
    setFormula(ws, 45, c, xsum(cl, 45), CURRENCY);
    // Row 46: Originations (cross-sheet sum)
    setFormula(ws, 46, c, xsum(cl, 46), CURRENCY);

    // Row 47: Avg Loan Amount (own formula from blended params)
    setFormula(ws, 47, c, `POWER(1+$C$45,${cl}$3-1)*$C$56`, CURRENCY);

    // Row 49: Notes Outstanding (own formula from blended data)
    if (c === COL_F) {
      setFormula(ws, 49, c, 'F46', CURRENCY);
    } else {
      setFormula(ws, 49, c,
        `(${prevCl}49-SUM(${cl}13:${cl}42))*(1+$C$45)+${cl}46`,
        CURRENCY);
    }

    // Row 50: Cash (own formula)
    setFormula(ws, 50, c,
      `SUM(${cl}6,${cl}7,${cl}13:${cl}42,${cl}45,-${cl}46)`,
      CURRENCY);

    // Row 51: Total Fund Value
    setFormula(ws, 51, c, `${cl}49+${cl}50`, CURRENCY);

    // Row 53: New Homeowners (cross-sheet sum)
    setFormula(ws, 53, c, xsum(cl, 53), CURRENCY);
    // Row 54: Total Homeowners Cum (cross-sheet sum)
    setFormula(ws, 54, c, xsum(cl, 54), NUM2);
    // Row 56: Exiting Homeowners (cross-sheet sum)
    setFormula(ws, 56, c, xsum(cl, 56), NUM2);

    // Row 58: Returned Capital (cross-sheet sum)
    setFormula(ws, 58, c, xsum(cl, 58), CURRENCY);

    // Row 59: % ROI
    setFormula(ws, 59, c, `${cl}58/SUM($F$6:$AJ$7)`, PCT2);

    // Row 60: % Total Return Cum
    setFormula(ws, 60, c, `SUM($F58:${cl}58)/SUM($F$6:$AJ$7)`, PCT2);

    // Row 62: Cumulative Expenses
    if (c === COL_F) {
      setFormula(ws, 62, c, '-F8-F10', CURRENCY);
    } else {
      setFormula(ws, 62, c, `${prevCl}62-${cl}8-${cl}10`, CURRENCY);
    }

    // Row 63: % Total Invested
    setFormula(ws, 63, c, `${cl}62/SUM($F$6:$AJ$7)`, PCT2);

    // Row 64: % Trust Value
    setFormula(ws, 64, c, `${cl}62/${cl}51`, PCT2);
  }

  // ── Impact preview (values from engine) ──
  buildImpactPreview(ws, blendedResults, 66);

  applySheetFormatting(ws, wb, false);
  return ws;
}

// ══════════════════════════════════════════════════════════════════════════
// COHORT DETAILS (values from engine — formulas deferred to v2)
// ══════════════════════════════════════════════════════════════════════════

function buildCohortDetailsValues(
  ws: ExcelJS.Worksheet,
  scenResult: ScenarioResult,
  fund: FundConfig,
): number {
  const cohorts = scenResult.cohorts;
  const states = scenResult.cohortStates;
  const numCohorts = Math.min(cohorts.length, 31);
  const maxYears = Math.min(scenResult.fundResults.length, MAX_YEARS);

  // Dynamic layout: each section = 1 header + numCohorts data + 1 summary = numCohorts + 2
  const sectionSize = numCohorts + 2;
  const REMAINING_HDR = 66;
  const REMAINING_START = 67;
  const REMAINING_SUM = REMAINING_START + numCohorts;

  const PRINCIPAL_HDR = REMAINING_SUM + 1;
  const PRINCIPAL_START = PRINCIPAL_HDR + 1;
  const PRINCIPAL_SUM = PRINCIPAL_START + numCohorts;

  const HOME_VALUE_HDR = PRINCIPAL_SUM + 1;
  const HOME_VALUE_START = HOME_VALUE_HDR + 1;
  const HOME_VALUE_SUM = HOME_VALUE_START + numCohorts;

  const HOM_QV_HDR = HOME_VALUE_SUM + 1;
  const HOM_QV_START = HOM_QV_HDR + 1;
  const HOM_QV_SUM = HOM_QV_START + numCohorts;

  const EQUITY_HDR = HOM_QV_SUM + 1;
  const EQUITY_START = EQUITY_HDR + 1;
  const EQUITY_SUM = EQUITY_START + numCohorts;

  const LTV_HDR = EQUITY_SUM + 1;
  const LTV_START = LTV_HDR + 1;
  const LTV_SUM = LTV_START + numCohorts;

  const CLTV_HDR = LTV_SUM + 1;
  const CLTV_START = CLTV_HDR + 1;
  const CLTV_SUM = CLTV_START + numCohorts;

  // Store ranges for formatting/grouping
  lastCohortGroupRanges = [
    [REMAINING_START, REMAINING_START + numCohorts - 1],
    [PRINCIPAL_START, PRINCIPAL_START + numCohorts - 1],
    [HOME_VALUE_START, HOME_VALUE_START + numCohorts - 1],
    [HOM_QV_START, HOM_QV_START + numCohorts - 1],
    [EQUITY_START, EQUITY_START + numCohorts - 1],
    [LTV_START, LTV_START + numCohorts - 1],
    [CLTV_START, CLTV_START + numCohorts - 1],
  ];
  lastCohortSectionHeaders = [
    REMAINING_HDR, PRINCIPAL_HDR, HOME_VALUE_HDR,
    HOM_QV_HDR, EQUITY_HDR, LTV_HDR, CLTV_HDR,
  ];
  lastCohortSummaryRows = [
    REMAINING_SUM, PRINCIPAL_SUM, HOME_VALUE_SUM,
    HOM_QV_SUM, EQUITY_SUM, LTV_SUM, CLTV_SUM,
  ];

  // Section headers
  setBoldLabel(ws, REMAINING_HDR, 5, 'Remaining in Cohort');
  setBoldLabel(ws, PRINCIPAL_HDR, 5, '1st Principal Remaining for Cohort');
  setBoldLabel(ws, HOME_VALUE_HDR, 5, 'Home Value for Cohort');
  setBoldLabel(ws, HOM_QV_HDR, 5, 'HOM Qualified Value');
  setBoldLabel(ws, EQUITY_HDR, 5, 'Homeowner Equity');
  setBoldLabel(ws, LTV_HDR, 5, 'LTV %');
  setBoldLabel(ws, CLTV_HDR, 5, 'CLTV %');

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

    ws.getCell(rRem, 2).value = cohort.cohortYear;
    ws.getCell(rPrin, 2).value = cohort.cohortYear;
    ws.getCell(rHV, 2).value = cohort.cohortYear;
    ws.getCell(rHom, 2).value = cohort.cohortYear;
    ws.getCell(rEq, 2).value = cohort.cohortYear;
    ws.getCell(rLTV, 2).value = cohort.cohortYear;
    ws.getCell(rCLTV, 2).value = cohort.cohortYear;

    ws.getCell(rPrin, 3).value = cohort.mortgagePrincipal0;
    ws.getCell(rPrin, 3).numFmt = CURRENCY;
    ws.getCell(rHV, 3).value = cohort.homeValue0;
    ws.getCell(rHV, 3).numFmt = CURRENCY;
    ws.getCell(rRem, 5).value = cohort.homeownerCount;
    ws.getCell(rRem, 5).numFmt = NUM2;

    let remaining = cohort.homeownerCount;

    for (let yr = 0; yr < maxYears; yr++) {
      const modelYear = yr + 1;
      const c = COL_F + yr;
      const cs = cohortStates.find(s => s.modelYear === modelYear);

      if (modelYear < cohort.cohortYear || !cs) {
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
  const sectionStarts = [REMAINING_START, PRINCIPAL_START, HOME_VALUE_START, HOM_QV_START, EQUITY_START, LTV_START, CLTV_START];
  const summaryDefs: Array<[number, string, number, string]> = [
    [REMAINING_SUM, 'Active Homeowners all Cohorts', 0, NUM2],
    [PRINCIPAL_SUM, 'W/A Outstanding Principal', 1, CURRENCY],
    [HOME_VALUE_SUM, 'W/A Home Value', 2, CURRENCY],
    [HOM_QV_SUM, 'W/A HOM Position', 3, CURRENCY],
    [EQUITY_SUM, 'W/A Homeowner Equity', 4, CURRENCY],
    [LTV_SUM, 'W/A LTV %', 5, PCT2],
    [CLTV_SUM, 'W/A CLTV %', 6, PCT2],
  ];

  for (const [sumRow, label, sectionIdx, fmt] of summaryDefs) {
    const dataStart = sectionStarts[sectionIdx as number];
    const dataEnd = dataStart + numCohorts - 1;
    ws.getCell(sumRow, 5).value = label;
    ws.getCell(sumRow, 5).font = { size: 10, bold: true };

    for (let yr = 0; yr < maxYears; yr++) {
      const c = COL_F + yr;
      if (sectionIdx === 0) {
        // Simple sum for remaining homeowners
        let total = 0;
        for (let r = dataStart; r <= dataEnd; r++) {
          total += (ws.getCell(r, c).value as number) || 0;
        }
        setVal(ws, sumRow, c, total, fmt);
      } else {
        // Weighted average using remaining homeowners as weights
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < numCohorts; i++) {
          const weight = (ws.getCell(REMAINING_START + i, c).value as number) || 0;
          const value = (ws.getCell(dataStart + i, c).value as number) || 0;
          weightedSum += weight * value;
          totalWeight += weight;
        }
        setVal(ws, sumRow, c, totalWeight > 0 ? weightedSum / totalWeight : 0, fmt);
      }
    }
  }

  // Return the row after the last section for impact preview placement
  return CLTV_SUM + 2;
}

// ── Impact Preview (values) ──

function buildImpactPreview(ws: ExcelJS.Worksheet, fundResults: FundYearState[], startRow = 294) {
  const maxYears = Math.min(fundResults.length, MAX_YEARS);
  const r0 = startRow;

  setBoldLabel(ws, r0, 2, 'Impact Preview');
  ws.getCell(r0, 5).value = 'Homeowners Created (Cum)';
  ws.getCell(r0, 5).font = { size: 10, bold: true };

  for (let yr = 0; yr < maxYears; yr++) {
    setVal(ws, r0, COL_F + yr, fundResults[yr].totalHomeownersCum, NUM2);
  }

  ws.getCell(r0 + 2, 5).value = 'Estimated Homeowner Equity';
  for (let yr = 0; yr < maxYears; yr++) {
    setVal(ws, r0 + 2, COL_F + yr, fundResults[yr].totalEquityCreated, CURRENCY);
  }

  const yr10 = fundResults[9];
  const yr30 = fundResults[maxYears - 1];
  const totalInvested = fundResults.reduce((s, yr) => s + yr.newDonations + yr.newContributions, 0);

  if (yr10) {
    setLabel(ws, r0 + 1, 2, 'Total Homeowners Created (10 Years)');
    setVal(ws, r0 + 1, 3, yr10.totalHomeownersCum, NUM2);
    setLabel(ws, r0 + 2, 2, 'Total Homeowner Equity Created (10 Years)');
    setVal(ws, r0 + 2, 3, yr10.totalEquityCreated, CURRENCY);
    if (totalInvested > 0) {
      setLabel(ws, r0 + 3, 2, '$1 Private Cap = $X Homeowner Wealth');
      setVal(ws, r0 + 3, 3, yr10.totalEquityCreated / totalInvested, MULT);
    }
  }

  if (yr30) {
    setLabel(ws, r0 + 5, 2, 'Total Homeowners Created (30 Years)');
    setVal(ws, r0 + 5, 3, yr30.totalHomeownersCum, NUM2);
    setLabel(ws, r0 + 6, 2, 'Total Homeowner Equity Created (30 Years)');
    setVal(ws, r0 + 6, 3, yr30.totalEquityCreated, CURRENCY);
    if (totalInvested > 0) {
      setLabel(ws, r0 + 7, 2, '$1 Private Cap = $X Homeowner Wealth');
      setVal(ws, r0 + 7, 3, yr30.totalEquityCreated / totalInvested, MULT);
    }
  }
}

// ── Charts sheet ──

function buildChartsSheet(wb: ExcelJS.Workbook, blended: FundYearState[]) {
  const ws = wb.addWorksheet('Charts');
  ws.getCell(1, 3).value = 'Chart Data';
  ws.getCell(1, 3).font = TITLE_FONT;

  // Data table starts at row 40 (below charts)
  const DATA_ROW = 40;
  const headers = ['Year', 'Equity Created', 'Active Homeowners', 'Fund NAV', 'Cumulative ROI', 'Returned Capital'];
  headers.forEach((h, i) => ws.getCell(DATA_ROW, i + 1).value = h);
  applyHeaderRow(ws, DATA_ROW, 1, headers.length);

  const maxYears = Math.min(blended.length, MAX_YEARS);
  for (let yr = 0; yr < maxYears; yr++) {
    const r = DATA_ROW + 1 + yr;
    const f = blended[yr];
    ws.getCell(r, 1).value = f.calendarYear;
    ws.getCell(r, 1).numFmt = '0'; // plain number, no comma
    setVal(ws, r, 2, f.totalEquityCreated, CURRENCY);
    setVal(ws, r, 3, f.activeHomeowners, NUM);
    setVal(ws, r, 4, f.fundNAV, CURRENCY);
    setVal(ws, r, 5, f.roiCumulative, PCT2);
    setVal(ws, r, 6, f.returnedCapital, CURRENCY);
  }

  headers.forEach((_, i) => ws.getColumn(i + 1).width = 18);
  const lastDataRow = DATA_ROW + maxYears;

  // ── Chart 1: Equity Created (area) ──
  const equityChart = wb.addWorksheet('_eq') as any; // temp workaround
  // ExcelJS doesn't support charts natively — use chart API if available
  // Fall back to embedding chart objects directly
  try {
    // Chart 1: Homeowner Equity Created (col B)
    (ws as any).addChart?.('line', {
      title: 'Homeowner Equity Created',
      series: [{ name: 'Equity Created', ref: `Charts!B${DATA_ROW + 1}:B${lastDataRow}` }],
      categories: `Charts!A${DATA_ROW + 1}:A${lastDataRow}`,
    });
  } catch (_) {
    // ExcelJS chart support varies — charts may not render
  }

  // Since ExcelJS has limited chart support, create chart-friendly data layout
  // and add instructions for the user
  ws.getCell(3, 1).value = 'Select data below to create charts in Excel:';
  ws.getCell(3, 1).font = { italic: true, size: 10, color: { argb: 'FF888888' } };

  // Mini summary for quick visual reference
  ws.getCell(5, 1).value = 'Year 10 Summary';
  ws.getCell(5, 1).font = SECTION_FONT;
  ws.getCell(5, 1).fill = SECTION_FILL;
  for (let c = 2; c <= 4; c++) { ws.getCell(5, c).fill = SECTION_FILL; }

  const yr10 = blended[9];
  const yr30 = blended[maxYears - 1];
  if (yr10) {
    setLabel(ws, 6, 1, 'Active Homeowners');
    setVal(ws, 6, 2, yr10.activeHomeowners, NUM);
    setLabel(ws, 7, 1, 'Equity Created');
    setVal(ws, 7, 2, yr10.totalEquityCreated, CURRENCY);
    setLabel(ws, 8, 1, 'Fund NAV');
    setVal(ws, 8, 2, yr10.fundNAV, CURRENCY);
    setLabel(ws, 9, 1, 'Cumulative ROI');
    setVal(ws, 9, 2, yr10.roiCumulative, PCT2);
  }

  ws.getCell(11, 1).value = 'Year 30 Summary';
  ws.getCell(11, 1).font = SECTION_FONT;
  ws.getCell(11, 1).fill = SECTION_FILL;
  for (let c = 2; c <= 4; c++) { ws.getCell(11, c).fill = SECTION_FILL; }

  if (yr30) {
    setLabel(ws, 12, 1, 'Active Homeowners');
    setVal(ws, 12, 2, yr30.activeHomeowners, NUM);
    setLabel(ws, 13, 1, 'Equity Created');
    setVal(ws, 13, 2, yr30.totalEquityCreated, CURRENCY);
    setLabel(ws, 14, 1, 'Fund NAV');
    setVal(ws, 14, 2, yr30.fundNAV, CURRENCY);
    setLabel(ws, 15, 1, 'Cumulative ROI');
    setVal(ws, 15, 2, yr30.roiCumulative, PCT2);
  }

  // Sparkline-style: mini inline bar using cell values for quick scan
  ws.getCell(17, 1).value = 'Homeowners by Year';
  ws.getCell(17, 1).font = SECTION_FONT;
  ws.getCell(17, 1).fill = SECTION_FILL;
  for (let c = 2; c <= Math.min(maxYears + 1, 32); c++) { ws.getCell(17, c).fill = SECTION_FILL; }

  for (let yr = 0; yr < maxYears; yr++) {
    ws.getCell(18, yr + 2).value = blended[yr].calendarYear;
    ws.getCell(18, yr + 2).numFmt = '0';
    ws.getCell(18, yr + 2).font = { size: 8, color: { argb: 'FF999999' } };
    ws.getCell(18, yr + 2).alignment = { horizontal: 'center' };
    ws.getCell(19, yr + 2).value = blended[yr].activeHomeowners;
    ws.getCell(19, yr + 2).numFmt = NUM;
    ws.getCell(19, yr + 2).font = { size: 9 };
    ws.getCell(19, yr + 2).alignment = { horizontal: 'center' };
  }
  setLabel(ws, 18, 1, 'Year');
  setLabel(ws, 19, 1, 'Active HO');

  ws.getCell(21, 1).value = 'Fund NAV by Year';
  ws.getCell(21, 1).font = SECTION_FONT;
  ws.getCell(21, 1).fill = SECTION_FILL;
  for (let c = 2; c <= Math.min(maxYears + 1, 32); c++) { ws.getCell(21, c).fill = SECTION_FILL; }

  for (let yr = 0; yr < maxYears; yr++) {
    ws.getCell(22, yr + 2).value = blended[yr].calendarYear;
    ws.getCell(22, yr + 2).numFmt = '0';
    ws.getCell(22, yr + 2).font = { size: 8, color: { argb: 'FF999999' } };
    ws.getCell(22, yr + 2).alignment = { horizontal: 'center' };
    ws.getCell(23, yr + 2).value = blended[yr].fundNAV;
    ws.getCell(23, yr + 2).numFmt = '$#,##0';
    ws.getCell(23, yr + 2).font = { size: 9 };
    ws.getCell(23, yr + 2).alignment = { horizontal: 'center' };
  }
  setLabel(ws, 22, 1, 'Year');
  setLabel(ws, 23, 1, 'NAV');

  addLogo(wb, ws);

  // Clean up temp worksheet if created
  const tempWs = wb.getWorksheet('_eq');
  if (tempWs) wb.removeWorksheet(tempWs.id);

  return ws;
}

// ── Share Conversion sheet ──

function buildShareConversionSheet(wb: ExcelJS.Workbook, fund: FundConfig) {
  const ws = wb.addWorksheet('Share Conversion');
  ws.getCell(1, 3).value = 'Share Conversion';
  ws.getCell(1, 3).font = TITLE_FONT;

  const netToDeploy = fund.raise.totalRaise * (1 - fund.fees.programFeePct);

  setLabel(ws, 3, 1, 'Fund Size');
  setVal(ws, 3, 2, fund.raise.totalRaise, CURRENCY);
  setLabel(ws, 4, 1, 'Program Fee');
  setVal(ws, 4, 2, fund.fees.programFeePct, PCT);
  setLabel(ws, 5, 1, 'Net to Deploy');
  setVal(ws, 5, 2, netToDeploy, CURRENCY);

  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 16;
  addLogo(wb, ws);
  return ws;
}

// ══════════════════════════════════════════════════════════════════════════
// MULTI-GEO: PER-GEO FORMULA SHEET (reuses buildFormulaModelSheet)
// ══════════════════════════════════════════════════════════════════════════

function buildGeoFormulaSheet(
  wb: ExcelJS.Workbook,
  fund: FundConfig,
  gb: GeoBreakdownResult,
  usedNames: string[],
): string {
  // Generate safe tab name (31 char limit, deduplicate)
  let tabName = gb.geo.geoLabel.substring(0, 31);
  if (usedNames.includes(tabName)) {
    tabName = `${gb.geo.geoLabel.substring(0, 27)}_${usedNames.length + 1}`;
  }

  // Build synthetic ScenarioResult from geo data
  // Use MID scenario's cohort data (index 1), fallback to first available
  const midScen = gb.scenarioResults[1] || gb.scenarioResults[0];
  const syntheticResult: ScenarioResult = {
    scenario: {
      name: gb.geo.geoLabel,
      weight: gb.geo.allocationPct,
      raiseAllocation: fund.raise.totalRaise * gb.geo.allocationPct,
      medianIncome: gb.geo.medianIncome,
      medianHomeValue: gb.geo.medianHomeValue,
    },
    cohorts: midScen?.cohorts || [],
    cohortStates: midScen?.cohortStates || [],
    fundResults: gb.blended,
    affordability: midScen?.affordability || {
      mortgagePrincipal: 0, maxPITI: 0, pitiBeforeHomium: 0, pitiAfterHomium: 0,
      gapBefore: 0, gapAfter: 0, homiumPrincipal: 0, downPayment: 0, reducedMortgage: 0,
    },
  };

  buildFormulaModelSheet(wb, tabName, fund, syntheticResult);
  return tabName;
}

// ══════════════════════════════════════════════════════════════════════════
// MULTI-GEO: GEO SUMMARY SHEET
// ══════════════════════════════════════════════════════════════════════════

function buildGeoSummarySheet(
  wb: ExcelJS.Workbook,
  fund: FundConfig,
  geoBreakdown: GeoBreakdownResult[],
  geoSheetNames: string[],
) {
  const ws = wb.addWorksheet('Geo Summary');
  const geoCount = geoBreakdown.length;
  const baseYear = fund.raise.baseYear;
  const qn = (s: string) => `'${s}'`;

  // Title — rows 1-2 reserved for logo, title in rows 3-4
  ws.getCell(3, 1).value = fund.name;
  ws.getCell(3, 1).font = TITLE_FONT;
  ws.getCell(4, 1).value = 'Geography Comparison';
  ws.getCell(4, 1).font = SUBTITLE_FONT;

  // Column layout: A = metric labels, B+ = geos, last = Total
  const dataStartCol = 2;
  const totalCol = dataStartCol + geoCount;

  // Geo column headers
  for (let g = 0; g < geoCount; g++) {
    const col = dataStartCol + g;
    ws.getCell(6, col).value = geoBreakdown[g].geo.geoLabel;
    ws.getCell(6, col).font = HEADER_FONT;
    ws.getCell(6, col).fill = HEADER_FILL;
    ws.getCell(6, col).alignment = { horizontal: 'center' };
  }
  ws.getCell(6, totalCol).value = 'Total';
  ws.getCell(6, totalCol).font = HEADER_FONT;
  ws.getCell(6, totalCol).fill = HEADER_FILL;
  ws.getCell(6, totalCol).alignment = { horizontal: 'center' };

  let row = 7;

  // ── Allocation section ──
  ws.getCell(row, 1).value = 'Allocation';
  ws.getCell(row, 1).font = SECTION_FONT;
  for (let c = 1; c <= totalCol; c++) { ws.getCell(row, c).fill = SECTION_FILL; ws.getCell(row, c).border = { bottom: THIN_BORDER }; }
  row++;

  // Allocation metrics: cross-sheet refs to geo sheet inputs (C6 = raise, C47 = income, C48 = MHV)
  const allocMetrics: Array<[string, string | null, string, boolean]> = [
    ['State', null, '', false],      // value, not formula
    ['Allocation %', null, PCT, false], // value, not formula
    ['Raise Amount', 'C6', CURRENCY, true],
    ['Median Income', 'C47', CURRENCY, false],
    ['Median Home Value', 'C48', CURRENCY, false],
  ];

  for (const [label, cellRef, fmt, summable] of allocMetrics) {
    setLabel(ws, row, 1, label);
    for (let g = 0; g < geoCount; g++) {
      const col = dataStartCol + g;
      if (!cellRef) {
        // Static values
        const val = label === 'State' ? geoBreakdown[g].geo.state : geoBreakdown[g].geo.allocationPct;
        if (typeof val === 'string') {
          ws.getCell(row, col).value = val;
        } else {
          setVal(ws, row, col, val, fmt);
        }
      } else {
        setFormula(ws, row, col, `${qn(geoSheetNames[g])}!${cellRef}`, fmt);
      }
      ws.getCell(row, col).alignment = { horizontal: 'center' };
    }
    if (summable) {
      const sumRange = `${colLetter(dataStartCol)}${row}:${colLetter(dataStartCol + geoCount - 1)}${row}`;
      setFormula(ws, row, totalCol, `SUM(${sumRange})`, fmt);
    }
    row++;
  }

  row++; // spacer

  // ── Year 10 Snapshot — cross-sheet refs to geo formula sheet cells ──
  // On geo formula sheets: row 54 = Total Homeowners Cum, row 51 = Fund NAV,
  // row 49 = Notes Outstanding, row 60 = ROI Cum, col for yr10 = O (col 15 = COL_F+9)
  const yr10Col = colLetter(COL_F + 9); // year 10 column letter

  ws.getCell(row, 1).value = 'Year 10 Snapshot';
  ws.getCell(row, 1).font = SECTION_FONT;
  for (let c = 1; c <= totalCol; c++) { ws.getCell(row, c).fill = SECTION_FILL; ws.getCell(row, c).border = { bottom: THIN_BORDER }; }
  row++;

  const yr10CrossRefs: Array<[string, number, string, boolean]> = [
    ['Active Homeowners', 54, NUM, true],      // row 54 = Total Homeowners Cum
    ['Fund NAV', 51, CURRENCY, true],           // row 51 = Total Fund Value
    ['Notes Outstanding', 49, CURRENCY, true],  // row 49 = Notes Outstanding
    ['Cumulative ROI', 60, PCT2, false],         // row 60 = % Total Return (Cum)
  ];

  for (const [label, srcRow, fmt, summable] of yr10CrossRefs) {
    setLabel(ws, row, 1, label);
    for (let g = 0; g < geoCount; g++) {
      setFormula(ws, row, dataStartCol + g, `${qn(geoSheetNames[g])}!${yr10Col}${srcRow}`, fmt);
      ws.getCell(row, dataStartCol + g).alignment = { horizontal: 'center' };
    }
    if (summable) {
      const sumRange = `${colLetter(dataStartCol)}${row}:${colLetter(dataStartCol + geoCount - 1)}${row}`;
      setFormula(ws, row, totalCol, `SUM(${sumRange})`, fmt);
    }
    row++;
  }

  row++; // spacer

  // ── Year 30 Snapshot ──
  const maxYears = Math.min(geoBreakdown[0].blended.length, MAX_YEARS);
  const yr30Col = colLetter(COL_F + maxYears - 1);

  ws.getCell(row, 1).value = `Year ${maxYears} Snapshot`;
  ws.getCell(row, 1).font = SECTION_FONT;
  for (let c = 1; c <= totalCol; c++) { ws.getCell(row, c).fill = SECTION_FILL; ws.getCell(row, c).border = { bottom: THIN_BORDER }; }
  row++;

  const yr30CrossRefs: Array<[string, number, string, boolean]> = [
    ['Active Homeowners', 54, NUM, true],
    ['Fund NAV', 51, CURRENCY, true],
    ['Cumulative ROI', 60, PCT2, false],
    ['Returned Capital (Cum)', 58, CURRENCY, true], // row 58 = Returned Capital
  ];

  for (const [label, srcRow, fmt, summable] of yr30CrossRefs) {
    setLabel(ws, row, 1, label);
    for (let g = 0; g < geoCount; g++) {
      setFormula(ws, row, dataStartCol + g, `${qn(geoSheetNames[g])}!${yr30Col}${srcRow}`, fmt);
      ws.getCell(row, dataStartCol + g).alignment = { horizontal: 'center' };
    }
    if (summable) {
      const sumRange = `${colLetter(dataStartCol)}${row}:${colLetter(dataStartCol + geoCount - 1)}${row}`;
      setFormula(ws, row, totalCol, `SUM(${sumRange})`, fmt);
    }
    row++;
  }

  row++; // spacer

  // ── Annual Homeowners (collapsible) — cross-sheet refs to row 53 per year ──
  ws.getCell(row, 1).value = 'New Homeowners by Year';
  ws.getCell(row, 1).font = SECTION_FONT;
  for (let c = 1; c <= totalCol; c++) { ws.getCell(row, c).fill = SECTION_FILL; ws.getCell(row, c).border = { bottom: THIN_BORDER }; }
  row++;

  const hoGroupStart = row;

  for (let yr = 0; yr < maxYears; yr++) {
    const yrCol = colLetter(COL_F + yr);
    setLabel(ws, row, 1, `${baseYear + yr}`);
    for (let g = 0; g < geoCount; g++) {
      // Row 53 = New Homeowners on each geo formula sheet
      setFormula(ws, row, dataStartCol + g, `${qn(geoSheetNames[g])}!${yrCol}53`, NUM2);
      ws.getCell(row, dataStartCol + g).alignment = { horizontal: 'center' };
    }
    const sumRange = `${colLetter(dataStartCol)}${row}:${colLetter(dataStartCol + geoCount - 1)}${row}`;
    setFormula(ws, row, totalCol, `SUM(${sumRange})`, NUM2);
    row++;
  }
  const hoGroupEnd = row - 1;

  // Group and collapse homeowner rows
  for (let r = hoGroupStart; r <= hoGroupEnd; r++) {
    ws.getRow(r).outlineLevel = 1;
    ws.getRow(r).hidden = true;
  }
  ws.properties.outlineLevelRow = 1;

  // Column widths
  ws.getColumn(1).width = 24;
  for (let c = dataStartCol; c <= totalCol; c++) ws.getColumn(c).width = 18;

  // Freeze column A + header rows
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 6 }];

  addLogo(wb, ws);
  return ws;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════

export async function generateFormulaExcel(data: ProformaData): Promise<Buffer> {
  const { fund, result, geoBreakdown } = data;
  const isMultiGeo = geoBreakdown && geoBreakdown.length > 1;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Homium Explore';
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  // Scenarios overview (always)
  buildScenariosSheet(wb, fund, result, geoBreakdown);

  let geoSheetNames: string[] | undefined;

  if (!isMultiGeo) {
    // Single-geo: LO/MID/HI formula sheets + formula-based Blended (existing behavior)
    const scenarioResults = result.scenarioResults.slice(0, 3);
    while (scenarioResults.length < 3) {
      scenarioResults.push(scenarioResults[scenarioResults.length - 1]);
    }

    const sheetNames = ['LO', 'MID', 'HI'];
    for (let i = 0; i < 3; i++) {
      buildFormulaModelSheet(wb, sheetNames[i], fund, scenarioResults[i]);
    }

    buildFormulaBlendedSheet(wb, fund, result.blended, sheetNames);
  } else {
    // Multi-geo: per-geo formula sheets + aggregate Blended with cross-sheet SUMs
    geoSheetNames = [];
    for (const gb of geoBreakdown) {
      const name = buildGeoFormulaSheet(wb, fund, gb, geoSheetNames);
      geoSheetNames.push(name);
    }

    buildFormulaBlendedSheet(wb, fund, result.blended, geoSheetNames, true);
  }

  // Charts and Share Conversion (always)
  buildChartsSheet(wb, result.blended);
  buildShareConversionSheet(wb, fund);

  // Multi-geo: Geo Summary with cross-sheet refs
  if (isMultiGeo && geoSheetNames) {
    buildGeoSummarySheet(wb, fund, geoBreakdown, geoSheetNames);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
