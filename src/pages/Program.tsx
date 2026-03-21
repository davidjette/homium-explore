import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Section } from '../design-system/Layout'
import { H1, H2, H3, Body, Label } from '../design-system/Typography'
import { Card, MetricCard } from '../design-system/Card'
import { Button } from '../design-system/Button'
import { fmtDollar, fmtNumber, fmtMultiple, fmtPct } from '../lib/api'
import { STATE_NAMES } from '../design-system/Map'
import PdfExportButton from '../components/shared/PdfExportButton'
import ExcelExportButton from '../components/shared/ExcelExportButton'
import { useAuthContext } from '../components/shared/AuthProvider'
import ShareButton from '../components/shared/ShareButton'
import { trackEvent } from '../lib/analytics'
import { logUsage } from '../lib/usageLog'
import { runFundModel, fetchFund } from '../lib/api'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

import type { TopOffYearState, GeoBreakdownResult } from '../lib/types'

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
  blendedYrEnd: {
    equityCreated: number
    activeHomeowners: number
    roiCumulative: number
    homeownersCum: number
  } | null
  housingData: {
    medianIncome: number
    medianHomeValue: number
  }
  topOffSchedule?: TopOffYearState[]
  includeAffordabilitySensitivity?: boolean
  geoBreakdown?: GeoBreakdownResult[]
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
  const [, setStateAbbr] = useState('')
  const { isTeam } = useAuthContext()

  const [loading, setLoading] = useState(false)
  const [fundId] = useState(() => new URLSearchParams(window.location.search).get('fundId'))

  useEffect(() => {
    // Check for saved fund: /program?fundId=<uuid>
    if (fundId) {
      setLoading(true)
      fetchFund(fundId).then(({ fund: fundConfig, latestRun }) => {
        if (!latestRun) {
          // No results yet — redirect to edit
          navigate(`/design?fundId=${fundId}`)
          return
        }
        const abbr = fundConfig.geography?.state || ''
        const name = STATE_NAMES[abbr] || fundConfig.geography?.label || abbr
        setStateAbbr(abbr)
        setStateName(name)

        // latestRun from DB has: blended, scenarios (array of ScenarioResult), totalHomeowners
        const blended = latestRun.blended || []
        const scenarioResults = latestRun.scenarios || []
        const endIdx = blended.length - 1
        const yrEndData = blended[endIdx]

        setData({
          fund: fundConfig,
          totalHomeowners: latestRun.totalHomeowners || 0,
          blendedYrEnd: yrEndData ? {
            equityCreated: Math.round(yrEndData.totalEquityCreated),
            activeHomeowners: yrEndData.activeHomeowners,
            roiCumulative: yrEndData.roiCumulative,
            homeownersCum: yrEndData.totalHomeownersCum,
          } : null,
          scenarios: scenarioResults.map((sr: any) => ({
            name: sr.scenario?.name || sr.name || '',
            homeowners: sr.cohorts?.reduce((s: number, c: any) => s + c.homeownerCount, 0) || sr.homeowners || 0,
            medianIncome: sr.scenario?.medianIncome || sr.medianIncome || 0,
            medianHomeValue: sr.scenario?.medianHomeValue || sr.medianHomeValue || 0,
            affordabilityGap: sr.affordability?.gapAfter || 0,
          })),
          housingData: {
            medianIncome: fundConfig.scenarios?.[1]?.medianIncome || fundConfig.scenarios?.[0]?.medianIncome || 0,
            medianHomeValue: fundConfig.scenarios?.[1]?.medianHomeValue || fundConfig.scenarios?.[0]?.medianHomeValue || 0,
          },
          fullResult: { blended, scenarioResults },
          geoBreakdown: latestRun.metadata?.geoBreakdown,
        })
        setLoading(false)
        trackEvent('saved_fund_loaded', { state: abbr, fundId })
      }).catch(err => {
        console.error('Failed to load saved fund:', err)
        setLoading(false)
        navigate('/dashboard')
      })
      return
    }

    // Check for shared link: /program#c=<base64url-encoded fund config>
    const hash = window.location.hash
    if (hash.startsWith('#c=')) {
      const b64 = hash.slice(3).replace(/-/g, '+').replace(/_/g, '/')
      try {
        const json = decodeURIComponent(escape(atob(b64)))
        const fundConfig = JSON.parse(json)
        const abbr = fundConfig.geography?.state || ''
        const name = STATE_NAMES[abbr] || fundConfig.geography?.label || abbr
        setStateAbbr(abbr)
        setStateName(name)
        setLoading(true)

        runFundModel(fundConfig).then(result => {
          const endIdx = result.blended.length - 1;
          const yrEndData = result.blended[endIdx];
          setData({
            fund: result.fund,
            totalHomeowners: result.totalHomeowners,
            blendedYrEnd: yrEndData ? {
              equityCreated: Math.round(yrEndData.totalEquityCreated),
              activeHomeowners: yrEndData.activeHomeowners,
              roiCumulative: yrEndData.roiCumulative,
              homeownersCum: yrEndData.totalHomeownersCum,
            } : null,
            scenarios: result.scenarioResults.map((sr: any) => ({
              name: sr.scenario.name,
              homeowners: sr.cohorts?.reduce((s: number, c: any) => s + c.homeownerCount, 0) || 0,
              medianIncome: sr.scenario.medianIncome,
              medianHomeValue: sr.scenario.medianHomeValue,
              affordabilityGap: sr.affordability?.gapAfter || 0,
            })),
            housingData: {
              medianIncome: fundConfig.scenarios?.[1]?.medianIncome || fundConfig.scenarios?.[0]?.medianIncome || 0,
              medianHomeValue: fundConfig.scenarios?.[1]?.medianHomeValue || fundConfig.scenarios?.[0]?.medianHomeValue || 0,
            },
            fullResult: result,
            geoBreakdown: result.geoBreakdown,
          })
          setLoading(false)
          trackEvent('shared_link_loaded', { state: abbr })
        }).catch(err => {
          console.error('Failed to load shared program:', err)
          setLoading(false)
          navigate('/')
        })
        return
      } catch (err) {
        console.error('Invalid share link:', err)
      }
    }

    // Default: load from sessionStorage
    const raw = sessionStorage.getItem('programResult')
    const abbr = sessionStorage.getItem('programState') || ''
    const name = sessionStorage.getItem('programStateName') || ''
    if (!raw) {
      navigate('/')
      return
    }
    const parsed = JSON.parse(raw)
    setData(parsed)
    setStateAbbr(abbr)
    setStateName(name || STATE_NAMES[abbr] || abbr)
    trackEvent('model_generated', { state: abbr })
    logUsage('program_viewed', {
      state: abbr,
      programName: parsed.fund?.name,
      totalRaise: parsed.fund?.raise?.totalRaise,
    })
  }, [navigate])

  if (loading) return (
    <Section>
      <div className="max-w-xl mx-auto text-center py-20">
        <H2 className="mb-4">Loading Program...</H2>
        <Body className="text-lightGray">Loading program results...</Body>
      </div>
    </Section>
  )

  if (!data) return null

  const { fund, totalHomeowners, blendedYrEnd, scenarios, fullResult, topOffSchedule, includeAffordabilitySensitivity, geoBreakdown } = data
  const blended = fullResult?.blended || []
  const yrEnd = blendedYrEnd
  const fundLife = blended.length || 30
  const yrMax = blended[blended.length - 1] || null

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
  const isMultiGeo = geoBreakdown && geoBreakdown.length > 1
  const geoLabel = isMultiGeo
    ? `${geoBreakdown.length} Geographies (${stateName})`
    : (fund?.geography?.label || stateName)
  const isReinvesting = fund?.raise?.reinvestNetProceeds === true
  const returnsLabel = isReinvesting ? 'Capital Recycled' : 'Cumulative Returns'

  // Borrower profile — use weighted composite for multi-geo, MID scenario for single-geo
  let midScenario = scenarios.find(s => s.name === 'MID') || scenarios[0]
  if (isMultiGeo && geoBreakdown) {
    const totalAlloc = geoBreakdown.reduce((s, gb) => s + gb.geo.allocationPct, 0)
    const wtdIncome = geoBreakdown.reduce((s, gb) => s + gb.geo.medianIncome * gb.geo.allocationPct, 0) / totalAlloc
    const wtdHomeValue = geoBreakdown.reduce((s, gb) => s + gb.geo.medianHomeValue * gb.geo.allocationPct, 0) / totalAlloc
    midScenario = { ...midScenario, medianIncome: Math.round(wtdIncome), medianHomeValue: Math.round(wtdHomeValue) }
  }
  let midAffordability = fullResult?.scenarioResults?.[1]?.affordability
    || fullResult?.scenarioResults?.[0]?.affordability

  // Fallback: compute affordability client-side when fullResult doesn't include it
  if ((!midAffordability || isMultiGeo) && midScenario && fund) {
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
            {isMultiGeo ? (
              <div className="flex flex-wrap items-center gap-2">
                {geoBreakdown!.map(gb => (
                  <span key={gb.geo.geoId} className="inline-flex items-center gap-1.5 bg-greenLight text-green px-3 py-1 rounded-full font-body text-sm font-medium">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
                    {gb.geo.geoLabel}
                  </span>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-greenLight text-green px-3 py-1 rounded-full font-body text-sm font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
                {geoLabel}
              </span>
            )}
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
              value={fmtNumber(yrEnd?.homeownersCum || totalHomeowners)}
              description={`Families achieving homeownership over ${fundLife} years`}
            />
            <MetricCard
              label="Equity Created"
              value={yrEnd ? fmtDollar(yrEnd.equityCreated) : '--'}
              description={`Total homeowner equity generated (${fundLife}yr)`}
            />
            <MetricCard
              label="Fund ROI"
              value={yrEnd ? fmtMultiple(yrEnd.roiCumulative) : '--'}
              description={`Cumulative return on invested capital (${fundLife}yr)`}
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
                earning {midScenario ? fmtPct(0.80) : ''} AMI across{' '}
                <strong className="text-dark">{isMultiGeo ? `${geoBreakdown!.length} geographies in ${stateName}` : geoLabel}</strong> could
                help <strong className="text-dark">{fmtNumber(yrEnd?.homeownersCum || totalHomeowners)} families</strong> achieve
                homeownership over {fundLife} years
                {yrEnd ? <>, creating <strong className="text-green">{fmtDollar(yrEnd.equityCreated)}</strong> in homeowner equity</> : ''}.
              </p>
              {midAffordability && (
                <p>
                  {midAffordability.pitiAfterHomium <= midAffordability.maxPITI
                    ? <>The program closes a monthly affordability gap of{' '}
                        <strong className="text-dark">{fmtDollar(midAffordability.pitiBeforeHomium - midAffordability.maxPITI, 0)}</strong></>
                    : <>The program reduces the monthly affordability gap by{' '}
                        <strong className="text-dark">{fmtDollar(midAffordability.pitiBeforeHomium - midAffordability.pitiAfterHomium, 0)}</strong></>
                  }{' '}
                  by providing a {fmtPct(fund?.program?.homiumSAPct || 0.20)} shared appreciation mortgage,
                  reducing the typical family's monthly payment from {fmtDollar(midAffordability.pitiBeforeHomium, 0)}{' '}
                  to {fmtDollar(midAffordability.pitiAfterHomium, 0)}.
                </p>
              )}
              {yrMax && (
                <p>
                  Over {fundLife} years, the fund is projected to generate a cumulative ROI of{' '}
                  <strong className="text-dark">{fmtMultiple(yrMax.roiCumulative)}</strong>,
                  while creating <strong className="text-green">{fmtDollar(yrMax.totalEquityCreated)}</strong>{' '}
                  in total homeowner equity.
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* Charts */}
        {chartData.length > 0 && (
          <Section>
            <H2 className="mb-10 text-center">{fundLife}-Year Projections</H2>
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

        {/* Geographic Distribution — only when multi-geo */}
        {geoBreakdown && geoBreakdown.length > 1 && (
          <Section alt>
            <H2 className="mb-8 text-center">Geographic Distribution</H2>
            <div className="max-w-4xl mx-auto">
              {/* Allocation bar */}
              <div className="flex h-8 rounded-lg overflow-hidden mb-6">
                {geoBreakdown.map((gb, i) => {
                  const colors = ['#3D7A58', '#1A2930', '#7BB394', '#5BA37E', '#2E6046', '#4A9268'];
                  return (
                    <div
                      key={gb.geo.geoId}
                      style={{ width: `${gb.geo.allocationPct * 100}%`, backgroundColor: colors[i % colors.length] }}
                      className="flex items-center justify-center text-white text-xs font-bold font-body truncate px-1"
                      title={`${gb.geo.geoLabel}: ${Math.round(gb.geo.allocationPct * 100)}%`}
                    >
                      {Math.round(gb.geo.allocationPct * 100)}%
                    </div>
                  );
                })}
              </div>

              <Card>
                <table className="w-full font-body text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="py-2 pr-4 font-bold text-dark">Geography</th>
                      <th className="py-2 pr-4 font-bold text-dark text-right">Allocation</th>
                      <th className="py-2 pr-4 font-bold text-dark text-right">Homeowners</th>
                      <th className="py-2 pr-4 font-bold text-dark text-right">Equity (Yr {fundLife})</th>
                      <th className="py-2 font-bold text-dark text-right">Avg MHV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geoBreakdown.map(gb => {
                      const endEquity = gb.blended[gb.blended.length - 1]?.totalEquityCreated || 0;
                      return (
                        <tr key={gb.geo.geoId} className="border-b border-border/50">
                          <td className="py-2 pr-4 font-medium text-dark">{gb.geo.geoLabel}</td>
                          <td className="py-2 pr-4 text-right">{fmtPct(gb.geo.allocationPct)}</td>
                          <td className="py-2 pr-4 text-right">{fmtNumber(gb.totalHomeowners)}</td>
                          <td className="py-2 pr-4 text-right">{fmtDollar(endEquity)}</td>
                          <td className="py-2 text-right">{fmtDollar(gb.geo.medianHomeValue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                    <p className={`font-body font-medium mt-2 ${midAffordability.pitiAfterHomium <= midAffordability.maxPITI ? 'text-green' : 'text-red-600'}`}>
                      {midAffordability.pitiAfterHomium <= midAffordability.maxPITI
                        ? 'Affordable!'
                        : `Remaining gap: ${fmtDollar(midAffordability.pitiAfterHomium - midAffordability.maxPITI, 0)}/mo`
                      }
                    </p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-border text-center">
                  <Body>
                    {midAffordability.pitiAfterHomium <= midAffordability.maxPITI
                      ? <>A family earning <strong className="text-dark">{fmtDollar(midScenario.medianIncome)}</strong> can
                          now afford a <strong className="text-dark">{fmtDollar(midScenario.medianHomeValue)}</strong> home.</>
                      : <>Homium reduces the monthly payment gap by{' '}
                          <strong className="text-dark">{fmtDollar(midAffordability.pitiBeforeHomium - midAffordability.pitiAfterHomium, 0)}</strong>,
                          making a <strong className="text-dark">{fmtDollar(midScenario.medianHomeValue)}</strong> home
                          more accessible for a family earning <strong className="text-dark">{fmtDollar(midScenario.medianIncome)}</strong>.</>
                    }
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
                  {isMultiGeo ? (
                    // Multi-geo: group scenarios by geography
                    <div className="space-y-6">
                      {geoBreakdown!.map(gb => (
                        <div key={gb.geo.geoId}>
                          <p className="font-body text-xs font-bold uppercase tracking-wider text-green mb-2">
                            {gb.geo.geoLabel} ({fmtPct(gb.geo.allocationPct)} allocation)
                          </p>
                          <table className="w-full font-body text-sm">
                            <thead>
                              <tr className="text-left border-b border-border">
                                <th className="py-1.5 pr-4 font-bold text-dark">Scenario</th>
                                <th className="py-1.5 pr-4 font-bold text-dark">Homeowners</th>
                                <th className="py-1.5 pr-4 font-bold text-dark">Income</th>
                                <th className="py-1.5 font-bold text-dark">Home Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gb.scenarioResults.map(sr => (
                                <tr key={`${gb.geo.geoId}-${sr.scenario.name}`} className="border-b border-border/50">
                                  <td className="py-1.5 pr-4 font-medium text-dark">{sr.scenario.name}</td>
                                  <td className="py-1.5 pr-4">{fmtNumber(sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0))}</td>
                                  <td className="py-1.5 pr-4">{fmtDollar(sr.scenario.medianIncome)}</td>
                                  <td className="py-1.5">{fmtDollar(sr.scenario.medianHomeValue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ) : (
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
                  )}
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
            <Button onClick={() => navigate(fundId ? `/design?fundId=${fundId}` : '/design')}>
              Edit Program
            </Button>
            <PdfExportButton fund={fund} programName={programName} includeAffordabilitySensitivity={includeAffordabilitySensitivity} />
            {isTeam ? (
              <ExcelExportButton fund={fund} programName={programName} />
            ) : (
              <div className="relative group inline-flex">
                <Button variant="outline" disabled>
                  Export Excel
                </Button>
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Contact Homium for access
                </span>
              </div>
            )}
            <ShareButton fund={fund} programName={programName} />
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
