/** Per-cohort 30-year waterfall projection */
import { Cohort, CohortYearState, PayoffEntry, ScenarioAssumptions } from './types';
import { calculateMonthlyPayment } from './affordability';

const BASE_YEAR = 2025;

/** Generate cohorts for a scenario (all enter Year 1) */
export function generateCohorts(a: ScenarioAssumptions): Cohort[] {
  const homiumPrincipal = a.medianHomeValue * a.homiumSAPct;
  const downPayment = a.medianHomeValue * a.downPaymentPct;
  const mortgagePrincipal = a.medianHomeValue - downPayment - homiumPrincipal;
  const netRaise = a.initialRaise * (1 - a.programFeePct);
  const homeownerCount = Math.floor(netRaise / homiumPrincipal);

  return [{
    cohortYear: 1,
    homeownerCount,
    homeValue0: a.medianHomeValue,
    mortgagePrincipal0: mortgagePrincipal,
    homiumPrincipal0: homiumPrincipal,
    downPayment,
  }];
}

/** Generate a single cohort from available capital for a specific year */
export function generateCohortForYear(
  cohortYear: number,
  availableCapital: number,
  assumptions: ScenarioAssumptions
): Cohort | null {
  const homiumPrincipal = assumptions.medianHomeValue * assumptions.homiumSAPct;
  const downPayment = assumptions.medianHomeValue * assumptions.downPaymentPct;
  const mortgagePrincipal = assumptions.medianHomeValue - downPayment - homiumPrincipal;
  
  // How many homeowners can we fund with available capital?
  const homeownerCount = Math.floor(availableCapital / homiumPrincipal);
  
  if (homeownerCount === 0) {
    return null;  // Not enough capital for even one homeowner
  }

  return {
    cohortYear,
    homeownerCount,
    homeValue0: assumptions.medianHomeValue,
    mortgagePrincipal0: mortgagePrincipal,
    homiumPrincipal0: homiumPrincipal,
    downPayment,
  };
}

/** Run 30-year waterfall for a single cohort */
export function runCohortWaterfall(
  cohort: Cohort,
  payoffSchedule: PayoffEntry[],
  hpa: number,
  interestRate: number,
  fundMaxYears: number = 30,
  noteTerm: number = 30
): CohortYearState[] {
  const states: CohortYearState[] = [];
  const monthlyRate = interestRate / 12;
  const totalMonths = 30 * 12;
  const monthlyPayment = calculateMonthlyPayment(cohort.mortgagePrincipal0, interestRate, 30);

  let mortgageBalance = cohort.mortgagePrincipal0;
  let cumulativeExits = 0;

  // Calculate how many years this cohort will run (from cohort start to fund end)
  const cohortMaxYears = fundMaxYears - cohort.cohortYear + 1;

  const noteTermYears = noteTerm;
  for (let cohortAge = 1; cohortAge <= Math.min(noteTermYears, cohortMaxYears); cohortAge++) {
    // modelYear = fund year (not cohort age)
    const modelYear = cohort.cohortYear + cohortAge - 1;
    
    // Home value compounds at HPA based on cohort age
    const homeValue = cohort.homeValue0 * Math.pow(1 + hpa, cohortAge);
    // Homium position compounds with home
    const homiumPosition = cohort.homiumPrincipal0 * Math.pow(1 + hpa, cohortAge);

    // Monthly amortization for this year (12 months)
    for (let m = 0; m < 12; m++) {
      if (mortgageBalance <= 0) break;
      const interestPayment = mortgageBalance * monthlyRate;
      const principalPayment = Math.min(monthlyPayment - interestPayment, mortgageBalance);
      mortgageBalance = Math.max(0, mortgageBalance - principalPayment);
    }

    const homeownerEquity = homeValue - mortgageBalance - homiumPosition;
    const ltv = homeValue > 0 ? mortgageBalance / homeValue : 0;
    const cltv = homeValue > 0 ? (mortgageBalance + homiumPosition) / homeValue : 0;

    // Cumulative tracking based on cohort age (use cohortAge for payoff schedule lookup)
    const payoffEntry = payoffSchedule.find(p => p.year === cohortAge);
    let payoffCount: number;

    if (payoffEntry) {
      // Use cumulative % to determine total exits by this year, then subtract what's already exited
      const targetCumulative = Math.round(cohort.homeownerCount * payoffEntry.cumulativePct);
      payoffCount = Math.max(0, targetCumulative - cumulativeExits);
    } else {
      payoffCount = 0;
    }
    // At note term end, force-exit any remaining homeowners (handles rounding)
    if (cohortAge === noteTermYears && cumulativeExits + payoffCount < cohort.homeownerCount) {
      payoffCount = cohort.homeownerCount - cumulativeExits;
    }

    cumulativeExits += payoffCount;
    // Payoff amount = Homium position value at time of exit × number exiting
    const payoffAmount = payoffCount * homiumPosition;

    states.push({
      cohortYear: cohort.cohortYear,
      modelYear,  // Fund year (cohortYear + cohortAge - 1)
      calendarYear: BASE_YEAR + modelYear,
      homeValue,
      mortgageBalance,
      homiumPosition,
      homeownerEquity,
      ltv,
      cltv,
      payoffAmount,
      payoffCount,
    });
  }

  return states;
}
