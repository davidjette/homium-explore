/**
 * Generic Fund Model Runner
 * 
 * Takes a FundConfig, runs all scenarios, blends results.
 * No fund-specific hardcoding — everything is configurable.
 */
import {
  FundConfig, FundModelResult, ScenarioResult, ScenarioConfig,
  FundYearState, toLegacyAssumptions, DEFAULT_PAYOFF_SCHEDULE,
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

/** Run a complete fund model from a FundConfig */
export function runFundModel(fund: FundConfig): FundModelResult {
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
