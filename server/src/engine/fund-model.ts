/**
 * Generic Fund Model Runner
 * 
 * Takes a FundConfig, runs all scenarios, blends results.
 * No fund-specific hardcoding — everything is configurable.
 */
import {
  FundConfig, FundModelResult, ScenarioResult, ScenarioConfig,
  FundYearState, GeoAllocation, GeoBreakdownResult,
  toLegacyAssumptions, DEFAULT_PAYOFF_SCHEDULE,
} from './types';
import { calculateAffordability } from './affordability';
import { runScenario } from './fund-aggregator';
import { blendScenarios } from './blender';

/** Resolve % AMI / % MHP to dollar values — only if not already set */
export function resolveScenarioValues(fund: FundConfig, scenario: ScenarioConfig): ScenarioConfig {
  const resolved = { ...scenario };
  // Only resolve percentages if dollar values are missing
  // (Frontend sends both % and $ values; we shouldn't overwrite $ with incorrect calculations)
  if (scenario.pctAMI != null && !scenario.medianIncome && fund.program.incomeMax) {
    resolved.medianIncome = scenario.pctAMI * fund.program.incomeMax;
  }
  if (scenario.pctMHP != null && !scenario.medianHomeValue && fund.program.purchaseMax) {
    resolved.medianHomeValue = scenario.pctMHP * fund.program.purchaseMax;
  }
  return resolved;
}

/** Validate scenario against program limits. Returns error messages (empty = valid). */
export function validateScenario(fund: FundConfig, scenario: ScenarioConfig): string[] {
  const errors: string[] = [];
  const resolved = resolveScenarioValues(fund, scenario);
  const downPayment = resolved.medianHomeValue * fund.program.downPaymentPct;
  const mortgage = resolved.medianHomeValue - downPayment;
  const homiumPrincipal = resolved.medianHomeValue * fund.program.homiumSAPct;
  const loanAmount = mortgage - homiumPrincipal;

  if (fund.program.loanMax && loanAmount > fund.program.loanMax) {
    errors.push(`${scenario.name}: Loan amount $${Math.round(loanAmount).toLocaleString()} exceeds program limit $${fund.program.loanMax.toLocaleString()}`);
  }
  if (fund.program.purchaseMax && resolved.medianHomeValue > fund.program.purchaseMax) {
    errors.push(`${scenario.name}: Purchase price $${Math.round(resolved.medianHomeValue).toLocaleString()} exceeds program limit $${fund.program.purchaseMax.toLocaleString()}`);
  }
  if (fund.program.incomeMax && resolved.medianIncome > fund.program.incomeMax) {
    errors.push(`${scenario.name}: Income $${Math.round(resolved.medianIncome).toLocaleString()} exceeds program limit $${fund.program.incomeMax.toLocaleString()}`);
  }
  return errors;
}

/** Validate all scenarios. Returns all error messages. */
export function validateFund(fund: FundConfig): string[] {
  return fund.scenarios.flatMap(s => validateScenario(fund, s));
}

/** Generate LO/MID/HI scenarios from a geography's income/MHV */
function autoScenariosForGeo(
  geo: GeoAllocation,
  raiseAllocation: number,
): ScenarioConfig[] {
  const income = geo.medianIncome;
  const mhv = geo.medianHomeValue;
  return [
    { name: 'LO', weight: 0.20, raiseAllocation: raiseAllocation * 0.20, medianIncome: Math.round(income * 0.75), medianHomeValue: Math.round(mhv * 0.80) },
    { name: 'MID', weight: 0.60, raiseAllocation: raiseAllocation * 0.60, medianIncome: Math.round(income), medianHomeValue: Math.round(mhv) },
    { name: 'HI', weight: 0.20, raiseAllocation: raiseAllocation * 0.20, medianIncome: Math.round(income * 1.35), medianHomeValue: Math.round(mhv * 1.40) },
  ];
}

/** Sum two FundYearState arrays element-wise */
function sumFundYears(a: FundYearState[], b: FundYearState[]): FundYearState[] {
  const maxLen = Math.max(a.length, b.length);
  const result: FundYearState[] = [];
  for (let i = 0; i < maxLen; i++) {
    const ya = a[i] || {} as FundYearState;
    const yb = b[i] || {} as FundYearState;
    result.push({
      year: ya.year || yb.year,
      calendarYear: ya.calendarYear || yb.calendarYear,
      newDonations: (ya.newDonations || 0) + (yb.newDonations || 0),
      newContributions: (ya.newContributions || 0) + (yb.newContributions || 0),
      reinvestedFunds: (ya.reinvestedFunds || 0) + (yb.reinvestedFunds || 0),
      capitalDeployed: (ya.capitalDeployed || 0) + (yb.capitalDeployed || 0),
      programFee: (ya.programFee || 0) + (yb.programFee || 0),
      managementFee: (ya.managementFee || 0) + (yb.managementFee || 0),
      newHomeowners: (ya.newHomeowners || 0) + (yb.newHomeowners || 0),
      totalHomeownersCum: (ya.totalHomeownersCum || 0) + (yb.totalHomeownersCum || 0),
      activeHomeowners: (ya.activeHomeowners || 0) + (yb.activeHomeowners || 0),
      exitingHomeowners: (ya.exitingHomeowners || 0) + (yb.exitingHomeowners || 0),
      returnedCapital: (ya.returnedCapital || 0) + (yb.returnedCapital || 0),
      roiAnnual: 0, // Will recalculate after summing
      roiCumulative: 0,
      fundBalance: (ya.fundBalance || 0) + (yb.fundBalance || 0),
      totalEquityCreated: (ya.totalEquityCreated || 0) + (yb.totalEquityCreated || 0),
      outstandingPositionValue: (ya.outstandingPositionValue || 0) + (yb.outstandingPositionValue || 0),
      fundNAV: (ya.fundNAV || 0) + (yb.fundNAV || 0),
      lpCapitalIn: (ya.lpCapitalIn || 0) + (yb.lpCapitalIn || 0),
      cumulativeDistributions: (ya.cumulativeDistributions || 0) + (yb.cumulativeDistributions || 0),
    });
  }
  // Recalculate ROI from summed values
  for (const yr of result) {
    const totalValue = yr.cumulativeDistributions + yr.fundNAV;
    yr.roiCumulative = yr.lpCapitalIn > 0 ? (totalValue - yr.lpCapitalIn) / yr.lpCapitalIn : 0;
  }
  let prevTotal = result[0]?.lpCapitalIn || 0;
  for (const yr of result) {
    const totalValue = yr.cumulativeDistributions + yr.fundNAV;
    yr.roiAnnual = prevTotal > 0 ? (totalValue - prevTotal) / prevTotal : 0;
    prevTotal = totalValue;
  }
  return result;
}

/** Run a complete fund model from a FundConfig */
export function runFundModel(fund: FundConfig): FundModelResult {
  // Multi-geo mode: run each geography independently and sum results
  const allocations = fund.geography.allocations;
  if (allocations && allocations.length > 1) {
    const geoBreakdown: GeoBreakdownResult[] = [];
    let programBlended: FundYearState[] | null = null;
    let programScenarioResults: ScenarioResult[] = [];
    let totalHomeowners = 0;

    for (const geo of allocations.slice(0, 20)) { // Cap at 20 geos
      const geoRaise = fund.raise.totalRaise * geo.allocationPct;
      const geoScenarios = autoScenariosForGeo(geo, geoRaise);

      const subFund: FundConfig = {
        ...fund,
        geography: {
          state: geo.state,
          county: geo.county,
          label: geo.geoLabel,
        },
        raise: { ...fund.raise, totalRaise: geoRaise },
        scenarios: geoScenarios,
      };

      const subResult = runFundModel(subFund); // Recursive call (single-geo path)
      geoBreakdown.push({
        geo,
        scenarioResults: subResult.scenarioResults,
        blended: subResult.blended,
        totalHomeowners: subResult.totalHomeowners,
      });
      programScenarioResults.push(...subResult.scenarioResults);
      totalHomeowners += subResult.totalHomeowners;

      if (!programBlended) {
        programBlended = subResult.blended.map(yr => ({ ...yr }));
      } else {
        programBlended = sumFundYears(programBlended, subResult.blended);
      }
    }

    return {
      fund,
      scenarioResults: programScenarioResults,
      blended: programBlended || [],
      totalHomeowners,
      totalRaise: fund.raise.totalRaise,
      geoBreakdown,
    };
  }

  // Single-geo path (original logic)
  const maxYears = fund.program.maxHoldYears || 30;
  const scenarioResults: ScenarioResult[] = [];

  for (const scenario of fund.scenarios) {
    // Resolve %AMI/%MHP to dollar values
    const resolved = resolveScenarioValues(fund, scenario);
    const legacy = toLegacyAssumptions(fund, resolved);
    const { cohorts, cohortStates, fundResults } = runScenario(legacy, fund.payoffSchedule, maxYears);
    const affordability = calculateAffordability(legacy);

    scenarioResults.push({
      scenario: resolved,
      cohorts,
      cohortStates,
      fundResults,
      affordability,
    });
  }

  // Blend if multiple scenarios
  let blended: FundYearState[];
  if (scenarioResults.length >= 3) {
    // Use first 3 as LO/MID/HI (by weight order)
    const sorted = [...scenarioResults].sort((a, b) => b.scenario.weight - a.scenario.weight);
    const midIdx = 0;  // highest weight
    const others = sorted.slice(1);
    blended = blendScenarios(
      others[0]?.fundResults || sorted[0].fundResults,
      sorted[midIdx].fundResults,
      others[1]?.fundResults || sorted[0].fundResults,
      {
        lo: others[0]?.scenario.weight || 0,
        mid: sorted[midIdx].scenario.weight,
        hi: others[1]?.scenario.weight || 0,
      }
    );
  } else if (scenarioResults.length === 1) {
    blended = scenarioResults[0].fundResults;
  } else {
    // 2 scenarios — equal blend
    blended = blendScenarios(
      scenarioResults[0].fundResults,
      scenarioResults[1].fundResults,
      scenarioResults[0].fundResults, // duplicate first as placeholder
      { lo: scenarioResults[0].scenario.weight, mid: scenarioResults[1].scenario.weight, hi: 0 }
    );
  }

  const totalHomeowners = scenarioResults.reduce(
    (sum, sr) => sum + sr.cohorts.reduce((s, c) => s + c.homeownerCount, 0), 0
  );

  return {
    fund,
    scenarioResults,
    blended,
    totalHomeowners,
    totalRaise: fund.raise.totalRaise,
  };
}

/** Build a FundConfig from partial inputs (fills defaults) */
export function buildFundConfig(partial: Partial<FundConfig> & { name: string }): FundConfig {
  const defaults = {
    geography: { label: 'Custom' },
    raise: {
      totalRaise: 10_000_000,
      annualContributionPct: 0,
      reinvestNetProceeds: false,
      baseYear: new Date().getFullYear(),
    },
    fees: { programFeePct: 0.05, managementFeePct: 0.005 },
    assumptions: { hpaPct: 0.05, interestRate: 0.07 },
    program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30, loanMax: undefined, purchaseMax: undefined, incomeMax: undefined },
  };

  return {
    name: partial.name,
    geography: { ...defaults.geography, ...partial.geography } as any,
    raise: { ...defaults.raise, ...partial.raise },
    fees: { ...defaults.fees, ...partial.fees },
    assumptions: { ...defaults.assumptions, ...partial.assumptions },
    program: { ...defaults.program, ...partial.program },
    payoffSchedule: partial.payoffSchedule?.length ? partial.payoffSchedule : DEFAULT_PAYOFF_SCHEDULE,
    scenarios: partial.scenarios || [{
      name: 'BASE',
      weight: 1.0,
      raiseAllocation: (partial.raise?.totalRaise || defaults.raise.totalRaise),
      medianIncome: 98_000,
      medianHomeValue: 440_000,
    }],
  } as FundConfig;
}
