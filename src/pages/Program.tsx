import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Section } from '../design-system/Layout'
import { H1, H2, H3, Body, Label } from '../design-system/Typography'
import { Card, MetricCard } from '../design-system/Card'
import { Button } from '../design-system/Button'
import { fmtDollar, fmtNumber, fmtMultiple, fmtPct } from '../lib/api'
import { STATE_NAMES } from '../design-system/Map'
import { useLeadCapture } from '../hooks/useLeadCapture'
import LeadCaptureModal from '../components/shared/LeadCaptureModal'
import PdfExportButton from '../components/shared/PdfExportButton'
import { trackEvent } from '../lib/analytics'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

import type { TopOffYearState } from '../lib/types'

interface ProgramData {
  fund: any
  totalHomeowners: number
  scenarios: Array<{
    name: string
    homeowners: number
    medianIncome: number
    medianHomeValue: number
    affordabilityGap: number
  }>
  blendedYr10: {
    equityCreated: number
    activeHomeowners: number
    roiCumulative: number
  } | null
  housingData: {
    medianIncome: number
    medianHomeValue: number
  }
  topOffSchedule?: TopOffYearState[]
  includeAffordabilitySensitivity?: boolean
  fullResult?: {
    blended: Array<{
      year: number
      calendarYear: number
      activeHomeowners: number
      totalEquityCreated: number
      fundBalance: number
      fundNAV: number
      roiCumulative: number
      returnedCapital: number
      totalHomeownersCum: number
    }>
    scenarioResults: Array<{
      affordability: {
        pitiBeforeHomium: number
        pitiAfterHomium: number
        gapBefore: number
        gapAfter: number
        maxPITI: number
      }
    }>
  }
}

const CHART_COLORS = {
  green: '#3D7A58',
  greenLight: '#7BB394',
  dark: '#1A2930',
  gray: '#888888',
  border: '#E5E5E0',
}

export default function Program() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProgramData | null>(null)
  const [stateName, setStateName] = useState('')
  const [stateAbbr, setStateAbbr] = useState('')
  const { isGated, submitLead } = useLeadCapture()

  useEffect(() => {
    const raw = sessionStorage.getItem('programResult')
    const abbr = sessionStorage.getItem('programState') || ''
    const name = sessionStorage.getItem('programStateName') || ''
    if (!raw) {
      navigate('/')
      return
    }
    setData(JSON.parse(raw))
    setStateAbbr(abbr)
    setStateName(name || STATE_NAMES[abbr] || abbr)
    trackEvent('model_generated', { state: abbr })
  }, [navigate])

  if (!data) return null

  // Show lead capture gate
  if (isGated) {
    return (
      <LeadCaptureModal
        onSubmit={submitLead}
        prefilledState={stateAbbr}
      />
    )
  }

  const { fund, totalHomeowners, blendedYr10, scenarios, fullResult, topOffSchedule, includeAffordabilitySensitivity } = data
  const blended = fullResult?.blended || []
  const yr10 = blendedYr10
  const yr30 = blended.length >= 30 ? blended[29] : null

  // Chart data — accumulate returned capital into a running total
  let cumulativeReturns = 0
  const chartData = blended.map(y => {
    cumulativeReturns += (y.returnedCapital || 0)
    return {
      year: y.calendarYear,
      equityCreated: Math.round(y.totalEquityCreated),
      activeHomeowners: y.activeHomeowners,
      fundValue: Math.round(y.fundNAV || y.fundBalance),
      roi: y.roiCumulative,
      cumulativeReturns: Math.round(cumulativeReturns),
      totalHomeowners: y.totalHomeownersCum,
    }
  })

  const totalRaise = fund?.raise?.totalRaise || 25_000_000
  const programName = fund?.name || `${stateName} Homeownership Program`
  const geoLabel = fund?.geography?.label || stateName
  const isReinvesting = fund?.raise?.reinvestNetProceeds === true
  const returnsLabel = isReinvesting ? 'Capital Recycled' : 'Cumulative Returns'

  // Borrower profile from MID scenario
  const midScenario = scenarios.find(s => s.name === 'MID') || scenarios[0]
  let midAffordability = fullResult?.scenarioResults?.[1]?.affordability
    || fullResult?.scenarioResults?.[0]?.affordability

  // Fallback: compute affordability client-side when fullResult doesn't include it
  if (!midAffordability && midScenario && fund) {
    const income = midScenario.medianIncome
    const homePrice = midScenario.medianHomeValue
    const rate = fund.assumptions?.interestRate || 0.07
    const samPct = fund.program?.homiumSAPct || 0.20
    const dpPct = fund.program?.downPaymentPct || 0.03
    const mr = rate / 12
    const pmtN = 360
    const calcPITI = (principal: number) => {
      const pi = mr === 0 ? principal / pmtN
        : principal * (mr * Math.pow(1 + mr, pmtN)) / (Math.pow(1 + mr, pmtN) - 1)
      return pi + (homePrice * 0.0085) / 12
    }
    const mortgageBefore = homePrice * (1 - dpPct)
    const homiumAmt = homePrice * samPct
    const maxPITI = (income * 0.35) / 12
    midAffordability = {
      pitiBeforeHomium: calcPITI(mortgageBefore),
      pitiAfterHomium: calcPITI(mortgageBefore - homiumAmt),
      maxPITI,
      gapBefore: calcPITI(mortgageBefore) - maxPITI,
      gapAfter: calcPITI(mortgageBefore - homiumAmt) - maxPITI,
    }
  }

  return (
    <>
      {/* Program Identity */}
      <section className="bg-white pt-16 pb-12 border-b border-border">
        <Container>
          <Label className="text-green mb-3 block">Program Model</Label>
          <H1>{programName}</H1>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <span className="inline-flex items-center gap-1.5 bg-greenLight text-green px-3 py-1 rounded-full font-body text-sm font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
              {geoLabel}
            </span>
            <span className="font-body text-sm text-lightGray">
              {fmtDollar(totalRaise)} raise
            </span>
            <span className="font-body text-sm text-lightGray">
              Modeled {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </Container>
      </section>

      {/* Printable content wrapper for PDF export */}
      <div id="program-content">
        {/* Hero Metrics */}
        <Section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-14">
            <MetricCard
              label="Homeowners Served"
              value={fmtNumber(totalHomeowners)}
              description="Families achieving homeownership over 10 years"
            />
            <MetricCard
              label="Equity Created"
              value={yr10 ? fmtDollar(yr10.equityCreated) : '--'}
              description="Total homeowner equity generated (10yr)"
            />
            <MetricCard
              label="Fund ROI"
              value={yr10 ? fmtMultiple(yr10.roiCumulative) : '--'}
              description="Cumulative return on invested capital (10yr)"
            />
            <MetricCard
              label="Monthly Savings"
              value={midAffordability ? fmtDollar(midAffordability.pitiBeforeHomium - midAffordability.pitiAfterHomium, 0) : '--'}
              description="Monthly PITI reduction per family"
            />
          </div>
        </Section>

        {/* Impact Narrative */}
        <Section alt>
          <div className="max-w-3xl mx-auto">
            <H2 className="mb-6">Impact Summary</H2>
            <div className="font-body text-gray text-lg leading-relaxed space-y-4">
              <p>
                A <strong className="text-dark">{fmtDollar(totalRaise)}</strong> fund targeting families
                earning {midScenario ? fmtPct(0.80) : ''} AMI in <strong className="text-dark">{geoLabel}</strong> could
                help <strong className="text-dark">{fmtNumber(totalHomeowners)} families</strong> achieve
                homeownership over 10 years
                {yr10 ? <>, creating <strong className="text-green">{fmtDollar(yr10.equityCreated)}</strong> in homeowner equity</> : ''}.
              </p>
              {midAffordability && (
                <p>
                  The program closes a monthly affordability gap of{' '}
                  <strong className="text-dark">{fmtDollar(midAffordability.pitiBeforeHomium - midAffordability.pitiAfterHomium, 0)}</strong>{' '}
                  by providing a {fmtPct(fund?.program?.homiumSAPct || 0.20)} shared appreciation mortgage,
                  reducing the typical family's monthly payment from {fmtDollar(midAffordability.pitiBeforeHomium, 0)}{' '}
                  to {fmtDollar(midAffordability.pitiAfterHomium, 0)}.
                </p>
              )}
              {yr30 && (
                <p>
                  Over 30 years, the fund is projected to generate a cumulative ROI of{' '}
                  <strong className="text-dark">{fmtMultiple(yr30.roiCumulative)}</strong>,
                  while creating <strong className="text-green">{fmtDollar(yr30.totalEquityCreated)}</strong>{' '}
                  in total homeowner equity.
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* Charts */}
        {chartData.length > 0 && (
          <Section>
            <H2 className="mb-10 text-center">30-Year Projections</H2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Equity Created */}
              <Card>
                <Label className="block mb-4">Homeowner Equity Created</Label>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
                    <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip formatter={(v) => fmtDollar(Number(v))} labelFormatter={l => `Year ${l}`} />
                    <Area type="monotone" dataKey="equityCreated" stroke={CHART_COLORS.green} fill={CHART_COLORS.green} fillOpacity={0.1} strokeWidth={2} name="Equity Created" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              {/* Active Homeowners */}
              <Card>
                <Label className="block mb-4">Active Homeowners</Label>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
                    <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
                    <Tooltip labelFormatter={l => `Year ${l}`} />
                    <Bar dataKey="activeHomeowners" fill={CHART_COLORS.green} radius={[2, 2, 0, 0]} name="Active Homeowners" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Fund Value & Returns */}
              <Card>
                <Label className="block mb-4">Fund Value & Returns</Label>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
                    <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip formatter={(v) => fmtDollar(Number(v))} labelFormatter={l => `Year ${l}`} />
                    <Line type="monotone" dataKey="fundValue" stroke={CHART_COLORS.dark} strokeWidth={2} dot={false} name="Fund Value" />
                    <Line type="monotone" dataKey="cumulativeReturns" stroke={CHART_COLORS.green} strokeWidth={2} dot={false} name={returnsLabel} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Cumulative ROI */}
              <Card>
                <Label className="block mb-4">Cumulative ROI</Label>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
                    <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={v => `${v.toFixed(1)}x`} />
                    <Tooltip formatter={(v) => fmtMultiple(Number(v))} labelFormatter={l => `Year ${l}`} />
                    <Line type="monotone" dataKey="roi" stroke={CHART_COLORS.green} strokeWidth={2.5} dot={false} name="ROI" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </Section>
        )}

        {/* Borrower Profile */}
        {midAffordability && midScenario && (
          <Section alt>
            <div className="max-w-2xl mx-auto">
              <H2 className="mb-8 text-center">Typical Borrower Profile</H2>
              <Card>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="block mb-3">Before Homium</Label>
                    <p className="font-body text-dark">Income: {fmtDollar(midScenario.medianIncome)}</p>
                    <p className="font-body text-dark">Home Price: {fmtDollar(midScenario.medianHomeValue)}</p>
                    <p className="font-body text-dark">Monthly PITI: {fmtDollar(midAffordability.pitiBeforeHomium, 0)}</p>
                    <p className="font-body text-dark">Max Affordable: {fmtDollar(midAffordability.maxPITI, 0)}</p>
                    <p className="font-body text-red-600 font-medium mt-2">
                      Gap: {fmtDollar(midAffordability.pitiBeforeHomium - midAffordability.maxPITI, 0)}/mo
                    </p>
                  </div>
                  <div>
                    <Label className="text-green block mb-3">With Homium</Label>
                    <p className="font-body text-dark">Monthly PITI: {fmtDollar(midAffordability.pitiAfterHomium, 0)}</p>
                    <p className="font-body text-dark">Monthly Savings: {fmtDollar(midAffordability.pitiBeforeHomium - midAffordability.pitiAfterHomium, 0)}</p>
                    <p className="font-body text-green font-medium mt-2">
                      {midAffordability.pitiAfterHomium <= midAffordability.maxPITI
                        ? 'Affordable!'
                        : `Remaining gap: ${fmtDollar(midAffordability.pitiAfterHomium - midAffordability.maxPITI, 0)}/mo`
                      }
                    </p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-border text-center">
                  <Body>
                    A family earning <strong className="text-dark">{fmtDollar(midScenario.medianIncome)}</strong> can
                    now afford a <strong className="text-dark">{fmtDollar(midScenario.medianHomeValue)}</strong> home.
                  </Body>
                </div>
              </Card>
            </div>
          </Section>
        )}

        {/* Affordability Sensitivity — only when explicitly enabled */}
        {includeAffordabilitySensitivity && topOffSchedule && topOffSchedule.length > 0 && (() => {
          const totalTopOff = topOffSchedule[topOffSchedule.length - 1].cumulativeTopOff
          const peakEntry = topOffSchedule.reduce((max, e) => e.annualTopOff > max.annualTopOff ? e : max, topOffSchedule[0])
          const avgAnnual = totalTopOff / topOffSchedule.length

          const divergenceData = topOffSchedule.map(e => ({
            year: e.calendarYear,
            homeValue: Math.round(e.homeValue),
            income80AMI: Math.round(e.income80AMI),
          }))

          const topOffChartData = topOffSchedule.map(e => ({
            year: e.calendarYear,
            cumulative: Math.round(e.cumulativeTopOff),
            annual: Math.round(e.annualTopOff),
          }))

          return (
            <Section alt>
              <H2 className="mb-8 text-center">Affordability Sensitivity</H2>
              <Body className="text-center mb-8 max-w-2xl mx-auto">
                When home values outpace income growth, the program needs additional capital (top-off) to maintain affordability for new cohorts.
              </Body>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10 max-w-3xl mx-auto">
                <MetricCard
                  label="Total Top-Off"
                  value={fmtDollar(totalTopOff)}
                  description="Cumulative additional capital needed over 30 years"
                />
                <MetricCard
                  label="Peak Year"
                  value={String(peakEntry.calendarYear)}
                  description={`Highest annual top-off: ${fmtDollar(peakEntry.annualTopOff)}`}
                />
                <MetricCard
                  label="Avg Annual"
                  value={fmtDollar(avgAnnual)}
                  description="Average annual top-off capital needed"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto">
                {/* Home Value vs Income Divergence */}
                <Card>
                  <Label className="block mb-4">Home Value vs Income (80% AMI)</Label>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={divergenceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
                      <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v) => fmtDollar(Number(v))} labelFormatter={l => `Year ${l}`} />
                      <Line type="monotone" dataKey="homeValue" stroke={CHART_COLORS.dark} strokeWidth={2} dot={false} name="Home Value" />
                      <Line type="monotone" dataKey="income80AMI" stroke={CHART_COLORS.green} strokeWidth={2} dot={false} name="80% AMI Income" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {/* Cumulative Top-Off */}
                <Card>
                  <Label className="block mb-4">Cumulative Top-Off Capital</Label>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={topOffChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
                      <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} />
                      <Tooltip formatter={(v) => fmtDollar(Number(v))} labelFormatter={l => `Year ${l}`} />
                      <Area type="monotone" dataKey="cumulative" stroke={CHART_COLORS.green} fill={CHART_COLORS.green} fillOpacity={0.15} strokeWidth={2} name="Cumulative Top-Off" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </Section>
          )
        })()}

        {/* Program Summary */}
        <Section>
          <H2 className="mb-8 text-center">Program Summary</H2>
          <div className="max-w-3xl mx-auto">
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 font-body text-sm">
                <SummaryRow label="Geography" value={geoLabel} />
                <SummaryRow label="Total Raise" value={fmtDollar(totalRaise)} />
                <SummaryRow label="Homium SAM" value={fmtPct(fund?.program?.homiumSAPct || 0.20)} />
                <SummaryRow label="Down Payment" value={fmtPct(fund?.program?.downPaymentPct || 0.03)} />
                <SummaryRow label="Program Fee" value={fmtPct(fund?.fees?.programFeePct || 0.05)} />
                <SummaryRow label="Management Fee" value={fmtPct(fund?.fees?.managementFeePct || 0.005)} />
                <SummaryRow label="Interest Rate" value={fmtPct(fund?.assumptions?.interestRate || 0.07)} />
                <SummaryRow label="HPA Assumption" value={fmtPct(fund?.assumptions?.hpaPct || 0.05)} />
              </div>

              {/* Scenario breakdown */}
              {scenarios.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <Label className="block mb-4">Scenario Breakdown</Label>
                  <table className="w-full font-body text-sm">
                    <thead>
                      <tr className="text-left border-b border-border">
                        <th className="py-2 pr-4 font-bold text-dark">Scenario</th>
                        <th className="py-2 pr-4 font-bold text-dark">Homeowners</th>
                        <th className="py-2 pr-4 font-bold text-dark">Income</th>
                        <th className="py-2 font-bold text-dark">Home Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map(s => (
                        <tr key={s.name} className="border-b border-border/50">
                          <td className="py-2 pr-4 font-medium text-dark">{s.name}</td>
                          <td className="py-2 pr-4">{fmtNumber(s.homeowners)}</td>
                          <td className="py-2 pr-4">{fmtDollar(s.medianIncome)}</td>
                          <td className="py-2">{fmtDollar(s.medianHomeValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </Section>
      </div>

      {/* Actions */}
      <Section alt>
        <div className="max-w-xl mx-auto text-center">
          <H3 className="mb-6">What's Next?</H3>
          <div className="flex flex-wrap justify-center gap-4">
            <Button onClick={() => navigate('/design')}>
              Edit Program
            </Button>
            <PdfExportButton fund={fund} programName={programName} includeAffordabilitySensitivity={includeAffordabilitySensitivity} />
            <Button variant="outline" onClick={() => navigate('/explore')}>
              Explore Another Market
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/30">
      <span className="text-lightGray">{label}</span>
      <span className="text-dark font-medium">{value}</span>
    </div>
  )
}
