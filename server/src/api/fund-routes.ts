/**
 * Generic Fund Model API Routes
 * 
 * /api/v2/funds/* — create, configure, and run any Homium fund model
 */
import { Router, Request, Response } from 'express';
import { FundConfig, DEFAULT_PAYOFF_SCHEDULE } from '../engine/types';
import { runFundModel, buildFundConfig, validateFund } from '../engine/fund-model';
import { calculateShareConversion } from '../engine/share-conversion';
import { calculateTopOffSchedule } from '../engine/topoff-calculator';
import {
  autoPopulateScenarios, getStateStats, getZipStats, searchHousingData,
  getCountiesByState, getCountyStats, getZipsByState, getAllStates,
} from '../integrations/housing-data';
import { calculateAffordability } from '../engine/affordability';
import { toLegacyAssumptions } from '../engine/types';

const router = Router();

const ok = (data: any, meta: any = {}) => ({
  success: true,
  data,
  meta: { timestamp: new Date().toISOString(), ...meta },
});
const err = (msg: string) => ({ success: false, error: msg });

// ── Fund Model CRUD ──

/** POST /api/v2/funds/create — Create and run a new fund model */
router.post('/create', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.name) return res.status(400).json(err('Fund name required'));

    const start = Date.now();
    const fund = buildFundConfig(body);
    const result = runFundModel(fund);

    res.json(ok({
      fund: result.fund,
      totalHomeowners: result.totalHomeowners,
      totalRaise: result.totalRaise,
      scenarioCount: result.scenarioResults.length,
      scenarios: result.scenarioResults.map(sr => ({
        name: sr.scenario.name,
        weight: sr.scenario.weight,
        homeowners: sr.cohorts.reduce((s, c) => s + c.homeownerCount, 0),
        affordability: sr.affordability,
        assumptions: {
          medianHomeValue: sr.scenario.medianHomeValue || 0,
          medianIncome: sr.scenario.medianIncome || 0,
          raiseAllocation: sr.scenario.raiseAllocation || 0,
        },
        yr10: sr.fundResults[9] ? {
          equityCreated: Math.round(sr.fundResults[9].totalEquityCreated),
          activeHomeowners: sr.fundResults[9].activeHomeowners,
          fundBalance: Math.round(sr.fundResults[9].fundBalance),
          roiCumulative: sr.fundResults[9].roiCumulative,
        } : null,
        yr30: sr.fundResults[29] ? {
          equityCreated: Math.round(sr.fundResults[29].totalEquityCreated),
          activeHomeowners: sr.fundResults[29].activeHomeowners,
          fundBalance: Math.round(sr.fundResults[29].fundBalance),
          roiCumulative: sr.fundResults[29].roiCumulative,
        } : null,
      })),
      blended: {
        labels: result.blended.map(y => y.calendarYear),
        returnedCapital: result.blended.map(y => Math.round(y.returnedCapital)),
        fundBalance: result.blended.map(y => Math.round(y.fundBalance)),
        equityCreated: result.blended.map(y => Math.round(y.totalEquityCreated)),
        activeHomeowners: result.blended.map(y => y.activeHomeowners),
        roiCumulative: result.blended.map(y => y.roiCumulative),
      },
    }, { compute_time_ms: Date.now() - start }));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** POST /api/v2/funds/run — Run a full fund config (pass complete FundConfig) */
router.post('/run', (req: Request, res: Response) => {
  try {
    const fund = req.body as FundConfig;
    if (!fund.name || !fund.scenarios?.length) {
      return res.status(400).json(err('Fund name and at least one scenario required'));
    }
    // Fill defaults for payoff schedule
    if (!fund.payoffSchedule?.length) {
      fund.payoffSchedule = DEFAULT_PAYOFF_SCHEDULE;
    }

    const start = Date.now();
    const result = runFundModel(fund);

    // Calculate top-off schedule when wageGrowthPct is present
    // Use fixedHomeCount if set, otherwise fall back to totalHomeowners from the model
    let topOffSchedule;
    const homeCount = fund.program.fixedHomeCount || result.totalHomeowners;
    if (fund.assumptions.wageGrowthPct != null && homeCount) {
      topOffSchedule = calculateTopOffSchedule(fund, fund.assumptions.wageGrowthPct, homeCount);
    }

    res.json(ok({
      fund: result.fund,
      totalHomeowners: result.totalHomeowners,
      scenarioResults: result.scenarioResults.map(sr => ({
        scenario: sr.scenario,
        cohorts: sr.cohorts,
        affordability: sr.affordability,
        years: sr.fundResults,
        assumptions: {
          medianHomeValue: sr.scenario.medianHomeValue || 0,
          medianIncome: sr.scenario.medianIncome || 0,
          raiseAllocation: sr.scenario.raiseAllocation || 0,
        },
      })),
      blended: result.blended,
      topOffSchedule,
      geoBreakdown: result.geoBreakdown?.map(gb => ({
        geo: gb.geo,
        scenarioResults: gb.scenarioResults.map(sr => ({
          scenario: sr.scenario,
          cohorts: sr.cohorts,
          affordability: sr.affordability,
          years: sr.fundResults,
        })),
        blended: gb.blended,
        totalHomeowners: gb.totalHomeowners,
      })),
    }, { compute_time_ms: Date.now() - start }));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** POST /api/v2/funds/sensitivity — Run sensitivity analysis on any parameter */
router.post('/sensitivity', (req: Request, res: Response) => {
  try {
    const { fund: fundInput, parameter, values, timeframes = [10, 20, 30] } = req.body;
    if (!fundInput?.name) return res.status(400).json(err('Fund config required'));
    if (!parameter || !values?.length) return res.status(400).json(err('parameter and values[] required'));

    const start = Date.now();
    const results = values.map((val: number) => {
      // Apply the parameter variation to the fund config
      const varied = applyParameterVariation(fundInput, parameter, val);
      const result = runFundModel(varied);

      const snapshots: Record<string, any> = {};
      for (const tf of timeframes) {
        const blendedYr = result.blended[tf - 1];
        if (blendedYr) {
          snapshots[`yr${tf}`] = {
            equityCreated: Math.round(blendedYr.totalEquityCreated),
            returnedCapital: Math.round(blendedYr.returnedCapital),
            fundBalance: Math.round(blendedYr.fundBalance),
            activeHomeowners: blendedYr.activeHomeowners,
            roiCumulative: blendedYr.roiCumulative,
          };
        }
      }

      return {
        [parameter]: val,
        totalHomeowners: result.totalHomeowners,
        ...snapshots,
      };
    });

    res.json(ok({ parameter, sensitivity: results }, { compute_time_ms: Date.now() - start }));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** POST /api/v2/funds/share-conversion — Calculate share conversion for any raise */
router.post('/share-conversion', (req: Request, res: Response) => {
  const { fundsRaised = 20_000_000, loanAmount = 100_000, programFeePct = 0.05 } = req.body;
  const result = calculateShareConversion(fundsRaised, loanAmount, programFeePct);
  res.json(ok(result));
});

// ── Housing Data Integration ──

/** GET /api/v2/funds/housing/state/:abbr — Get state housing data */
router.get('/housing/state/:abbr', async (req: Request, res: Response) => {
  try {
    const data = await getStateStats((req.params.abbr as string).toUpperCase());
    res.json(ok(data));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** GET /api/v2/funds/housing/zip/:zip — Get ZIP housing data */
router.get('/housing/zip/:zip', async (req: Request, res: Response) => {
  try {
    const data = await getZipStats(req.params.zip as string);
    res.json(ok(data));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** POST /api/v2/funds/housing/search — Search housing data */
router.post('/housing/search', async (req: Request, res: Response) => {
  try {
    const data = await searchHousingData(req.body);
    res.json(ok(data));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** POST /api/v2/funds/auto-populate — Auto-populate fund scenarios from housing data */
router.post('/auto-populate', async (req: Request, res: Response) => {
  try {
    const { state, totalRaise = 10_000_000, name } = req.body;
    if (!state) return res.status(400).json(err('state required (e.g. "UT", "AZ")'));

    const populated = await autoPopulateScenarios(state, totalRaise);

    // Build a complete fund config from the auto-populated data
    const fund = buildFundConfig({
      name: name || `Homium ${state} Fund`,
      geography: { state, label: state },
      raise: { totalRaise, annualContributionPct: 0, reinvestNetProceeds: false, baseYear: new Date().getFullYear() },
      scenarios: populated.scenarios,
    });

    // Run it
    const result = runFundModel(fund);

    res.json(ok({
      housingData: {
        medianIncome: populated.medianIncome,
        medianHomeValue: populated.medianHomeValue,
      },
      fund: result.fund,
      totalHomeowners: result.totalHomeowners,
      scenarios: result.scenarioResults.map(sr => ({
        name: sr.scenario.name,
        homeowners: sr.cohorts.reduce((s, c) => s + c.homeownerCount, 0),
        medianIncome: sr.scenario.medianIncome,
        medianHomeValue: sr.scenario.medianHomeValue,
        affordabilityGap: sr.affordability.gapAfter,
      })),
      blendedYr10: result.blended[9] ? {
        equityCreated: Math.round(result.blended[9].totalEquityCreated),
        activeHomeowners: result.blended[9].activeHomeowners,
        roiCumulative: result.blended[9].roiCumulative,
      } : null,
    }));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

// ── County & ZIP Endpoints (for Program Explorer) ──

/** GET /api/v2/funds/housing/states — List all states */
router.get('/housing/states', async (_req: Request, res: Response) => {
  try {
    const data = await getAllStates();
    res.json(ok(data));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** GET /api/v2/funds/housing/state/:abbr/counties — List all counties in a state */
router.get('/housing/state/:abbr/counties', async (req: Request, res: Response) => {
  try {
    const data = await getCountiesByState(req.params.abbr as string);
    res.json(ok(data));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** GET /api/v2/funds/housing/county/:state/:county — County-level stats */
router.get('/housing/county/:state/:county', async (req: Request, res: Response) => {
  try {
    const data = await getCountyStats(req.params.state as string, req.params.county as string);
    if (!data) return res.status(404).json(err('County not found'));
    res.json(ok(data));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** GET /api/v2/funds/housing/state/:abbr/zips — List all ZIPs in a state */
router.get('/housing/state/:abbr/zips', async (req: Request, res: Response) => {
  try {
    const data = await getZipsByState(req.params.abbr as string);
    res.json(ok(data));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

/** GET /api/v2/funds/housing/affordability — Compute affordability gap for any geography */
router.get('/housing/affordability', async (req: Request, res: Response) => {
  try {
    const { state, county, zip, dti, rate, dp, sam } = req.query;
    if (!state && !zip) return res.status(400).json(err('state or zip required'));

    // Get market data for the specified geography
    let medianIncome: number;
    let medianHomeValue: number;
    let medianRent: number;
    let geoLabel: string;

    if (zip) {
      const zipData = await getZipStats(zip as string);
      medianIncome = zipData.medianIncome;
      medianHomeValue = zipData.medianHomeValue;
      medianRent = zipData.medianRent;
      geoLabel = `${zipData.city}, ${zipData.state} ${zipData.zipCode}`;
    } else if (county && state) {
      const countyData = await getCountyStats(state as string, county as string);
      if (!countyData) return res.status(404).json(err('County not found'));
      medianIncome = countyData.medianIncome;
      medianHomeValue = countyData.medianHomeValue;
      medianRent = countyData.medianRent;
      geoLabel = `${countyData.countyName}, ${state}`;
    } else {
      const stateData = await getStateStats(state as string);
      medianIncome = stateData.avgIncome;
      medianHomeValue = stateData.avgHomePrice;
      medianRent = stateData.avgRent;
      geoLabel = stateData.stateName || (state as string);
    }

    // Configurable assumptions with sensible defaults
    const interestRate = parseFloat(rate as string) || 0.07;
    const maxFrontRatio = parseFloat(dti as string) || 0.35;
    const downPaymentPct = parseFloat(dp as string) || 0.03;
    const homiumSAPct = parseFloat(sam as string) || 0.20;

    const assumptions = {
      name: 'AFFORDABILITY',
      weight: 1,
      initialRaise: 10_000_000,
      annualContributionPct: 0,
      programFeePct: 0.05,
      managementFeePct: 0.005,
      reinvestNetProceeds: false,
      utahHPA: 0.05,
      interestRate,
      medianParticipantIncome: medianIncome,
      medianHomeValue,
      downPaymentPct,
      homiumSAPct,
      maxFrontRatio,
    };

    const affordability = calculateAffordability(assumptions);
    const downPaymentAmount = medianHomeValue * downPaymentPct;
    const affordablePrice = (medianIncome * maxFrontRatio / 12) / (interestRate / 12 * Math.pow(1 + interestRate / 12, 360) / (Math.pow(1 + interestRate / 12, 360) - 1) + 0.0085 / 12);

    res.json(ok({
      geography: geoLabel,
      medianIncome: Math.round(medianIncome),
      medianHomeValue: Math.round(medianHomeValue),
      medianRent: Math.round(medianRent),
      affordableHomePrice: Math.round(affordablePrice),
      downPaymentRequired: Math.round(downPaymentAmount),
      affordabilityGap: Math.round(medianHomeValue - affordablePrice),
      affordability,
      assumptions: { interestRate, maxFrontRatio, downPaymentPct, homiumSAPct },
    }));
  } catch (e: any) {
    res.status(500).json(err(e.message));
  }
});

// ── Helpers ──

function applyParameterVariation(fundInput: any, parameter: string, value: number): FundConfig {
  const fund = buildFundConfig(JSON.parse(JSON.stringify(fundInput)));

  // Map parameter names to config locations
  const paramMap: Record<string, (f: FundConfig, v: number) => void> = {
    hpaPct: (f, v) => { f.assumptions.hpaPct = v; },
    interestRate: (f, v) => { f.assumptions.interestRate = v; },
    homiumSAPct: (f, v) => { f.program.homiumSAPct = v; },
    downPaymentPct: (f, v) => { f.program.downPaymentPct = v; },
    programFeePct: (f, v) => { f.fees.programFeePct = v; },
    managementFeePct: (f, v) => { f.fees.managementFeePct = v; },
    totalRaise: (f, v) => {
      const ratio = v / f.raise.totalRaise;
      f.raise.totalRaise = v;
      f.scenarios.forEach(s => { s.raiseAllocation = s.raiseAllocation * ratio; });
    },
    maxFrontRatio: (f, v) => { f.program.maxFrontRatio = v; },
  };

  const applier = paramMap[parameter];
  if (applier) {
    applier(fund, value);
  } else {
    // Try to set it on assumptions as a fallback
    (fund.assumptions as any)[parameter] = value;
  }

  return fund;
}

/** POST /api/v2/funds/validate — Validate fund config against program limits */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const fund = buildFundConfig(req.body);
    const errors = validateFund(fund);
    res.json(ok({ valid: errors.length === 0, errors }));
  } catch (e: any) {
    res.status(400).json(err(e.message));
  }
});

export default router;
