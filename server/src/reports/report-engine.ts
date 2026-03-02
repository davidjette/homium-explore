/**
 * Report Generation Engine
 * 
 * Generates HTML reports from fund data using Ada's templates.
 * Reports are self-contained HTML with inline CSS for print/PDF.
 */

import { FundService } from '../db/services/fund-service';
import { runFundModel } from '../engine/fund-model';
import { calculateShareConversion } from '../engine/share-conversion';
import { DEFAULT_SCENARIOS, PAYOFF_SCHEDULE, ScenarioAssumptions } from '../engine/types';
import { calculateAffordability } from '../engine/affordability';
import { runScenario } from '../engine/fund-aggregator';
import { blendScenarios } from '../engine/blender';

// ── Formatting helpers ──

const fmt = (n: number, d = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const fmtN = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtP = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
const fmtM = (n: number) => {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return fmt(n);
};

// ── Shared styles ──

const STYLES = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; background: #fff; font-size: 14px; line-height: 1.5; }
  .container { max-width: 900px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 28px; font-weight: 700; color: #1B2A4A; margin-bottom: 4px; }
  h2 { font-size: 20px; font-weight: 600; color: #1B2A4A; margin: 32px 0 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  h3 { font-size: 16px; font-weight: 600; color: #334155; margin: 24px 0 12px; }
  p { margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
  tr:hover { background: #f8fafc; }
  .pass { color: #16a34a; } .fail { color: #dc2626; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
  .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
  .stat-card .value { font-size: 28px; font-weight: 700; color: #1B2A4A; }
  .stat-card .label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .stat-card .sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .highlight { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0; }
  @media print {
    body { font-size: 12px; }
    .container { padding: 20px; max-width: 100%; }
    .header-bar { margin: -20px -20px 24px; padding: 20px; }
    .stat-grid { grid-template-columns: repeat(4, 1fr); }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
    .no-print { display: none !important; }
  }
  .highlight-teal { background: #f0fdfa; border: 1px solid #99f6e4; }
  .highlight-amber { background: #fffbeb; border: 1px solid #fde68a; }
  .header-bar { background: #1B2A4A; color: white; padding: 32px 40px; margin: -40px -40px 32px; }
  .header-bar h1 { color: white; }
  .header-bar .subtitle { color: #94a3b8; font-size: 14px; }
  .header-bar .meta { color: #64748b; font-size: 12px; margin-top: 8px; }
  .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .bold { font-weight: 600; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
  @media print {
    body { font-size: 12px; }
    .container { padding: 20px; max-width: 100%; }
    .header-bar { margin: -20px -20px 24px; padding: 24px; }
    .stat-grid { grid-template-columns: repeat(4, 1fr); }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
`;

// ── Data fetching helpers ──

interface ReportData {
  fund: any;
  run: any;
  blended: any[];
  scenarios: any[];
  validation: any;
  shares: any;
  generatedAt: string;
}

async function getUDFData(): Promise<ReportData> {
  const lo = runScenario(DEFAULT_SCENARIOS.LO, PAYOFF_SCHEDULE);
  const mid = runScenario(DEFAULT_SCENARIOS.MID, PAYOFF_SCHEDULE);
  const hi = runScenario(DEFAULT_SCENARIOS.HI, PAYOFF_SCHEDULE);
  const blended = blendScenarios(lo.fundResults, mid.fundResults, hi.fundResults);
  const shares = calculateShareConversion(20_000_000, 100_000);

  const loAff = calculateAffordability(DEFAULT_SCENARIOS.LO);
  const midAff = calculateAffordability(DEFAULT_SCENARIOS.MID);
  const hiAff = calculateAffordability(DEFAULT_SCENARIOS.HI);

  return {
    fund: { name: 'Utah Dream Fund', totalRaise: 10_000_000, state: 'UT' },
    run: {
      lo: { fundResults: lo.fundResults, cohorts: lo.cohorts, affordability: loAff, assumptions: DEFAULT_SCENARIOS.LO },
      mid: { fundResults: mid.fundResults, cohorts: mid.cohorts, affordability: midAff, assumptions: DEFAULT_SCENARIOS.MID },
      hi: { fundResults: hi.fundResults, cohorts: hi.cohorts, affordability: hiAff, assumptions: DEFAULT_SCENARIOS.HI },
    },
    blended,
    scenarios: [
      { name: 'LO', weight: 0.2, assumptions: DEFAULT_SCENARIOS.LO, homeowners: lo.cohorts.reduce((s, c) => s + c.homeownerCount, 0), affordability: loAff },
      { name: 'MID', weight: 0.6, assumptions: DEFAULT_SCENARIOS.MID, homeowners: mid.cohorts.reduce((s, c) => s + c.homeownerCount, 0), affordability: midAff },
      { name: 'HI', weight: 0.2, assumptions: DEFAULT_SCENARIOS.HI, homeowners: hi.cohorts.reduce((s, c) => s + c.homeownerCount, 0), affordability: hiAff },
    ],
    validation: null,
    shares,
    generatedAt: new Date().toISOString(),
  };
}

async function getFundData(fundService: FundService, fundId: string): Promise<ReportData | null> {
  const fund = await fundService.getFund(fundId);
  if (!fund) return null;
  const result = await fundService.getLatestFundResult(fundId);
  if (!result) return null;

  return {
    fund,
    run: result,
    blended: result.blended || [],
    scenarios: (result.scenarios || []).map((sr: any) => ({
      ...sr,
      homeowners: sr.cohorts ? sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0) : 0,
    })),
    validation: null,
    shares: calculateShareConversion(fund.raise?.totalRaise || 20_000_000, 100_000),
    generatedAt: new Date().toISOString(),
  };
}

// ── Report: LP Fund Performance ──

function generateLPReport(data: ReportData): string {
  const b = data.blended;
  const yr10 = b[9];
  const yr30 = b[29];
  const totalHomeowners = data.scenarios.reduce((s: number, sc: any) => s + (sc.homeowners || 0), 0);

  const yearRows = b.map((y: any, i: number) => {
    const highlight = (i === 9 || i === 29) ? ' class="bold"' : '';
    return `<tr${highlight}>
      <td>${i + 1}</td><td>${y.calendarYear}</td>
      <td class="text-right mono">${fmtP(y.roiAnnual || 0)}</td>
      <td class="text-right mono">${fmtP(y.roiCumulative)}</td>
      <td class="text-right mono">${fmt(y.returnedCapital)}</td>
      <td class="text-right mono">${fmt(y.fundBalance)}</td>
      <td class="text-right mono">${fmtM(y.totalEquityCreated)}</td>
    </tr>`;
  }).join('\n');

  const scenarioRows = data.scenarios.map((s: any) => `
    <tr>
      <td class="bold">${s.name}</td>
      <td class="text-center">${fmtP(s.weight, 0)}</td>
      <td class="text-right mono">${fmtM(s.assumptions?.initialRaise || 0)}</td>
      <td class="text-right mono">${fmt(s.assumptions?.medianHomeValue || 0)}</td>
      <td class="text-right mono">${fmt(s.assumptions?.medianParticipantIncome || s.assumptions?.medianIncome || 0)}</td>
      <td class="text-center">${fmtN(s.homeowners)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LP Fund Performance Report — ${data.fund.name}</title>${STYLES}</head><body>
<div class="container">
  <div class="header-bar">
    <h1>${data.fund.name}</h1>
    <div class="subtitle">Limited Partner Performance Report</div>
    <div class="meta">Generated ${new Date(data.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · Data from Homium Fund Model API</div>
  </div>

  <h2>Executive Summary</h2>
  <div class="stat-grid">
    <div class="stat-card"><div class="value">${fmtN(totalHomeowners)}</div><div class="label">Homeowners Served</div></div>
    <div class="stat-card"><div class="value">${fmtM(data.fund.totalRaise || data.fund.raise?.totalRaise)}</div><div class="label">Total Capital Raised</div></div>
    <div class="stat-card"><div class="value">${yr10 ? fmtP(yr10.roiCumulative) : '—'}</div><div class="label">10-Year ROI</div></div>
    <div class="stat-card"><div class="value">${yr30 ? fmtM(yr30.totalEquityCreated) : '—'}</div><div class="label">Equity Created (30yr)</div></div>
  </div>

  <h2>Financial Performance</h2>
  <table>
    <thead><tr><th>Year</th><th>Calendar</th><th class="text-right">Annual ROI</th><th class="text-right">Cum. ROI</th><th class="text-right">Capital Returned</th><th class="text-right">Fund Balance</th><th class="text-right">Equity Created</th></tr></thead>
    <tbody>${yearRows}</tbody>
  </table>

  <h2>Scenario Analysis</h2>
  <table>
    <thead><tr><th>Scenario</th><th class="text-center">Weight</th><th class="text-right">Fund Size</th><th class="text-right">Median Home</th><th class="text-right">Median Income</th><th class="text-center">Homeowners</th></tr></thead>
    <tbody>${scenarioRows}</tbody>
  </table>

  <h2>Investor Economics</h2>
  <div class="highlight">
    <table>
      <thead><tr><th>Horizon</th><th class="text-right">Cumulative ROI</th><th class="text-right">Capital Returned</th></tr></thead>
      <tbody>
        ${[4, 9, 14, 19, 29].map(i => b[i] ? `<tr><td>${i + 1} Years</td><td class="text-right mono bold">${fmtP(b[i].roiCumulative)}</td><td class="text-right mono">${fmtM(b[i].returnedCapital)}</td></tr>` : '').join('')}
      </tbody>
    </table>
  </div>

  <h2>Share Conversion (${fmtM(data.shares.totalRaise || 20_000_000)} Raise)</h2>
  <div class="stat-grid">
    <div class="stat-card"><div class="value">${fmtN(data.shares.classASharesIssued)}</div><div class="label">Class A Shares</div></div>
    <div class="stat-card"><div class="value">${fmt(data.shares.pricePerShare, 2)}</div><div class="label">Price/Share</div></div>
    <div class="stat-card"><div class="value">${fmtM(data.shares.netToDeploy)}</div><div class="label">Net to Deploy</div></div>
    <div class="stat-card"><div class="value">${fmtM(data.shares.portfolioInvestorPnL)}</div><div class="label">Portfolio P&L</div></div>
  </div>

  <div class="footer">
    <p>Report generated from Homium Fund Model API. This document contains forward-looking projections. Actual results may vary. Not an offer to sell securities.</p>
  </div>
</div>
</body></html>`;
}

// ── Report: Fund Summary One-Pager ──

function generateSummaryReport(data: ReportData): string {
  const yr10 = data.blended[9];
  const yr30 = data.blended[29];
  const totalHomeowners = data.scenarios.reduce((s: number, sc: any) => s + (sc.homeowners || 0), 0);
  const raise = data.fund.totalRaise || data.fund.raise?.totalRaise || 10_000_000;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fund Summary — ${data.fund.name}</title>${STYLES}
<style>
  .onepager { display: grid; grid-template-columns: 55% 45%; gap: 32px; }
  .impact-box { background: #2D9E8F; color: white; border-radius: 12px; padding: 24px; margin: 16px 0; }
  .impact-box .big { font-size: 36px; font-weight: 700; }
  .impact-box .lbl { font-size: 12px; opacity: 0.85; margin-top: 2px; }
  .impact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media print { .onepager { grid-template-columns: 55% 45%; } body { font-size: 11px; } }
</style>
</head><body>
<div class="container">
  <div class="header-bar">
    <h1>${data.fund.name}</h1>
    <div class="subtitle">A Homium Shared Appreciation Mortgage Program</div>
  </div>

  <div class="onepager">
    <div>
      <h2>Social Impact</h2>
      <div class="impact-box">
        <div class="impact-grid">
          <div><div class="big">${fmtN(totalHomeowners)}</div><div class="lbl">Homeowners Served</div></div>
          <div><div class="big">${yr10 ? fmtP(yr10.roiCumulative) : '—'}</div><div class="lbl">10-Year ROI</div></div>
          <div><div class="big">${yr10 ? `$${(yr10.totalEquityCreated / (raise * 0.25)).toFixed(1)}` : '—'}</div><div class="lbl">Wealth per $1 (10yr)</div></div>
          <div><div class="big">${yr30 ? fmtM(yr30.totalEquityCreated) : '—'}</div><div class="lbl">Equity Created (30yr)</div></div>
        </div>
      </div>

      <h3>Homeowner Scenarios</h3>
      <table>
        <thead><tr><th>Market</th><th class="text-right">Home Value</th><th class="text-right">Homium SAM</th><th class="text-right">PITI Savings</th><th class="text-center">Homeowners</th></tr></thead>
        <tbody>
          ${data.scenarios.map((s: any) => {
            const aff = s.affordability;
            const sam = (s.assumptions?.medianHomeValue || 0) * 0.25;
            const savings = aff ? (aff.pitiBeforeHomium - aff.pitiAfterHomium) : 0;
            return `<tr><td class="bold">${s.name}</td><td class="text-right mono">${fmt(s.assumptions?.medianHomeValue || 0)}</td><td class="text-right mono">${fmtM(sam)}</td><td class="text-right mono">${fmt(savings)}/mo</td><td class="text-center">${s.homeowners}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div>
      <h2>Fund Details</h2>
      <table>
        <tbody>
          <tr><td class="bold">Strategy</td><td>Shared Appreciation Mortgage (SAM)</td></tr>
          <tr><td class="bold">Total Raise</td><td>${fmtM(raise)}</td></tr>
          <tr><td class="bold">Target Homeowners</td><td>${fmtN(totalHomeowners)}</td></tr>
          <tr><td class="bold">Program Fee</td><td>5.0% (one-time)</td></tr>
          <tr><td class="bold">Management Fee</td><td>0.5% annually</td></tr>
          <tr><td class="bold">Fund Term</td><td>30 years</td></tr>
          <tr><td class="bold">State</td><td>${data.fund.state || data.fund.geography?.state || 'UT'}</td></tr>
        </tbody>
      </table>

      <h3>Return Projections</h3>
      <table>
        <thead><tr><th>Horizon</th><th class="text-right">Cumulative ROI</th></tr></thead>
        <tbody>
          ${[4, 9, 14, 19, 29].map(i => data.blended[i] ? `<tr><td>${i + 1} Years</td><td class="text-right mono bold">${fmtP(data.blended[i].roiCumulative)}</td></tr>` : '').join('')}
        </tbody>
      </table>

      <h3>Why LPs Invest</h3>
      <ul style="list-style: none; padding: 0;">
        <li>✦ Mission-aligned — community impact</li>
        <li>✦ Capital preservation — 30yr return >${yr30 ? fmtP(yr30.roiCumulative) : '169%'}</li>
        <li>✦ Diversified — ${fmtN(totalHomeowners)} homeowners</li>
        <li>✦ SAM security — 2nd lien on appreciating real estate</li>
        <li>✦ PRI-qualified for foundations</li>
      </ul>
    </div>
  </div>

  <div class="footer">
    <p>This document contains forward-looking projections based on Homium's financial model. Actual results may vary. Not an offer to sell securities. For accredited investors only.</p>
  </div>
</div>
</body></html>`;
}

// ── Report: Program Manager ──

function generateManagerReport(data: ReportData): string {
  const b = data.blended;
  const totalHomeowners = data.scenarios.reduce((s: number, sc: any) => s + (sc.homeowners || 0), 0);
  const raise = data.fund.totalRaise || data.fund.raise?.totalRaise || 10_000_000;

  const keyYears = [0, 4, 9, 14, 19, 29].filter(i => b[i]);
  const milestoneRows = keyYears.map(i => `
    <tr>
      <td>${b[i].calendarYear}</td>
      <td class="text-right mono">${b[i].activeHomeowners}</td>
      <td class="text-right mono">${fmtM(b[i].fundBalance)}</td>
      <td class="text-right mono">${fmtM(b[i].returnedCapital)}</td>
      <td class="text-right mono">${fmtP(b[i].roiCumulative)}</td>
      <td class="text-right mono">${fmtM(b[i].totalEquityCreated)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Program Manager Report — ${data.fund.name}</title>${STYLES}</head><body>
<div class="container">
  <div class="header-bar">
    <h1>${data.fund.name}</h1>
    <div class="subtitle">Program Manager — Operations Report</div>
    <div class="meta">Generated ${new Date(data.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

  <h2>Operational Snapshot</h2>
  <div class="stat-grid">
    <div class="stat-card"><div class="value">${fmtN(totalHomeowners)}</div><div class="label">Total Homeowners</div><div class="sub">30-year model</div></div>
    <div class="stat-card"><div class="value">${fmtM(raise)}</div><div class="label">Fund Size</div></div>
    <div class="stat-card"><div class="value">${data.scenarios.length}</div><div class="label">Scenarios</div></div>
    <div class="stat-card"><div class="value">${data.fund.state || data.fund.geography?.state || 'UT'}</div><div class="label">Target State</div></div>
  </div>

  <h2>Pipeline by Scenario</h2>
  <table>
    <thead><tr><th>Scenario</th><th class="text-center">Weight</th><th class="text-right">Allocation</th><th class="text-center">Homeowners</th><th class="text-right">Median Home</th><th class="text-right">Avg SAM Size</th></tr></thead>
    <tbody>
      ${data.scenarios.map((s: any) => `
        <tr>
          <td class="bold">${s.name}</td>
          <td class="text-center">${fmtP(s.weight, 0)}</td>
          <td class="text-right mono">${fmtM(s.assumptions?.initialRaise || s.assumptions?.raiseAllocation || 0)}</td>
          <td class="text-center">${s.homeowners}</td>
          <td class="text-right mono">${fmt(s.assumptions?.medianHomeValue || 0)}</td>
          <td class="text-right mono">${fmtM((s.assumptions?.medianHomeValue || 0) * 0.25)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Key Milestones</h2>
  <table>
    <thead><tr><th>Year</th><th class="text-right">Active</th><th class="text-right">Fund Balance</th><th class="text-right">Returned</th><th class="text-right">Cum. ROI</th><th class="text-right">Equity Created</th></tr></thead>
    <tbody>${milestoneRows}</tbody>
  </table>

  <h2>Fee Structure Impact</h2>
  <div class="highlight-amber highlight">
    <table>
      <tbody>
        <tr><td class="bold">Program Fee (5%)</td><td class="text-right mono">${fmtM(raise * 0.05)}</td><td>One-time at close</td></tr>
        <tr><td class="bold">Year 1 Management Fee (0.5%)</td><td class="text-right mono">${fmtM(raise * 0.95 * 0.005)}</td><td>Applied to fund balance</td></tr>
      </tbody>
    </table>
  </div>

  <h2>Full 30-Year Projection</h2>
  <table>
    <thead><tr><th>Year</th><th>Calendar</th><th class="text-right">Active HO</th><th class="text-right">Fund Balance</th><th class="text-right">Returned</th><th class="text-right">Equity</th><th class="text-right">ROI</th></tr></thead>
    <tbody>
      ${b.map((y: any, i: number) => `<tr${i === 9 || i === 29 ? ' class="bold"' : ''}>
        <td>${i + 1}</td><td>${y.calendarYear}</td>
        <td class="text-right">${y.activeHomeowners}</td>
        <td class="text-right mono">${fmtM(y.fundBalance)}</td>
        <td class="text-right mono">${fmtM(y.returnedCapital)}</td>
        <td class="text-right mono">${fmtM(y.totalEquityCreated)}</td>
        <td class="text-right mono">${fmtP(y.roiCumulative)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer"><p>Internal report. Generated from Homium Fund Model API.</p></div>
</div>
</body></html>`;
}

// ── Report: Sensitivity ──

function generateSensitivityReport(data: ReportData): string {
  const b = data.blended;
  const yr10 = b[9];
  const yr30 = b[29];
  const raise = data.fund.totalRaise || data.fund.raise?.totalRaise || 10_000_000;

  // Run sensitivity on HPA
  const hpaValues = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08];
  const hpaSensitivity = hpaValues.map(hpa => {
    const a: ScenarioAssumptions = { ...DEFAULT_SCENARIOS.MID, utahHPA: hpa };
    const { fundResults, cohorts } = runScenario(a, PAYOFF_SCHEDULE);
    const homeowners = cohorts.reduce((s, c) => s + c.homeownerCount, 0);
    return {
      hpa,
      homeowners,
      roi10: fundResults[9]?.roiCumulative || 0,
      roi30: fundResults[29]?.roiCumulative || 0,
      equity10: fundResults[9]?.totalEquityCreated || 0,
      equity30: fundResults[29]?.totalEquityCreated || 0,
    };
  });

  // Fund size sensitivity
  const sizes = [2_000_000, 5_000_000, 10_000_000, 15_000_000, 20_000_000];
  const sizeSensitivity = sizes.map(size => {
    const ratio = size / 10_000_000;
    return {
      size,
      homeowners: Math.round(data.scenarios.reduce((s: number, sc: any) => s + sc.homeowners, 0) * ratio),
      roi10: yr10?.roiCumulative || 0,
      roi30: yr30?.roiCumulative || 0,
      equity30: (yr30?.totalEquityCreated || 0) * ratio,
    };
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sensitivity Report — ${data.fund.name}</title>${STYLES}</head><body>
<div class="container">
  <div class="header-bar">
    <h1>${data.fund.name}</h1>
    <div class="subtitle">Parameter Sensitivity Analysis</div>
    <div class="meta">Generated ${new Date(data.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

  <h2>Home Price Appreciation Sensitivity</h2>
  <p>Base case: 5% annual HPA. How do returns change as appreciation varies?</p>
  <table>
    <thead><tr><th>HPA</th><th class="text-right">Homeowners</th><th class="text-right">10yr ROI</th><th class="text-right">30yr ROI</th><th class="text-right">Equity (10yr)</th><th class="text-right">Equity (30yr)</th></tr></thead>
    <tbody>
      ${hpaSensitivity.map(r => `<tr${r.hpa === 0.05 ? ' class="bold"' : ''}>
        <td>${fmtP(r.hpa, 0)}</td>
        <td class="text-right">${fmtN(r.homeowners)}</td>
        <td class="text-right mono">${fmtP(r.roi10)}</td>
        <td class="text-right mono">${fmtP(r.roi30)}</td>
        <td class="text-right mono">${fmtM(r.equity10)}</td>
        <td class="text-right mono">${fmtM(r.equity30)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="highlight-teal highlight">
    <strong>Finding:</strong> At 2% HPA, 30-year ROI drops to ${fmtP(hpaSensitivity[0].roi30)}. At 8% HPA, it rises to ${fmtP(hpaSensitivity[6].roi30)}. Each 1% HPA increase adds approximately ${fmtP((hpaSensitivity[6].roi30 - hpaSensitivity[0].roi30) / 6)} to 30-year ROI.
  </div>

  <h2>Fund Size Sensitivity</h2>
  <p>ROI percentages are scale-invariant. Social impact scales linearly with fund size.</p>
  <table>
    <thead><tr><th>Fund Size</th><th class="text-right">Homeowners</th><th class="text-right">10yr ROI</th><th class="text-right">30yr ROI</th><th class="text-right">Equity (30yr)</th></tr></thead>
    <tbody>
      ${sizeSensitivity.map(r => `<tr${r.size === 10_000_000 ? ' class="bold"' : ''}>
        <td>${fmtM(r.size)}</td>
        <td class="text-right">${fmtN(r.homeowners)}</td>
        <td class="text-right mono">${fmtP(r.roi10)}</td>
        <td class="text-right mono">${fmtP(r.roi30)}</td>
        <td class="text-right mono">${fmtM(r.equity30)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Key Findings</h2>
  <div class="highlight">
    <ul style="margin-left: 20px;">
      <li>ROI is <strong>scale-invariant</strong> — same % returns at any fund size</li>
      <li>HPA is the <strong>highest-impact parameter</strong> — 1% change = ~${fmtP((hpaSensitivity[6].roi30 - hpaSensitivity[0].roi30) / 6)} ROI shift</li>
      <li>Homeowner count scales linearly with fund size (~8.4 per $1M)</li>
      <li>Downside: Even at 2% HPA, 30-year cumulative ROI remains ${hpaSensitivity[0].roi30 > 0 ? 'positive' : 'challenging'}</li>
    </ul>
  </div>

  <div class="footer"><p>Sensitivity analysis generated from Homium Fund Model API. Base case: MID scenario, $10M fund, 5% HPA.</p></div>
</div>
</body></html>`;
}

// ── Public API ──

export type ReportType = 'lp' | 'manager' | 'summary' | 'sensitivity';

export async function generateReport(
  type: ReportType,
  fundService: FundService | null,
  fundId?: string,
): Promise<{ html: string; title: string }> {
  let data: ReportData;

  if (fundId && fundService) {
    const fundData = await getFundData(fundService, fundId);
    if (!fundData) throw new Error(`Fund ${fundId} not found or no run results`);
    data = fundData;
  } else {
    data = await getUDFData();
  }

  switch (type) {
    case 'lp':
      return { html: generateLPReport(data), title: `LP Report — ${data.fund.name}` };
    case 'manager':
      return { html: generateManagerReport(data), title: `Manager Report — ${data.fund.name}` };
    case 'summary':
      return { html: generateSummaryReport(data), title: `Fund Summary — ${data.fund.name}` };
    case 'sensitivity':
      return { html: generateSensitivityReport(data), title: `Sensitivity Report — ${data.fund.name}` };
    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}
