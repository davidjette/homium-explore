import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Container } from '../design-system/Layout'
import { H2, H3, Body, Label } from '../design-system/Typography'
import { Card } from '../design-system/Card'
import { Button } from '../design-system/Button'
import { Select } from '../design-system/Select'
import { STATE_NAMES } from '../design-system/Map'
import {
  fetchStateData, fetchCountiesByState,
  runFundModel, computeSmartDefaults, fmtDollar, fmtPct
} from '../lib/api'
import { trackEvent } from '../lib/analytics'
import type { WizardState, FundConfig, ScenarioConfig } from '../lib/types'
import { DEFAULT_WIZARD_STATE } from '../lib/types'

const SORTED_STATES = Object.entries(STATE_NAMES)
  .sort(([, a], [, b]) => a.localeCompare(b))

const STEPS = [
  { num: 1, label: 'Choose Your Market' },
  { num: 2, label: 'Define Your Borrower' },
  { num: 3, label: 'Design Your Program' },
  { num: 4, label: 'Model Your Fund' },
]

export default function Studio() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [wizard, setWizard] = useState<WizardState>(() => {
    // Pre-fill from Explorer if available
    const savedState = sessionStorage.getItem('wizardState')
    const savedName = sessionStorage.getItem('wizardStateName')
    if (savedState) {
      sessionStorage.removeItem('wizardState')
      sessionStorage.removeItem('wizardStateName')
      return { ...DEFAULT_WIZARD_STATE, state: savedState, stateName: savedName || savedState }
    }
    return DEFAULT_WIZARD_STATE
  })
  const [isRunning, setIsRunning] = useState(false)

  const update = (partial: Partial<WizardState>) => setWizard(prev => ({ ...prev, ...partial }))

  // Fetch state data when state changes
  const { data: stateData } = useQuery({
    queryKey: ['stateData', wizard.state],
    queryFn: () => fetchStateData(wizard.state),
    enabled: !!wizard.state,
  })

  // Fetch counties
  const { data: counties } = useQuery({
    queryKey: ['counties', wizard.state],
    queryFn: () => fetchCountiesByState(wizard.state),
    enabled: !!wizard.state,
  })

  // Update market data + smart defaults when state data arrives
  useEffect(() => {
    if (stateData) {
      const { targetAMIPct, homiumSAPct } = computeSmartDefaults(
        stateData.avgIncome, stateData.avgHomePrice
      )
      update({
        stateName: stateData.stateName || STATE_NAMES[wizard.state] || wizard.state,
        marketLabel: stateData.stateName || STATE_NAMES[wizard.state] || wizard.state,
        marketData: {
          medianIncome: stateData.avgIncome,
          medianHomeValue: stateData.avgHomePrice,
          medianRent: stateData.avgRent,
          population: stateData.totalPopulation,
        },
        targetAMIPct,
        homiumSAPct,
      })
    }
  }, [stateData])

  // Computed borrower values
  const borrowerIncome = wizard.marketData.medianIncome * wizard.targetAMIPct
  const borrowerHomePrice = wizard.marketData.medianHomeValue * wizard.targetHomePricePct
  const maxPITI = (borrowerIncome / 12) * 0.35

  // Computed program values
  const homiumAmount = borrowerHomePrice * wizard.homiumSAPct
  const downPayment = borrowerHomePrice * wizard.downPaymentPct
  const mortgageBefore = borrowerHomePrice - downPayment
  const mortgageAfter = mortgageBefore - homiumAmount

  // Estimate monthly payments
  const monthlyRate = wizard.interestRate / 12
  const n = 360
  const pitiEst = (principal: number) => {
    const pi = monthlyRate === 0 ? principal / n : principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    return pi + (borrowerHomePrice * 0.0085) / 12
  }
  const pitiBefore = pitiEst(mortgageBefore)
  const pitiAfter = pitiEst(mortgageAfter)

  // Build scenarios for step 4
  const defaultScenarios: ScenarioConfig[] = useMemo(() => {
    const base = wizard.totalRaise
    return [
      { name: 'LO', weight: 0.20, raiseAllocation: base * 0.20, medianIncome: Math.round(borrowerIncome * 0.75), medianHomeValue: Math.round(borrowerHomePrice * 0.80) },
      { name: 'MID', weight: 0.60, raiseAllocation: base * 0.60, medianIncome: Math.round(borrowerIncome), medianHomeValue: Math.round(borrowerHomePrice) },
      { name: 'HI', weight: 0.20, raiseAllocation: base * 0.20, medianIncome: Math.round(borrowerIncome * 1.35), medianHomeValue: Math.round(borrowerHomePrice * 1.40) },
    ]
  }, [wizard.totalRaise, borrowerIncome, borrowerHomePrice])

  const handleRun = async () => {
    setIsRunning(true)
    try {
      const scenarios = wizard.scenarios.length > 0 ? wizard.scenarios : defaultScenarios
      const config: FundConfig = {
        name: `Homium ${wizard.stateName} Program`,
        geography: {
          state: wizard.state,
          county: wizard.county,
          label: wizard.marketLabel || wizard.stateName,
        },
        raise: {
          totalRaise: wizard.totalRaise,
          annualContributionPct: 0,
          reinvestNetProceeds: wizard.reinvestProceeds,
          baseYear: new Date().getFullYear(),
        },
        fees: {
          programFeePct: wizard.programFeePct,
          managementFeePct: wizard.managementFeePct,
        },
        assumptions: {
          hpaPct: 0.05,
          interestRate: wizard.interestRate,
        },
        program: {
          homiumSAPct: wizard.homiumSAPct,
          downPaymentPct: wizard.downPaymentPct,
          maxFrontRatio: 0.35,
          maxHoldYears: wizard.maxHoldYears,
        },
        payoffSchedule: [],
        scenarios,
      }

      const result = await runFundModel(config)
      sessionStorage.setItem('programResult', JSON.stringify({
        fund: result.fund,
        totalHomeowners: result.totalHomeowners,
        blendedYr10: result.blended[9] ? {
          equityCreated: Math.round(result.blended[9].totalEquityCreated),
          activeHomeowners: result.blended[9].activeHomeowners,
          roiCumulative: result.blended[9].roiCumulative,
        } : null,
        scenarios: result.scenarioResults.map(sr => ({
          name: sr.scenario.name,
          homeowners: sr.cohorts.reduce((s, c) => s + c.homeownerCount, 0),
          medianIncome: sr.scenario.medianIncome,
          medianHomeValue: sr.scenario.medianHomeValue,
          affordabilityGap: sr.affordability.gapAfter,
        })),
        housingData: {
          medianIncome: Math.round(borrowerIncome),
          medianHomeValue: Math.round(borrowerHomePrice),
        },
        fullResult: result,
      }))
      sessionStorage.setItem('programState', wizard.state)
      sessionStorage.setItem('programStateName', wizard.stateName)
      navigate('/program')
      trackEvent('wizard_completed', { state: wizard.state })
    } catch (e) {
      console.error('Fund model run failed:', e)
      setIsRunning(false)
    }
  }

  return (
    <div className="bg-sectionAlt min-h-screen">
      {/* Progress Bar */}
      <div className="bg-white border-b border-border sticky top-16 z-40">
        <Container>
          <div className="flex items-center gap-1 py-4 overflow-x-auto">
            {STEPS.map(s => (
              <button
                key={s.num}
                onClick={() => s.num <= step && setStep(s.num)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-body transition-colors cursor-pointer
                  ${step === s.num ? 'bg-green text-white font-bold' : s.num < step ? 'bg-greenLight text-green' : 'text-lightGray'}
                `}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === s.num ? 'bg-white/20' : s.num < step ? 'bg-green/10' : 'bg-border'}
                `}>
                  {s.num < step ? '\u2713' : s.num}
                </span>
                <span className="hidden sm:inline whitespace-nowrap">{s.label}</span>
              </button>
            ))}
          </div>
        </Container>
      </div>

      <Container className="py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <StepGeography
                wizard={wizard}
                counties={counties || []}
                onUpdate={update}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <StepBorrower
                wizard={wizard}
                borrowerIncome={borrowerIncome}
                borrowerHomePrice={borrowerHomePrice}
                onUpdate={update}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <StepProgram
                wizard={wizard}
                homiumAmount={homiumAmount}
                onUpdate={update}
                onNext={() => setStep(4)}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <StepFund
                wizard={wizard}
                defaultScenarios={defaultScenarios}
                onUpdate={update}
                onRun={handleRun}
                onBack={() => setStep(3)}
                isRunning={isRunning}
              />
            )}
          </div>

          {/* Live Preview Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-40">
              <LivePreview
                step={step}
                wizard={wizard}
                borrowerIncome={borrowerIncome}
                borrowerHomePrice={borrowerHomePrice}
                pitiBefore={pitiBefore}
                pitiAfter={pitiAfter}
                maxPITI={maxPITI}
              />
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}

// ── Step Components ──

function StepGeography({ wizard, counties, onUpdate, onNext }: {
  wizard: WizardState
  counties: Array<{ countyName: string; stateAbbr: string }>
  onUpdate: (p: Partial<WizardState>) => void
  onNext: () => void
}) {
  return (
    <Card>
      <H2>Choose Your Market</H2>
      <Body className="mt-2 mb-8">Where will this program operate?</Body>

      <Select
        label="State"
        value={wizard.state}
        onChange={e => onUpdate({ state: e.target.value, county: undefined })}
        className="mb-6"
      >
        <option value="">Select a state...</option>
        {SORTED_STATES.map(([abbr, name]) => (
          <option key={abbr} value={abbr}>{name}</option>
        ))}
      </Select>

      {counties.length > 0 && (
        <Select
          label="County (optional)"
          value={wizard.county || ''}
          onChange={e => onUpdate({ county: e.target.value || undefined })}
          className="mb-6"
        >
          <option value="">All counties (statewide)</option>
          {counties.map(c => (
            <option key={c.countyName} value={c.countyName}>{c.countyName}</option>
          ))}
        </Select>
      )}

      <div className="flex justify-end mt-8">
        <Button onClick={onNext} disabled={!wizard.state}>
          Next: Define Borrower
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Button>
      </div>
    </Card>
  )
}

function StepBorrower({ wizard, borrowerIncome, borrowerHomePrice, onUpdate, onNext, onBack }: {
  wizard: WizardState
  borrowerIncome: number
  borrowerHomePrice: number
  onUpdate: (p: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <Card>
      <H2>Define Your Borrower</H2>
      <Body className="mt-2 mb-8">Who does this program serve?</Body>

      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <Label>Target AMI</Label>
            <span className="font-body text-dark font-medium">{Math.round(wizard.targetAMIPct * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.40"
            max="1.50"
            step="0.05"
            value={wizard.targetAMIPct}
            onChange={e => onUpdate({ targetAMIPct: parseFloat(e.target.value) })}
          />
          <p className="font-body text-sm text-lightGray mt-1">
            Families earning ~{fmtDollar(borrowerIncome)}/year
          </p>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-2">
            <Label>Target Home Price</Label>
            <span className="font-body text-dark font-medium">{Math.round(wizard.targetHomePricePct * 100)}% of median</span>
          </div>
          <input
            type="range"
            min="0.50"
            max="1.50"
            step="0.05"
            value={wizard.targetHomePricePct}
            onChange={e => onUpdate({ targetHomePricePct: parseFloat(e.target.value) })}
          />
          <p className="font-body text-sm text-lightGray mt-1">
            Homes valued at ~{fmtDollar(borrowerHomePrice)}
          </p>
        </div>

        <div>
          <Label className="block mb-2">Interest Rate</Label>
          <PercentInput
            value={wizard.interestRate}
            onChange={v => onUpdate({ interestRate: v })}
            min={3}
            max={12}
            hint="Assumed rate on the borrower's 1st mortgage (30-yr fixed)"
          />
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>
          Next: Design Program
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Button>
      </div>
    </Card>
  )
}

function StepProgram({ wizard, homiumAmount, onUpdate, onNext, onBack }: {
  wizard: WizardState
  homiumAmount: number
  onUpdate: (p: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <Card>
      <H2>Design Your Program</H2>
      <Body className="mt-2 mb-8">How does Homium help?</Body>

      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <Label>Homium SAM %</Label>
            <span className="font-body text-dark font-medium">{Math.round(wizard.homiumSAPct * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="0.50"
            step="0.05"
            value={wizard.homiumSAPct}
            onChange={e => onUpdate({ homiumSAPct: parseFloat(e.target.value) })}
          />
          <p className="font-body text-sm text-lightGray mt-1">
            Homium covers {fmtDollar(homiumAmount)} of the home price
          </p>
        </div>

        <Select
          label="Down Payment"
          value={String(wizard.downPaymentPct)}
          onChange={e => onUpdate({ downPaymentPct: parseFloat(e.target.value) })}
        >
          <option value="0.03">3%</option>
          <option value="0.05">5%</option>
          <option value="0.10">10%</option>
          <option value="0.20">20%</option>
        </Select>

        <div>
          <Label className="block mb-2">Program Fee</Label>
          <PercentInput
            value={wizard.programFeePct}
            onChange={v => onUpdate({ programFeePct: v })}
            min={0}
            max={10}
            hint="One-time origination fee on fund deployments"
          />
        </div>

        <Select
          label="Max Hold Period"
          value={String(wizard.maxHoldYears)}
          onChange={e => onUpdate({ maxHoldYears: parseInt(e.target.value) })}
        >
          <option value="15">15 years</option>
          <option value="20">20 years</option>
          <option value="25">25 years</option>
          <option value="30">30 years</option>
        </Select>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>
          Next: Model Fund
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Button>
      </div>
    </Card>
  )
}

function StepFund({ wizard, defaultScenarios, onUpdate, onRun, onBack, isRunning }: {
  wizard: WizardState
  defaultScenarios: ScenarioConfig[]
  onUpdate: (p: Partial<WizardState>) => void
  onRun: () => void
  onBack: () => void
  isRunning: boolean
}) {
  const raiseOptions = [5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000]

  return (
    <Card>
      <H2>Model Your Fund</H2>
      <Body className="mt-2 mb-8">How does the fund work?</Body>

      <div className="space-y-8">
        <div>
          <Label className="block mb-3">Total Raise</Label>
          <div className="flex flex-wrap gap-2">
            {raiseOptions.map(amt => (
              <button
                key={amt}
                onClick={() => onUpdate({ totalRaise: amt })}
                className={`px-4 py-2 rounded-md border font-body text-sm transition-colors cursor-pointer
                  ${wizard.totalRaise === amt
                    ? 'bg-green text-white border-green'
                    : 'bg-white text-gray border-border hover:border-green'
                  }`}
              >
                {fmtDollar(amt)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="block mb-2">Management Fee</Label>
          <PercentInput
            value={wizard.managementFeePct}
            onChange={v => onUpdate({ managementFeePct: v })}
            min={0}
            max={3}
            hint="Annual fee on fund assets under management"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="reinvest"
            checked={wizard.reinvestProceeds}
            onChange={e => onUpdate({ reinvestProceeds: e.target.checked })}
            className="w-4 h-4 accent-green"
          />
          <label htmlFor="reinvest" className="font-body text-dark text-base cursor-pointer">
            Reinvest net proceeds
          </label>
        </div>

        {/* Scenario preview */}
        <div>
          <Label className="block mb-3">Scenarios (Auto-populated)</Label>
          <div className="grid grid-cols-3 gap-3">
            {defaultScenarios.map(s => (
              <div key={s.name} className="bg-sectionAlt border border-border rounded-md p-3">
                <p className="font-body font-bold text-dark text-sm">{s.name}</p>
                <p className="font-body text-xs text-lightGray mt-1">{fmtPct(s.weight)} weight</p>
                <p className="font-body text-xs text-lightGray">Income: {fmtDollar(s.medianIncome)}</p>
                <p className="font-body text-xs text-lightGray">Home: {fmtDollar(s.medianHomeValue)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button size="lg" onClick={onRun} disabled={isRunning}>
          {isRunning ? 'Running Model...' : 'Generate Program'}
          {!isRunning && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          )}
        </Button>
      </div>
    </Card>
  )
}

// ── Live Preview ──

function LivePreview({ step, wizard, borrowerIncome, borrowerHomePrice, pitiBefore, pitiAfter, maxPITI }: {
  step: number
  wizard: WizardState
  borrowerIncome: number
  borrowerHomePrice: number
  pitiBefore: number
  pitiAfter: number
  maxPITI: number
}) {
  return (
    <Card className="bg-sectionAlt border-green/20">
      <Label className="text-green mb-4 block">Live Preview</Label>

      {step >= 1 && wizard.state && (
        <div className="mb-4">
          <H3>{wizard.marketLabel || wizard.stateName}</H3>
          {wizard.marketData.medianIncome > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <MiniStat label="AMI" value={fmtDollar(wizard.marketData.medianIncome)} />
              <MiniStat label="MHV" value={fmtDollar(wizard.marketData.medianHomeValue)} />
            </div>
          )}
        </div>
      )}

      {step >= 2 && borrowerIncome > 0 && (
        <div className="mb-4 pt-4 border-t border-border">
          <Label className="block mb-2">Borrower</Label>
          <p className="font-body text-sm text-dark">Income: {fmtDollar(borrowerIncome)}</p>
          <p className="font-body text-sm text-dark">Home: {fmtDollar(borrowerHomePrice)}</p>
          <p className="font-body text-sm text-dark">PITI: {fmtDollar(pitiBefore, 0)}/mo</p>
          <p className="font-body text-sm text-dark">Max PITI: {fmtDollar(maxPITI, 0)}/mo</p>
          {pitiBefore > maxPITI && (
            <p className="font-body text-sm text-red-600 font-medium mt-1">
              Gap: {fmtDollar(pitiBefore - maxPITI, 0)}/mo
            </p>
          )}
        </div>
      )}

      {step >= 3 && (
        <div className="mb-4 pt-4 border-t border-border">
          <Label className="block mb-2">After Homium</Label>
          <p className="font-body text-sm text-green font-medium">PITI: {fmtDollar(pitiAfter, 0)}/mo</p>
          <p className="font-body text-sm text-dark">
            Saves {fmtDollar(pitiBefore - pitiAfter, 0)}/mo
          </p>
          {pitiAfter <= maxPITI && (
            <p className="font-body text-sm text-green font-medium mt-1">
              Affordable!
            </p>
          )}
        </div>
      )}

      {step >= 4 && (
        <div className="pt-4 border-t border-border">
          <Label className="block mb-2">Fund</Label>
          <p className="font-body text-sm text-dark">Raise: {fmtDollar(wizard.totalRaise)}</p>
          <p className="font-body text-sm text-dark">SAM: {fmtPct(wizard.homiumSAPct)}</p>
          <p className="font-body text-sm text-dark">DP: {fmtPct(wizard.downPaymentPct)}</p>
        </div>
      )}
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded px-2 py-1.5">
      <p className="font-body font-bold text-[10px] uppercase tracking-wider text-lightGray">{label}</p>
      <p className="font-heading text-dark text-base">{value}</p>
    </div>
  )
}

/** Percentage input that displays/edits as whole percent (e.g. "7") while storing as decimal (0.07) */
function PercentInput({ value, onChange, min, max, hint }: {
  value: number
  onChange: (decimal: number) => void
  min?: number
  max?: number
  hint?: string
}) {
  const toDisplay = (v: number) => parseFloat((v * 100).toPrecision(10)).toString()
  const [display, setDisplay] = useState(toDisplay(value))
  const [focused, setFocused] = useState(false)

  // Sync from parent when value changes externally (and not currently editing)
  useEffect(() => {
    if (!focused) setDisplay(toDisplay(value))
  }, [value, focused])

  const commit = () => {
    setFocused(false)
    const parsed = parseFloat(display)
    if (!isNaN(parsed) && parsed >= (min ?? 0) && parsed <= (max ?? 100)) {
      onChange(parsed / 100)
    } else {
      setDisplay(toDisplay(value))
    }
  }

  return (
    <div>
      <div className="relative inline-block">
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={e => setDisplay(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
          className="font-body text-dark text-base px-4 py-3 border-[1.5px] border-border rounded-md w-40 focus:border-green focus:outline-none pr-8"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-lightGray pointer-events-none">%</span>
      </div>
      {hint && <p className="font-body text-sm text-lightGray mt-1">{hint}</p>}
    </div>
  )
}
