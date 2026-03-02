/** Blend LO/MID/HI scenarios into a combined view */
import { FundYearState } from './types';

export interface BlendWeights {
  lo: number;
  mid: number;
  hi: number;
}

const DEFAULT_WEIGHTS: BlendWeights = { lo: 0.20, mid: 0.60, hi: 0.20 };

/** Blend scenario fund results using weighted averages for rates, sums for absolutes */
export function blendScenarios(
  loResults: FundYearState[],
  midResults: FundYearState[],
  hiResults: FundYearState[],
  weights: BlendWeights = DEFAULT_WEIGHTS
): FundYearState[] {
  return loResults.map((lo, i) => {
    const mid = midResults[i];
    const hi = hiResults[i];

    return {
      year: lo.year,
      calendarYear: lo.calendarYear,
      // Absolute values: sum across scenarios
      newDonations: lo.newDonations + mid.newDonations + hi.newDonations,
      newContributions: lo.newContributions + mid.newContributions + hi.newContributions,
      reinvestedFunds: lo.reinvestedFunds + mid.reinvestedFunds + hi.reinvestedFunds,
      capitalDeployed: lo.capitalDeployed + mid.capitalDeployed + hi.capitalDeployed,
      programFee: lo.programFee + mid.programFee + hi.programFee,
      managementFee: lo.managementFee + mid.managementFee + hi.managementFee,
      newHomeowners: lo.newHomeowners + mid.newHomeowners + hi.newHomeowners,
      totalHomeownersCum: lo.totalHomeownersCum + mid.totalHomeownersCum + hi.totalHomeownersCum,
      activeHomeowners: lo.activeHomeowners + mid.activeHomeowners + hi.activeHomeowners,
      exitingHomeowners: lo.exitingHomeowners + mid.exitingHomeowners + hi.exitingHomeowners,
      returnedCapital: lo.returnedCapital + mid.returnedCapital + hi.returnedCapital,
      fundBalance: lo.fundBalance + mid.fundBalance + hi.fundBalance,
      totalEquityCreated: lo.totalEquityCreated + mid.totalEquityCreated + hi.totalEquityCreated,
      // Absolute values: sum across scenarios
      outstandingPositionValue: lo.outstandingPositionValue + mid.outstandingPositionValue + hi.outstandingPositionValue,
      fundNAV: lo.fundNAV + mid.fundNAV + hi.fundNAV,
      lpCapitalIn: lo.lpCapitalIn + mid.lpCapitalIn + hi.lpCapitalIn,
      cumulativeDistributions: lo.cumulativeDistributions + mid.cumulativeDistributions + hi.cumulativeDistributions,
      // Weighted averages for rates
      roiAnnual: lo.roiAnnual * weights.lo + mid.roiAnnual * weights.mid + hi.roiAnnual * weights.hi,
      roiCumulative: lo.roiCumulative * weights.lo + mid.roiCumulative * weights.mid + hi.roiCumulative * weights.hi,
    };
  });
}
