/**
 * Top-Off Sensitivity Calculator
 *
 * Post-processing overlay: calculates additional capital needed when HPA
 * outpaces wage growth in a fixed-home development. Runs after the core
 * waterfall engine — no engine changes required.
 */

import { FundConfig } from './types';
import { calculateMonthlyPayment } from './affordability';

export interface TopOffYearState {
  year: number;
  calendarYear: number;
  homeValue: number;
  income80AMI: number;
  maxAffordableMortgage: number;
  samRequired: number;
  samBaseline: number;
  recycledPerHome: number;
  topOffPerHome: number;
  exitsThisYear: number;
  annualTopOff: number;
  cumulativeTopOff: number;
}

/** Reverse-solve: given max monthly P&I, what principal can the borrower afford? */
function maxPrincipalFromPayment(maxMonthlyPI: number, annualRate: number, years: number = 30): number {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return maxMonthlyPI * n;
  return maxMonthlyPI * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
}

export function calculateTopOffSchedule(
  fund: FundConfig,
  wageGrowthPct: number,
  fixedHomeCount: number,
): TopOffYearState[] {
  const hpa = fund.assumptions.hpaPct;
  const rate = fund.assumptions.interestRate;
  const downPct = fund.program.downPaymentPct;
  const samPct = fund.program.homiumSAPct;
  const maxFrontRatio = fund.program.maxFrontRatio;
  const baseYear = fund.raise.baseYear;

  // Use MID scenario as baseline, fall back to first scenario
  const midScenario = fund.scenarios.find(s => s.name === 'MID') || fund.scenarios[0];
  const baseHomeValue = midScenario.medianHomeValue;
  const baseIncome = midScenario.medianIncome;
  const baseSAM = baseHomeValue * samPct;

  const schedule: TopOffYearState[] = [];
  let cumulativeTopOff = 0;

  const maxYears = fund.program.maxHoldYears || 30;
  for (let year = 1; year <= maxYears; year++) {
    const homeValue = baseHomeValue * Math.pow(1 + hpa, year);
    const income = baseIncome * Math.pow(1 + wageGrowthPct, year);

    // Max affordable PITI for the replacement buyer
    const maxPITI = (income / 12) * maxFrontRatio;

    // Subtract taxes & insurance to get max P&I budget
    const taxIns = (homeValue * 0.0085) / 12;
    const maxPI = Math.max(0, maxPITI - taxIns);

    // Reverse-solve for max affordable mortgage principal
    const maxMortgage = maxPrincipalFromPayment(maxPI, rate);

    // SAM needed for the replacement buyer at year N prices
    const downPayment = homeValue * downPct;
    const samRequired = Math.max(0, homeValue - downPayment - maxMortgage);

    // Baseline: SAM at same % of (now-appreciated) home value
    const samBaseline = homeValue * samPct;

    // Recycled capital: what fund gets back from the exiting home
    const recycledPerHome = baseSAM * Math.pow(1 + hpa, year);

    // Top-off = shortfall per replacement home
    const topOffPerHome = Math.max(0, samRequired - recycledPerHome);

    // Exits from payoff schedule applied to fixed home count
    const payoffEntry = fund.payoffSchedule.find(p => p.year === year);
    const exitsThisYear = payoffEntry
      ? Math.round(fixedHomeCount * payoffEntry.annualPct)
      : 0;

    const annualTopOff = topOffPerHome * exitsThisYear;
    cumulativeTopOff += annualTopOff;

    schedule.push({
      year,
      calendarYear: baseYear + year,
      homeValue,
      income80AMI: income,
      maxAffordableMortgage: maxMortgage,
      samRequired,
      samBaseline,
      recycledPerHome,
      topOffPerHome,
      exitsThisYear,
      annualTopOff,
      cumulativeTopOff,
    });
  }

  return schedule;
}
