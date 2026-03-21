/**
 * Program Explorer — Data Index & Aggregation Helpers
 */
import type { SAMLoan, HALLoan, ProgramMeta, ProgramStats } from './types'
import { UDF_LOANS, UDF_META } from './udf'
import { THHI_LOANS, THHI_META } from './thhi'
import { HAL_LOANS, HAL_META, HAL_PILOT_STATS } from './hal'

export { UDF_LOANS, UDF_META } from './udf'
export { THHI_LOANS, THHI_META } from './thhi'
export { HAL_LOANS, HAL_META, HAL_PILOT_STATS } from './hal'
export type { SAMLoan, HALLoan, ProgramMeta, ProgramStats } from './types'

export type ProgramId = 'udf' | 'thhi' | 'hal'

export const PROGRAM_METAS: Record<ProgramId, ProgramMeta> = {
  udf: UDF_META,
  thhi: THHI_META,
  hal: HAL_META,
}

/** Compute stats for a SAM loan portfolio */
function samStats(loans: SAMLoan[]): ProgramStats {
  const total = loans.reduce((s, l) => s + l.loanAmount, 0)
  const counties = [...new Set(loans.map((l) => l.county))]
  const avgLTV = loans.length
    ? loans.reduce((s, l) => s + (l.purchasePrice ? l.loanAmount / l.purchasePrice : 0), 0) / loans.filter((l) => l.purchasePrice > 0).length
    : 0
  return {
    totalDeployed: total,
    loanCount: loans.length,
    avgLoanAmount: Math.round(total / loans.length),
    counties,
    avgLTV,
  }
}

/** Compute stats for the HAL portfolio */
function halStats(loans: HALLoan[]): ProgramStats {
  const total = loans.reduce((s, l) => s + l.noteAmount, 0)
  const counties = [...new Set(loans.map((l) => l.county))]
  const avgLTV = loans.reduce((s, l) => s + l.ltv, 0) / loans.length
  return {
    totalDeployed: total,
    loanCount: loans.length,
    avgLoanAmount: Math.round(total / loans.length),
    counties,
    avgLTV,
  }
}

export const PROGRAM_STATS: Record<ProgramId, ProgramStats> = {
  udf: samStats(UDF_LOANS),
  thhi: samStats(THHI_LOANS),
  hal: halStats(HAL_LOANS),
}

/** Cross-program aggregate */
export function getCrossStats() {
  const all = Object.values(PROGRAM_STATS)
  const totalDeployed = all.reduce((s, p) => s + p.totalDeployed, 0)
  const totalLoans = all.reduce((s, p) => s + p.loanCount, 0)
  const allCounties = [...new Set(all.flatMap((p) => p.counties))]
  const states = [...new Set([UDF_META.state, THHI_META.state, HAL_META.state])]
  return { totalDeployed, totalLoans, countyCount: allCounties.length, stateCount: states.length }
}

/** HAL income distribution — counts by bracket (matches Pilot Results PDF categories) */
export function getHALIncomeDistribution() {
  const brackets = ['<25k', '25k-50k', '50k-75k', '75k-100k', '>100k'] as const
  const counts = brackets.map((b) => ({
    bracket: b,
    label: b === '<25k' ? '< $25K' : b === '>100k' ? '> $100K' : `$${b.replace('k', 'K').replace('-', ' – $')}`,
    count: HAL_LOANS.filter((l) => l.incomeBracket === b).length,
  }))
  return counts
}

/** HAL loan status counts */
export function getHALStatusCounts() {
  return {
    active: HAL_LOANS.filter((l) => l.status === 'active').length,
    paidOff: HAL_LOANS.filter((l) => l.status === 'paid_off').length,
  }
}

/** Geographic distribution (loan count + total deployed per county) for any loan set */
export function getGeoDistribution(programId: ProgramId) {
  const map = new Map<string, { county: string; count: number; total: number }>()

  if (programId === 'hal') {
    for (const l of HAL_LOANS) {
      const e = map.get(l.county) || { county: l.county, count: 0, total: 0 }
      e.count++
      e.total += l.noteAmount
      map.set(l.county, e)
    }
  } else {
    const loans = programId === 'udf' ? UDF_LOANS : THHI_LOANS
    for (const l of loans) {
      const e = map.get(l.county) || { county: l.county, count: 0, total: 0 }
      e.count++
      e.total += l.loanAmount
      map.set(l.county, e)
    }
  }

  return [...map.values()].sort((a, b) => b.total - a.total)
}

/** Origination timeline — cumulative loans by month */
export function getOriginationTimeline(programId: ProgramId) {
  const dateMap = new Map<string, number>()

  if (programId === 'hal') {
    for (const l of HAL_LOANS) {
      const month = l.noteDate.slice(0, 7) // "2024-04"
      dateMap.set(month, (dateMap.get(month) || 0) + 1)
    }
  } else {
    const loans = programId === 'udf' ? UDF_LOANS : THHI_LOANS
    for (const l of loans) {
      // CSV format: "02-2026" → "2026-02"
      const [mm, yyyy] = l.originationMonth.split('-')
      const month = `${yyyy}-${mm}`
      dateMap.set(month, (dateMap.get(month) || 0) + 1)
    }
  }

  const sorted = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  let cumulative = 0
  return sorted.map(([month, count]) => {
    cumulative += count
    return { month, count, cumulative }
  })
}

/** LTV distribution for any program (buckets of 5%) */
export function getLTVDistribution(programId: ProgramId) {
  const buckets = [
    { label: '0–10%', min: 0, max: 0.10 },
    { label: '10–15%', min: 0.10, max: 0.15 },
    { label: '15–20%', min: 0.15, max: 0.20 },
    { label: '20–25%', min: 0.20, max: 0.25 },
    { label: '25–30%', min: 0.25, max: 0.30 },
    { label: '30–40%', min: 0.30, max: 0.40 },
    { label: '40%+', min: 0.40, max: 1.0 },
  ]

  if (programId === 'hal') {
    return buckets.map((b) => ({
      ...b,
      count: HAL_LOANS.filter((l) => l.ltv >= b.min && l.ltv < b.max).length,
    }))
  }

  const loans = programId === 'udf' ? UDF_LOANS : THHI_LOANS
  return buckets.map((b) => {
    const loansWithPrice = loans.filter((l) => l.purchasePrice > 0)
    return {
      ...b,
      count: loansWithPrice.filter((l) => {
        const ltv = l.loanAmount / l.purchasePrice
        return ltv >= b.min && ltv < b.max
      }).length,
    }
  })
}
