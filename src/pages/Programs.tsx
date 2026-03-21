/**
 * Programs — Live Program Explorer
 *
 * Team-only page showing anonymized portfolio data across three active Homium programs.
 * All data sourced from loan manifests, portfolio CSVs, ATR worksheets, and published materials.
 * See src/data/programs/ for source documentation.
 */
import { useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts'
import { Container, Section } from '../design-system/Layout'
import { H1, H2, H3, Body, Label, Caption } from '../design-system/Typography'
import { Card, StatCard, MetricCard } from '../design-system/Card'
import { fmtDollar, fmtPct, fmtNumber } from '../lib/api'
import {
  PROGRAM_METAS, PROGRAM_STATS, getCrossStats,
  getGeoDistribution, getOriginationTimeline, getLTVDistribution,
  getHALIncomeDistribution, getHALStatusCounts,
  HAL_PILOT_STATS, HAL_LOANS, UDF_LOANS, THHI_LOANS,
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
            Real portfolio data from three Homium programs across {cross.stateCount} states.
            All borrower information anonymized — financial data sourced from loan manifests and closing documents.
          </Body>
        </Container>
      </section>

      {/* Cross-Program Summary */}
      <Section>
        <Container>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <MetricCard
              label="Total Deployed"
              value={fmtDollar(cross.totalDeployed)}
              description="Capital deployed across all programs"
            />
            <MetricCard
              label="Loans Originated"
              value={fmtNumber(cross.totalLoans)}
              description="Across 3 active programs"
            />
            <MetricCard
              label="States"
              value={String(cross.stateCount)}
              description={`${cross.countyCount} counties reached`}
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
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="font-heading text-dark text-lg">{stats.loanCount}</div>
                      <Caption>Loans</Caption>
                    </div>
                    <div>
                      <div className="font-heading text-dark text-lg">{fmtDollar(stats.totalDeployed)}</div>
                      <Caption>Deployed</Caption>
                    </div>
                    <div>
                      <div className="font-heading text-dark text-lg">{fmtDollar(stats.avgLoanAmount)}</div>
                      <Caption>Avg Loan</Caption>
                    </div>
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
  const timeline = getOriginationTimeline(programId)
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
          <StatCard label="Loans" value={String(stats.loanCount)} />
          <StatCard label="Total Deployed" value={fmtDollar(stats.totalDeployed)} />
          <StatCard label="Avg Loan" value={fmtDollar(stats.avgLoanAmount)} />
          <StatCard label="Counties" value={String(stats.counties.length)} />
          {meta.partner && <StatCard label="Partner" value={meta.partner} />}
          <StatCard label="Avg LTV" value={fmtPct(stats.avgLTV, 1)} />
          {programId === 'hal' && (
            <>
              <StatCard label="Avg AMI" value={fmtPct(HAL_PILOT_STATS.avgAMI, 0)} />
              <StatCard label="Under 80% AMI" value={fmtPct(HAL_PILOT_STATS.pctUnder80AMI, 0)} />
            </>
          )}
        </div>
      </div>

      {/* Charts Row 1: Timeline + Geography */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Origination Timeline */}
        <Card>
          <Label className="block mb-4">Origination Timeline</Label>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
              <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(l) => `Month: ${l}`}
                formatter={(v: number, name: string) =>
                  [v, name === 'cumulative' ? 'Total Loans' : 'New Loans']
                }
              />
              <Area
                type="stepAfter"
                dataKey="cumulative"
                stroke={PROGRAM_COLORS[programId]}
                fill={PROGRAM_COLORS[programId]}
                fillOpacity={0.15}
                strokeWidth={2}
                name="cumulative"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <Label className="block mb-4">Geographic Distribution</Label>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={geo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={(v) => fmtDollar(v)} />
              <YAxis type="category" dataKey="county" tick={{ fontSize: 11, fill: CHART_COLORS.dark }} width={90} />
              <Tooltip
                formatter={(v: number) => fmtDollar(v)}
                labelFormatter={(l) => `${l} County`}
              />
              <Bar dataKey="total" fill={PROGRAM_COLORS[programId]} radius={[0, 4, 4, 0]} name="Deployed" />
            </BarChart>
          </ResponsiveContainer>
          <Caption className="mt-2 block">
            {geo.map((g) => `${g.county}: ${g.count} loan${g.count > 1 ? 's' : ''}`).join(' · ')}
          </Caption>
        </Card>
      </div>

      {/* Charts Row 2: LTV Distribution + Program-Specific */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LTV Distribution */}
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

        {/* Program-Specific Chart */}
        {programId === 'hal' ? (
          <HALIncomeChart />
        ) : (
          <SAMCollateralChart programId={programId} />
        )}
      </div>

      {/* HAL-specific: Status + Rate */}
      {programId === 'hal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <HALStatusChart />
          <HALHomeValueChart />
        </div>
      )}

      {/* THHI/UDF specific: SAM charts */}
      {programId !== 'hal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SAMPriceDistribution programId={programId} />
          {programId === 'thhi' && <THHICLTVChart />}
        </div>
      )}

      {/* Impact Narrative */}
      <Card className="bg-greenLight/30 border-green/20">
        <Label className="text-green block mb-3">Impact Summary</Label>
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

      {/* Data Source Attribution */}
      <div className="border-t border-border pt-6">
        <Caption className="block">
          Data sources: {programId === 'hal'
            ? 'loan-manifest-v2.xlsx, ATR Worksheets, Homium Colorado Pilot Results - 2024.pdf'
            : programId === 'udf'
              ? 'portfolio_03_18_2026 udf.csv (Utah Dream Fund portfolio export)'
              : 'portfolio_03_18_2026 thhi.csv (THHI portfolio export)'
          }. All borrower names and addresses removed. Financial figures are unmodified from source.
        </Caption>
      </div>
    </div>
  )
}

// ─── HAL-specific charts ─────────────────────────────────────────

function HALIncomeChart() {
  const data = getHALIncomeDistribution()
  return (
    <Card>
      <Label className="block mb-1">Household Income Distribution</Label>
      <Caption className="block mb-4">Source: ATR Worksheets (monthly income × 12)</Caption>
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
        Pilot Results PDF: avg income $60K, avg AMI 84%, 50% under 80% AMI
      </Caption>
    </Card>
  )
}

function HALStatusChart() {
  const { active, paidOff } = getHALStatusCounts()
  const data = [{ name: 'Portfolio', active, paidOff }]
  return (
    <Card>
      <Label className="block mb-4">Loan Status</Label>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} domain={[0, 16]} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip />
          <Bar dataKey="active" stackId="status" fill={CHART_COLORS.green} name="Active" radius={[0, 0, 0, 0]} />
          <Bar dataKey="paidOff" stackId="status" fill={CHART_COLORS.greenLight} name="Paid Off" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.green }} />
          <Caption>Active ({active})</Caption>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.greenLight }} />
          <Caption>Paid Off ({paidOff})</Caption>
        </div>
      </div>
    </Card>
  )
}

function HALHomeValueChart() {
  const data = HAL_LOANS
    .map((l) => ({
      id: l.id,
      homeValue: l.appraisedValue,
      loanAmount: l.noteAmount,
    }))
    .sort((a, b) => b.homeValue - a.homeValue)

  return (
    <Card>
      <Label className="block mb-4">Home Value vs. Loan Amount</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="id" tick={{ fontSize: 9, fill: CHART_COLORS.gray }} angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
          <Tooltip formatter={(v: number) => fmtDollar(v)} />
          <Bar dataKey="homeValue" fill={CHART_COLORS.border} radius={[4, 4, 0, 0]} name="Home Value" />
          <Bar dataKey="loanAmount" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} name="Loan Amount" />
        </BarChart>
      </ResponsiveContainer>
      <Caption className="mt-2 block">Conservative positioning: avg LTV of 15% across the portfolio</Caption>
    </Card>
  )
}

// ─── SAM-specific charts ─────────────────────────────────────────

function SAMCollateralChart({ programId }: { programId: ProgramId }) {
  const loans = programId === 'udf' ? UDF_LOANS : THHI_LOANS
  const data = loans
    .filter((l) => l.purchasePrice > 0)
    .map((l) => ({
      id: l.id,
      purchasePrice: l.purchasePrice,
      loanAmount: l.loanAmount,
    }))
    .sort((a, b) => b.purchasePrice - a.purchasePrice)

  return (
    <Card>
      <Label className="block mb-4">Purchase Price vs. SAM Amount</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="id" tick={{ fontSize: 9, fill: CHART_COLORS.gray }} angle={-45} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
          <Tooltip formatter={(v: number) => fmtDollar(v)} />
          <Bar dataKey="purchasePrice" fill={CHART_COLORS.border} radius={[4, 4, 0, 0]} name="Purchase Price" />
          <Bar dataKey="loanAmount" fill={PROGRAM_COLORS[programId]} radius={[4, 4, 0, 0]} name="SAM Amount" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function SAMPriceDistribution({ programId }: { programId: ProgramId }) {
  const loans = programId === 'udf' ? UDF_LOANS : THHI_LOANS
  const buckets = [
    { label: '< $200K', min: 0, max: 200000 },
    { label: '$200–300K', min: 200000, max: 300000 },
    { label: '$300–400K', min: 300000, max: 400000 },
    { label: '$400–500K', min: 400000, max: 500000 },
    { label: '$500K+', min: 500000, max: Infinity },
  ]
  const data = buckets.map((b) => ({
    label: b.label,
    count: loans.filter((l) => l.purchasePrice >= b.min && l.purchasePrice < b.max).length,
  }))

  return (
    <Card>
      <Label className="block mb-4">Home Price Distribution</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data.filter((d) => d.count > 0)}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill={PROGRAM_COLORS[programId]} radius={[4, 4, 0, 0]} name="Homes" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function THHICLTVChart() {
  const loans = THHI_LOANS.filter((l) => l.previewCLTV !== null)
  const data = loans.map((l) => ({
    id: l.id,
    cltv: l.previewCLTV!,
  }))

  if (data.length === 0) return null

  return (
    <Card>
      <Label className="block mb-4">Combined LTV (CLTV)</Label>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="id" tick={{ fontSize: 11, fill: CHART_COLORS.gray }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.gray }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <ReferenceLine y={80} stroke={CHART_COLORS.accent} strokeDasharray="5 5" label={{ value: '80% CLTV', fill: CHART_COLORS.accent, fontSize: 10 }} />
          <Bar dataKey="cltv" fill={CHART_COLORS.dark} radius={[4, 4, 0, 0]} name="CLTV %" />
        </BarChart>
      </ResponsiveContainer>
      <Caption className="mt-2 block">CLTV from portfolio snapshot (preview data)</Caption>
    </Card>
  )
}
