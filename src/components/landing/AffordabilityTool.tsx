import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Container } from '../../design-system/Layout'
import { H2, Body } from '../../design-system/Typography'
import { Button } from '../../design-system/Button'
import { Select } from '../../design-system/Select'
import { fetchStateData, runFundModel, computeSmartDefaults, fmtDollar, fmtPct } from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import { STATE_NAMES } from '../../design-system/Map'
import StateZoomMap from '../../design-system/StateZoomMap'

const BASE = import.meta.env.BASE_URL
const MAP_BG_URL = `${BASE}assets/images/us-map-outline.svg`

const SORTED_STATES = Object.entries(STATE_NAMES)
  .sort(([, a], [, b]) => a.localeCompare(b))

// Map US state/region names from geo APIs to abbreviations
const STATE_NAME_TO_ABBR: Record<string, string> = {}
for (const [abbr, name] of Object.entries(STATE_NAMES)) {
  STATE_NAME_TO_ABBR[name.toLowerCase()] = abbr
}

async function detectUserState(): Promise<string> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return ''
    const data = await res.json()
    const region = (data.region || '').toLowerCase()
    return STATE_NAME_TO_ABBR[region] || ''
  } catch {
    return ''
  }
}

export default function AffordabilityTool() {
  const navigate = useNavigate()
  const [selectedState, setSelectedState] = useState('')
  const [isQuickStarting, setIsQuickStarting] = useState(false)

  // Auto-detect state on mount
  useEffect(() => {
    detectUserState().then(abbr => {
      if (abbr && !selectedState) {
        setSelectedState(abbr)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: stateData, isLoading: stateLoading, isError } = useQuery({
    queryKey: ['stateData', selectedState],
    queryFn: () => fetchStateData(selectedState),
    enabled: !!selectedState,
  })

  const affordability = useMemo(() => {
    if (!stateData) return null
    const { targetAMIPct, homiumSAPct } = computeSmartDefaults(stateData.avgIncome, stateData.avgHomePrice)
    const income = stateData.avgIncome * targetAMIPct
    const homeValue = stateData.avgHomePrice
    const rate = 0.07
    const maxDTI = 0.35
    const dpPct = 0.03
    const monthlyBudget = (income * maxDTI) / 12
    const monthlyRate = rate / 12
    const n = 360
    const pitiRate = monthlyRate * Math.pow(1 + monthlyRate, n) / (Math.pow(1 + monthlyRate, n) - 1) + 0.0085 / 12
    const affordablePrice = monthlyBudget / pitiRate
    const downPayment = homeValue * dpPct
    return {
      targetAMIPct,
      homiumSAPct,
      targetIncome: Math.round(income),
      affordableHomePrice: Math.round(affordablePrice),
      downPaymentRequired: Math.round(downPayment),
      affordabilityGap: Math.round(homeValue - affordablePrice),
    }
  }, [stateData])

  const stateName = STATE_NAMES[selectedState] || selectedState

  const handleStateSelect = useCallback((abbr: string) => {
    setSelectedState(abbr)
    if (abbr) trackEvent('state_selected', { state: abbr })
  }, [])

  const handleQuickStart = useCallback(async () => {
    if (!selectedState || !stateData) return
    setIsQuickStarting(true)
    try {
      const { targetAMIPct, homiumSAPct } = computeSmartDefaults(
        stateData.avgIncome, stateData.avgHomePrice
      )
      const borrowerIncome = Math.round(stateData.avgIncome * targetAMIPct)
      const borrowerHomePrice = Math.round(stateData.avgHomePrice)
      const totalRaise = 25_000_000
      const scenarios = [
        { name: 'LO', weight: 0.20, raiseAllocation: totalRaise * 0.20, medianIncome: Math.round(borrowerIncome * 0.75), medianHomeValue: Math.round(borrowerHomePrice * 0.80) },
        { name: 'MID', weight: 0.60, raiseAllocation: totalRaise * 0.60, medianIncome: borrowerIncome, medianHomeValue: borrowerHomePrice },
        { name: 'HI', weight: 0.20, raiseAllocation: totalRaise * 0.20, medianIncome: Math.round(borrowerIncome * 1.35), medianHomeValue: Math.round(borrowerHomePrice * 1.40) },
      ]

      const config = {
        name: `Homium ${stateName} Program`,
        geography: { state: selectedState, label: stateName },
        raise: { totalRaise, annualContributionPct: 0, reinvestNetProceeds: false, baseYear: new Date().getFullYear() },
        fees: { programFeePct: 0.05, managementFeePct: 0.005 },
        assumptions: { hpaPct: 0.05, interestRate: 0.07 },
        program: { homiumSAPct, downPaymentPct: 0.03, maxFrontRatio: 0.35, maxHoldYears: 30 },
        payoffSchedule: [] as Array<{ year: number; annualPct: number; cumulativePct: number }>,
        scenarios,
      }

      const result = await runFundModel(config)
      sessionStorage.setItem('programResult', JSON.stringify({
        fund: result.fund,
        totalHomeowners: result.totalHomeowners,
        blendedYrEnd: (() => {
          const endIdx = result.blended.length - 1;
          const yr = result.blended[endIdx];
          return yr ? {
            equityCreated: Math.round(yr.totalEquityCreated),
            activeHomeowners: yr.activeHomeowners,
            roiCumulative: yr.roiCumulative,
          } : null;
        })(),
        scenarios: result.scenarioResults.map(sr => ({
          name: sr.scenario.name,
          homeowners: sr.cohorts.reduce((s, c) => s + c.homeownerCount, 0),
          medianIncome: sr.scenario.medianIncome,
          medianHomeValue: sr.scenario.medianHomeValue,
          affordabilityGap: sr.affordability.gapAfter,
        })),
        housingData: {
          medianIncome: borrowerIncome,
          medianHomeValue: borrowerHomePrice,
        },
        fullResult: result,
      }))
      sessionStorage.setItem('programState', selectedState)
      sessionStorage.setItem('programStateName', STATE_NAMES[selectedState] || selectedState)
      navigate('/program')
      trackEvent('quick_start_clicked', { state: selectedState })
    } catch (e) {
      console.error('Quick start failed:', e)
      setIsQuickStarting(false)
    }
  }, [selectedState, stateData, stateName, navigate])

  const handleCustomize = useCallback(() => {
    if (!selectedState) return
    sessionStorage.setItem('wizardState', selectedState)
    sessionStorage.setItem('wizardStateName', STATE_NAMES[selectedState] || selectedState)
    navigate('/design')
  }, [selectedState, navigate])

  return (
    <section id="affordability" className="bg-white py-[120px] max-md:py-[80px] relative overflow-hidden">
      {/* DGA-style faint map outline background — fades out when state selected */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{ opacity: selectedState && stateData ? 0 : 1 }}
      >
        <img
          src={MAP_BG_URL}
          alt=""
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[900px] opacity-[0.25]"
          style={{ filter: 'saturate(0) brightness(0.6)' }}
        />
      </div>

      <Container>
        {/* Section Header */}
        <div className="text-center mb-8 relative z-10 pt-4">
          <span className="font-body font-bold text-green text-[11px] uppercase tracking-[2.5px] block mb-3">Interactive Analysis</span>
          <H2>State Affordability Gap Analysis</H2>
          <Body className="mt-4 max-w-2xl mx-auto">
            Select a state to see the affordability challenge facing Homium's target borrowers —
            and understand why shared appreciation programs are essential.
          </Body>
        </div>

        {/* State Selector */}
        <div className="max-w-md mx-auto mb-8 relative z-10">
          <Select
            value={selectedState}
            onChange={(e) => handleStateSelect(e.target.value)}
          >
            <option value="">Select a state...</option>
            {SORTED_STATES.map(([abbr, name]) => (
              <option key={abbr} value={abbr}>{name}</option>
            ))}
          </Select>
        </div>

        {/* Tool Area */}
        <div className="relative z-10">
          {/* Placeholder when no state */}
          {!selectedState && (
            <p className="text-center font-body font-light text-lightGray italic py-12">
              Select a state above to view affordability data.
            </p>
          )}

          {/* Loading spinner */}
          {selectedState && stateLoading && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
              <p className="font-body text-sm text-lightGray mt-4">Loading market data...</p>
            </div>
          )}

          {/* Error state */}
          {selectedState && isError && (
            <div className="text-center py-12">
              <p className="font-body text-sm text-red-600">
                Failed to load data. The backend may be warming up — try again in a moment.
              </p>
            </div>
          )}

          {/* Data display: map left, cards right */}
          {selectedState && stateData && affordability && (
            <>
              <div className="flex gap-4 items-start mt-3 max-md:flex-col max-md:items-stretch">
                {/* State zoom panel — 38% width */}
                <div className="flex-[0_0_38%] rounded-lg overflow-hidden max-h-[280px] max-md:w-full max-md:max-h-[220px]">
                  <StateZoomMap
                    selectedState={selectedState}
                    className="w-full h-[280px] max-md:h-[220px]"
                  />
                </div>

                {/* Data cards — right side */}
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-[10px] max-md:grid-cols-1">
                    <DataCard label={`Target Borrower Income (${Math.round(affordability.targetAMIPct * 100)}% AMI)`} value={fmtDollar(affordability.targetIncome, 0)} />
                    <DataCard label="Median Home Value" value={fmtDollar(stateData.avgHomePrice, 0)} />
                    <DataCard label="Affordable Home Price @ 35% DTI" value={fmtDollar(affordability.affordableHomePrice, 0)} />
                    <DataCard label="Down Payment Required (3%)" value={fmtDollar(affordability.downPaymentRequired, 0)} />
                    <DataCard label="Median Monthly Rent" value={fmtDollar(stateData.avgRent, 0)} wide />
                  </div>
                </div>
              </div>

              {/* Affordability Gap card */}
              <div className="mt-[10px]">
                <div className="bg-[#f0f7f4] border border-green rounded-lg px-7 py-6 text-center">
                  <span className="font-body font-bold text-[11px] uppercase tracking-[2.5px] text-green block mb-1">
                    Affordability Gap
                  </span>
                  <span className="font-heading text-green text-[56px] leading-[1.1] max-md:text-[48px] block">
                    {fmtDollar(affordability.affordabilityGap, 0)}
                  </span>
                  <p className="font-body text-sm text-lightGray mt-3 max-w-xl mx-auto leading-relaxed">
                    A <strong className="text-gray">{stateName}</strong> family earning {fmtPct(affordability.targetAMIPct)} of area median income
                    cannot afford the median home at 35% DTI with a 3% down payment.
                    A {fmtPct(affordability.homiumSAPct)} Homium shared appreciation mortgage closes this gap.
                  </p>
                </div>
              </div>

              {/* CTA buttons */}
              <div className="text-center mt-10 space-y-3">
                <Button
                  size="lg"
                  onClick={handleQuickStart}
                  disabled={isQuickStarting}
                >
                  {isQuickStarting ? 'Generating Program...' : 'See What Homium Could Do Here'}
                  {!isQuickStarting && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  )}
                </Button>
                <div>
                  <Button variant="text" onClick={handleCustomize}>
                    Or customize your own program
                  </Button>
                </div>
              </div>

              {/* Methodology */}
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-[13px] text-[#6B7280] leading-relaxed">
                  Methodology: Based on census and ACS housing data. Target borrower income set to the highest AMI
                  level where an affordability gap exists. Modeled at 35% front-end DTI, 3% down payment, 7% fixed rate,
                  with estimated state-level property taxes, insurance, and PMI.
                </p>
              </div>
            </>
          )}
        </div>
      </Container>
    </section>
  )
}

/** Data card matching DGA style */
function DataCard({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`bg-white border border-border rounded-lg px-5 py-4 text-center ${wide ? 'col-span-full' : ''}`}>
      <span className="font-body font-bold text-[11px] uppercase tracking-[2.5px] text-lightGray block mb-1">
        {label}
      </span>
      <span className="font-heading text-dark text-[28px] leading-[1.2]">
        {value}
      </span>
    </div>
  )
}
