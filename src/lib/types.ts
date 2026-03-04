/** Shared types — mirrors verbose-fiesta engine types for frontend use */

export interface GeographyConfig {
  state?: string;
  county?: string;
  zipCodes?: string[];
  label: string;
}

export interface RaiseConfig {
  totalRaise: number;
  annualContributionPct: number;
  reinvestNetProceeds: boolean;
  baseYear: number;
}

export interface FeeConfig {
  programFeePct: number;
  managementFeePct: number;
}

export interface MarketAssumptions {
  hpaPct: number;
  interestRate: number;
  propertyTaxRate?: number;
  insuranceRate?: number;
  wageGrowthPct?: number;
}

export interface ProgramConfig {
  homiumSAPct: number;
  downPaymentPct: number;
  maxFrontRatio: number;
  maxHoldYears: number;
  loanMax?: number;
  purchaseMax?: number;
  incomeMax?: number;
  fixedHomeCount?: number;
}

export interface ScenarioConfig {
  name: string;
  weight: number;
  raiseAllocation: number;
  medianIncome: number;
  medianHomeValue: number;
  pctAMI?: number;
  pctMHP?: number;
}

export interface PayoffEntry {
  year: number;
  annualPct: number;
  cumulativePct: number;
}

export interface FundConfig {
  id?: string;
  name: string;
  geography: GeographyConfig;
  raise: RaiseConfig;
  fees: FeeConfig;
  assumptions: MarketAssumptions;
  program: ProgramConfig;
  payoffSchedule: PayoffEntry[];
  scenarios: ScenarioConfig[];
}

export interface AffordabilityResult {
  mortgagePrincipal: number;
  maxPITI: number;
  pitiBeforeHomium: number;
  pitiAfterHomium: number;
  gapBefore: number;
  gapAfter: number;
  homiumPrincipal: number;
  downPayment: number;
  reducedMortgage: number;
}

export interface FundYearState {
  year: number;
  calendarYear: number;
  newDonations: number;
  newContributions: number;
  reinvestedFunds: number;
  capitalDeployed: number;
  programFee: number;
  managementFee: number;
  newHomeowners: number;
  totalHomeownersCum: number;
  activeHomeowners: number;
  exitingHomeowners: number;
  returnedCapital: number;
  roiAnnual: number;
  roiCumulative: number;
  fundBalance: number;
  totalEquityCreated: number;
  outstandingPositionValue: number;
  fundNAV: number;
  lpCapitalIn: number;
  cumulativeDistributions: number;
}

export interface ScenarioResult {
  scenario: ScenarioConfig;
  cohorts: Array<{
    cohortYear: number;
    homeownerCount: number;
    homeValue0: number;
    mortgagePrincipal0: number;
    homiumPrincipal0: number;
    downPayment: number;
  }>;
  affordability: AffordabilityResult;
  years: FundYearState[];
  assumptions: {
    medianHomeValue: number;
    medianIncome: number;
    raiseAllocation: number;
  };
}

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

export interface FundModelResult {
  fund: FundConfig;
  totalHomeowners: number;
  scenarioResults: ScenarioResult[];
  blended: FundYearState[];
  topOffSchedule?: TopOffYearState[];
}

export interface HousingStateData {
  stateAbbr: string;
  stateName: string;
  zipCount: number;
  avgHomeownership: number;
  avgHomePrice: number;
  avgRent: number;
  avgIncome: number;
  totalPopulation: number;
}

export interface HousingCountyData {
  countyName: string;
  stateAbbr: string;
  population: number;
  medianIncome: number;
  medianHomeValue: number;
  medianRent: number;
  homeownershipRate: number;
}

export interface AffordabilityData {
  geography: string;
  medianIncome: number;
  medianHomeValue: number;
  medianRent: number;
  affordableHomePrice: number;
  downPaymentRequired: number;
  affordabilityGap: number;
  affordability: AffordabilityResult;
  assumptions: {
    interestRate: number;
    maxFrontRatio: number;
    downPaymentPct: number;
    homiumSAPct: number;
  };
}

export interface HousingZipData {
  zipCode: string;
  state: string;
  county: string;
  city: string;
  medianHomeValue: number;
  medianIncome: number;
  homeownershipRate: number;
  population: number;
  medianRent: number;
  medianAge: number;
  vacancyRate: number;
}

/** Wizard state — accumulated across all 4 steps */
export interface WizardState {
  // Step 1: Geography
  fundName: string;
  state: string;
  stateName: string;
  county?: string;
  zip?: string;
  zipCodes?: string[];
  marketLabel: string;
  marketData: {
    medianIncome: number;
    medianHomeValue: number;
    medianRent: number;
    population: number;
  };

  // Step 2: Borrower
  targetAMIPct: number;       // 0.40 – 1.50, default 0.80
  targetHomePricePct: number;  // % of median, default 1.0
  interestRate: number;        // default 0.07
  hpaPct: number;              // default 0.05
  wageGrowthPct: number;       // default 0.03

  // Step 3: Program
  homiumSAPct: number;         // 0.10 – 0.50, default 0.20
  downPaymentPct: number;      // 0.03, 0.05, 0.10
  programFeePct: number;       // default 0.05
  maxHoldYears: number;        // 15, 20, 25, 30

  // Step 4: Fund
  payoffPeakYear: number;      // 5–25, default 12
  payoffConcentration: number; // 0–1, default 0.5
  totalRaise: number;          // 5M, 10M, 25M, 50M, 100M
  customTotalRaise?: number;   // Free-form dollar amount (mutually exclusive with presets/homeCount)
  managementFeePct: number;    // default 0.005
  reinvestProceeds: boolean;
  fixedHomeCount?: number;     // Fixed development size (e.g. 46) for top-off analysis
  scenarios: ScenarioConfig[];
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  fundName: '',
  state: '',
  stateName: '',
  marketLabel: '',
  marketData: { medianIncome: 0, medianHomeValue: 0, medianRent: 0, population: 0 },
  targetAMIPct: 0.80,
  targetHomePricePct: 1.0,
  interestRate: 0.07,
  hpaPct: 0.05,
  wageGrowthPct: 0.03,
  homiumSAPct: 0.20,
  downPaymentPct: 0.03,
  programFeePct: 0.05,
  maxHoldYears: 30,
  payoffPeakYear: 12,
  payoffConcentration: 0.5,
  totalRaise: 25_000_000,
  managementFeePct: 0.005,
  reinvestProceeds: false,
  scenarios: [],
};
