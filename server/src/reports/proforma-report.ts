/**
 * Pro Forma Report — Investor-grade sales collateral PDF
 *
 * 5-page landscape deck: rich narrative + data. Reads like a pitch deck
 * with Homium's value proposition woven throughout.
 *
 * Pages:
 *   1. Cover — fund identity, US map, Homium wordmark
 *   2. The Opportunity — affordability crisis narrative + key callouts
 *   3. Program Impact — borrower profile, metrics, 30yr projections
 *   4. 30-Year Charts — 4 SVG visualizations
 *   5. Disclaimer
 */

import { FundConfig, FundModelResult, FundYearState, AffordabilityResult } from '../engine/types';
import { TopOffYearState } from '../engine/topoff-calculator';
import { STATE_PATHS, homiumWordmark } from './us-map-paths';
import { COUNTY_PATHS } from './us-county-paths';
import { resolveCountyFips, STATE_FIPS } from './county-fips';

export interface ProformaData {
  fund: FundConfig;
  result: FundModelResult;
  blended: FundYearState[];
  affordability: AffordabilityResult;
  programName: string;
  geoLabel: string;
  topOff?: TopOffYearState[];
  geoBreakdown?: import('../engine/types').GeoBreakdownResult[];
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

// ── Formatting ──

const fmt = (n: number, d = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const fmtN = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtP = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
const fmtM = (n: number) => {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return fmt(n);
};
const fmtX = (n: number) => `${n.toFixed(2)}x`;

// ── Colors ──

const GREEN = '#3D7A58';
const GREEN_LIGHT = '#7BB394';
const GREEN_BG = 'rgba(61,122,88,0.07)';
const DARK = '#1A2930';
const GRAY = '#888';
const LIGHT_GRAY = '#AAA';
const BORDER = '#E5E5E0';
const CREAM = '#FAFAF8';

// ── US Map ──

function generateUSMapSVG(selectedState?: string, width = 400, height = 250): string {
  let paths = '';
  for (const [code, d] of Object.entries(STATE_PATHS)) {
    const fill = code === selectedState ? '#7BB394' : 'rgba(255,255,255,0.15)';
    const sw = code === selectedState ? '2' : '0.5';
    const extra = code === selectedState ? ' filter="url(#glow)"' : '';
    paths += `<path d="${d}" fill="${fill}" stroke="rgba(255,255,255,0.25)" stroke-width="${sw}"${extra} />`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 610" width="${width}" height="${height}" style="display:block;">
    <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${paths}</svg>`;
}

// ── Geo Choropleth Map ──

function generateGeoMapSVG(
  countyAllocations: Record<string, { pct: number; color: string }>,
  highlightedStates: Set<string>,
  width = 600, height = 380
): string {
  const maxPct = Math.max(...Object.values(countyAllocations).map(a => a.pct), 0.01);
  const numRegex = /[-+]?\d*\.?\d+/g;

  // Bounding box from allocated county paths
  let minX = 960, minY = 610, maxX = 0, maxY = 0;
  for (const fips of Object.keys(countyAllocations)) {
    const d = COUNTY_PATHS[fips];
    if (!d) continue;
    const nums = d.match(numRegex);
    if (!nums) continue;
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = parseFloat(nums[i]), y = parseFloat(nums[i + 1]);
      if (x > 0 && x < 960 && y > 0 && y < 610) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }

  // Smart crop: pad proportionally, tighter zoom for small areas
  const extentX = maxX - minX, extentY = maxY - minY;
  const padX = Math.max(extentX * 0.5, Math.min(80, extentX * 3));
  const padY = Math.max(extentY * 0.5, Math.min(80, extentY * 3));
  const vx = Math.max(0, minX - padX);
  const vy = Math.max(0, minY - padY);
  const vw = Math.min(960 - vx, extentX + padX * 2);
  const vh = Math.min(610 - vy, extentY + padY * 2);

  // Layer 1: All 50 states — light base
  let statePaths = '';
  for (const [code, d] of Object.entries(STATE_PATHS)) {
    statePaths += `<path d="${d}" fill="#EEEEE8" stroke="#fff" stroke-width="0.5" />`;
  }

  // Build set of highlighted state FIPS prefixes
  const highlightedPrefixes = new Set<string>();
  for (const st of highlightedStates) {
    const prefix = STATE_FIPS[st];
    if (prefix) highlightedPrefixes.add(prefix);
  }

  // Layer 2: County boundaries in highlighted states
  let countyPaths = '';
  for (const [fips, d] of Object.entries(COUNTY_PATHS)) {
    const statePrefix = fips.slice(0, 2);
    if (!highlightedPrefixes.has(statePrefix)) continue;

    const alloc = countyAllocations[fips];
    if (alloc) {
      const intensity = alloc.pct / maxPct;
      const r = Math.round(238 - (238 - 61) * intensity);
      const g = Math.round(238 - (238 - 122) * intensity);
      const b = Math.round(232 - (232 - 88) * intensity);
      const fill = `rgb(${r},${g},${b})`;
      countyPaths += `<path d="${d}" fill="${fill}" stroke="#fff" stroke-width="0.8" filter="url(#geoGlow)" />`;
    } else {
      countyPaths += `<path d="${d}" fill="#E2E2DC" stroke="#D0D0CA" stroke-width="0.3" />`;
    }
  }

  // Layer 3: Re-draw highlighted state borders on top for crisp outlines
  let stateOutlines = '';
  for (const st of highlightedStates) {
    const d = STATE_PATHS[st];
    if (d) {
      stateOutlines += `<path d="${d}" fill="none" stroke="#fff" stroke-width="1.2" />`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(0)} ${vy.toFixed(0)} ${vw.toFixed(0)} ${vh.toFixed(0)}" width="${width}" height="${height}" style="display:block;">
    <defs><filter id="geoGlow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${statePaths}${countyPaths}${stateOutlines}</svg>`;
}

// ── SVG Charts ──

function svgAreaChart(data: { x: number; y: number }[], w: number, h: number, color: string, label: string, yFmt?: (n: number) => string): string {
  if (!data.length) return '';
  const pad = { top: 38, right: 20, bottom: 38, left: 70 };
  const pW = w - pad.left - pad.right, pH = h - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d => d.y)) * 1.12 || 1;
  const minX = data[0].x, maxX = data[data.length - 1].x;
  const sx = (x: number) => pad.left + ((x - minX) / (maxX - minX)) * pW;
  const sy = (y: number) => pad.top + pH - (y / maxY) * pH;
  const fY = yFmt || ((v: number) => `$${(v / 1e6).toFixed(0)}M`);
  const pts = data.map(d => `${sx(d.x).toFixed(1)},${sy(d.y).toFixed(1)}`).join(' ');
  const area = `${sx(minX).toFixed(1)},${(pad.top + pH).toFixed(1)} ${pts} ${sx(maxX).toFixed(1)},${(pad.top + pH).toFixed(1)}`;
  let yT = '', xT = '';
  for (let i = 0; i <= 4; i++) {
    const v = (maxY / 4) * i, y = sy(v);
    yT += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + pW}" y2="${y}" stroke="${BORDER}" stroke-width="0.5"/>`;
    yT += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${GRAY}">${fY(v)}</text>`;
  }
  data.filter((_, i) => i % 5 === 0 || i === data.length - 1).forEach(d => {
    xT += `<text x="${sx(d.x)}" y="${pad.top + pH + 20}" text-anchor="middle" font-size="11" fill="${GRAY}">${d.x}</text>`;
  });
  const last = data[data.length - 1];
  const id = label.replace(/[^a-zA-Z]/g, '');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <text x="${pad.left}" y="24" font-size="14" font-weight="700" fill="${DARK}" font-family="Ubuntu,sans-serif">${label}</text>
    ${yT}${xT}
    <defs><linearGradient id="ag${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#ag${id})"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"/>
    <circle cx="${sx(last.x)}" cy="${sy(last.y)}" r="4" fill="${color}"/>
    <text x="${sx(last.x) - 6}" y="${sy(last.y) - 10}" text-anchor="end" font-size="13" font-weight="700" fill="${color}">${fY(last.y)}</text>
  </svg>`;
}

function svgBarChart(data: { x: number; y: number }[], w: number, h: number, color: string, label: string): string {
  if (!data.length) return '';
  const pad = { top: 38, right: 20, bottom: 38, left: 52 };
  const pW = w - pad.left - pad.right, pH = h - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d => d.y)) * 1.15 || 1;
  const bW = Math.min(16, (pW / data.length) * 0.6), gap = pW / data.length;
  let bars = '';
  data.forEach((d, i) => {
    const x = pad.left + i * gap + (gap - bW) / 2, bH = (d.y / maxY) * pH;
    bars += `<rect x="${x.toFixed(1)}" y="${(pad.top + pH - bH).toFixed(1)}" width="${bW}" height="${bH.toFixed(1)}" fill="${color}" rx="2" opacity="0.85"/>`;
  });
  const peak = data.reduce((m, d, i) => d.y > data[m].y ? i : m, 0);
  const px = pad.left + peak * gap + gap / 2, py = pad.top + pH - (data[peak].y / maxY) * pH;
  let yT = '', xT = '';
  for (let i = 0; i <= 4; i++) {
    const v = (maxY / 4) * i, y = pad.top + pH - (v / maxY) * pH;
    yT += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + pW}" y2="${y}" stroke="${BORDER}" stroke-width="0.5"/>`;
    yT += `<text x="${pad.left - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="${GRAY}">${Math.round(v)}</text>`;
  }
  data.filter((_, i) => i % 5 === 0 || i === data.length - 1).forEach((d, _, arr) => {
    const idx = data.indexOf(d);
    xT += `<text x="${pad.left + idx * gap + gap / 2}" y="${pad.top + pH + 20}" text-anchor="middle" font-size="11" fill="${GRAY}">${d.x}</text>`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <text x="${pad.left}" y="24" font-size="14" font-weight="700" fill="${DARK}" font-family="Ubuntu,sans-serif">${label}</text>
    ${yT}${xT}${bars}
    <text x="${px}" y="${py - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="${color}">${Math.round(data[peak].y)}</text>
  </svg>`;
}

function svgLineChart(data: Array<{ x: number; lines: { y: number; color: string; label: string }[] }>, w: number, h: number, title: string, yFmt: (n: number) => string): string {
  if (!data.length) return '';
  const pad = { top: 38, right: 20, bottom: 50, left: 70 };
  const pW = w - pad.left - pad.right, pH = h - pad.top - pad.bottom;
  const allY = data.flatMap(d => d.lines.map(l => l.y));
  const maxY = Math.max(...allY) * 1.12 || 1;
  const minX = data[0].x, maxX = data[data.length - 1].x;
  const sx = (x: number) => pad.left + ((x - minX) / (maxX - minX)) * pW;
  const sy = (y: number) => pad.top + pH - (y / maxY) * pH;
  let yT = '', xT = '';
  for (let i = 0; i <= 4; i++) {
    const v = (maxY / 4) * i, y = sy(v);
    yT += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + pW}" y2="${y}" stroke="${BORDER}" stroke-width="0.5"/>`;
    yT += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${GRAY}">${yFmt(v)}</text>`;
  }
  data.filter((_, i) => i % 5 === 0 || i === data.length - 1).forEach(d => {
    xT += `<text x="${sx(d.x)}" y="${pad.top + pH + 20}" text-anchor="middle" font-size="11" fill="${GRAY}">${d.x}</text>`;
  });
  const nL = data[0].lines.length;
  let lines = '', legend = '';
  for (let li = 0; li < nL; li++) {
    const pts = data.map(d => `${sx(d.x).toFixed(1)},${sy(d.lines[li].y).toFixed(1)}`).join(' ');
    const c = data[0].lines[li].color;
    lines += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2.5"/>`;
    const last = data[data.length - 1];
    lines += `<circle cx="${sx(last.x)}" cy="${sy(last.lines[li].y)}" r="4" fill="${c}"/>`;
    lines += `<text x="${sx(last.x) - 6}" y="${sy(last.lines[li].y) - 10}" text-anchor="end" font-size="13" font-weight="700" fill="${c}">${yFmt(last.lines[li].y)}</text>`;
  }
  if (nL > 1) {
    data[0].lines.forEach((l, i) => {
      const lx = pad.left + i * 180;
      legend += `<rect x="${lx}" y="${h - 12}" width="16" height="4" rx="2" fill="${l.color}"/>`;
      legend += `<text x="${lx + 22}" y="${h - 4}" font-size="11" font-weight="500" fill="${GRAY}">${l.label}</text>`;
    });
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <text x="${pad.left}" y="24" font-size="14" font-weight="700" fill="${DARK}" font-family="Ubuntu,sans-serif">${title}</text>
    ${yT}${xT}${lines}${legend}
  </svg>`;
}

// ── Page 1: Cover ──

function coverPage(data: ProformaData): string {
  const { fund, geoLabel, result } = data;
  const totalRaise = fund.raise.totalRaise;
  const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const fundName = fund.name || data.programName;
  const stateCode = fund.geography?.state;
  const isMultiGeo = result.geoBreakdown && result.geoBreakdown.length > 1;
  const stateName = isMultiGeo
    ? `${result.geoBreakdown!.length} Markets (${stateCode ? STATE_NAMES[stateCode] || stateCode : geoLabel})`
    : (stateCode ? STATE_NAMES[stateCode] || stateCode : geoLabel);

  return `
    <div class="page cover">
      <div class="cover-left">
        <div class="cover-brand">${homiumWordmark(DARK, 28)}</div>
        <div class="cover-spacer"></div>
        <p class="cover-eyebrow">Shared Appreciation Homeownership Program</p>
        <h1 class="cover-title">${fundName}</h1>
        <div class="cover-rule"></div>
        <p class="cover-tagline">The gap between what families earn and what homes cost has never been wider. This fund uses Homium's shared appreciation model to close that gap&mdash;creating homeowners and generating returns.</p>
        <div class="cover-stats">
          <div class="cover-stat"><span class="cs-val">${fmtM(totalRaise)}</span><span class="cs-lbl">Fund Size</span></div>
          <div class="cs-div"></div>
          <div class="cover-stat"><span class="cs-val">${stateName}</span><span class="cs-lbl">Target Market</span></div>
          <div class="cs-div"></div>
          <div class="cover-stat"><span class="cs-val">${date}</span><span class="cs-lbl">Date Prepared</span></div>
        </div>
        <div class="cover-spacer"></div>
        <div class="cover-foot">Prepared by Homium, Inc. &middot; Confidential</div>
      </div>
      <div class="cover-right">
        <div class="cover-map-wrap">
          ${generateUSMapSVG(stateCode, 440, 275)}
          <div class="cover-map-lbl">${stateName}</div>
        </div>
      </div>
    </div>`;
}

// ── Page 2: Impact Billboard ──

function opportunityPage(data: ProformaData): string {
  const { fund, blended, affordability, result, geoLabel } = data;
  const fundLife = blended.length || 30;
  const yrEnd = blended[fundLife - 1] || blended[blended.length - 1];
  const homeowners = result.totalHomeowners;
  const monthlySavings = affordability.pitiBeforeHomium - affordability.pitiAfterHomium;
  const fundName = fund.name || data.programName;
  const stateCode = fund.geography?.state;
  const isMultiGeo = result.geoBreakdown && result.geoBreakdown.length > 1;
  const stateName = isMultiGeo
    ? (stateCode ? STATE_NAMES[stateCode] || geoLabel : geoLabel)
    : (stateCode ? STATE_NAMES[stateCode] || geoLabel : geoLabel);

  return `
    <div class="page opp">
      <div class="page-inner">
        <div class="sbar"><div class="sbar-l"><span class="sbar-tag">The Opportunity</span><span class="sbar-name">${fundName}</span></div><div class="sbar-r">${homiumWordmark(LIGHT_GRAY, 18)}</div></div>

        <div class="bb-hero">
          <h2 class="bb-headline">${fmtN(homeowners)} Families Could<br/>Own a Home in ${isMultiGeo ? `${result.geoBreakdown!.length} ${stateName} Communities` : stateName}</h2>
          <p class="bb-sub">A shared appreciation mortgage makes homeownership affordable&mdash;and generates returns for investors.</p>
        </div>

        <div class="bb-payment">
          <div class="bb-pay-before">
            <div class="bb-pay-label">Without Homium</div>
            <div class="bb-pay-amount">${fmt(affordability.pitiBeforeHomium, 0)}<span>/mo</span></div>
            <div class="bb-pay-note">Over budget by ${fmt(affordability.pitiBeforeHomium - affordability.maxPITI, 0)}/mo</div>
          </div>
          <div class="bb-pay-arrow">&#10132;</div>
          <div class="bb-pay-after">
            <div class="bb-pay-label">With Homium</div>
            <div class="bb-pay-amount">${fmt(affordability.pitiAfterHomium, 0)}<span>/mo</span></div>
            <div class="bb-pay-note">${affordability.pitiAfterHomium <= affordability.maxPITI ? 'Now affordable' : `Gap reduced to ${fmt(affordability.pitiAfterHomium - affordability.maxPITI, 0)}/mo`}</div>
          </div>
          <div class="bb-pay-savings">
            <div class="bb-sav-num">${fmt(monthlySavings, 0)}</div>
            <div class="bb-sav-lbl">saved every month</div>
          </div>
        </div>

        <div class="bb-metrics">
          <div class="bb-metric">
            <div class="bb-metric-num green">${yrEnd ? fmtM(yrEnd.totalEquityCreated) : '--'}</div>
            <div class="bb-metric-lbl">Homeowner Equity Created</div>
            <div class="bb-metric-sub">over ${fundLife} years</div>
          </div>
          <div class="bb-metric-div"></div>
          <div class="bb-metric">
            <div class="bb-metric-num">${yrEnd ? fmtX(yrEnd.roiCumulative) : '--'}</div>
            <div class="bb-metric-lbl">Fund Return</div>
            <div class="bb-metric-sub">${fundLife}-year cumulative ROI</div>
          </div>
          <div class="bb-metric-div"></div>
          <div class="bb-metric">
            <div class="bb-metric-num green">${yrEnd ? fmtM(yrEnd.totalEquityCreated) : '--'}</div>
            <div class="bb-metric-lbl">Total Wealth Created</div>
            <div class="bb-metric-sub">over ${fundLife} years</div>
          </div>
        </div>

        <div class="bb-footer">
          <span class="bb-foot-item">${fmtM(fund.raise.totalRaise)} Fund</span>
          <span class="bb-foot-dot">&middot;</span>
          <span class="bb-foot-item">${fmtP(fund.program.homiumSAPct, 0)} Shared Appreciation Mortgage</span>
          <span class="bb-foot-dot">&middot;</span>
          <span class="bb-foot-item">${fmtP(fund.assumptions.hpaPct, 1)} HPA</span>
          <span class="bb-foot-dot">&middot;</span>
          <span class="bb-foot-item">${fmtP(fund.assumptions.interestRate, 1)} Rate</span>
        </div>

        <div class="page-num">2</div>
      </div>
    </div>`;
}

// ── Page 3: Program Detail (Data Room) ──

function impactPage(data: ProformaData): string {
  const { fund, blended, affordability, result, geoLabel } = data;
  const monthlySavings = affordability.pitiBeforeHomium - affordability.pitiAfterHomium;
  const fundName = fund.name || data.programName;
  const midScenario = fund.scenarios.find(s => s.name === 'MID') || fund.scenarios[0];
  const scenarios = result.scenarioResults;
  const totalRaise = fund.raise.totalRaise;
  const stateCode = fund.geography?.state;
  const stateName = stateCode ? STATE_NAMES[stateCode] || geoLabel : geoLabel;
  const isMultiGeo = result.geoBreakdown && result.geoBreakdown.length > 1;
  const fundLife = blended.length || 30;

  // Adapt milestone rows to fund term
  const allMilestones = fundLife <= 5
    ? Array.from({ length: fundLife }, (_, i) => i)           // 5yr: show every year
    : fundLife <= 10
    ? Array.from({ length: fundLife }, (_, i) => i).filter(i => i % 2 === 0 || i === fundLife - 1)  // 10yr: every 2 years
    : [0, 2, 4, 6, 9, 14, 19, 24, 29];                           // 15+: original milestones
  const milestones = allMilestones.filter(i => i < blended.length);

  return `
    <div class="page impact">
      <div class="page-inner">
        <div class="sbar"><div class="sbar-l"><span class="sbar-tag">Program Detail</span><span class="sbar-name">${fundName}</span></div><div class="sbar-r">${homiumWordmark(LIGHT_GRAY, 18)}</div></div>

        <div class="dr-cols">
          <div class="dr-left">
            <h3 class="dr-head">Typical ${isMultiGeo ? 'Program' : stateName} Borrower</h3>
            <div class="dr-borrow-row">
              <div class="dr-b-card">
                <div class="dr-b-badge">Without Homium</div>
                <div class="dr-b-big">${fmt(affordability.pitiBeforeHomium, 0)}<span>/mo</span></div>
                <div class="dr-b-line"><span>Income</span><strong>${fmt(midScenario.medianIncome)}</strong></div>
                <div class="dr-b-line"><span>Home Price</span><strong>${fmt(midScenario.medianHomeValue)}</strong></div>
                <div class="dr-b-line"><span>Max Affordable</span><strong>${fmt(affordability.maxPITI, 0)}/mo</strong></div>
                <div class="dr-b-gap-neg">Over budget by ${fmt(affordability.pitiBeforeHomium - affordability.maxPITI, 0)}/mo</div>
              </div>
              <div class="dr-arrow">&#10132;</div>
              <div class="dr-b-card dr-b-green">
                <div class="dr-b-badge gbadge">With Homium</div>
                <div class="dr-b-big green">${fmt(affordability.pitiAfterHomium, 0)}<span>/mo</span></div>
                <div class="dr-b-line"><span>Reduced Mortgage</span><strong>${fmt(affordability.reducedMortgage)}</strong></div>
                <div class="dr-b-line"><span>SAM Position</span><strong>${fmt(affordability.homiumPrincipal)}</strong></div>
                <div class="dr-b-line"><span>Monthly Savings</span><strong class="green">${fmt(monthlySavings, 0)}</strong></div>
                <div class="dr-b-gap-pos">${affordability.pitiAfterHomium <= affordability.maxPITI ? 'Now affordable' : `Gap: ${fmt(affordability.pitiAfterHomium - affordability.maxPITI, 0)}/mo`}</div>
              </div>
            </div>

            <h3 class="dr-head" style="margin-top:16px">Fund Parameters</h3>
            <div class="dr-params-grid">
              <div class="dr-p"><span>Fund Size</span><strong>${fmtM(totalRaise)}</strong></div>
              <div class="dr-p"><span>Homium SAM</span><strong>${fmtP(fund.program.homiumSAPct, 0)}</strong></div>
              <div class="dr-p"><span>Down Payment</span><strong>${fmtP(fund.program.downPaymentPct, 0)}</strong></div>
              <div class="dr-p"><span>Program Fee</span><strong>${fmtP(fund.fees.programFeePct, 0)}</strong></div>
              <div class="dr-p"><span>Mgmt Fee</span><strong>${fmtP(fund.fees.managementFeePct, 1)}</strong></div>
              <div class="dr-p"><span>Interest Rate</span><strong>${fmtP(fund.assumptions.interestRate, 1)}</strong></div>
              <div class="dr-p"><span>HPA Assumption</span><strong>${fmtP(fund.assumptions.hpaPct, 1)}</strong></div>
              <div class="dr-p"><span>Reinvest</span><strong>${fund.raise.reinvestNetProceeds ? 'Yes' : 'No'}</strong></div>
            </div>

            ${scenarios.length > 1 ? (() => {
              const geoBreakdown = result.geoBreakdown;
              if (geoBreakdown && geoBreakdown.length > 1) {
                // Multi-geo: show aggregate program impact metrics
                const totalHO = result.totalHomeowners;
                const totalWeight = scenarios.reduce((s, sr) => s + sr.scenario.weight, 0) || 1;
                const wtdIncome = scenarios.reduce((s, sr) => s + sr.scenario.medianIncome * sr.scenario.weight, 0) / totalWeight;
                const wtdHome = scenarios.reduce((s, sr) => s + sr.scenario.medianHomeValue * sr.scenario.weight, 0) / totalWeight;
                const wtdSAM = wtdHome * fund.program.homiumSAPct;
                const wtdDP = wtdHome * fund.program.downPaymentPct;
                const wtdMortgage = wtdHome - wtdSAM - wtdDP;
                const yrEnd = blended[fundLife - 1] || blended[blended.length - 1];
                const geoCount = geoBreakdown.length;
                return `
                  <h3 class="dr-head" style="margin-top:12px">Program Impact</h3>
                  <table class="sc-table"><tbody>
                    <tr><td>Geographies</td><td class="bold">${fmtN(geoCount)}</td></tr>
                    <tr><td>Total Homeowners</td><td class="bold">${fmtN(totalHO)}</td></tr>
                    <tr><td>Wtd Avg Income</td><td class="bold">${fmt(wtdIncome, 0)}</td></tr>
                    <tr><td>Wtd Avg Home Value</td><td class="bold">${fmt(wtdHome, 0)}</td></tr>
                    <tr><td>Avg SA Position</td><td class="bold">${fmt(wtdSAM, 0)}</td></tr>
                    <tr><td>Avg Down Payment</td><td class="bold">${fmt(wtdDP, 0)}</td></tr>
                    <tr><td>Avg First Mortgage</td><td class="bold">${fmt(wtdMortgage, 0)}</td></tr>
                    ${yrEnd ? `<tr><td>Yr ${fundLife} Equity Created</td><td class="bold">${fmtM(yrEnd.totalEquityCreated)}</td></tr>
                    <tr><td>Yr ${fundLife} ROI</td><td class="bold">${fmtX(yrEnd.roiCumulative)}</td></tr>` : ''}
                  </tbody></table>
                  <p style="font-size:11px;color:${GRAY};margin-top:8px;font-style:italic">Full detail by geography on the Geographic Distribution page.</p>`;
              }
              return `
                <h3 class="dr-head" style="margin-top:16px">Scenarios</h3>
                <table class="sc-table"><thead><tr><th>Name</th><th>HOs</th><th>Income</th><th>Home</th></tr></thead><tbody>
                ${scenarios.map(sr => `<tr><td class="bold">${sr.scenario.name}</td><td>${fmtN(sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0))}</td><td>${fmt(sr.scenario.medianIncome, 0)}</td><td>${fmt(sr.scenario.medianHomeValue, 0)}</td></tr>`).join('')}
                </tbody></table>`;
            })() : ''}
          </div>

          <div class="dr-right">
            <h3 class="dr-head">${fundLife}-Year Projections</h3>
            <table class="proj-table proj-table-full">
              <thead><tr><th>Year</th><th>Active HOs</th><th>Equity Created</th><th>Fund NAV</th><th>Capital Returned</th><th>ROI</th></tr></thead>
              <tbody>
                ${milestones.map(i => {
                  const y = blended[i];
                  const hl = i === fundLife - 1 || i === blended.length - 1;
                  return `<tr class="${hl ? 'hl-row' : ''}"><td>${y.calendarYear}</td><td>${fmtN(y.activeHomeowners)}</td><td>${fmtM(y.totalEquityCreated)}</td><td>${fmtM(y.fundNAV)}</td><td>${fmtM(y.cumulativeDistributions)}</td><td>${fmtX(y.roiCumulative)}</td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="page-num">3</div>
      </div>
    </div>`;
}

// ── Page 4: Charts ──

function chartsPage(data: ProformaData): string {
  const { blended, fund } = data;
  const cW = 660, cH = 340;
  const fundName = fund.name || data.programName;

  const cd = blended.map(y => ({
    year: y.calendarYear,
    equity: y.totalEquityCreated,
    ho: y.activeHomeowners,
    fv: y.fundNAV || y.fundBalance,
    dist: y.cumulativeDistributions,
    roi: y.roiCumulative,
  }));

  return `
    <div class="page charts">
      <div class="page-inner">
        <div class="sbar"><div class="sbar-l"><span class="sbar-tag">${blended.length || 30}-Year Projections</span><span class="sbar-name">${fundName}</span></div><div class="sbar-r">${homiumWordmark(LIGHT_GRAY, 18)}</div></div>

        <div class="charts-grid">
          <div class="chart-card">${svgAreaChart(cd.map(d => ({ x: d.year, y: d.equity })), cW, cH, GREEN, 'Homeowner Equity Created')}</div>
          <div class="chart-card">${svgBarChart(cd.map(d => ({ x: d.year, y: d.ho })), cW, cH, GREEN, 'Active Homeowners')}</div>
          <div class="chart-card">${svgLineChart(cd.map(d => ({ x: d.year, lines: [{ y: d.fv, color: DARK, label: 'Fund Value' }, { y: d.dist, color: GREEN, label: 'Returned Capital' }] })), cW, cH, 'Fund Value & Returns', v => `$${(v / 1e6).toFixed(0)}M`)}</div>
          <div class="chart-card">${svgLineChart(cd.map(d => ({ x: d.year, lines: [{ y: d.roi, color: GREEN, label: 'ROI' }] })), cW, cH, 'Cumulative ROI', v => `${v.toFixed(1)}x`)}</div>
        </div>

        <div class="charts-foot">Projections assume ${fmtP(fund.assumptions.hpaPct, 1)} annual HPA and ${fmtP(fund.assumptions.interestRate, 1)} mortgage rate. See disclaimer for full details.</div>
        <div class="page-num">4</div>
      </div>
    </div>`;
}

// ── Page 5 (conditional): Geographic Distribution — multi-geo only ──

function geoDistributionPage(data: ProformaData): string {
  const { fund, result, blended } = data;
  const geoBreakdown = result.geoBreakdown;
  if (!geoBreakdown || geoBreakdown.length < 2) return '';

  const fundLife = blended.length || 30;
  const fundName = fund.name || data.programName;

  const colors = [GREEN, DARK, GREEN_LIGHT, '#5BA37E', '#2E6046', '#4A9268'];
  const isCompact = geoBreakdown.length > 6;

  // ── Resolve county FIPS and build allocations ──
  const countyAllocations: Record<string, { pct: number; color: string }> = {};
  const highlightedStates = new Set<string>();

  geoBreakdown.forEach((gb, i) => {
    const st = gb.geo.state;
    if (!st) return;
    highlightedStates.add(st);

    const countyName = gb.geo.county || gb.geo.geoLabel;
    const fips = gb.geo.fips || resolveCountyFips(st, countyName);

    if (fips && COUNTY_PATHS[fips]) {
      countyAllocations[fips] = {
        pct: gb.geo.allocationPct,
        color: colors[i % colors.length],
      };
    }
    // If FIPS unresolved → that geo won't highlight on map (table still shows it)
  });

  const uniqueStates = new Set(geoBreakdown.map(gb => gb.geo.state).filter(Boolean));
  const totalHOs = geoBreakdown.reduce((s, gb) => s + gb.totalHomeowners, 0);
  const totalCapital = fund.raise.totalRaise;

  // ── Portfolio Snapshot ──
  const snapshot = `<div style="background:${CREAM};border:1px solid ${BORDER};border-radius:12px;padding:20px 24px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${GREEN};margin-bottom:12px">Portfolio Snapshot</div>
    <div style="font-family:'Taviraj',serif;font-size:28px;font-weight:600;color:${DARK};line-height:1.2">${geoBreakdown.length} <span style="font-size:14px;font-weight:400;color:${GRAY}">markets</span> · ${uniqueStates.size} <span style="font-size:14px;font-weight:400;color:${GRAY}">${uniqueStates.size === 1 ? 'state' : 'states'}</span></div>
    <div style="font-size:14px;color:${DARK};margin-top:8px;font-weight:500">${fmtN(totalHOs)} <span style="color:${GRAY};font-weight:400">homeowners</span> · ${fmt(totalCapital, 0)} <span style="color:${GRAY};font-weight:400">deployed</span></div>
  </div>`;

  // ── Per-geo summary stats (replaces affordability bars + stacked allocation bar) ──
  const geoStatsRows = geoBreakdown.map((gb, i) => {
    return `<tr>
      <td style="padding:4px 6px;font-size:12px;white-space:nowrap"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${colors[i % colors.length]};margin-right:6px;vertical-align:middle"></span>${gb.geo.geoLabel}</td>
      <td style="padding:4px 6px;font-size:12px;text-align:right">${fmtP(gb.geo.allocationPct, 0)}</td>
      <td style="padding:4px 6px;font-size:12px;text-align:right">${fmt(gb.geo.medianIncome, 0)}</td>
      <td style="padding:4px 6px;font-size:12px;text-align:right">${fmt(gb.geo.medianHomeValue, 0)}</td>
      <td style="padding:4px 6px;font-size:12px;text-align:right">${fmtN(gb.totalHomeowners)}</td>
    </tr>`;
  }).join('');

  const geoStatsHeaderStyle = `font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${GRAY};padding:4px 6px;border-bottom:1px solid ${BORDER}`;
  const geoStatsCard = `<div style="margin-top:16px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${GRAY};margin-bottom:8px">Market Summary</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${geoStatsHeaderStyle};text-align:left">Geography</th>
        <th style="${geoStatsHeaderStyle};text-align:right">Alloc</th>
        <th style="${geoStatsHeaderStyle};text-align:right">Income</th>
        <th style="${geoStatsHeaderStyle};text-align:right">Home</th>
        <th style="${geoStatsHeaderStyle};text-align:right">HOs</th>
      </tr></thead>
      <tbody>${geoStatsRows}</tbody>
    </table>
  </div>`;

  // ── Scenario tables (for ≤6 geos) ──
  const isSmallGeoCount = geoBreakdown.length <= 6;
  const scenarioFontSize = geoBreakdown.length <= 4 ? '12px' : '11px';
  const scenarioPad = geoBreakdown.length <= 4 ? '4px 10px' : '3px 6px';

  // ── Compact table for 7+ geos (with inline affordability bars) ──
  const useTwoCol = geoBreakdown.length >= 13;
  const fontSize = geoBreakdown.length >= 13 ? '11px' : '12px';
  const compactMaxRatio = Math.max(...geoBreakdown.map(gb => gb.geo.medianHomeValue / gb.geo.medianIncome), 0.01);
  const compactRows = geoBreakdown.map((gb, i) => {
    const ratio = gb.geo.medianHomeValue / gb.geo.medianIncome;
    const barW = (ratio / compactMaxRatio) * 100;
    return `<tr>
      <td style="padding:5px 8px;font-size:${fontSize}"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${colors[i % colors.length]};margin-right:6px;vertical-align:middle"></span>${gb.geo.geoLabel}</td>
      <td style="padding:5px 8px;text-align:right;font-size:${fontSize};font-weight:600">${fmtP(gb.geo.allocationPct, 0)}</td>
      <td style="padding:5px 8px;font-size:${fontSize};width:120px">
        <div style="display:flex;align-items:center;gap:4px">
          <div style="flex:1;height:12px;background:#f0f0ec;border-radius:3px;overflow:hidden"><div style="width:${barW}%;height:100%;background:${colors[i % colors.length]};border-radius:3px"></div></div>
          <span style="font-weight:600;white-space:nowrap">${ratio.toFixed(1)}×</span>
        </div>
      </td>
      <td style="padding:5px 8px;text-align:right;font-size:${fontSize}">${fmtN(gb.totalHomeowners)}</td>
    </tr>`;
  });

  const compactTable = (() => {
    if (!isCompact) return '';
    const headerStyle = `font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${GRAY};padding:5px 8px;border-bottom:1px solid ${BORDER}`;
    const tableHeader = `<thead><tr><th style="${headerStyle};text-align:left">Geography</th><th style="${headerStyle};text-align:right">Alloc</th><th style="${headerStyle};text-align:left">Affordability</th><th style="${headerStyle};text-align:right">HOs</th></tr></thead>`;
    if (useTwoCol) {
      const mid = Math.ceil(compactRows.length / 2);
      const col1 = compactRows.slice(0, mid).join('');
      const col2 = compactRows.slice(mid).join('');
      return `<div style="display:flex;gap:16px;flex:1">
        <table style="flex:1;border-collapse:collapse">${tableHeader}<tbody>${col1}</tbody></table>
        <table style="flex:1;border-collapse:collapse">${tableHeader}<tbody>${col2}</tbody></table>
      </div>`;
    }
    return `<table style="width:100%;border-collapse:collapse;flex:1">${tableHeader}<tbody>${compactRows.join('')}</tbody></table>`;
  })();

  // ── Layout: branch on geo count ──
  if (isCompact) {
    // 7+ geos: full-width map on top, snapshot + compact table below
    const mapSvg = generateGeoMapSVG(countyAllocations, highlightedStates, 1350, 280);
    return `
    <div class="page" style="background:#fff">
      <div class="page-inner">
        <div class="sbar"><div class="sbar-l"><span class="sbar-tag">Geographic Distribution</span><span class="sbar-name">${fundName}</span></div><div class="sbar-r">${homiumWordmark(LIGHT_GRAY, 18)}</div></div>

        <div style="background:${CREAM};border:1px solid ${BORDER};border-radius:12px;padding:10px;margin-bottom:14px;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${mapSvg}
        </div>

        <div style="display:flex;gap:20px;flex:1">
          <div style="flex:0 0 200px;display:flex;flex-direction:column;gap:12px">
            ${snapshot}
          </div>
          <div style="flex:1;display:flex;flex-direction:column">
            ${compactTable}
          </div>
        </div>

        <div class="page-num">5</div>
      </div>
    </div>`;
  }

  // ≤6 geos: map left + snapshot/stats right, scenario tables below
  const mapSvg = generateGeoMapSVG(countyAllocations, highlightedStates, 640, 340);

  const scenarioSection = isSmallGeoCount ? (() => {
    const perRow = geoBreakdown.length <= 3 ? geoBreakdown.length : 3;
    const widthPct = `calc(${(100 / perRow).toFixed(1)}% - ${Math.ceil(24 * (perRow - 1) / perRow)}px)`;
    const wrappedBlocks = geoBreakdown.map((gb, i) => {
      const rows = gb.scenarioResults.map(sr => {
        const ho = sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0);
        return `<tr>
          <td style="padding:${scenarioPad};font-weight:600">${sr.scenario.name}</td>
          <td style="padding:${scenarioPad};text-align:right">${fmtN(ho)}</td>
          <td style="padding:${scenarioPad};text-align:right">${fmt(sr.scenario.medianIncome)}</td>
          <td style="padding:${scenarioPad};text-align:right">${fmt(sr.scenario.medianHomeValue)}</td>
        </tr>`;
      }).join('');
      return `<div style="flex:0 0 ${widthPct};min-width:0">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${colors[i % colors.length]};margin-bottom:6px">${gb.geo.geoLabel}</div>
        <table style="width:100%;border-collapse:collapse;font-size:${scenarioFontSize}">
          <thead><tr style="border-bottom:1px solid ${BORDER}"><th style="text-align:left;padding:${scenarioPad};font-size:10px;color:${GRAY}">Scenario</th><th style="text-align:right;padding:${scenarioPad};font-size:10px;color:${GRAY}">HOs</th><th style="text-align:right;padding:${scenarioPad};font-size:10px;color:${GRAY}">Income</th><th style="text-align:right;padding:${scenarioPad};font-size:10px;color:${GRAY}">Home</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');
    return `<h3 class="dr-head">Scenario Detail by Geography</h3>
      <div style="display:flex;flex-wrap:wrap;gap:16px 24px;margin-top:10px">${wrappedBlocks}</div>`;
  })() : '';

  return `
    <div class="page" style="background:#fff">
      <div class="page-inner">
        <div class="sbar"><div class="sbar-l"><span class="sbar-tag">Geographic Distribution</span><span class="sbar-name">${fundName}</span></div><div class="sbar-r">${homiumWordmark(LIGHT_GRAY, 18)}</div></div>

        <div style="display:flex;gap:24px;margin-bottom:16px">
          <div style="flex:0 0 55%;background:${CREAM};border:1px solid ${BORDER};border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:center;overflow:hidden">
            ${mapSvg}
          </div>
          <div style="flex:1;display:flex;flex-direction:column">
            ${snapshot}
            ${geoStatsCard}
          </div>
        </div>

        ${scenarioSection}

        <div class="page-num">5</div>
      </div>
    </div>`;
}

// ── Top-Off Sensitivity ──

function topOffPage(data: ProformaData): string {
  const { fund, topOff } = data;
  if (!topOff || !topOff.length) return '';

  const fundName = fund.name || data.programName;
  const hpa = fund.assumptions.hpaPct;
  const wg = fund.assumptions.wageGrowthPct || 0;
  const fixedHomes = fund.program.fixedHomeCount || 0;
  const milestones = [0, 1, 3, 5, 8, 13, 18, 23, 29].filter(i => i < topOff.length);

  const totalTopOff = topOff[topOff.length - 1].cumulativeTopOff;
  const avgAnnual = totalTopOff / 30;
  const peakYear = topOff.reduce((max, y) => y.annualTopOff > max.annualTopOff ? y : max, topOff[0]);

  // Dual-line chart: home value vs income indexed to 100
  const chartData = topOff.filter((_, i) => i % 2 === 0 || i === topOff.length - 1).map(y => ({
    x: y.calendarYear,
    lines: [
      { y: y.homeValue, color: DARK, label: 'Home Value' },
      { y: y.income80AMI, color: GREEN, label: '80% AMI Income' },
    ],
  }));

  return `
    <div class="page topoff">
      <div class="page-inner">
        <div class="sbar"><div class="sbar-l"><span class="sbar-tag">Affordability Sensitivity</span><span class="sbar-name">${fundName}</span></div><div class="sbar-r">${homiumWordmark(LIGHT_GRAY, 18)}</div></div>

        <div class="to-cols">
          <div class="to-left">
            <div class="to-assumptions">
              <h3 class="dr-head">Key Assumptions</h3>
              <div class="dr-params-grid">
                <div class="dr-p"><span>HPA Rate</span><strong>${fmtP(hpa, 1)}</strong></div>
                <div class="dr-p"><span>Wage Growth</span><strong>${fmtP(wg, 1)}</strong></div>
                <div class="dr-p"><span>Target AMI</span><strong>80%</strong></div>
                <div class="dr-p"><span>Fixed Homes</span><strong>${fmtN(fixedHomes)}</strong></div>
                <div class="dr-p"><span>HPA − WG Spread</span><strong>${fmtP(hpa - wg, 1)}</strong></div>
                <div class="dr-p"><span>SAM %</span><strong>${fmtP(fund.program.homiumSAPct, 0)}</strong></div>
              </div>
            </div>

            <div class="to-chart" style="margin-top:10px;flex:1;display:flex;align-items:center">
              ${svgLineChart(chartData, 480, 380, 'Home Value vs. Income Growth', v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`)}
            </div>

            <div class="to-summary" style="margin-top:10px">
              <h3 class="dr-head">30-Year Summary</h3>
              <div class="to-summary-grid">
                <div class="to-sum-card">
                  <div class="to-sum-num">${fmtM(totalTopOff)}</div>
                  <div class="to-sum-lbl">Total Top-Off</div>
                </div>
                <div class="to-sum-card">
                  <div class="to-sum-num">${fmtM(avgAnnual)}</div>
                  <div class="to-sum-lbl">Avg Annual</div>
                </div>
                <div class="to-sum-card">
                  <div class="to-sum-num">${peakYear.calendarYear}</div>
                  <div class="to-sum-lbl">Peak Year (${fmtM(peakYear.annualTopOff)})</div>
                </div>
              </div>
            </div>
          </div>

          <div class="to-right">
            <h3 class="dr-head">Top-Off Schedule</h3>
            <table class="proj-table proj-table-full to-table">
              <thead><tr><th>Year</th><th>Home Value</th><th>80% AMI</th><th>SAM Req'd</th><th>Recycled</th><th>Period Top-Off</th><th>Cumulative</th></tr></thead>
              <tbody>
                ${milestones.map((idx, mi) => {
                  const y = topOff[idx];
                  const prevCum = mi > 0 ? topOff[milestones[mi - 1]].cumulativeTopOff : 0;
                  const periodTopOff = y.cumulativeTopOff - prevCum;
                  const hl = periodTopOff > 0;
                  return `<tr class="${hl ? 'hl-row' : ''}">
                    <td>${y.calendarYear}</td>
                    <td>${fmtM(y.homeValue)}</td>
                    <td>${fmtM(y.income80AMI)}</td>
                    <td>${fmtM(y.samRequired)}</td>
                    <td>${fmtM(y.recycledPerHome)}</td>
                    <td>${periodTopOff > 0 ? fmtM(periodTopOff) : '—'}</td>
                    <td>${fmtM(y.cumulativeTopOff)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="page-num">5</div>
      </div>
    </div>`;
}

// ── Page 5/6: Disclaimer ──

function disclaimerPage(data: ProformaData): string {
  const fundName = data.fund.name || data.programName;
  const stateCode = data.fund.geography?.state;
  const stateName = stateCode ? STATE_NAMES[stateCode] || data.geoLabel : data.geoLabel;
  const hasGeo = data.result.geoBreakdown && data.result.geoBreakdown.length > 1;
  const pageNum = 4 + (hasGeo ? 1 : 0) + (data.topOff ? 1 : 0) + 1;
  return `
    <div class="page disclaimer">
      <div class="page-inner">
        <div class="disc-top">${homiumWordmark(DARK, 26)}</div>
        <h2 class="disc-title">Important Disclosures</h2>
        <div class="disc-cols">
          <div class="disc-col">
            <h3>NOTICE OF CONFIDENTIAL INFORMATION</h3>
            <p>This document has been prepared by Homium, Inc. ("Homium") for informational purposes only and is strictly confidential. This document is not an offer or solicitation to buy or sell any security or to participate in any investment strategy.</p>
            <p>The projections and estimates contained in this document are based on assumptions that Homium believes to be reasonable as of the date hereof. However, actual results may differ materially from those projected. No representation or warranty, express or implied, is given as to the accuracy, reliability, or completeness of the information contained herein.</p>
            <p>This material may not be reproduced, distributed, or transmitted to any third party without the prior written consent of Homium, Inc.</p>
          </div>
          <div class="disc-col">
            <h3>FORWARD-LOOKING STATEMENTS</h3>
            <p>This pro forma contains forward-looking projections. Actual events or results may differ materially. Factors include market conditions, interest rates, housing price appreciation rates, regulatory changes, and other risk factors.</p>
            <p>The ${fundName} model is based on the Homium Shared Appreciation Mortgage ("SAM") structure. Key assumptions including home price appreciation (${fmtP(data.fund.assumptions.hpaPct, 1)}), interest rates (${fmtP(data.fund.assumptions.interestRate, 1)}), and geographic market conditions (${stateName}) are subject to significant uncertainty.</p>
            <p>Past performance is not indicative of future results. All projected returns are hypothetical and not guarantees. Investors should conduct their own independent diligence and consult with professional advisors before investing.</p>
            <p style="margin-top:12px;font-size:11px;color:#999">&copy; ${new Date().getFullYear()} Homium, Inc. All rights reserved.</p>
          </div>
        </div>
        <div class="page-footer"><div class="pf-line"></div><div class="pf-row"><span>${fundName} &mdash; Pro Forma</span><span>Prepared by Homium, Inc. &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span><span>${pageNum}</span></div></div>
      </div>
    </div>`;
}

// ── Main export ──

export function generateProformaHTML(data: ProformaData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${data.fund.name || data.programName} Pro Forma</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Taviraj:wght@300;400;600;700&family=Ubuntu:wght@300;400;500;700&display=swap" rel="stylesheet"/>
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    @page{size:1440px 810px;margin:0}
    html,body{font-family:'Ubuntu',sans-serif;color:#333;background:#fff;font-size:14px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{width:1440px;height:810px;page-break-after:always;position:relative;overflow:hidden;background:#fff}
    .page:last-child{page-break-after:auto}
    .page-inner{padding:26px 44px;height:100%;position:relative;display:flex;flex-direction:column}
    .green{color:${GREEN}}.bold{font-weight:700}
    .page-num{position:absolute;bottom:14px;right:44px;font-size:11px;color:${LIGHT_GRAY}}

    /* Section Bar */
    .sbar{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;margin-bottom:14px;border-bottom:2px solid ${GREEN}}
    .sbar-l{display:flex;align-items:baseline;gap:14px}
    .sbar-tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${GREEN}}
    .sbar-name{font-family:'Taviraj',serif;font-size:22px;font-weight:400;color:${DARK}}
    .sbar-r{opacity:.35}

    /* ── COVER ── */
    .cover{display:flex}
    .cover-left{flex:0 0 54%;padding:40px 52px 32px;display:flex;flex-direction:column;background:#fff}
    .cover-brand{margin-bottom:0}
    .cover-spacer{flex:1;min-height:20px;max-height:60px}
    .cover-eyebrow{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:${GREEN};margin-bottom:8px}
    .cover-title{font-family:'Taviraj',serif;font-weight:300;font-size:60px;color:${DARK};line-height:1.05;margin-bottom:14px}
    .cover-rule{width:80px;height:3px;background:linear-gradient(90deg,${GREEN},${GREEN_LIGHT});margin-bottom:20px;border-radius:2px}
    .cover-tagline{font-size:16px;line-height:1.65;color:#555;margin-bottom:28px;max-width:580px}
    .cover-stats{display:flex;align-items:center;gap:0;margin-bottom:28px}
    .cover-stat{text-align:center;padding:0 28px}
    .cover-stat:first-child{padding-left:0;text-align:left}
    .cs-val{font-family:'Taviraj',serif;font-size:24px;font-weight:600;color:${DARK};display:block;line-height:1.2}
    .cs-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:${GRAY};margin-top:2px}
    .cs-div{width:1px;height:38px;background:${BORDER}}
    .cover-foot{font-size:10px;color:${LIGHT_GRAY}}
    .cover-right{flex:1;overflow:hidden;background:linear-gradient(155deg,${GREEN} 0%,${DARK} 100%);clip-path:polygon(14% 0,100% 0,100% 100%,0 100%);display:flex;align-items:center;justify-content:center}
    .cover-map-wrap{padding-left:28px;text-align:center}
    .cover-map-lbl{font-size:15px;font-weight:600;color:rgba(255,255,255,.85);letter-spacing:4px;text-transform:uppercase;margin-top:16px}

    /* ── BILLBOARD (Page 2) ── */
    .opp{background:#fff}
    .opp .page-inner{display:flex;flex-direction:column;justify-content:space-between}
    .bb-hero{text-align:center;padding:20px 0 0}
    .bb-headline{font-family:'Taviraj',serif;font-size:56px;font-weight:300;color:${DARK};line-height:1.08;margin-bottom:12px}
    .bb-sub{font-size:18px;color:${GRAY};line-height:1.5;max-width:800px;margin:0 auto}

    .bb-payment{display:flex;align-items:center;justify-content:center;gap:0;padding:24px 0}
    .bb-pay-before,.bb-pay-after{text-align:center;padding:24px 48px;border-radius:16px}
    .bb-pay-before{background:${CREAM};border:1px solid ${BORDER}}
    .bb-pay-after{background:${GREEN_BG};border:2px solid ${GREEN}}
    .bb-pay-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${GRAY};margin-bottom:4px}
    .bb-pay-after .bb-pay-label{color:${GREEN}}
    .bb-pay-amount{font-family:'Taviraj',serif;font-size:64px;font-weight:600;color:${DARK};line-height:1}
    .bb-pay-after .bb-pay-amount{color:${GREEN}}
    .bb-pay-amount span{font-size:22px;font-weight:300;color:${GRAY}}
    .bb-pay-after .bb-pay-amount span{color:${GREEN_LIGHT}}
    .bb-pay-note{font-size:13px;font-weight:600;margin-top:8px}
    .bb-pay-before .bb-pay-note{color:#C44}
    .bb-pay-after .bb-pay-note{color:${GREEN}}
    .bb-pay-arrow{font-size:48px;color:${GREEN};padding:0 32px;margin-top:12px}
    .bb-pay-savings{text-align:center;padding:0 0 0 40px;margin-top:12px}
    .bb-sav-num{font-family:'Taviraj',serif;font-size:52px;font-weight:700;color:${GREEN};line-height:1}
    .bb-sav-lbl{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:${GRAY};margin-top:4px}

    .bb-metrics{display:flex;align-items:center;justify-content:center;gap:0;background:linear-gradient(135deg,${DARK} 0%,#2a4a3a 100%);border-radius:16px;padding:36px 60px;box-shadow:0 8px 32px rgba(26,41,48,.25)}
    .bb-metric{text-align:center;flex:1}
    .bb-metric-num{font-family:'Taviraj',serif;font-size:52px;font-weight:600;color:#fff;line-height:1}
    .bb-metric-num.green{color:${GREEN_LIGHT}}
    .bb-metric-lbl{font-size:14px;font-weight:600;color:rgba(255,255,255,.85);margin-top:6px;text-transform:uppercase;letter-spacing:1.5px}
    .bb-metric-sub{font-size:12px;color:rgba(255,255,255,.45);margin-top:2px}
    .bb-metric-div{width:1px;height:60px;background:rgba(255,255,255,.15);margin:0 20px}

    .bb-footer{text-align:center;padding:8px 0 0;font-size:13px;color:${LIGHT_GRAY}}
    .bb-foot-item{font-weight:500}
    .bb-foot-dot{margin:0 10px;color:${BORDER}}

    /* ── DATA ROOM (Page 3) ── */
    .dr-cols{display:flex;gap:28px;flex:1}
    .dr-left{flex:0 0 480px;display:flex;flex-direction:column}
    .dr-right{flex:1;display:flex;flex-direction:column}
    .dr-head{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${GREEN};padding-bottom:4px;border-bottom:2px solid ${GREEN};margin-bottom:8px}
    .dr-borrow-row{display:flex;align-items:stretch;gap:0}
    .dr-b-card{flex:1;background:${CREAM};border:1px solid ${BORDER};border-radius:10px;padding:12px 16px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.05)}
    .dr-b-green{border:2px solid ${GREEN};background:${GREEN_BG};box-shadow:0 3px 12px rgba(61,122,88,.12)}
    .dr-b-badge{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${DARK};margin-bottom:2px}
    .gbadge{color:${GREEN}}
    .dr-b-big{font-family:'Taviraj',serif;font-size:32px;font-weight:600;color:${DARK};line-height:1.1;margin-bottom:8px}
    .dr-b-big.green{color:${GREEN}}
    .dr-b-big span{font-size:13px;font-weight:300;color:${GRAY}}
    .dr-b-line{display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#666}
    .dr-b-line strong{color:${DARK}}
    .dr-b-line .green{color:${GREEN};font-weight:700}
    .dr-b-gap-neg{margin-top:auto;padding-top:5px;border-top:1px solid ${BORDER};font-size:11px;font-weight:700;color:#C44}
    .dr-b-gap-pos{margin-top:auto;padding-top:5px;border-top:1px solid rgba(61,122,88,.2);font-size:11px;font-weight:700;color:${GREEN}}
    .dr-arrow{display:flex;align-items:center;padding:0 8px;font-size:24px;color:${GREEN};flex-shrink:0}
    .dr-params-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px}
    .dr-p{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid #f0f0ec}
    .dr-p span{color:${GRAY}}
    .dr-p strong{color:${DARK}}
    .sc-table{width:100%;border-collapse:collapse}
    .sc-table th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${GRAY};padding:4px 0;border-bottom:1px solid ${BORDER};text-align:left}
    .sc-table th:not(:first-child){text-align:right}
    .sc-table td{font-size:12px;padding:4px 0;border-bottom:1px solid #f0f0ec}
    .sc-table td:not(:first-child){text-align:right}
    .sc-table .bold{font-weight:600;color:${DARK}}
    .proj-table{width:100%;border-collapse:collapse}
    .proj-table th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:${DARK};padding:8px 10px;text-align:right}
    .proj-table th:first-child{text-align:left;border-radius:8px 0 0 0}
    .proj-table th:last-child{border-radius:0 8px 0 0}
    .proj-table td{font-size:13px;padding:8px 10px;text-align:right;border-bottom:1px solid #f0f0ec}
    .proj-table td:first-child{text-align:left;font-weight:600}
    .proj-table tbody tr:nth-child(even) td{background:${CREAM}}
    .proj-table tr.hl-row td{font-weight:700;color:${DARK};background:${GREEN_BG}}
    .proj-table-full{flex:1}
    .proj-table-full td{padding:10px 12px;font-size:14px}
    .proj-table-full th{padding:10px 12px}

    /* ── CHARTS ── */
    .charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1}
    .chart-card{background:${CREAM};border:1px solid ${BORDER};border-radius:12px;padding:8px 10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center}
    .chart-card svg{display:block;max-width:100%;height:auto}
    .charts-foot{font-size:11px;color:${LIGHT_GRAY};text-align:center;padding-top:4px;font-style:italic}

    /* ── TOP-OFF SENSITIVITY ── */
    .to-cols{display:flex;gap:36px;flex:1}
    .to-left{flex:0 0 400px;display:flex;flex-direction:column}
    .to-right{flex:1;display:flex;flex-direction:column}
    .to-assumptions{margin-bottom:0}
    .to-table td{font-size:12px;padding:7px 8px}
    .to-table th{font-size:9px;padding:7px 8px}
    .to-chart svg{width:100%;height:auto}
    .to-summary-grid{display:flex;gap:8px;margin-top:6px}
    .to-sum-card{flex:1;background:${GREEN_BG};border:1px solid rgba(61,122,88,.15);border-radius:8px;padding:10px 8px;text-align:center}
    .to-sum-num{font-family:'Taviraj',serif;font-size:22px;font-weight:600;color:${DARK};line-height:1.1}
    .to-sum-lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:${GRAY};margin-top:3px}

    /* ── DISCLAIMER ── */
    .disclaimer{background:#fff}
    .disc-top{margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid ${GREEN}}
    .disc-title{font-family:'Taviraj',serif;font-size:34px;font-weight:300;color:${DARK};margin-bottom:20px}
    .disc-cols{display:flex;gap:40px;flex:1}
    .disc-col{flex:1}
    .disc-col h3{font-size:12px;font-weight:700;color:${DARK};margin-bottom:12px;letter-spacing:1.5px;text-transform:uppercase}
    .disc-col p{font-size:13px;line-height:1.7;color:#666;margin-bottom:12px}
    .page-footer{position:absolute;bottom:18px;left:44px;right:44px}
    .pf-line{border-top:1px solid ${DARK};margin-bottom:6px}
    .pf-row{display:flex;justify-content:space-between;font-size:10px;color:${DARK}}
  </style>
</head>
<body>
  ${coverPage(data)}
  ${opportunityPage(data)}
  ${impactPage(data)}
  ${chartsPage(data)}
  ${geoDistributionPage(data)}
  ${data.topOff ? topOffPage(data) : ''}
  ${disclaimerPage(data)}
</body>
</html>`;
}
