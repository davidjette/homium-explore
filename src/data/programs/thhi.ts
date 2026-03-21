/**
 * Tobias Harris Homeownership Initiative (THHI) — Anonymized Portfolio Data
 *
 * Source: portfolio_03_18_2026 thhi.csv
 * Location: finops-workspace/Loans - TH Tobias Harris Homeownership Initiative/
 * Extracted: 2026-03-20
 *
 * Anonymization: Exact addresses removed. City, county, state retained.
 * All financial figures are original from source CSV.
 */
import type { SAMLoan, ProgramMeta, THHIBorrowerProfile } from './types'

export const THHI_META: ProgramMeta = {
  id: 'thhi',
  name: 'THHI Detroit',
  fullName: 'Tobias Harris Homeownership Initiative',
  productType: 'Purchase',
  location: 'Detroit, MI',
  state: 'MI',
  partner: 'MSHDA · Tobias Harris',
  sponsors: ['MSHDA', 'Tobias Harris', 'Guild Mortgage'],
  capitalRaised: 3_500_000,
  description:
    'A new path to homeownership for Detroit — no monthly payments, just a fair, sustainable way for families to build equity and stay rooted in their communities. The THHI uses a 1:1 Shared Appreciation Mortgage across nine priority neighborhoods, with program criteria aligned to MSHDA\'s MI Home Loan guidelines. It serves essential workers: teachers, healthcare workers, public safety, and government employees.',
  impactHighlight:
    'Focused on nine Detroit neighborhoods with documented equity gaps, serving essential workers earning $45,000+ and building generational wealth in historically underserved communities.',
  website: 'https://thhidetroit.com',
}

/**
 * Source: portfolio_03_18_2026 thhi.csv — 7 loans
 * Originated 11-2025 to 02-2026
 * All in Wayne County, MI (Detroit)
 *
 * Note: Loans 74-76 have HPI tracking data (originated 11-12/2025).
 * Loans 85-111 are too recent for HPI snapshots.
 */
export const THHI_LOANS: SAMLoan[] = [
  {
    id: 'THHI-001',
    sourceId: 111,
    city: 'Detroit',
    county: 'Wayne',
    state: 'MI',
    purchasePrice: 135000,
    loanAmount: 54000,
    originationMonth: '02-2026',
    disbursementDate: '2026-02-11',
    hpiInitial: null,
    hpiCurrent: null,
    allTimeChangePct: null,
    previewFMV: null,
    previewMortgageBalance: null,
    previewLTV: null,
    previewCLTV: null,
    previewCollateral: null,
  },
  {
    id: 'THHI-002',
    sourceId: 92,
    city: 'Detroit',
    county: 'Wayne',
    state: 'MI',
    purchasePrice: 200000,
    loanAmount: 75000,
    originationMonth: '02-2026',
    disbursementDate: '2026-02-10',
    hpiInitial: null,
    hpiCurrent: null,
    allTimeChangePct: null,
    previewFMV: null,
    previewMortgageBalance: null,
    previewLTV: null,
    previewCLTV: null,
    previewCollateral: null,
  },
  {
    id: 'THHI-003',
    sourceId: 85,
    city: 'Detroit',
    county: 'Wayne',
    state: 'MI',
    purchasePrice: 0, // Price not recorded in CSV
    loanAmount: 66000,
    originationMonth: '02-2026',
    disbursementDate: '2026-02-23',
    hpiInitial: null,
    hpiCurrent: null,
    allTimeChangePct: null,
    previewFMV: null,
    previewMortgageBalance: null,
    previewLTV: null,
    previewCLTV: null,
    previewCollateral: null,
  },
  {
    // Earliest THHI loans with HPI tracking data
    id: 'THHI-004',
    sourceId: 76,
    city: 'Detroit',
    county: 'Wayne',
    state: 'MI',
    purchasePrice: 164500,
    loanAmount: 65800,
    originationMonth: '11-2025',
    disbursementDate: '2025-11-26',
    hpiInitial: 327.15,
    hpiCurrent: 327.15,
    allTimeChangePct: 0.0,
    previewFMV: 164570.43,
    previewMortgageBalance: 93765,
    previewLTV: 40.0,
    previewCLTV: 96.98,
    previewCollateral: 4977.26,
  },
  {
    id: 'THHI-005',
    sourceId: 75,
    city: 'Detroit',
    county: 'Wayne',
    state: 'MI',
    purchasePrice: 186000,
    loanAmount: 74400,
    originationMonth: '12-2025',
    disbursementDate: '2025-12-03',
    hpiInitial: 327.15,
    hpiCurrent: 327.15,
    allTimeChangePct: 0.0,
    previewFMV: 186000,
    previewMortgageBalance: 70625,
    previewLTV: 40.0,
    previewCLTV: 77.98,
    previewCollateral: 40975,
  },
  {
    id: 'THHI-006',
    sourceId: 74,
    city: 'Detroit',
    county: 'Wayne',
    state: 'MI',
    purchasePrice: 190000,
    loanAmount: 75000,
    originationMonth: '12-2025',
    disbursementDate: '2025-12-12',
    hpiInitial: null,
    hpiCurrent: null,
    allTimeChangePct: null,
    previewFMV: 190000,
    previewMortgageBalance: 109300,
    previewLTV: 39.48,
    previewCLTV: 97.0,
    previewCollateral: 5700,
  },
  {
    id: 'THHI-007',
    sourceId: 71,
    city: 'Detroit',
    county: 'Wayne',
    state: 'MI',
    purchasePrice: 126000,
    loanAmount: 50400,
    originationMonth: '11-2025',
    disbursementDate: '2025-11-17',
    hpiInitial: 327.15,
    hpiCurrent: 327.15,
    allTimeChangePct: 0.0,
    previewFMV: 126053.95,
    previewMortgageBalance: 71820,
    previewLTV: 40.0,
    previewCLTV: 96.98,
    previewCollateral: 3812.38,
  },
]

/**
 * THHI Borrower Profiles — from THHI Borrower Profiles_3.20.pdf
 *
 * Aggregate stats from same PDF:
 * - Avg Home Sales Price: $170,625
 * - Avg AMI: 57% ($51,951/yr)
 * - Avg FICO: 702
 * - Avg First Lien Rate: 6.21%
 * - Avg First Lien LTV: 53%
 * - Avg Monthly Income: $4,329
 * - Avg Front Ratio: 15%
 * - Avg Back Ratio: 32%
 * - Avg Monthly PITI + Maintenance: $948
 */
export const THHI_AGGREGATE = {
  source: 'THHI Borrower Profiles_3.20.pdf',
  avgHomePrice: 170625,
  avgAMI: 0.57,
  avgFICO: 702,
  avgFirstLienRate: 0.0621,
  avgFirstLienLTV: 0.53,
  avgMonthlyIncome: 4329,
  avgFrontRatio: 0.15,
  avgBackRatio: 0.32,
  avgMonthlyPITI: 948,
} as const

export const THHI_PROFILES: THHIBorrowerProfile[] = [
  { occupation: 'Community Health Worker', amiPct: 0.50, priorRent: 819, newPITI: 781, maintenance: 107, totalMonthly: 887, savingsPct: -0.08 },
  { occupation: 'Retired', amiPct: 0.30, priorRent: 1200, newPITI: 722, maintenance: 155, totalMonthly: 877, savingsPct: 0.27 },
  { occupation: 'Truck Driver', amiPct: 0.80, priorRent: 1200, newPITI: 938, maintenance: 138, totalMonthly: 1076, savingsPct: 0.10 },
  { occupation: 'EMT', amiPct: 0.60, priorRent: 1200, newPITI: 897, maintenance: 158, totalMonthly: 1055, savingsPct: 0.12 },
  { occupation: 'Event Manager', amiPct: 0.60, priorRent: 900, newPITI: 772, maintenance: 112, totalMonthly: 885, savingsPct: 0.02 },
  { occupation: 'Facilities Employee', amiPct: 0.55, priorRent: 1030, newPITI: 768, maintenance: 137, totalMonthly: 905, savingsPct: 0.12 },
  { occupation: 'Special Ed Teacher', amiPct: 0.80, priorRent: 785, newPITI: 712, maintenance: 166, totalMonthly: 878, savingsPct: -0.12 },
  { occupation: 'Disability Worker', amiPct: 0.50, priorRent: 2000, newPITI: 602, maintenance: 150, totalMonthly: 752, savingsPct: 0.62 },
]
