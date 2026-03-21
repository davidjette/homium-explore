/**
 * Program Explorer Data Types
 *
 * All data sourced from:
 * - HAL: finops-workspace/loan-manifest-v2.xlsx (cols A-AC, 17 data rows)
 * - HAL income: ATR Worksheets in Originations/2024 Refinance/Colorado Pilot/
 * - UDF: portfolio_03_18_2026 udf.csv (Loans - UD Utah Dream Fund/)
 * - THHI: portfolio_03_18_2026 thhi.csv (Loans - TH Tobias Harris Homeownership Initiative/)
 * - Aggregate stats: Homium Colorado Pilot Results - 2024.pdf
 */

/** SAM (Shared Appreciation Mortgage) loan — used for UDF and THHI programs */
export interface SAMLoan {
  id: string                // Sequential anonymized ID (e.g., "UDF-001")
  sourceId: number          // Original portfolio CSV "ID" column for traceability
  city: string
  county: string
  state: string
  purchasePrice: number     // CSV "Price" column
  loanAmount: number        // CSV "Original Loan Amount"
  originationMonth: string  // CSV "Origination Month" (e.g., "02-2026")
  disbursementDate: string  // CSV "Disbursment Date" [sic] (e.g., "2026-02-18")
  // HPI fields — n/a for recently originated loans
  hpiInitial: number | null
  hpiCurrent: number | null
  allTimeChangePct: number | null
  // Preview fields — available for loans with HPI data
  previewFMV: number | null
  previewMortgageBalance: number | null
  previewLTV: number | null
  previewCLTV: number | null
  previewCollateral: number | null
}

/** HAL (Home Equity) loan — Colorado pilot program */
export interface HALLoan {
  id: string                // Manifest "Loan ID" (e.g., "HAL-17")
  city: string              // Manifest "City"
  county: string            // Manifest "County"
  state: 'CO'
  noteAmount: number        // Manifest "Note Amount"
  appraisedValue: number    // Manifest "Appraised Value"
  firstLienBalance: number | null // Manifest "First Lien Balance"
  ltv: number               // Manifest "LTV %" as decimal (e.g., 0.0713)
  cltv: number              // Manifest "CLTV %" as decimal
  rate: number              // Manifest "Note / WAB Rate" (0.05595 for all)
  noteDate: string          // Manifest "Note Date" (e.g., "2024-04-10")
  status: 'active' | 'paid_off'
  settlementDate: string | null
  // Income from ATR Worksheets (monthly income × 12)
  annualIncome: number | null
  // Income bracket matching Pilot Results PDF categories
  incomeBracket: '<25k' | '25k-50k' | '50k-75k' | '75k-100k' | '>100k' | null
}

/** Program metadata — static descriptive info */
export interface ProgramMeta {
  id: 'udf' | 'thhi' | 'hal'
  name: string
  fullName: string
  productType: 'SAM' | 'Home Equity'
  location: string
  state: string
  partner: string | null
  description: string
  impactHighlight: string
  website: string | null
}

/** Aggregate stats — for cross-program summary */
export interface ProgramStats {
  totalDeployed: number
  loanCount: number
  avgLoanAmount: number
  counties: string[]
  avgLTV: number
}
