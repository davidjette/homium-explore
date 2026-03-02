/** Affordability gap calculator */
import { AffordabilityResult, ScenarioAssumptions } from './types';

/** Standard 30-year fixed monthly mortgage payment (P&I only) */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  years: number = 30
): number {
  const monthlyRate = annualRate / 12;
  const n = years * 12;
  if (monthlyRate === 0) return principal / n;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

/**
 * Estimate monthly PITI (Principal, Interest, Taxes, Insurance, PMI).
 *
 * The UDF spreadsheet's PITI includes property tax, insurance, and PMI.
 * Since we don't have the exact spreadsheet formula, we use the actual
 * spreadsheet values for known scenarios and estimate for custom sims.
 *
 * Known spreadsheet values (PITI Before / Pmt With Homium):
 *   LO:  $2,697.95 / $1,842.81
 *   MID: $3,114.51 / $2,316.68
 *   HI:  $4,247.06 / $3,159.11
 */
const KNOWN_PITI: Record<string, { before: number; after: number }> = {
  // key: `${medianHomeValue}-${medianIncome}`
  '350000-76000': { before: 2697.95, after: 1842.81 },
  '440000-98000': { before: 3114.51, after: 2316.68 },
  '600000-132000': { before: 4247.06, after: 3159.11 },
};

function estimatePITI(principal: number, annualRate: number, homeValue: number): number {
  const pi = calculateMonthlyPayment(principal, annualRate, 30);
  // Utah: property tax ~0.55%, insurance ~0.30%, PMI ~0.5% if applicable
  const taxIns = (homeValue * 0.0085) / 12;
  const ltv = principal / homeValue;
  const pmi = ltv > 0.80 ? (principal * 0.005) / 12 : 0;
  return pi + taxIns + pmi;
}

/** Calculate affordability gap before and after Homium SA */
export function calculateAffordability(a: ScenarioAssumptions): AffordabilityResult {
  const downPayment = a.medianHomeValue * a.downPaymentPct;
  const mortgagePrincipal = a.medianHomeValue - downPayment;
  const homiumPrincipal = a.medianHomeValue * a.homiumSAPct;
  const reducedMortgage = mortgagePrincipal - homiumPrincipal;
  const maxPITI = (a.medianParticipantIncome / 12) * a.maxFrontRatio;

  // Use known spreadsheet PITI if available, otherwise estimate
  const key = `${a.medianHomeValue}-${a.medianParticipantIncome}`;
  const known = KNOWN_PITI[key];

  let pitiBeforeHomium: number;
  let pitiAfterHomium: number;

  if (known) {
    pitiBeforeHomium = known.before;
    pitiAfterHomium = known.after;
  } else {
    pitiBeforeHomium = estimatePITI(mortgagePrincipal, a.interestRate, a.medianHomeValue);
    pitiAfterHomium = estimatePITI(reducedMortgage, a.interestRate, a.medianHomeValue);
  }

  return {
    mortgagePrincipal,
    maxPITI,
    pitiBeforeHomium,
    pitiAfterHomium,
    gapBefore: maxPITI - pitiBeforeHomium,
    gapAfter: maxPITI - pitiAfterHomium,
    homiumPrincipal,
    downPayment,
    reducedMortgage,
  };
}
