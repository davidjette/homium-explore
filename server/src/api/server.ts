/**
 * Homium Fund Model — REST API
 */
import express from 'express';
import cors from 'cors';
import { pool } from '../db/pool';
import {
  DEFAULT_SCENARIOS,
  PAYOFF_SCHEDULE,
  ScenarioAssumptions,
} from '../engine/types';
import { calculateAffordability } from '../engine/affordability';
import { runScenario } from '../engine/fund-aggregator';
import { blendScenarios } from '../engine/blender';
import { calculateShareConversion } from '../engine/share-conversion';
import fundRoutes from './fund-routes';
import { FundService } from '../db/services/fund-service';
import { createFundPersistenceRoutes } from './fund-persistence-routes';
import { generateReport, ReportType } from '../reports/report-engine';
import { authMiddleware } from './auth';
import { authRouter, jwtAuthMiddleware } from './auth-routes';
import { supabaseAuthMiddleware } from './supabase-auth';
import userRoutes from './user-routes';
import adminRoutes from './admin-routes';
import reportRoutes from './report-routes';
import usageRoutes from './usage-routes';

const app = express();
app.use(cors());
app.use(express.json());

// Auth routes (login/verify) — must be before auth middleware
app.use('/api/auth', authRouter);

// Usage analytics — must be before auth middleware (anonymous POST from frontend)
app.use('/api/v2/usage', usageRoutes);

// Supabase auth — permissive global middleware (sets req.user when token present)
app.use('/api', supabaseAuthMiddleware);

// User profile routes (requires Supabase auth)
app.use('/api/users', userRoutes);

// Admin routes (requires admin role)
app.use('/api/admin', adminRoutes);

// API key auth — protects write endpoints when FUND_API_KEY is set
app.use('/api', authMiddleware);

// JWT auth — protects routes when FUND_AUTH_PASSWORD is set (legacy, kept for transition)
app.use('/api', jwtAuthMiddleware);

const ok = (data: any, meta: any = {}) => ({
  success: true,
  data,
  meta: { timestamp: new Date().toISOString(), ...meta },
});
const err = (msg: string) => ({ success: false, error: msg });

// ── Health ──
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e: any) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// ── Scenarios (in-memory for prototype — no DB required) ──

app.get('/api/v1/udf/scenarios', (_req, res) => {
  const scenarios = Object.values(DEFAULT_SCENARIOS).map(s => ({
    name: s.name,
    weight: s.weight,
    initialRaise: s.initialRaise,
    medianHomeValue: s.medianHomeValue,
    medianIncome: s.medianParticipantIncome,
    affordability: calculateAffordability(s),
  }));
  res.json(ok(scenarios));
});

app.get('/api/v1/udf/scenarios/:name', (req, res) => {
  const name = req.params.name.toUpperCase();
  const a = DEFAULT_SCENARIOS[name];
  if (!a) return res.status(404).json(err('Scenario not found'));

  const affordability = calculateAffordability(a);
  res.json(ok({ ...a, affordability }));
});

app.get('/api/v1/udf/scenarios/:name/results', (req, res) => {
  const name = req.params.name.toUpperCase();
  const a = DEFAULT_SCENARIOS[name];
  if (!a) return res.status(404).json(err('Scenario not found'));

  const start = Date.now();
  const { cohorts, fundResults } = runScenario(a, PAYOFF_SCHEDULE);
  res.json(ok({
    scenario: name,
    assumptions: a,
    affordability: calculateAffordability(a),
    cohorts,
    years: fundResults,
  }, { compute_time_ms: Date.now() - start }));
});

app.get('/api/v1/udf/scenarios/:name/impact', (req, res) => {
  const name = req.params.name.toUpperCase();
  const a = DEFAULT_SCENARIOS[name];
  if (!a) return res.status(404).json(err('Scenario not found'));

  const { fundResults } = runScenario(a, PAYOFF_SCHEDULE);
  const affordability = calculateAffordability(a);
  const yr10 = fundResults[9];
  const yr30 = fundResults[29];

  res.json(ok({
    scenario: name,
    homeowners10yr: yr10.totalHomeownersCum,
    equityCreated10yr: yr10.totalEquityCreated,
    leverage10yr: yr10.totalEquityCreated > 0
      ? Math.round((yr10.totalEquityCreated / (a.initialRaise * a.homiumSAPct)) * 100) / 100
      : 0,
    homeowners30yr: yr30.totalHomeownersCum,
    equityCreated30yr: yr30.totalEquityCreated,
    leverage30yr: yr30.totalEquityCreated > 0
      ? Math.round((yr30.totalEquityCreated / (a.initialRaise * a.homiumSAPct)) * 100) / 100
      : 0,
    affordabilityGapBefore: affordability.gapBefore,
    affordabilityGapAfter: affordability.gapAfter,
  }));
});

// ── Blended ──

app.get('/api/v1/udf/blended', (_req, res) => {
  const start = Date.now();
  const lo = runScenario(DEFAULT_SCENARIOS.LO, PAYOFF_SCHEDULE);
  const mid = runScenario(DEFAULT_SCENARIOS.MID, PAYOFF_SCHEDULE);
  const hi = runScenario(DEFAULT_SCENARIOS.HI, PAYOFF_SCHEDULE);

  const blended = blendScenarios(lo.fundResults, mid.fundResults, hi.fundResults);

  const totalRaise = 2_000_000 + 6_000_000 + 2_000_000;
  const totalHomeowners =
    lo.cohorts.reduce((s, c) => s + c.homeownerCount, 0) +
    mid.cohorts.reduce((s, c) => s + c.homeownerCount, 0) +
    hi.cohorts.reduce((s, c) => s + c.homeownerCount, 0);

  const loAff = calculateAffordability(DEFAULT_SCENARIOS.LO);
  const midAff = calculateAffordability(DEFAULT_SCENARIOS.MID);
  const hiAff = calculateAffordability(DEFAULT_SCENARIOS.HI);
  const blendedGap = loAff.gapAfter * 0.2 + midAff.gapAfter * 0.6 + hiAff.gapAfter * 0.2;

  res.json(ok({
    totalRaise,
    totalHomeowners,
    programFee: totalRaise * 0.05,
    affordabilityGapClosed: Math.round(blendedGap * 100) / 100,
    years: blended,
  }, { compute_time_ms: Date.now() - start }));
});

app.get('/api/v1/udf/blended/chart-data', (_req, res) => {
  const lo = runScenario(DEFAULT_SCENARIOS.LO, PAYOFF_SCHEDULE);
  const mid = runScenario(DEFAULT_SCENARIOS.MID, PAYOFF_SCHEDULE);
  const hi = runScenario(DEFAULT_SCENARIOS.HI, PAYOFF_SCHEDULE);
  const blended = blendScenarios(lo.fundResults, mid.fundResults, hi.fundResults);

  res.json(ok({
    labels: blended.map(y => y.calendarYear),
    datasets: {
      returnedCapital: blended.map(y => Math.round(y.returnedCapital)),
      fundBalance: blended.map(y => Math.round(y.fundBalance)),
      roiCumulative: blended.map(y => y.roiCumulative),
      activeHomeowners: blended.map(y => y.activeHomeowners),
      totalEquityCreated: blended.map(y => Math.round(y.totalEquityCreated)),
    },
  }));
});

// ── Simulate (custom assumptions) ──

app.post('/api/v1/udf/simulate', (req, res) => {
  const body = req.body;
  if (!body || !body.initialRaise) {
    return res.status(400).json(err('initialRaise required'));
  }

  const start = Date.now();
  const assumptions: ScenarioAssumptions = {
    name: 'MODEL',
    weight: 1.0,
    initialRaise: body.initialRaise,
    annualContributionPct: body.annualContributionPct ?? 0,
    programFeePct: body.programFeePct ?? 0.05,
    managementFeePct: body.managementFeePct ?? 0.005,
    reinvestNetProceeds: body.reinvestNetProceeds ?? false,
    utahHPA: body.utahHPA ?? 0.05,
    interestRate: body.interestRate ?? 0.07,
    medianParticipantIncome: body.medianParticipantIncome ?? 98000,
    medianHomeValue: body.medianHomeValue ?? 440000,
    downPaymentPct: body.downPaymentPct ?? 0.03,
    homiumSAPct: body.homiumSAPct ?? 0.25,
    maxFrontRatio: body.maxFrontRatio ?? 0.30,
  };

  const { cohorts, fundResults } = runScenario(assumptions, PAYOFF_SCHEDULE);
  const affordability = calculateAffordability(assumptions);

  res.json(ok({
    assumptions,
    affordability,
    cohorts,
    years: fundResults,
  }, { compute_time_ms: Date.now() - start }));
});

// ── Sensitivity Analysis ──

app.post('/api/v1/udf/sensitivity', (req, res) => {
  const body = req.body;
  const baseAssumptions: ScenarioAssumptions = {
    name: 'MODEL',
    weight: 1.0,
    initialRaise: body.initialRaise ?? 10_000_000,
    annualContributionPct: body.annualContributionPct ?? 0,
    programFeePct: body.programFeePct ?? 0.05,
    managementFeePct: body.managementFeePct ?? 0.005,
    reinvestNetProceeds: body.reinvestNetProceeds ?? false,
    utahHPA: body.utahHPA ?? 0.05,
    interestRate: body.interestRate ?? 0.07,
    medianParticipantIncome: body.medianParticipantIncome ?? 98000,
    medianHomeValue: body.medianHomeValue ?? 440000,
    downPaymentPct: body.downPaymentPct ?? 0.03,
    homiumSAPct: body.homiumSAPct ?? 0.25,
    maxFrontRatio: body.maxFrontRatio ?? 0.30,
  };

  // Parameter to vary and range
  const param = body.parameter || 'utahHPA';
  const values: number[] = body.values || [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08];
  const timeframes = body.timeframes || [10, 20, 30];

  const start = Date.now();
  const results = values.map(val => {
    const a = { ...baseAssumptions, [param]: val } as ScenarioAssumptions;
    const { cohorts, fundResults } = runScenario(a, PAYOFF_SCHEDULE);
    const affordability = calculateAffordability(a);
    const totalHomeowners = cohorts.reduce((s, c) => s + c.homeownerCount, 0);

    const snapshots: Record<string, any> = {};
    for (const tf of timeframes) {
      const yr = fundResults[tf - 1];
      if (yr) {
        snapshots[`yr${tf}`] = {
          totalEquityCreated: Math.round(yr.totalEquityCreated),
          returnedCapital: Math.round(yr.returnedCapital),
          fundBalance: Math.round(yr.fundBalance),
          activeHomeowners: yr.activeHomeowners,
          roiCumulative: yr.roiCumulative,
          leverage: Math.round((yr.totalEquityCreated / (a.initialRaise * a.homiumSAPct)) * 100) / 100,
        };
      }
    }

    return {
      [param]: val,
      homeowners: totalHomeowners,
      affordabilityGap: Math.round(affordability.gapAfter * 100) / 100,
      ...snapshots,
    };
  });

  res.json(ok({
    parameter: param,
    baseAssumptions,
    sensitivity: results,
  }, { compute_time_ms: Date.now() - start }));
});

// ── Validation Checkpoints (for testing) ──

app.get('/api/v1/udf/validation', (_req, res) => {
  const start = Date.now();
  const lo = runScenario(DEFAULT_SCENARIOS.LO, PAYOFF_SCHEDULE);
  const mid = runScenario(DEFAULT_SCENARIOS.MID, PAYOFF_SCHEDULE);
  const hi = runScenario(DEFAULT_SCENARIOS.HI, PAYOFF_SCHEDULE);
  const blended = blendScenarios(lo.fundResults, mid.fundResults, hi.fundResults);
  const shares = calculateShareConversion(20_000_000, 100_000);

  const loHomeowners = lo.cohorts.reduce((s, c) => s + c.homeownerCount, 0);
  const midHomeowners = mid.cohorts.reduce((s, c) => s + c.homeownerCount, 0);
  const hiHomeowners = hi.cohorts.reduce((s, c) => s + c.homeownerCount, 0);

  const loAff = calculateAffordability(DEFAULT_SCENARIOS.LO);
  const midAff = calculateAffordability(DEFAULT_SCENARIOS.MID);
  const hiAff = calculateAffordability(DEFAULT_SCENARIOS.HI);
  const blendedGapAfter = loAff.gapAfter * 0.2 + midAff.gapAfter * 0.6 + hiAff.gapAfter * 0.2;

  const checkpoints = [
    { id: 1, name: 'LO homeowners (10yr)', expected: 22, actual: loHomeowners, pass: Math.abs(loHomeowners - 22) <= 1 },
    { id: 2, name: 'MID homeowners (10yr)', expected: 52, actual: midHomeowners, pass: Math.abs(midHomeowners - 52) <= 1 },
    { id: 3, name: 'HI homeowners (10yr)', expected: 13, actual: hiHomeowners, pass: Math.abs(hiHomeowners - 13) <= 1 },
    { id: 4, name: 'LO equity created (10yr)', expected: 4669096, actual: Math.round(lo.fundResults[9].totalEquityCreated), pass: Math.abs(lo.fundResults[9].totalEquityCreated - 4669096) / 4669096 < 0.15 },
    { id: 5, name: 'MID equity created (10yr)', expected: 14007287, actual: Math.round(mid.fundResults[9].totalEquityCreated), pass: Math.abs(mid.fundResults[9].totalEquityCreated - 14007287) / 14007287 < 0.15 },
    { id: 6, name: '$1 → wealth (10yr)', expected: 9.30, actual: Math.round(mid.fundResults[9].totalEquityCreated / (DEFAULT_SCENARIOS.MID.initialRaise * DEFAULT_SCENARIOS.MID.homiumSAPct) * 100) / 100, pass: Math.abs(mid.fundResults[9].totalEquityCreated / (DEFAULT_SCENARIOS.MID.initialRaise * DEFAULT_SCENARIOS.MID.homiumSAPct) - 9.30) / 9.30 < 0.05 },
    { id: 7, name: '$1 → wealth (30yr)', expected: 49.30, actual: Math.round(mid.fundResults[29].totalEquityCreated / (DEFAULT_SCENARIOS.MID.initialRaise * DEFAULT_SCENARIOS.MID.homiumSAPct) * 100) / 100, pass: Math.abs(mid.fundResults[29].totalEquityCreated / (DEFAULT_SCENARIOS.MID.initialRaise * DEFAULT_SCENARIOS.MID.homiumSAPct) - 49.30) / 49.30 < 0.05 },
    { id: 8, name: 'Blended homeowners', expected: 86, actual: loHomeowners + midHomeowners + hiHomeowners, pass: Math.abs((loHomeowners + midHomeowners + hiHomeowners) - 86) <= 3 },
    { id: 9, name: 'Blended affordability gap', expected: 335.26, actual: Math.round(blendedGapAfter * 100) / 100, pass: blendedGapAfter > 0 },
    { id: 10, name: 'Class A shares ($20M)', expected: 19047619, actual: shares.classASharesIssued, pass: shares.classASharesIssued === 19047619 },
    { id: 11, name: 'Portfolio investor P&L', expected: -952381, actual: Math.round(shares.portfolioInvestorPnL), pass: Math.abs(shares.portfolioInvestorPnL + 952381) < 1 },
  ];

  const passed = checkpoints.filter(c => c.pass).length;

  res.json(ok({
    checkpoints,
    summary: { total: checkpoints.length, passed, failed: checkpoints.length - passed },
  }, { compute_time_ms: Date.now() - start }));
});

// ── Share Conversion ──

app.get('/api/v1/udf/share-conversion', (req, res) => {
  const raise = parseFloat(req.query.raise as string) || 20_000_000;
  const loan = parseFloat(req.query.loanAmount as string) || 100_000;
  const feePct = parseFloat(req.query.programFeePct as string) || 0.05;

  const result = calculateShareConversion(raise, loan, feePct);
  res.json(ok(result));
});

// ── V2: Generic Fund Model Routes ──
app.use('/api/v2/funds', fundRoutes);

// ── V2: Fund Persistence & Analytics Routes ──
const fundService = new FundService(pool);
const persistenceRoutes = createFundPersistenceRoutes(fundService);
app.use('/api/v2/funds', persistenceRoutes);

// ── V2: Pro Forma Report Routes (PDF generation + email) ──
app.use('/api/v2/funds', reportRoutes);

// ── Reports ──
app.get('/api/v2/funds/db/:id/report', async (req, res) => {
  try {
    const fundId = String(req.params.id);
    const type = (req.query.type as string || 'lp') as ReportType;
    const validTypes = ['lp', 'manager', 'summary', 'sensitivity'];
    if (!validTypes.includes(type)) {
      return res.status(400).json(err(`Invalid report type. Must be one of: ${validTypes.join(', ')}`));
    }
    const format = req.query.format as string || 'html';
    const { html, title } = await generateReport(type, fundService, fundId);

    if (format === 'json') {
      return res.json(ok({ title, html }));
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

// UDF default reports (no fund ID needed — uses hardcoded UDF data)
app.get('/api/v2/reports/:type', async (req, res) => {
  try {
    const type = req.params.type as ReportType;
    const validTypes = ['lp', 'manager', 'summary', 'sensitivity'];
    if (!validTypes.includes(type)) {
      return res.status(400).json(err(`Invalid report type. Must be one of: ${validTypes.join(', ')}`));
    }
    const { html, title } = await generateReport(type, null);
    const format = req.query.format as string || 'html';
    if (format === 'json') {
      return res.json(ok({ title, html }));
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

// ── API-only mode (frontend served separately via GitHub Pages) ──
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Homium Fund Model API' });
});

app.use((_req, res) => {
  res.status(404).json(err('Not found'));
});

// ── Start ──
// Only bind when run directly (not when imported by tests)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`UDF Fund Model API running on port ${PORT}`));
}

export default app;
