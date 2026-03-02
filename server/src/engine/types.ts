/**
 * Homium Fund Model — Core Types
 * 
 * GENERIC: No fund-specific hardcoding. Any Homium fund is modelable
 * with tunable assumptions and outputs.
 */

// ── Fund Configuration (top-level, defines an entire fund) ──

export interface FundConfig {
  id?: string;                    // UUID, assigned by DB
  name: string;                   // e.g. "Utah Dream Fund", "Arizona Opportunity Fund"
  geography: GeographyConfig;
  raise: RaiseConfig;
  fees: FeeConfig;
  assumptions: MarketAssumptions;
  program: ProgramConfig;
  payoffSchedule: PayoffEntry[];  // 1–30 year schedule
  scenarios: ScenarioConfig[];    // LO/MID/HI or custom
  createdAt?: string;
  updatedAt?: string;
}

export interface GeographyConfig {
  state?: string;                 // e.g. "UT", "AZ"
  county?: string;
  zipCodes?: string[];            // Specific ZIPs to target
  label: string;                  // Human-readable: "Salt Lake Metro", "Phoenix MSA"
}

export interface RaiseConfig {
  totalRaise: number;             // Total fund raise amount
  annualContributionPct: number;  // Annual additional contributions (0 = one-time)
  reinvestNetProceeds: boolean;   // Reinvest returned capital?
  baseYear: number;               // Model start year (e.g. 2025)
}

export interface FeeConfig {
  programFeePct: number;          // One-time program fee (e.g. 0.05)
  managementFeePct: number;       // Annual management fee (e.g. 0.005)
}

export interface MarketAssumptions {
  hpaPct: number;                 // Home Price Appreciation (e.g. 0.05)
  interestRate: number;           // Mortgage interest rate (e.g. 0.07)
  propertyTaxRate?: number;       // Override for property tax (default varies by state)
  insuranceRate?: number;         // Override for insurance rate
}

export interface ProgramConfig {
  homiumSAPct: number;            // Shared Appreciation % (e.g. 0.25)
  downPaymentPct: number;         // Down payment % (e.g. 0.03)
  maxFrontRatio: number;          // Max front-end DTI ratio (e.g. 0.30)
  maxHoldYears: number;           // Model projection horizon (default 30)
  loanMax?: number;               // Program limit: max loan amount
  purchaseMax?: number;           // Program limit: max purchase price
  incomeMax?: number;             // Program limit: max qualifying income
}

export interface ScenarioConfig {
  name: string;                   // "LO", "MID", "HI", or custom names
  weight: number;                 // Blending weight (should sum to 1.0)
  raiseAllocation: number;        // How much of totalRaise goes to this scenario
  medianIncome: number;           // Target participant median income
  medianHomeValue: number;        // Target geography median home value
  pctAMI?: number;               // % of AMI (e.g. 0.69 = 69%). If set, medianIncome = pctAMI × incomeMax
  pctMHP?: number;               // % of median home price (e.g. 0.80). If set, medianHomeValue = pctMHP × purchaseMax
  geoState?: string;             // Per-scenario geography override (state)
  geoCounty?: string;            // Per-scenario geography override (county)
  geoZip?: string;               // Per-scenario geography override (ZIP)
}

// ── Payoff Schedule ──

export interface PayoffEntry {
  year: number;       // 1–30
  annualPct: number;
  cumulativePct: number;
}

// ── Computation Results ──

export interface Cohort {
  cohortYear: number;
  homeownerCount: number;
  homeValue0: number;
  mortgagePrincipal0: number;
  homiumPrincipal0: number;
  downPayment: number;
}

export interface CohortYearState {
  cohortYear: number;
  modelYear: number;
  calendarYear: number;
  homeValue: number;
  mortgageBalance: number;
  homiumPosition: number;
  homeownerEquity: number;
  ltv: number;
  cltv: number;
  payoffAmount: number;
  payoffCount: number;
}

export interface FundYearState {
  year: number;
  calendarYear: number;
  newDonations: number;
  newContributions: number;      // Annual contributions from raise.annualContributionPct
  reinvestedFunds: number;        // Returned capital reinvested this year
  capitalDeployed: number;        // Total capital deployed to new homeowners this year
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
  outstandingPositionValue: number; // Mark-to-market value of all active Homium positions
  fundNAV: number;                  // Fund NAV = fundBalance (cash) + outstandingPositionValue
  lpCapitalIn: number;              // Cumulative LP capital invested (raise + contributions)
  cumulativeDistributions: number;  // Cumulative capital distributed to LPs
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

export interface ShareConversionResult {
  fundsRaised: number;
  conversionPrice: number;
  programFeePct: number;
  classASharePrice: number;
  classASharesIssued: number;
  loanAmount: number;
  classHUnitsIssued: number;
  investorPnL: number;
  portfolioClassHUnits: number;
  portfolioInvestorPnL: number;
  pricePerShare?: number;    // Price per Class A share (for reports)
  netToDeploy?: number;      // Net capital after share issuance (for reports)
}

export interface ImpactMetrics {
  scenario: string;
  timeframeYears: number;
  totalHomesPurchased: number;
  totalHomeownersCreated: number;
  totalEquityCreated: number;
  privateCapitalLeverage: number;
  affordabilityGapBefore: number;
  affordabilityGapAfter: number;
}

export interface ScenarioResult {
  scenario: ScenarioConfig;
  cohorts: Cohort[];
  cohortStates: CohortYearState[];
  fundResults: FundYearState[];
  affordability: AffordabilityResult;
}

export interface FundModelResult {
  fund: FundConfig;
  scenarioResults: ScenarioResult[];
  blended: FundYearState[];
  totalHomeowners: number;
  totalRaise: number;
}

// ── Legacy compatibility (maps ScenarioConfig → old ScenarioAssumptions) ──

export interface ScenarioAssumptions {
  name: string;
  weight: number;
  initialRaise: number;
  annualContributionPct: number;
  programFeePct: number;
  managementFeePct: number;
  reinvestNetProceeds: boolean;
  utahHPA: number;
  interestRate: number;
  medianParticipantIncome: number;
  medianHomeValue: number;
  downPaymentPct: number;
  homiumSAPct: number;
  maxFrontRatio: number;
}

/** Convert new FundConfig + ScenarioConfig → legacy ScenarioAssumptions */
export function toLegacyAssumptions(fund: FundConfig, scenario: ScenarioConfig): ScenarioAssumptions {
  return {
    name: scenario.name,
    weight: scenario.weight,
    initialRaise: scenario.raiseAllocation,
    annualContributionPct: fund.raise.annualContributionPct,
    programFeePct: fund.fees.programFeePct,
    managementFeePct: fund.fees.managementFeePct,
    reinvestNetProceeds: fund.raise.reinvestNetProceeds,
    utahHPA: fund.assumptions.hpaPct,
    interestRate: fund.assumptions.interestRate,
    medianParticipantIncome: scenario.medianIncome,
    medianHomeValue: scenario.medianHomeValue,
    downPaymentPct: fund.program.downPaymentPct,
    homiumSAPct: fund.program.homiumSAPct,
    maxFrontRatio: fund.program.maxFrontRatio,
  };
}

// ── Default Payoff Schedule ──

export const DEFAULT_PAYOFF_SCHEDULE: PayoffEntry[] = [
  { year: 1,  annualPct: 0.0100, cumulativePct: 0.0100 },
  { year: 2,  annualPct: 0.0100, cumulativePct: 0.0200 },
  { year: 3,  annualPct: 0.0150, cumulativePct: 0.0350 },
  { year: 4,  annualPct: 0.0200, cumulativePct: 0.0550 },
  { year: 5,  annualPct: 0.0250, cumulativePct: 0.0800 },
  { year: 6,  annualPct: 0.0300, cumulativePct: 0.1100 },
  { year: 7,  annualPct: 0.0375, cumulativePct: 0.1475 },
  { year: 8,  annualPct: 0.0425, cumulativePct: 0.1900 },
  { year: 9,  annualPct: 0.0600, cumulativePct: 0.2500 },
  { year: 10, annualPct: 0.0900, cumulativePct: 0.3400 },
  { year: 11, annualPct: 0.0950, cumulativePct: 0.4350 },
  { year: 12, annualPct: 0.1000, cumulativePct: 0.5350 },
  { year: 13, annualPct: 0.0900, cumulativePct: 0.6250 },
  { year: 14, annualPct: 0.0500, cumulativePct: 0.6750 },
  { year: 15, annualPct: 0.0400, cumulativePct: 0.7150 },
  { year: 16, annualPct: 0.0350, cumulativePct: 0.7500 },
  { year: 17, annualPct: 0.0300, cumulativePct: 0.7800 },
  { year: 18, annualPct: 0.0300, cumulativePct: 0.8100 },
  { year: 19, annualPct: 0.0275, cumulativePct: 0.8375 },
  { year: 20, annualPct: 0.0250, cumulativePct: 0.8625 },
  { year: 21, annualPct: 0.0250, cumulativePct: 0.8875 },
  { year: 22, annualPct: 0.0225, cumulativePct: 0.9100 },
  { year: 23, annualPct: 0.0200, cumulativePct: 0.9300 },
  { year: 24, annualPct: 0.0175, cumulativePct: 0.9475 },
  { year: 25, annualPct: 0.0150, cumulativePct: 0.9625 },
  { year: 26, annualPct: 0.0125, cumulativePct: 0.9750 },
  { year: 27, annualPct: 0.0100, cumulativePct: 0.9850 },
  { year: 28, annualPct: 0.0075, cumulativePct: 0.9925 },
  { year: 29, annualPct: 0.0050, cumulativePct: 0.9975 },
  { year: 30, annualPct: 0.0025, cumulativePct: 1.0000 },
];

// ── UDF Default Fund Config (preserves backward compatibility) ──

export const UDF_FUND_CONFIG: FundConfig = {
  name: 'Utah Dream Fund',
  geography: { state: 'UT', label: 'Utah' },
  raise: {
    totalRaise: 10_000_000,
    annualContributionPct: 0,
    reinvestNetProceeds: false,
    baseYear: 2025,
  },
  fees: { programFeePct: 0.05, managementFeePct: 0.005 },
  assumptions: { hpaPct: 0.05, interestRate: 0.07 },
  program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30 },
  payoffSchedule: DEFAULT_PAYOFF_SCHEDULE,
  scenarios: [
    { name: 'LO',  weight: 0.20, raiseAllocation: 2_000_000, medianIncome: 76_000, medianHomeValue: 350_000 },
    { name: 'MID', weight: 0.60, raiseAllocation: 6_000_000, medianIncome: 98_000, medianHomeValue: 440_000 },
    { name: 'HI',  weight: 0.20, raiseAllocation: 2_000_000, medianIncome: 132_000, medianHomeValue: 600_000 },
  ],
};

// Legacy compat exports
export const PAYOFF_SCHEDULE = DEFAULT_PAYOFF_SCHEDULE;

export const DEFAULT_SCENARIOS: Record<string, ScenarioAssumptions> = Object.fromEntries(
  UDF_FUND_CONFIG.scenarios.map(s => [
    s.name,
    toLegacyAssumptions(UDF_FUND_CONFIG, s),
  ])
);

// Also export MODEL scenario for backward compat
DEFAULT_SCENARIOS['MODEL'] = {
  name: 'MODEL', weight: 1.0, initialRaise: 20_000_000,
  annualContributionPct: 0, programFeePct: 0.05, managementFeePct: 0.005,
  reinvestNetProceeds: false, utahHPA: 0.05, interestRate: 0.07,
  medianParticipantIncome: 98_000, medianHomeValue: 440_000,
  downPaymentPct: 0.03, homiumSAPct: 0.25, maxFrontRatio: 0.30,
};
