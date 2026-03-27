/**
 * Colorado Pilot / HAL (Homium Affordable Lending) — Anonymized Portfolio Data
 *
 * Source: finops-workspace/loan-manifest-v2.xlsx (sheet "Colorado Portfolio (HAL)")
 * Income: ATR Worksheets in Originations/2024 Refinance/Colorado Pilot/
 * Aggregate stats: Homium Colorado Pilot Results - 2024.pdf
 * Extracted: 2026-03-20
 *
 * Anonymization: Borrower names and exact addresses removed.
 * City, county, state, and all financial figures are original from source.
 *
 * Income notes:
 * - Monthly income extracted from each borrower's ATR Worksheet, multiplied by 12
 * - Income bracket categories match the Pilot Results PDF pie chart
 * - Aggregate AMI stats (84% avg, 50% <80%) are from the Pilot Results PDF
 */
import type { HALLoan, ProgramMeta, HALNAVStats } from './types'

export const HAL_META: ProgramMeta = {
  id: 'hal',
  name: 'Colorado Pilot',
  fullName: 'Homium Equity Unlock — Colorado Pilot',
  productType: 'Shared Appreciation Note',
  location: 'Colorado',
  state: 'CO',
  partner: null,
  sponsors: null,
  capitalRaised: null,
  description:
    'The Colorado Pilot offered 2nd position shared appreciation notes (SANs) to existing homeowners at up to 80% CLTV, helping families access their home equity for improvements, debt reduction, education, and more — while preserving homeownership stability. $1M in loans closed across 18 borrowers in 2024.',
  impactHighlight:
    'Without explicit income targeting, 50% of borrowers earn under 80% AMI — demonstrating that the product naturally reaches low-to-middle-income households. Average AMI across the portfolio is 84%.',
  website: null,
}

/**
 * Aggregate stats from Homium Colorado Pilot Results - 2024.pdf:
 * - Loans Closed: 18
 * - Loan Payoffs: 1
 * - Average Loan Amount: $63,651
 * - Average Home Value: $496,500
 * - Average LTV: 14%
 * - Average Annual Income: $60,000
 * - Average AMI: 84%
 * - % Loans < 80% AMI: 50%
 */
export const HAL_PILOT_STATS = {
  source: 'Homium Colorado Pilot Results - 2024.pdf',
  loansClosedToDate: 18,
  loanPayoffs: 1,
  avgAnnualIncome: 60000,
  avgAMI: 0.84,
  pctUnder80AMI: 0.50,
  avgLoanAmount: 63651,
  avgHomeValue: 496500,
  avgLTV: 0.14,
} as const

/**
 * Per-loan data from loan-manifest-v2.xlsx + ATR Worksheets
 *
 * Income source for each loan (ATR Worksheet monthly income field):
 * HAL-17 (Vernon): $4,793.75/mo → $57,525/yr — ATR date 3/27/24
 * HAL-20 (Maclean): $5,605.45/mo → $67,265/yr — ATR date 5/28/24
 * HAL-21 (Lampton): $5,062.25/mo → $60,747/yr — ATR date 5/9/24
 * HAL-22 (Frank): $4,144.37/mo → $49,732/yr — ATR date 5/6/24
 * HAL-24 (English): $3,922.67/mo → $47,072/yr — ATR date 4/26/24
 * HAL-25 (Myrick): $3,258.33/mo → $39,100/yr — ATR date 5/9/24
 * HAL-27 (Vandergrift): $5,477.55/mo → $65,731/yr — ATR date 5/28/24
 * HAL-34 (Moore): $4,657.58/mo → $55,891/yr — ATR date 7/1/24
 * HAL-37 (Leake): $3,676.58/mo → $44,119/yr — ATR date 6/11/24
 * HAL-38 (Segura): $5,171.00/mo → $62,052/yr — ATR date 6/4/24
 * HAL-39 (Smith): $60,547.00/mo → $726,564/yr — ATR date 6/6/24 (TWN income report)
 * HAL-40 (Cordova): $2,315.70/mo → $27,789/yr — ATR date 6/11/24
 * HAL-41 (Makah): $11,980.60/mo → $143,767/yr — ATR date 6/19/24
 * HAL-43 (Olsen): $3,567.90/mo → $42,815/yr — ATR date 7/3/24
 * HAL-67 (Hotz): $4,792.29/mo → $57,508/yr — ATR date 10/31/24
 * HAL-3 (Rizo): $9,810.45/mo → $117,726/yr — ATR date 4/26/24
 */
/**
 * NAV (h price) stats from hom_portfolio_2026_03_19_qc.xlsx
 *
 * h = (Qualified Value + Qualified Cash) / Active h Supply
 * QV per loan = MIN(Implied Value, Liquidation Value)
 * Implied Value = Original Loan × (Current HPI / Initial HPI)
 * HPI source: CoreLogic Case-Shiller indices (monthly, MSA-level)
 */
export const HAL_NAV_STATS: HALNAVStats = {
  source: 'hom_portfolio_2026_03_19_qc.xlsx',
  snapshotDate: '2026-03-19',
  hPrice: 1.0138964,
  hPriceRounded: 1.0139,
  hPriceChangePct: 0.0105,    // +1.05% vs prior month
  priorMonthPrice: 1.00339,
  activeHSupply: 785974,
  totalHIssued: 1059830,       // sum of all h ever minted (incl. retired)
  totalHRetired: 273856,
  totalQualifiedValue: 796896.23,
  qualifiedCash: 0,
}

/**
 * Per-loan data from loan-manifest-v2.xlsx + ATR Worksheets + QC report
 *
 * NAV fields (qualifiedValue, impliedValue, hpiChangePct, qcCLTV) from
 * hom_portfolio_2026_03_19_qc.xlsx snapshot. Only populated for active loans
 * present in the QC report. Paid-off loans have null NAV fields.
 */
export const HAL_LOANS: HALLoan[] = [
  // ── Active loans (12) with QC NAV data ──
  { id: 'HAL-17', city: 'Littleton', county: 'Jefferson', state: 'CO', noteAmount: 44200, appraisedValue: 620000, firstLienBalance: 357465, ltv: 0.0713, cltv: 0.6465, rate: 0.05595, noteDate: '2024-04-10', status: 'active', settlementDate: null, annualIncome: 57525, incomeBracket: '50k-75k', qualifiedValue: 44401.13, impliedValue: 44401.13, hpiChangePct: 0.0046, qcCLTV: 64.53 },
  { id: 'HAL-20', city: 'Delta', county: 'Delta', state: 'CO', noteAmount: 42900, appraisedValue: 356000, firstLienBalance: 241360, ltv: 0.1205, cltv: 0.7979, rate: 0.05595, noteDate: '2024-06-04', status: 'active', settlementDate: null, annualIncome: 67265, incomeBracket: '50k-75k', qualifiedValue: 43408.15, impliedValue: 43408.15, hpiChangePct: 0.0118, qcCLTV: 79.06 },
  { id: 'HAL-21', city: 'Cedaredge', county: 'Delta', state: 'CO', noteAmount: 60000, appraisedValue: 300000, firstLienBalance: 172382, ltv: 0.20, cltv: 0.7727, rate: 0.05595, noteDate: '2024-05-23', status: 'active', settlementDate: null, annualIncome: 60747, incomeBracket: '50k-75k', qualifiedValue: 60710.70, impliedValue: 60710.70, hpiChangePct: 0.0118, qcCLTV: 76.79 },
  { id: 'HAL-22', city: 'Delta', county: 'Delta', state: 'CO', noteAmount: 100000, appraisedValue: 435000, firstLienBalance: 104151, ltv: 0.2299, cltv: 0.4685, rate: 0.05595, noteDate: '2024-05-17', status: 'active', settlementDate: null, annualIncome: 49732, incomeBracket: '25k-50k', qualifiedValue: 101184.49, impliedValue: 101184.49, hpiChangePct: 0.0118, qcCLTV: 46.66 },
  { id: 'HAL-25', city: 'Delta', county: 'Delta', state: 'CO', noteAmount: 30000, appraisedValue: 375000, firstLienBalance: 186158, ltv: 0.08, cltv: 0.5748, rate: 0.05595, noteDate: '2024-05-22', status: 'active', settlementDate: null, annualIncome: 39100, incomeBracket: '25k-50k', qualifiedValue: 30202.70, impliedValue: 30202.70, hpiChangePct: 0.0068, qcCLTV: 52.83 },
  { id: 'HAL-37', city: 'Paonia', county: 'Delta', state: 'CO', noteAmount: 45000, appraisedValue: 325000, firstLienBalance: 202868, ltv: 0.1385, cltv: 0.7622, rate: 0.05595, noteDate: '2024-06-18', status: 'active', settlementDate: null, annualIncome: 44119, incomeBracket: '25k-50k', qualifiedValue: 45406.28, impliedValue: 45406.28, hpiChangePct: 0.0090, qcCLTV: 75.71 },
  { id: 'HAL-38', city: 'Northglenn', county: 'Adams', state: 'CO', noteAmount: 55000, appraisedValue: 500000, firstLienBalance: 319331, ltv: 0.11, cltv: 0.7497, rate: 0.05595, noteDate: '2024-06-18', status: 'active', settlementDate: null, annualIncome: 62052, incomeBracket: '50k-75k', qualifiedValue: 54155.03, impliedValue: 54155.03, hpiChangePct: -0.0154, qcCLTV: 75.87 },
  { id: 'HAL-39', city: 'Denver', county: 'Denver', state: 'CO', noteAmount: 108350, appraisedValue: 985000, firstLienBalance: 348868, ltv: 0.11, cltv: 0.4642, rate: 0.05595, noteDate: '2024-06-21', status: 'active', settlementDate: null, annualIncome: 726564, incomeBracket: '>100k', qualifiedValue: 109048.65, impliedValue: 109048.65, hpiChangePct: 0.0064, qcCLTV: 46.20 },
  { id: 'HAL-40', city: 'Grand Junction', county: 'Mesa', state: 'CO', noteAmount: 78000, appraisedValue: 325000, firstLienBalance: 177260, ltv: 0.24, cltv: 0.7854, rate: 0.05595, noteDate: '2024-06-26', status: 'active', settlementDate: null, annualIncome: 27789, incomeBracket: '25k-50k', qualifiedValue: 82440.92, impliedValue: 82440.92, hpiChangePct: 0.0569, qcCLTV: 75.61 },
  { id: 'HAL-41', city: 'Denver', county: 'Denver', state: 'CO', noteAmount: 54000, appraisedValue: 655000, firstLienBalance: 415731, ltv: 0.0824, cltv: 0.7171, rate: 0.05595, noteDate: '2024-07-08', status: 'active', settlementDate: null, annualIncome: 143767, incomeBracket: '>100k', qualifiedValue: 53450.35, impliedValue: 53450.35, hpiChangePct: -0.0102, qcCLTV: 72.37 },
  { id: 'HAL-43', city: 'Brighton', county: 'Adams', state: 'CO', noteAmount: 100000, appraisedValue: 373000, firstLienBalance: 194476, ltv: 0.2681, cltv: 0.7895, rate: 0.05595, noteDate: '2024-07-17', status: 'active', settlementDate: null, annualIncome: 42815, incomeBracket: '25k-50k', qualifiedValue: 98500.54, impliedValue: 98500.54, hpiChangePct: -0.0150, qcCLTV: 79.75 },
  { id: 'HAL-67', city: 'Centennial', county: 'Arapahoe', state: 'CO', noteAmount: 75000, appraisedValue: 615000, firstLienBalance: 408550, ltv: 0.122, cltv: 0.7863, rate: 0.05595, noteDate: '2024-11-20', status: 'active', settlementDate: null, annualIncome: 57508, incomeBracket: '50k-75k', qualifiedValue: 73987.29, impliedValue: 73987.29, hpiChangePct: -0.0135, qcCLTV: 79.54 },
  // ── Paid-off loans (4) — no QC NAV data ──
  { id: 'HAL-24', city: 'Highlands Ranch', county: 'Douglas', state: 'CO', noteAmount: 100000, appraisedValue: 550000, firstLienBalance: 179839, ltv: 0.1818, cltv: 0.5114, rate: 0.05595, noteDate: '2024-05-13', status: 'paid_off', settlementDate: '2026-02-05', annualIncome: 47072, incomeBracket: '25k-50k', qualifiedValue: null, impliedValue: null, hpiChangePct: null, qcCLTV: null },
  { id: 'HAL-27', city: 'Delta', county: 'Delta', state: 'CO', noteAmount: 30000, appraisedValue: 730000, firstLienBalance: 358046, ltv: 0.0411, cltv: 0.5321, rate: 0.05595, noteDate: '2024-06-11', status: 'paid_off', settlementDate: '2026-01-09', annualIncome: 65731, incomeBracket: '50k-75k', qualifiedValue: null, impliedValue: null, hpiChangePct: null, qcCLTV: null },
  { id: 'HAL-34', city: 'Delta', county: 'Delta', state: 'CO', noteAmount: 70000, appraisedValue: 355000, firstLienBalance: 175772, ltv: 0.1972, cltv: 0.6923, rate: 0.05595, noteDate: '2024-07-10', status: 'paid_off', settlementDate: '2026-02-05', annualIncome: 55891, incomeBracket: '50k-75k', qualifiedValue: null, impliedValue: null, hpiChangePct: null, qcCLTV: null },
  { id: 'HAL-3', city: 'Colorado Springs', county: 'El Paso', state: 'CO', noteAmount: 67662, appraisedValue: 298000, firstLienBalance: null, ltv: 0.227, cltv: 0.727, rate: 0.05595, noteDate: '2024-05-01', status: 'paid_off', settlementDate: '2024-09-01', annualIncome: 117726, incomeBracket: '>100k', qualifiedValue: null, impliedValue: null, hpiChangePct: null, qcCLTV: null },
]
