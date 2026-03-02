/** Fund-level aggregation of cohort waterfalls */
import { ScenarioAssumptions, PayoffEntry, FundYearState, Cohort, CohortYearState } from './types';
import { generateCohorts, generateCohortForYear, runCohortWaterfall } from './cohort-waterfall';

const BASE_YEAR = 2025;

/** Run a full scenario: generate cohorts, run waterfalls, aggregate fund-level results */
export function runScenario(
  assumptions: ScenarioAssumptions,
  payoffSchedule: PayoffEntry[],
  maxYears: number = 30
): { cohorts: Cohort[]; cohortStates: CohortYearState[]; fundResults: FundYearState[] } {
  const cohorts: Cohort[] = [];
  const allCohortStates: CohortYearState[] = [];
  const fundResults: FundYearState[] = [];

  // Track capital deployed and returned
  let totalDeployed = 0;
  let totalReturned = 0;
  let totalHomeowners = 0;
  let lpCapitalIn = assumptions.initialRaise; // LP has invested the initial raise
  let prevNAV = assumptions.initialRaise;     // Starting NAV = initial raise
  let cumulativeDistributions = 0;            // Capital distributed to LPs (not reinvested)

  // Initialize fund with year 1 raise
  const programFee = assumptions.initialRaise * assumptions.programFeePct;
  let availableCapital = assumptions.initialRaise - programFee;

  for (let yr = 1; yr <= maxYears; yr++) {
    // 1. Add annual contributions (beginning of year)
    const newContributions = yr > 1 ? assumptions.initialRaise * assumptions.annualContributionPct : 0;
    availableCapital += newContributions;
    lpCapitalIn += newContributions;

    // 2. Deploy available capital to new homeowners (beginning of year)
    let capitalDeployed = 0;
    let newHomeowners = 0;

    if (availableCapital > 0) {
      const newCohort = generateCohortForYear(yr, availableCapital, assumptions);
      if (newCohort) {
        cohorts.push(newCohort);
        capitalDeployed = newCohort.homeownerCount * newCohort.homiumPrincipal0;
        newHomeowners = newCohort.homeownerCount;
        totalHomeowners += newHomeowners;
        totalDeployed += capitalDeployed;
        availableCapital -= capitalDeployed;

        // Generate waterfall for this cohort (starting from its cohort year)
        const states = runCohortWaterfall(newCohort, payoffSchedule, assumptions.utahHPA, assumptions.interestRate, maxYears);
        allCohortStates.push(...states);
      }
    }

    // 3. Collect returned capital from ALL cohorts this year (end of year)
    // Queried AFTER deployment so newly created cohort's year-1 exits are captured
    const yearStates = allCohortStates.filter(s => s.modelYear === yr);
    const returnedCapital = yearStates.reduce((sum, s) => sum + s.payoffAmount, 0);
    totalReturned += returnedCapital;

    // 4. Reinvest or distribute returned capital
    const reinvestedFunds = assumptions.reinvestNetProceeds ? returnedCapital : 0;
    const distributions = returnedCapital - reinvestedFunds; // Distributed to LPs
    cumulativeDistributions += distributions;
    availableCapital += reinvestedFunds;

    // 5. Calculate exits and active homeowners
    const exitingHomeowners = yearStates.reduce((sum, s) => sum + s.payoffCount, 0);
    const cumulativeExited = allCohortStates
      .filter(s => s.modelYear <= yr)
      .reduce((sum, s) => sum + s.payoffCount, 0);
    const activeHomeowners = totalHomeowners - cumulativeExited;

    // 6. Deduct management fee from fund balance (end of year)
    const managementFee = availableCapital * assumptions.managementFeePct;
    availableCapital -= managementFee;

    // 7. Compute outstanding Homium position value (mark-to-market)
    // For each cohort, remaining homeowners × current position value
    let outstandingPositionValue = 0;
    for (const cohort of cohorts) {
      const cohortState = yearStates.find(s => s.cohortYear === cohort.cohortYear);
      if (!cohortState) continue;
      const cohortExited = allCohortStates
        .filter(s => s.cohortYear === cohort.cohortYear && s.modelYear <= yr)
        .reduce((sum, s) => sum + s.payoffCount, 0);
      const remaining = cohort.homeownerCount - cohortExited;
      outstandingPositionValue += remaining * cohortState.homiumPosition;
    }

    // 8. Fund NAV = cash balance + outstanding position value
    const fundNAV = availableCapital + outstandingPositionValue;

    // 9. Calculate ROI based on total value to LP (TVPI - 1)
    // Total Value = cumulative distributions + current NAV (cash + positions)
    const totalValue = cumulativeDistributions + fundNAV;
    const roiCumulative = lpCapitalIn > 0 ? (totalValue - lpCapitalIn) / lpCapitalIn : 0;
    const prevTotalValue = prevNAV; // Previous period's total value baseline
    const roiAnnual = prevTotalValue > 0 ? (totalValue - prevTotalValue) / prevTotalValue : 0;
    prevNAV = totalValue;

    // 10. Calculate total equity created (all cohorts this year)
    const totalEquityCreated = allCohortStates
      .filter(s => s.modelYear === yr)
      .reduce((sum, s) => {
        const cohort = cohorts.find(c => c.cohortYear === s.cohortYear);
        if (!cohort) return sum;
        const appreciationPerHome = s.homeValue - cohort.homeValue0;
        return sum + (appreciationPerHome * cohort.homeownerCount);
      }, 0);

    fundResults.push({
      year: yr,
      calendarYear: BASE_YEAR + yr,
      newDonations: yr === 1 ? assumptions.initialRaise : 0,
      newContributions,
      reinvestedFunds,
      capitalDeployed,
      programFee: yr === 1 ? -programFee : 0,
      managementFee: -managementFee,
      newHomeowners,
      totalHomeownersCum: totalHomeowners,
      activeHomeowners,
      exitingHomeowners,
      returnedCapital,
      roiAnnual,
      roiCumulative,
      fundBalance: availableCapital,
      totalEquityCreated,
      outstandingPositionValue,
      fundNAV,
      lpCapitalIn,
      cumulativeDistributions,
    });
  }

  return { cohorts, cohortStates: allCohortStates, fundResults };
}
