/**
 * Programs — Live Program Explorer
 *
 * Outward-facing demo page for potential program sponsors.
 * Shows anonymized portfolio data across three active Homium programs.
 *
 * Data sources (internal reference only — not shown in UI):
 * - HAL: loan-manifest-v2.xlsx, ATR Worksheets, Pilot Results PDF, hom_portfolio_2026_03_19_qc.xlsx
 * - UDF: portfolio_03_18_2026 udf.csv
 * - THHI: portfolio_03_18_2026 thhi.csv, THHI Borrower Profiles_3.20.pdf
 */
import { useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { Container, Section } from '../design-system/Layout'
import { H1, H2, H3, Body, Label, Caption } from '../design-system/Typography'
import { Card, StatCard, MetricCard } from '../design-system/Card'
import { fmtDollar, fmtPct, fmtNumber } from '../lib/api'
import {
  PROGRAM_METAS, PROGRAM_STATS, getCrossStats,
  getGeoDistribution, getOriginationTimeline, getLTVDistribution,
  getHALIncomeDistribution, getHALStatusCounts,
  HAL_PILOT_STATS, HAL_NAV_STATS, HAL_LOANS,
  UDF_LOANS, THHI_LOANS, THHI_PROFILES, THHI_AGGREGATE,
  type ProgramId,
} from '../data/programs'

const CHART_COLORS = {
  green: '#3D7A58',
  greenLight: '#7BB394',
  dark: '#1A2930',
  gray: '#888888',
  border: '#E5E5E0',
  accent: '#C4956A',
}

const PROGRAM_COLORS: Record<ProgramId, string> = {
  udf: CHART_COLORS.green,
  thhi: CHART_COLORS.dark,
  hal: CHART_COLORS.accent,
}

export default function Programs() {
  const [activeProgram, setActiveProgram] = useState<ProgramId>('udf')
  const cross = getCrossStats()

  return (
    <>
      {/* Header */}
      <section className="bg-white pt-16 pb-12 border-b border-border">
        <Container>
          <Label className="text-green mb-3 block">Live Programs</Label>
          <H1>Program Explorer</H1>
          <Body className="mt-2 text-lightGray max-w-2xl">
            Live deployment data from three Homium homeownership programs across {cross.stateCount} states.
            See how Shared Appreciation Mortgages are creating pathways to homeownership for working families.
          </Body>
        </Container>
      </section>

      {/* Cross-Program Summary */}
      <Section>
        <Container>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <MetricCard
              label="Capital Raised"
              value={fmtDollar(cross.totalRaised)}
              description="Committed across purchase programs"
            />
            <MetricCard
              label="Capital Deployed"
              value={fmtDollar(cross.totalDeployed)}
              description={`${fmtNumber(cross.totalLoans)} loans originated`}
            />
            <MetricCard
              label="Programs"
              value="3"
              description={`${cross.stateCount} states · ${cross.countyCount} counties`}
            />
            <MetricCard
              label="Avg AMI (CO Pilot)"
              value="84%"
              description="50% of borrowers under 80% AMI"
            />
          </div>
        </Container>
      </Section>

      {/* Program Selector Cards + Comparison */}
      <Section alt>
        <Container>
          <Label className="block mb-6">Select Program</Label>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {(['udf', 'thhi', 'hal'] as ProgramId[]).map((id) => {
              const meta = PROGRAM_METAS[id]
              const stats = PROGRAM_STATS[id]
              const isActive = activeProgram === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveProgram(id)}
                  className={`text-left bg-white border-2 rounded-lg p-6 transition-all cursor-pointer ${
                    isActive
                      ? 'border-green shadow-md'
                      : 'border-border hover:border-green/40'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <H3 className="!text-lg">{meta.name}</H3>
                    <span className="text-xs font-body font-bold uppercase tracking-wider bg-greenLight text-green px-2 py-0.5 rounded">
                      {meta.productType}
                    </span>
                  </div>
                  <Caption className="block mb-4">{meta.location}</Caption>
                  <div className={`grid gap-2 ${meta.capitalRaised ? 'grid-cols-3' : 'grid-cols-3'}`}>
                    <div>
                      <div className="font-heading text-dark text-lg">{stats.loanCount}</div>
                      <Caption>Loans</Caption>
                    </div>
                    <div>
                      <div className="font-heading text-dark text-lg">{fmtDollar(stats.totalDeployed)}</div>
                      <Caption>Deployed</Caption>
                    </div>
                    {meta.capitalRaised ? (
                      <div>
                        <div className="font-heading text-dark text-lg">{fmtDollar(meta.capitalRaised)}</div>
                        <Caption>Raised</Caption>
                      </div>
                    ) : (
                      <div>
                        <div className="font-heading text-dark text-lg">{fmtDollar(stats.avgLoanAmount)}</div>
                        <Caption>Avg Loan</Caption>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Capital Comparison Bar */}
          <Card>
            <Label className="block mb-4">Capital Deployed by Program</Label>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={(['udf', 'thhi', 'hal'] as ProgramId[]).map((id) => ({
                  name: PROGRAM_METAS[id].name,
                  deployed: PROGRAM_STATS[id].totalDeployed,
                  fill: PROGRAM_COLORS[id],
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={(v) => fmtDollar(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: CHART_COLORS.dark }} width={120} />
                <Tooltip formatter={(v) => fmtDollar(Number(v))} />
                <Bar dataKey="deployed" radius={[0, 4, 4, 0]} name="Capital Deployed">
                  {(['udf', 'thhi', 'hal'] as ProgramId[]).map((id) => (
                    <Cell key={id} fill={PROGRAM_COLORS[id]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Container>
      </Section>

      {/* Program Deep-Dive */}
      <Section>
        <Container>
          {/* Tab Buttons */}
          <div className="flex gap-2 mb-10">
            {(['udf', 'thhi', 'hal'] as ProgramId[]).map((id) => (
              <button
                key={id}
                onClick={() => setActiveProgram(id)}
                className={`font-body text-sm font-medium px-5 py-2 rounded-full transition-all cursor-pointer ${
                  activeProgram === id
                    ? 'bg-green text-white'
                    : 'bg-greenLight text-green hover:bg-green/20'
                }`}
              >
                {PROGRAM_METAS[id].name}
              </button>
            ))}
          </div>

          <ProgramDetail programId={activeProgram} />
        </Container>
      </Section>
    </>
  )
}

// ─── Program Detail ──────────────────────────────────────────────

function ProgramDetail({ programId }: { programId: ProgramId }) {
  const meta = PROGRAM_METAS[programId]
  const stats = PROGRAM_STATS[programId]
  const geo = getGeoDistribution(programId)
  const ltvDist = getLTVDistribution(programId)

  return (
    <div className="space-y-12">
      {/* Identity Block */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <H2>{meta.fullName}</H2>
        </div>
        <Body className="text-gray max-w-3xl mb-8">{meta.description}</Body>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Loans Originated" value={String(stats.loanCount)} />
          <StatCard label="Capital Deployed" value={fmtDollar(stats.totalDeployed)} />
          {meta.capitalRaised && <StatCard label="Capital Raised" value={fmtDollar(meta.capitalRaised)} />}
          <StatCard label="Avg Loan" value={fmtDollar(stats.avgLoanAmount)} />
          {meta.partner && <StatCard label="Partners" value={meta.partner} />}
          <StatCard label="Avg LTV" value={fmtPct(stats.avgLTV, 1)} />
          {programId === 'hal' && (
            <>
              <StatCard label="Active Loans" value={String(getHALStatusCounts().active)} />
              <StatCard label="Paid Off" value={String(getHALStatusCounts().paidOff)} />
              <StatCard label="Avg AMI" value={fmtPct(HAL_PILOT_STATS.avgAMI, 0)} />
              <StatCard label="Under 80% AMI" value={fmtPct(HAL_PILOT_STATS.pctUnder80AMI, 0)} />
            </>
          )}
          {programId === 'thhi' && (
            <>
              <StatCard label="Avg AMI" value={fmtPct(THHI_AGGREGATE.avgAMI, 0)} />
              <StatCard label="Avg FICO" value={String(THHI_AGGREGATE.avgFICO)} />
            </>
          )}
        </div>

        {/* Sponsors */}
        {meta.sponsors && (
          <div className="mt-6">
            <Caption className="block mb-2">Program Sponsors</Caption>
            <div className="flex flex-wrap gap-2">
              {meta.sponsors.map((s) => (
                <span key={s} className="font-body text-xs bg-sectionAlt text-gray px-3 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* HAL NAV Section */}
      {programId === 'hal' && <HALNAVSection />}

      {/* THHI Borrower Profiles */}
      {programId === 'thhi' && <THHIBorrowerSection />}

      {/* UDF Video */}
      {programId === 'udf' && <UDFVideoSection />}

      {/* Charts Row 1: Geography + LTV (skip geo for THHI — all Wayne County) */}
      <div className={`grid grid-cols-1 ${programId !== 'thhi' ? 'lg:grid-cols-2' : ''} gap-8`}>
        {programId !== 'thhi' && (
          <Card>
            <Label className="block mb-4">Geographic Distribution</Label>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={geo} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={(v) => fmtDollar(v)} />
                <YAxis type="category" dataKey="county" tick={{ fontSize: 11, fill: CHART_COLORS.dark }} width={90} />
                <Tooltip
                  formatter={(v) => fmtDollar(Number(v))}
                  labelFormatter={(l) => `${l} County`}
                />
                <Bar dataKey="total" fill={PROGRAM_COLORS[programId]} radius={[0, 4, 4, 0]} name="Deployed" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card>
          <Label className="block mb-4">LTV Distribution</Label>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ltvDist.filter((b) => b.count > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
              <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={PROGRAM_COLORS[programId]} radius={[4, 4, 0, 0]} name="Loans" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2: Program-Specific */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {programId === 'hal' ? (
          <>
            <HALIncomeChart />
            <HALValuationBridge />
          </>
        ) : (
          <>
            <SAMCollateralChart programId={programId} />
            <SAMLoanAmountDistribution programId={programId} />
          </>
        )}
      </div>

      {/* HAL Risk Profile */}
      {programId === 'hal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <HALRiskProfile />
          <HALOriginationTimeline />
        </div>
      )}

      {/* THHI Payment Comparison */}
      {programId === 'thhi' && (
        <div className="grid grid-cols-1 gap-8">
          <THHIPaymentComparison />
        </div>
      )}

      {/* Impact Narrative */}
      <Card className="bg-greenLight/30 border-green/20">
        <Label className="text-green block mb-3">Impact</Label>
        <Body className="text-dark leading-relaxed">{meta.impactHighlight}</Body>
        {meta.website && (
          <a
            href={meta.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 font-body text-sm text-green font-medium hover:underline"
          >
            Learn more →
          </a>
        )}
      </Card>
    </div>
  )
}

// ─── HAL NAV Section ─────────────────────────────────────────────

function HALNAVSection() {
  return (
    <div className="space-y-6">
      <H3 className="mb-2">Portfolio NAV Analysis</H3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="h Price" value={`$${HAL_NAV_STATS.hPriceRounded.toFixed(4)}`} />
        <StatCard label="Monthly Change" value={`+${(HAL_NAV_STATS.hPriceChangePct * 100).toFixed(2)}%`} />
        <StatCard label="Active h Supply" value={fmtNumber(HAL_NAV_STATS.activeHSupply)} />
        <StatCard label="Total Qualified Value" value={fmtDollar(HAL_NAV_STATS.totalQualifiedValue)} />
      </div>
      <Caption className="block text-gray">
        Portfolio values marked monthly using CoreLogic Case-Shiller home price indices.
      </Caption>
    </div>
  )
}

// ─── HAL Charts ──────────────────────────────────────────────────

function HALIncomeChart() {
  const data = getHALIncomeDistribution()
  return (
    <Card>
      <Label className="block mb-4">Household Income Distribution</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} name="Borrowers" />
        </BarChart>
      </ResponsiveContainer>
      <Caption className="mt-2 block">
        Average income $60K · Average AMI 84% · 50% of borrowers under 80% AMI
      </Caption>
    </Card>
  )
}

function HALValuationBridge() {
  const activeLoans = HAL_LOANS.filter((l) => l.status === 'active' && l.qualifiedValue !== null)
  const data = activeLoans.map((l, i) => ({
    label: String(i + 1),
    original: l.noteAmount,
    appreciation: l.qualifiedValue! - l.noteAmount,
  }))

  return (
    <Card>
      <Label className="block mb-4">Portfolio Valuation: Original Loan → Current Value</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
          <Tooltip formatter={(v) => fmtDollar(Number(v))} />
          <Bar dataKey="original" stackId="val" fill={CHART_COLORS.accent} name="Original Loan" radius={[0, 0, 0, 0]} />
          <Bar dataKey="appreciation" stackId="val" fill={CHART_COLORS.green} name="HPI Appreciation" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.accent }} />
          <Caption>Original Loan</Caption>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.green }} />
          <Caption>HPI Appreciation</Caption>
        </div>
      </div>
    </Card>
  )
}

function HALRiskProfile() {
  const activeLoans = HAL_LOANS.filter((l) => l.status === 'active' && l.qcCLTV !== null)
  const data = activeLoans.map((l) => ({
    ltv: +(l.ltv * 100).toFixed(1),
    cltv: l.qcCLTV!,
    noteAmount: l.noteAmount,
  }))

  return (
    <Card>
      <Label className="block mb-4">Risk Profile: LTV vs. CLTV</Label>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis
            type="number"
            dataKey="ltv"
            name="LTV"
            tick={{ fontSize: 11, fill: CHART_COLORS.gray }}
            label={{ value: 'LTV %', position: 'insideBottom', offset: -5, fontSize: 11, fill: CHART_COLORS.gray }}
            domain={[0, 30]}
          />
          <YAxis
            type="number"
            dataKey="cltv"
            name="CLTV"
            tick={{ fontSize: 11, fill: CHART_COLORS.gray }}
            label={{ value: 'CLTV %', angle: -90, position: 'insideLeft', fontSize: 11, fill: CHART_COLORS.gray }}
            domain={[40, 85]}
          />
          <ZAxis type="number" dataKey="noteAmount" range={[60, 300]} />
          <Tooltip
            formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name]}
            labelFormatter={() => ''}
          />
          <ReferenceLine y={80} stroke={CHART_COLORS.accent} strokeDasharray="5 5" label={{ value: '80% CLTV', fill: CHART_COLORS.accent, fontSize: 10 }} />
          <Scatter data={data} fill={CHART_COLORS.accent} name="Loans" />
        </ScatterChart>
      </ResponsiveContainer>
      <Caption className="mt-2 block">
        Conservative positioning — most loans cluster at low LTV with CLTV well below 80%.
      </Caption>
    </Card>
  )
}

function HALOriginationTimeline() {
  const timeline = getOriginationTimeline('hal')
  return (
    <Card>
      <Label className="block mb-4">Origination Timeline</Label>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={timeline}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} allowDecimals={false} />
          <Tooltip labelFormatter={(l) => `Month: ${l}`} />
          <Area
            type="stepAfter"
            dataKey="cumulative"
            stroke={CHART_COLORS.accent}
            fill={CHART_COLORS.accent}
            fillOpacity={0.15}
            strokeWidth={2}
            name="Cumulative Loans"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ─── THHI Sections ───────────────────────────────────────────────

/** Only show profiles where homeownership costs less than prior rent */
const THHI_POSITIVE_PROFILES = THHI_PROFILES.filter((p) => p.savingsPct > 0)

function THHIBorrowerSection() {
  return (
    <div className="space-y-6">
      <H3 className="mb-2">Borrower Profiles</H3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {THHI_POSITIVE_PROFILES.map((p) => {
          const monthlySavings = p.priorRent - p.totalMonthly
          return (
            <Card key={p.occupation} className="!p-4">
              <Label className="block mb-2 text-dark">{p.occupation}</Label>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Caption>AMI</Caption>
                  <Caption className="font-medium text-dark">{(p.amiPct * 100).toFixed(0)}%</Caption>
                </div>
                <div className="flex justify-between">
                  <Caption>Prior Rent</Caption>
                  <Caption className="font-medium text-dark">{fmtDollar(p.priorRent)}/mo</Caption>
                </div>
                <div className="flex justify-between">
                  <Caption>New Monthly</Caption>
                  <Caption className="font-medium text-dark">{fmtDollar(p.totalMonthly)}/mo</Caption>
                </div>
                <div className="flex justify-between">
                  <Caption>Monthly Savings</Caption>
                  <Caption className="font-medium text-green">{fmtDollar(monthlySavings)}/mo</Caption>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg Home Price" value={fmtDollar(THHI_AGGREGATE.avgHomePrice)} />
        <StatCard label="Avg AMI" value={fmtPct(THHI_AGGREGATE.avgAMI, 0)} />
        <StatCard label="Avg FICO" value={String(THHI_AGGREGATE.avgFICO)} />
        <StatCard label="Avg 1st Lien Rate" value={fmtPct(THHI_AGGREGATE.avgFirstLienRate, 2)} />
      </div>
    </div>
  )
}

function THHIPaymentComparison() {
  const data = THHI_POSITIVE_PROFILES.map((p) => ({
    name: p.occupation,
    priorRent: p.priorRent,
    newTotal: p.totalMonthly,
  }))

  return (
    <Card>
      <Label className="block mb-4">Monthly Cost: Prior Rent vs. Homeownership</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={(v) => fmtDollar(v)} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.dark }} width={130} />
          <Tooltip formatter={(v) => fmtDollar(Number(v))} />
          <Bar dataKey="priorRent" fill={CHART_COLORS.border} radius={[0, 4, 4, 0]} name="Prior Rent" />
          <Bar dataKey="newTotal" fill={CHART_COLORS.dark} radius={[0, 4, 4, 0]} name="Homeownership (PITI + Maint.)" />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.border }} />
          <Caption>Prior Rent</Caption>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.dark }} />
          <Caption>Homeownership (PITI + Maintenance)</Caption>
        </div>
      </div>
      <Caption className="mt-2 block">
        These borrowers are building wealth through homeownership at a lower monthly cost than renting.
      </Caption>
    </Card>
  )
}

// ─── UDF Video Section ───────────────────────────────────────────

function UDFVideoSection() {
  return (
    <div className="text-center">
      <H3 className="mb-6">Hear from a Utah Dream Fund Homeowner</H3>
      <div className="max-w-3xl mx-auto">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full rounded-lg"
            src="https://www.youtube.com/embed/XZCdLg3x2T0"
            title="Utah Dream Fund Homeowner Story"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}

// ─── SAM-specific charts ─────────────────────────────────────────

function SAMCollateralChart({ programId }: { programId: ProgramId }) {
  const loans = programId === 'udf' ? UDF_LOANS : THHI_LOANS
  const data = loans
    .filter((l) => l.purchasePrice > 0)
    .map((l, i) => ({
      label: String(i + 1),
      purchasePrice: l.purchasePrice,
      loanAmount: l.loanAmount,
    }))
    .sort((a, b) => b.purchasePrice - a.purchasePrice)

  return (
    <Card>
      <Label className="block mb-4">Purchase Price vs. Homium Loan</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
          <Tooltip formatter={(v) => fmtDollar(Number(v))} />
          <Bar dataKey="purchasePrice" fill={CHART_COLORS.border} radius={[4, 4, 0, 0]} name="Purchase Price" />
          <Bar dataKey="loanAmount" fill={PROGRAM_COLORS[programId]} radius={[4, 4, 0, 0]} name="Homium Loan" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function SAMLoanAmountDistribution({ programId }: { programId: ProgramId }) {
  const loans = programId === 'udf' ? UDF_LOANS : THHI_LOANS
  const buckets = [
    { label: '< $50K', min: 0, max: 50000 },
    { label: '$50–75K', min: 50000, max: 75000 },
    { label: '$75–100K', min: 75000, max: 100000 },
    { label: '$100–125K', min: 100000, max: 125000 },
    { label: '$125–150K', min: 125000, max: 150000 },
    { label: '$150K+', min: 150000, max: Infinity },
  ]
  const data = buckets
    .map((b) => ({
      label: b.label,
      count: loans.filter((l) => l.loanAmount >= b.min && l.loanAmount < b.max).length,
    }))
    .filter((d) => d.count > 0)

  return (
    <Card>
      <Label className="block mb-4">Loan Amount Distribution</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill={PROGRAM_COLORS[programId]} radius={[4, 4, 0, 0]} name="Loans" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
