/**
 * Pro Forma PowerPoint Generator
 *
 * Generates an editable .pptx deck mirroring the PDF pro forma report.
 * Uses pptxgenjs for native PowerPoint elements (text, shapes, tables, charts)
 * and sharp for SVG→PNG conversion (US map + wordmark).
 *
 * Slides:
 *   1. Cover — fund identity, US map, Homium wordmark
 *   2. The Opportunity — affordability crisis narrative + key callouts
 *   3. Program Detail — borrower profile, metrics, 30yr projections
 *   4. 30-Year Charts — 4 native PowerPoint charts
 *   5. Geographic Distribution (conditional — multi-geo only)
 *   6. Affordability Sensitivity (conditional — topOff only)
 *   7. Disclaimer
 */

import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';
import { ProformaData } from './proforma-report';
import { STATE_PATHS, homiumWordmark } from './us-map-paths';

// ── Formatting (mirrored from proforma-report.ts) ──

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

// ── Colors (hex without #) ──

const GREEN = '3D7A58';
const GREEN_LIGHT = '7BB394';
const DARK = '1A2930';
const CREAM = 'FAFAF8';
const GRAY = '888888';
const LIGHT_GRAY = 'AAAAAA';
const WHITE = 'FFFFFF';
const BORDER = 'E5E5E0';

// ── State names ──

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

// ── SVG → PNG via sharp ──

function generateUSMapSVG(selectedState?: string, width = 400, height = 250): string {
  let paths = '';
  for (const [code, d] of Object.entries(STATE_PATHS)) {
    const fill = code === selectedState ? '#7BB394' : 'rgba(255,255,255,0.15)';
    const sw = code === selectedState ? '2' : '0.5';
    const extra = code === selectedState ? ' filter="url(#glow)"' : '';
    paths += `<path d="${d}" fill="${fill}" stroke="rgba(255,255,255,0.25)" stroke-width="${sw}"${extra} />`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 610" width="${width}" height="${height}">
    <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${paths}</svg>`;
}

async function svgToPng(svgString: string, width: number, height: number): Promise<string> {
  const buf = Buffer.from(svgString);
  const png = await sharp(buf)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return `image/png;base64,${png.toString('base64')}`;
}

// ── Slide Master ──

function defineSlideMasters(pres: PptxGenJS) {
  pres.defineSlideMaster({
    title: 'SECTION_SLIDE',
    background: { fill: WHITE },
    objects: [
      // Green rule at y=0.49"
      { rect: { x: 0, y: 0.49, w: '100%', h: 0.02, fill: { color: GREEN } } },
    ],
  });
}

// ── Cover Slide (Page 1) ──

async function buildCoverSlide(pres: PptxGenJS, data: ProformaData) {
  const { fund, geoLabel, result } = data;
  const totalRaise = fund.raise.totalRaise;
  const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const fundName = fund.name || data.programName;
  const stateCode = fund.geography?.state;
  const isMultiGeo = result.geoBreakdown && result.geoBreakdown.length > 1;
  const stateName = isMultiGeo
    ? `${result.geoBreakdown!.length} Markets (${stateCode ? STATE_NAMES[stateCode] || stateCode : geoLabel})`
    : (stateCode ? STATE_NAMES[stateCode] || stateCode : geoLabel);

  const slide = pres.addSlide();

  // Right panel: green→dark gradient rectangle (right 46%)
  slide.addShape('rect' as any, {
    x: '54%', y: 0, w: '46%', h: '100%',
    fill: { type: 'solid', color: GREEN },
  } as any);
  // Dark overlay gradient effect — starts at 55% to eliminate light-green strip at diagonal
  slide.addShape('rect' as any, {
    x: '55%', y: 0, w: '45%', h: '100%',
    fill: { type: 'solid', color: DARK, alpha: 50 },
  } as any);

  // White triangle to simulate the diagonal clip-path
  // Rotated 180° so base is at top, point at bottom → subtle diagonal border
  slide.addShape('triangle' as any, {
    x: 5.1, y: 0, w: 0.6, h: 5.625,
    fill: { color: WHITE },
    rotate: 180,
    line: { color: WHITE, width: 0 },
  } as any);
  // Small white rect at top to smooth the triangle edge
  slide.addShape('rect' as any, {
    x: 5.1, y: 0, w: 0.32, h: 0.05,
    fill: { color: WHITE },
    line: { color: WHITE, width: 0 },
  } as any);

  // US Map image — vertically centered on right panel
  const mapSvg = generateUSMapSVG(stateCode, 800, 500);
  const mapPng = await svgToPng(mapSvg, 800, 500);
  slide.addImage({
    data: mapPng,
    x: 6.0, y: 1.2, w: 3.6, h: 2.0,
  });

  // State label below map
  slide.addText(stateName.toUpperCase(), {
    x: 6.0, y: 3.3, w: 3.6, h: 0.3,
    align: 'center',
    fontSize: 12, fontFace: 'Ubuntu',
    color: WHITE, bold: true,
    letterSpacing: 4,
  } as any);

  // Left side — Wordmark
  const wmSvg = homiumWordmark('#1A2930', 36);
  const wmPng = await svgToPng(wmSvg, 380, 72);
  slide.addImage({
    data: wmPng,
    x: 0.55, y: 0.3, w: 1.4, h: 0.27,
  });

  // Eyebrow
  slide.addText('SHARED APPRECIATION HOMEOWNERSHIP PROGRAM', {
    x: 0.55, y: 0.8, w: 4.8, h: 0.2,
    fontSize: 8, fontFace: 'Ubuntu', bold: true,
    color: GREEN, letterSpacing: 8,
  } as any);

  // Title
  slide.addText(fundName, {
    x: 0.55, y: 1.3, w: 4.8, h: 1.0,
    fontSize: 34, fontFace: 'Taviraj Light', bold: false,
    color: DARK, lineSpacingMultiple: 1.05,
  } as any);

  // Green rule
  slide.addShape('rect' as any, {
    x: 0.55, y: 2.5, w: 0.55, h: 0.03,
    fill: { color: GREEN },
  });

  // Tagline
  slide.addText(
    'The gap between what families earn and what homes cost has never been wider. ' +
    'This fund uses Homium\u2019s shared appreciation model to close that gap\u2014creating homeowners and generating returns.',
    {
      x: 0.55, y: 2.8, w: 4.2, h: 0.55,
      fontSize: 10, fontFace: 'Ubuntu',
      color: '555555', lineSpacingMultiple: 1.35,
    } as any,
  );

  // Stats row
  const statsY = 3.55;
  const stats = [
    { val: fmtM(totalRaise), lbl: 'Fund Size' },
    { val: stateName, lbl: 'Target Market' },
    { val: date, lbl: 'Date Prepared' },
  ];
  stats.forEach((s, i) => {
    const x = 0.55 + i * 1.8;
    slide.addText(s.val, {
      x, y: statsY, w: 1.6, h: 0.3,
      fontSize: 13, fontFace: 'Taviraj', bold: true,
      color: DARK, align: 'left',
    });
    slide.addText(s.lbl.toUpperCase(), {
      x, y: statsY + 0.3, w: 1.6, h: 0.15,
      fontSize: 7, fontFace: 'Ubuntu', bold: true,
      color: GRAY, align: 'left',
      letterSpacing: 2,
    } as any);
    // Divider between stats
    if (i < stats.length - 1) {
      slide.addShape('rect' as any, {
        x: x + 1.65, y: statsY + 0.04, w: 0.01, h: 0.35,
        fill: { color: BORDER },
      });
    }
  });

  // Footer
  slide.addText('Prepared by Homium, Inc. \u00B7 Confidential', {
    x: 0.55, y: 4.5, w: 4, h: 0.2,
    fontSize: 8, fontFace: 'Ubuntu',
    color: LIGHT_GRAY,
  });
}

// ── Opportunity Slide (Page 2) ──

async function buildOpportunitySlide(pres: PptxGenJS, data: ProformaData, wordmarkPng: string) {
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

  const slide = pres.addSlide({ masterName: 'SECTION_SLIDE' });

  // Section bar
  addSectionBar(slide, 'The Opportunity', fundName, wordmarkPng);

  // Hero headline
  const headlineText = isMultiGeo
    ? `${fmtN(homeowners)} Families Could Own a Home in ${result.geoBreakdown!.length} ${stateName} Communities`
    : `${fmtN(homeowners)} Families Could Own a Home in ${stateName}`;
  slide.addText(headlineText, {
    x: 0.5, y: 0.90, w: 9, h: 0.75,
    fontSize: 32, fontFace: 'Taviraj', bold: false,
    color: DARK, align: 'center', lineSpacingMultiple: 1.05,
  } as any);

  slide.addText('A shared appreciation mortgage makes homeownership affordable\u2014and generates returns for investors.', {
    x: 1.5, y: 1.72, w: 7, h: 0.26,
    fontSize: 12, fontFace: 'Ubuntu',
    color: GRAY, align: 'center',
  });

  // Payment comparison cards
  const cardY = 2.08;
  // "Without Homium" card
  slide.addShape('roundRect' as any, {
    x: 0.5, y: cardY, w: 3.2, h: 1.28,
    fill: { color: CREAM },
    line: { color: BORDER, width: 1 },
    rectRadius: 0.12,
  });
  slide.addText('WITHOUT HOMIUM', {
    x: 0.5, y: cardY + 0.11, w: 3.2, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true,
    color: GRAY, align: 'center', letterSpacing: 2,
  } as any);
  slide.addText(`${fmt(affordability.pitiBeforeHomium, 0)}/mo`, {
    x: 0.5, y: cardY + 0.34, w: 3.2, h: 0.45,
    fontSize: 28, fontFace: 'Taviraj', bold: true,
    color: DARK, align: 'center',
  });
  slide.addText(`Over budget by ${fmt(affordability.pitiBeforeHomium - affordability.maxPITI, 0)}/mo`, {
    x: 0.5, y: cardY + 0.9, w: 3.2, h: 0.23,
    fontSize: 10, fontFace: 'Ubuntu', bold: true,
    color: 'CC4444', align: 'center',
  });

  // Arrow
  slide.addText('\u2794', {
    x: 3.8, y: cardY + 0.3, w: 0.6, h: 0.45,
    fontSize: 32, color: GREEN, align: 'center',
  });

  // "With Homium" card
  slide.addShape('roundRect' as any, {
    x: 4.2, y: cardY, w: 3.2, h: 1.28,
    fill: { color: 'EDF5F0' },
    line: { color: GREEN, width: 2 },
    rectRadius: 0.12,
  });
  slide.addText('WITH HOMIUM', {
    x: 4.2, y: cardY + 0.11, w: 3.2, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true,
    color: GREEN, align: 'center', letterSpacing: 2,
  } as any);
  slide.addText(`${fmt(affordability.pitiAfterHomium, 0)}/mo`, {
    x: 4.2, y: cardY + 0.34, w: 3.2, h: 0.45,
    fontSize: 28, fontFace: 'Taviraj', bold: true,
    color: GREEN, align: 'center',
  });
  const afterNote = affordability.pitiAfterHomium <= affordability.maxPITI
    ? 'Now affordable'
    : `Gap reduced to ${fmt(affordability.pitiAfterHomium - affordability.maxPITI, 0)}/mo`;
  slide.addText(afterNote, {
    x: 4.2, y: cardY + 0.9, w: 3.2, h: 0.23,
    fontSize: 10, fontFace: 'Ubuntu', bold: true,
    color: GREEN, align: 'center',
  });

  // Savings callout
  slide.addText(fmt(monthlySavings, 0), {
    x: 7.6, y: cardY + 0.15, w: 2.2, h: 0.45,
    fontSize: 28, fontFace: 'Taviraj', bold: true,
    color: GREEN, align: 'center',
  });
  slide.addText('SAVED EVERY MONTH', {
    x: 7.6, y: cardY + 0.64, w: 2.2, h: 0.19,
    fontSize: 8, fontFace: 'Ubuntu', bold: true,
    color: GRAY, align: 'center', letterSpacing: 2,
  } as any);

  // Dark metrics banner
  const bannerY = 3.58;
  slide.addShape('roundRect' as any, {
    x: 0.5, y: bannerY, w: 9, h: 1.05,
    fill: { color: DARK },
    rectRadius: 0.12,
    shadow: { type: 'outer', blur: 12, offset: 4, color: '1A2930', opacity: 0.25 },
  } as any);

  const metrics = [
    { val: yrEnd ? fmtM(yrEnd.totalEquityCreated) : '--', lbl: 'Homeowner Equity Created', sub: `over ${fundLife} years`, green: true },
    { val: yrEnd ? fmtX(yrEnd.roiCumulative) : '--', lbl: 'Fund Return', sub: `${fundLife}-year cumulative ROI`, green: false },
    { val: yrEnd ? fmtM(yrEnd.totalEquityCreated) : '--', lbl: 'Total Wealth Created', sub: `over ${fundLife} years`, green: true },
  ];
  metrics.forEach((m, i) => {
    const mx = 0.8 + i * 3.0;
    slide.addText(m.val, {
      x: mx, y: bannerY + 0.11, w: 2.6, h: 0.38,
      fontSize: 28, fontFace: 'Taviraj', bold: true,
      color: m.green ? GREEN_LIGHT : WHITE, align: 'center',
    });
    slide.addText(m.lbl.toUpperCase(), {
      x: mx, y: bannerY + 0.53, w: 2.6, h: 0.19,
      fontSize: 9, fontFace: 'Ubuntu', bold: true,
      color: WHITE, align: 'center', letterSpacing: 1,
    } as any);
    slide.addText(m.sub, {
      x: mx, y: bannerY + 0.71, w: 2.6, h: 0.15,
      fontSize: 9, fontFace: 'Ubuntu',
      color: '667777', align: 'center',
    });
    // Divider
    if (i < metrics.length - 1) {
      slide.addShape('rect' as any, {
        x: mx + 2.7, y: bannerY + 0.19, w: 0.01, h: 0.68,
        fill: { color: '334444' },
      });
    }
  });

  // Footer params
  const footText = `${fmtM(fund.raise.totalRaise)} Fund  \u00B7  ${fmtP(fund.program.homiumSAPct, 0)} Shared Appreciation Mortgage  \u00B7  ${fmtP(fund.assumptions.hpaPct, 1)} HPA  \u00B7  ${fmtP(fund.assumptions.interestRate, 1)} Rate`;
  slide.addText(footText, {
    x: 0.5, y: 4.93, w: 9, h: 0.23,
    fontSize: 10, fontFace: 'Ubuntu',
    color: LIGHT_GRAY, align: 'center',
  });

  addPageNumber(slide, 2);
}

// ── Impact / Program Detail Slide (Page 3) ──

async function buildImpactSlide(pres: PptxGenJS, data: ProformaData, wordmarkPng: string) {
  const { fund, blended, affordability, result, geoLabel } = data;
  const monthlySavings = affordability.pitiBeforeHomium - affordability.pitiAfterHomium;
  const fundName = fund.name || data.programName;
  const midScenario = fund.scenarios.find(s => s.name === 'MID') || fund.scenarios[0];
  const stateCode = fund.geography?.state;
  const stateName = stateCode ? STATE_NAMES[stateCode] || geoLabel : geoLabel;
  const isMultiGeo = result.geoBreakdown && result.geoBreakdown.length > 1;
  const fundLife = blended.length || 30;

  const slide = pres.addSlide({ masterName: 'SECTION_SLIDE' });
  addSectionBar(slide, 'Program Detail', fundName, wordmarkPng);

  // ── Left column: Borrower cards ──
  const leftX = 0.4;
  const colW = 4.3;

  // Section heading
  slide.addText(`TYPICAL ${isMultiGeo ? 'PROGRAM' : stateName.toUpperCase()} BORROWER`, {
    x: leftX, y: 0.6, w: colW, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true,
    color: GREEN, letterSpacing: 2,
  } as any);

  // "Without Homium" mini card
  const cardW = 1.95;
  const cardY = 0.83;
  slide.addShape('roundRect' as any, {
    x: leftX, y: cardY, w: cardW, h: 1.3,
    fill: { color: CREAM }, line: { color: BORDER, width: 1 }, rectRadius: 0.08,
  });
  slide.addText('Without Homium', { x: leftX, y: cardY + 0.04, w: cardW, h: 0.14, fontSize: 7, fontFace: 'Ubuntu', bold: true, color: DARK, align: 'center' });
  slide.addText(`${fmt(affordability.pitiBeforeHomium, 0)}/mo`, { x: leftX, y: cardY + 0.2, w: cardW, h: 0.32, fontSize: 22, fontFace: 'Taviraj', bold: true, color: DARK, align: 'center' });

  const beforeLines = [
    ['Income', fmt(midScenario.medianIncome)],
    ['Home Price', fmt(midScenario.medianHomeValue)],
    ['Max Affordable', `${fmt(affordability.maxPITI, 0)}/mo`],
  ];
  beforeLines.forEach(([label, value], i) => {
    slide.addText([
      { text: label, options: { fontSize: 8, color: GRAY } },
      { text: `  ${value}`, options: { fontSize: 8, color: DARK, bold: true } },
    ], { x: leftX + 0.1, y: cardY + 0.56 + i * 0.16, w: cardW - 0.2, h: 0.16 });
  });
  slide.addText(`Over budget by ${fmt(affordability.pitiBeforeHomium - affordability.maxPITI, 0)}/mo`, {
    x: leftX, y: cardY + 1.08, w: cardW, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true, color: 'CC4444', align: 'center',
  });

  // Arrow
  slide.addText('\u2794', { x: leftX + cardW, y: cardY + 0.5, w: 0.35, h: 0.3, fontSize: 18, color: GREEN, align: 'center' });

  // "With Homium" mini card
  const rightCardX = leftX + cardW + 0.35;
  slide.addShape('roundRect' as any, {
    x: rightCardX, y: cardY, w: cardW, h: 1.3,
    fill: { color: 'EDF5F0' }, line: { color: GREEN, width: 1.5 }, rectRadius: 0.08,
  });
  slide.addText('With Homium', { x: rightCardX, y: cardY + 0.04, w: cardW, h: 0.14, fontSize: 7, fontFace: 'Ubuntu', bold: true, color: GREEN, align: 'center' });
  slide.addText(`${fmt(affordability.pitiAfterHomium, 0)}/mo`, { x: rightCardX, y: cardY + 0.2, w: cardW, h: 0.32, fontSize: 22, fontFace: 'Taviraj', bold: true, color: GREEN, align: 'center' });

  const afterLines = [
    ['Reduced Mortgage', fmt(affordability.reducedMortgage)],
    ['SAM Position', fmt(affordability.homiumPrincipal)],
    ['Monthly Savings', fmt(monthlySavings, 0)],
  ];
  afterLines.forEach(([label, value], i) => {
    const isGreen = i === 2;
    slide.addText([
      { text: label, options: { fontSize: 8, color: GRAY } },
      { text: `  ${value}`, options: { fontSize: 8, color: isGreen ? GREEN : DARK, bold: true } },
    ], { x: rightCardX + 0.1, y: cardY + 0.56 + i * 0.16, w: cardW - 0.2, h: 0.16 });
  });
  const afterGapNote = affordability.pitiAfterHomium <= affordability.maxPITI
    ? 'Now affordable'
    : `Gap: ${fmt(affordability.pitiAfterHomium - affordability.maxPITI, 0)}/mo`;
  slide.addText(afterGapNote, {
    x: rightCardX, y: cardY + 1.08, w: cardW, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true, color: GREEN, align: 'center',
  });

  // Fund Parameters table
  slide.addText('FUND PARAMETERS', {
    x: leftX, y: 2.25, w: colW, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true, color: GREEN, letterSpacing: 2,
  } as any);

  const params = [
    ['Fund Size', fmtM(fund.raise.totalRaise)], ['Homium SAM', fmtP(fund.program.homiumSAPct, 0)],
    ['Down Payment', fmtP(fund.program.downPaymentPct, 0)], ['Program Fee', fmtP(fund.fees.programFeePct, 0)],
    ['Mgmt Fee', fmtP(fund.fees.managementFeePct, 1)], ['Interest Rate', fmtP(fund.assumptions.interestRate, 1)],
    ['HPA Assumption', fmtP(fund.assumptions.hpaPct, 1)], ['Reinvest', fund.raise.reinvestNetProceeds ? 'Yes' : 'No'],
  ];
  const paramRows: PptxGenJS.TableRow[] = [];
  for (let i = 0; i < params.length; i += 2) {
    const row: PptxGenJS.TableCell[] = [
      { text: params[i][0], options: { fontSize: 8, color: GRAY, fontFace: 'Ubuntu' } },
      { text: params[i][1], options: { fontSize: 8, color: DARK, bold: true, fontFace: 'Ubuntu', align: 'right' } },
    ];
    if (i + 1 < params.length) {
      row.push(
        { text: params[i + 1][0], options: { fontSize: 8, color: GRAY, fontFace: 'Ubuntu' } },
        { text: params[i + 1][1], options: { fontSize: 8, color: DARK, bold: true, fontFace: 'Ubuntu', align: 'right' } },
      );
    }
    paramRows.push(row);
  }
  slide.addTable(paramRows, {
    x: leftX, y: 2.45, w: colW,
    fontSize: 8, fontFace: 'Ubuntu',
    border: { type: 'solid', pt: 0.5, color: 'F0F0EC' },
    colW: [1.1, 0.8, 1.1, 0.8],
  } as any);

  // Scenarios / Program Impact
  const scenarios = result.scenarioResults;
  if (scenarios.length > 1) {
    const geoBreakdown = result.geoBreakdown;
    if (geoBreakdown && geoBreakdown.length > 1) {
      slide.addText('PROGRAM IMPACT', {
        x: leftX, y: 3.3, w: colW, h: 0.15,
        fontSize: 8, fontFace: 'Ubuntu', bold: true, color: GREEN, letterSpacing: 2,
      } as any);
      const totalHO = result.totalHomeowners;
      const totalWeight = scenarios.reduce((s, sr) => s + sr.scenario.weight, 0) || 1;
      const wtdIncome = scenarios.reduce((s, sr) => s + sr.scenario.medianIncome * sr.scenario.weight, 0) / totalWeight;
      const wtdHome = scenarios.reduce((s, sr) => s + sr.scenario.medianHomeValue * sr.scenario.weight, 0) / totalWeight;
      const yrEnd = blended[fundLife - 1] || blended[blended.length - 1];
      const impactRows: PptxGenJS.TableRow[] = [
        [{ text: 'Geographies', options: { fontSize: 8, color: GRAY } }, { text: fmtN(geoBreakdown.length), options: { fontSize: 8, color: DARK, bold: true, align: 'right' } }],
        [{ text: 'Total Homeowners', options: { fontSize: 8, color: GRAY } }, { text: fmtN(totalHO), options: { fontSize: 8, color: DARK, bold: true, align: 'right' } }],
        [{ text: 'Wtd Avg Income', options: { fontSize: 8, color: GRAY } }, { text: fmt(wtdIncome, 0), options: { fontSize: 8, color: DARK, bold: true, align: 'right' } }],
        [{ text: 'Wtd Avg Home Value', options: { fontSize: 8, color: GRAY } }, { text: fmt(wtdHome, 0), options: { fontSize: 8, color: DARK, bold: true, align: 'right' } }],
      ];
      if (yrEnd) {
        impactRows.push(
          [{ text: `Yr ${fundLife} Equity`, options: { fontSize: 8, color: GRAY } }, { text: fmtM(yrEnd.totalEquityCreated), options: { fontSize: 8, color: DARK, bold: true, align: 'right' } }],
          [{ text: `Yr ${fundLife} ROI`, options: { fontSize: 8, color: GRAY } }, { text: fmtX(yrEnd.roiCumulative), options: { fontSize: 8, color: DARK, bold: true, align: 'right' } }],
        );
      }
      slide.addTable(impactRows, {
        x: leftX, y: 3.5, w: colW,
        fontSize: 8, fontFace: 'Ubuntu',
        border: { type: 'solid', pt: 0.5, color: 'F0F0EC' },
        colW: [2.2, 1.6],
      } as any);
    } else {
      slide.addText('SCENARIOS', {
        x: leftX, y: 3.42, w: colW, h: 0.15,
        fontSize: 8, fontFace: 'Ubuntu', bold: true, color: GREEN, letterSpacing: 2,
      } as any);
      const scHeader: PptxGenJS.TableRow = [
        { text: 'Name', options: { fontSize: 7, color: GRAY, bold: true } },
        { text: 'HOs', options: { fontSize: 7, color: GRAY, bold: true, align: 'right' } },
        { text: 'Income', options: { fontSize: 7, color: GRAY, bold: true, align: 'right' } },
        { text: 'Home', options: { fontSize: 7, color: GRAY, bold: true, align: 'right' } },
      ];
      const scRows: PptxGenJS.TableRow[] = [scHeader];
      scenarios.forEach(sr => {
        const ho = sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0);
        scRows.push([
          { text: sr.scenario.name, options: { fontSize: 8, color: DARK, bold: true } },
          { text: fmtN(ho), options: { fontSize: 8, color: DARK, align: 'right' } },
          { text: fmt(sr.scenario.medianIncome, 0), options: { fontSize: 8, color: DARK, align: 'right' } },
          { text: fmt(sr.scenario.medianHomeValue, 0), options: { fontSize: 8, color: DARK, align: 'right' } },
        ]);
      });
      slide.addTable(scRows, {
        x: leftX, y: 3.62, w: colW,
        fontSize: 8, fontFace: 'Ubuntu',
        border: { type: 'solid', pt: 0.5, color: 'F0F0EC' },
        colW: [0.8, 0.8, 1.2, 1.2],
      } as any);
    }
  }

  // ── Right column: Projections table ──
  const rightX = 5.0;
  const rightW = 4.8;

  slide.addText(`${fundLife}-YEAR PROJECTIONS`, {
    x: rightX, y: 0.6, w: rightW, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true, color: GREEN, letterSpacing: 2,
  } as any);

  const allMilestones = fundLife <= 5
    ? Array.from({ length: fundLife }, (_, i) => i)
    : fundLife <= 10
    ? Array.from({ length: fundLife }, (_, i) => i).filter(i => i % 2 === 0 || i === fundLife - 1)
    : [0, 2, 4, 6, 9, 14, 19, 24, 29];
  const milestones = allMilestones.filter(i => i < blended.length);

  const projHeader: PptxGenJS.TableRow = [
    { text: 'Year', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK } } },
    { text: 'Active HOs', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Equity Created', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Fund NAV', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Capital Returned', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'ROI', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
  ];

  const projRows: PptxGenJS.TableRow[] = [projHeader];
  milestones.forEach(i => {
    const y = blended[i];
    const isLast = i === fundLife - 1 || i === blended.length - 1;
    const cellOpts = (text: string, align: 'left' | 'right' = 'right'): PptxGenJS.TableCell => ({
      text,
      options: {
        fontSize: 8, color: DARK, align, fontFace: 'Ubuntu',
        bold: isLast,
        fill: isLast ? { color: 'EDF5F0' } : (i % 2 === 0 ? { color: CREAM } : undefined),
      },
    });
    projRows.push([
      cellOpts(String(y.calendarYear), 'left'),
      cellOpts(fmtN(y.activeHomeowners)),
      cellOpts(fmtM(y.totalEquityCreated)),
      cellOpts(fmtM(y.fundNAV)),
      cellOpts(fmtM(y.cumulativeDistributions)),
      cellOpts(fmtX(y.roiCumulative)),
    ]);
  });

  slide.addTable(projRows, {
    x: rightX, y: 0.79, w: rightW,
    fontSize: 8, fontFace: 'Ubuntu',
    border: { type: 'solid', pt: 0.5, color: 'F0F0EC' },
    colW: [0.55, 0.7, 0.85, 0.8, 0.95, 0.55],
    rowH: 0.38,
  } as any);

  addPageNumber(slide, 3);
}

// ── Charts Slide (Page 4) ──

function buildChartsSlide(pres: PptxGenJS, data: ProformaData, wordmarkPng: string) {
  const { blended, fund } = data;
  const fundName = fund.name || data.programName;

  const slide = pres.addSlide({ masterName: 'SECTION_SLIDE' });
  addSectionBar(slide, `${blended.length || 30}-Year Projections`, fundName, wordmarkPng);

  const cd = blended.map(y => ({
    year: y.calendarYear,
    equity: y.totalEquityCreated / 1e6,
    ho: y.activeHomeowners,
    fv: (y.fundNAV || y.fundBalance) / 1e6,
    dist: y.cumulativeDistributions / 1e6,
    roi: y.roiCumulative,
  }));

  // Sample data at intervals for readable charts (~7 points)
  const sampleInterval = Math.max(1, Math.floor(cd.length / 10));
  const sampled = cd.filter((_, i) => i % sampleInterval === 0 || i === cd.length - 1);
  const catLabels = sampled.map(d => String(d.year));

  // Chart grid: 2×2
  const chartConfigs: Array<{
    x: number; y: number; title: string;
    type: any;
    data: any[];
    opts: any;
  }> = [
    {
      x: 0.3, y: 0.64, title: 'Homeowner Equity Created',
      type: pres.ChartType.area,
      data: [{ name: 'Equity', labels: catLabels, values: sampled.map(d => d.equity) }],
      opts: { valAxisNumFmt: '$#,##0"M"', chartColors: [GREEN], showValue: false, lineSize: 2, showLegend: false, catAxisLabelRotate: 0 },
    },
    {
      x: 5.1, y: 0.64, title: 'Active Homeowners',
      type: pres.ChartType.bar,
      data: [{ name: 'Homeowners', labels: catLabels, values: sampled.map(d => d.ho) }],
      opts: { valAxisNumFmt: '#,##0', chartColors: [GREEN], showValue: false, showLegend: false, catAxisLabelRotate: 0 },
    },
    {
      x: 0.3, y: 2.96, title: 'Fund Value & Returns',
      type: pres.ChartType.line,
      data: [
        { name: 'Fund Value', labels: catLabels, values: sampled.map(d => d.fv) },
        { name: 'Returned Capital', labels: catLabels, values: sampled.map(d => d.dist) },
      ],
      opts: { valAxisNumFmt: '$#,##0"M"', chartColors: [DARK, GREEN], showValue: false, lineSize: 2, showLegend: true, legendPos: 'b', catAxisLabelRotate: 0 },
    },
    {
      x: 5.1, y: 2.96, title: 'Cumulative ROI',
      type: pres.ChartType.line,
      data: [{ name: 'ROI', labels: catLabels, values: sampled.map(d => d.roi) }],
      opts: { valAxisNumFmt: '0.0"x"', chartColors: [GREEN], showValue: false, lineSize: 2, showLegend: false, catAxisLabelRotate: 0 },
    },
  ];

  chartConfigs.forEach(cfg => {
    // Card background
    slide.addShape('roundRect' as any, {
      x: cfg.x, y: cfg.y, w: 4.6, h: 2.18,
      fill: { color: CREAM }, line: { color: BORDER, width: 0.5 }, rectRadius: 0.1,
    });

    // Chart title
    slide.addText(cfg.title, {
      x: cfg.x + 0.15, y: cfg.y + 0.04, w: 4.3, h: 0.23,
      fontSize: 10, fontFace: 'Ubuntu', bold: true, color: DARK,
    });

    // Native chart
    slide.addChart(cfg.type, cfg.data, {
      x: cfg.x + 0.05, y: cfg.y + 0.26, w: 4.5, h: 1.8,
      showTitle: false,
      catAxisLabelFontSize: 8,
      catAxisLabelColor: GRAY,
      valAxisLabelFontSize: 8,
      valAxisLabelColor: GRAY,
      catAxisOrientation: 'minMax',
      valGridLine: { color: BORDER, size: 0.5 },
      ...cfg.opts,
    } as any);
  });

  // Footer
  slide.addText(
    `Projections assume ${fmtP(fund.assumptions.hpaPct, 1)} annual HPA and ${fmtP(fund.assumptions.interestRate, 1)} mortgage rate. See disclaimer for full details.`,
    { x: 0.5, y: 5.25, w: 9, h: 0.19, fontSize: 8, fontFace: 'Ubuntu', color: LIGHT_GRAY, align: 'center', italic: true },
  );

  addPageNumber(slide, 4);
}

// ── Geographic Distribution Slide (Page 5, conditional) ──

function buildGeoDistributionSlide(pres: PptxGenJS, data: ProformaData, wordmarkPng: string, pageNum: number) {
  const { fund, result, blended } = data;
  const geoBreakdown = result.geoBreakdown;
  if (!geoBreakdown || geoBreakdown.length < 2) return;

  const fundLife = blended.length || 30;
  const fundName = fund.name || data.programName;
  const colors = [GREEN, DARK, GREEN_LIGHT, '5BA37E', '2E6046', '4A9268'];

  const slide = pres.addSlide({ masterName: 'SECTION_SLIDE' });
  addSectionBar(slide, 'Geographic Distribution', fundName, wordmarkPng);

  // Allocation bar (horizontal stacked)
  let barX = 0.5;
  const barW = 9.0;
  const barY = 0.68;
  geoBreakdown.forEach((gb, i) => {
    const segW = gb.geo.allocationPct * barW;
    slide.addShape('roundRect' as any, {
      x: barX, y: barY, w: segW, h: 0.26,
      fill: { color: colors[i % colors.length] },
      rectRadius: i === 0 ? 0.06 : (i === geoBreakdown.length - 1 ? 0.06 : 0),
    });
    slide.addText(`${Math.round(gb.geo.allocationPct * 100)}%`, {
      x: barX, y: barY, w: segW, h: 0.26,
      fontSize: 9, fontFace: 'Ubuntu', bold: true, color: WHITE, align: 'center', valign: 'middle',
    });
    barX += segW;
  });

  // Geography table
  const geoHeader: PptxGenJS.TableRow = [
    { text: 'Geography', options: { fontSize: 8, bold: true, color: WHITE, fill: { color: DARK } } },
    { text: 'Allocation', options: { fontSize: 8, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Median Income', options: { fontSize: 8, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Median Home', options: { fontSize: 8, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Homeowners', options: { fontSize: 8, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: `Equity (Yr ${fundLife})`, options: { fontSize: 8, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
  ];

  const geoRows: PptxGenJS.TableRow[] = [geoHeader];
  geoBreakdown.forEach((gb, i) => {
    const endEq = gb.blended[fundLife - 1]?.totalEquityCreated || 0;
    geoRows.push([
      { text: gb.geo.geoLabel, options: { fontSize: 9, color: DARK, fontFace: 'Ubuntu' } },
      { text: fmtP(gb.geo.allocationPct, 0), options: { fontSize: 9, color: DARK, align: 'right' } },
      { text: fmt(gb.geo.medianIncome), options: { fontSize: 9, color: DARK, align: 'right' } },
      { text: fmt(gb.geo.medianHomeValue), options: { fontSize: 9, color: DARK, align: 'right' } },
      { text: fmtN(gb.totalHomeowners), options: { fontSize: 9, color: DARK, align: 'right' } },
      { text: fmtM(endEq), options: { fontSize: 9, color: DARK, align: 'right' } },
    ]);
  });

  slide.addTable(geoRows, {
    x: 0.5, y: 1.09, w: 9,
    fontSize: 9, fontFace: 'Ubuntu',
    border: { type: 'solid', pt: 0.5, color: 'F0F0EC' },
    colW: [2.0, 1.0, 1.5, 1.5, 1.2, 1.3],
    rowH: 0.26,
  } as any);

  // Scenario detail tables (if ≤4 geos)
  if (geoBreakdown.length <= 4) {
    slide.addText('SCENARIO DETAIL BY GEOGRAPHY', {
      x: 0.5, y: 1.13 + geoRows.length * 0.26 + 0.23, w: 9, h: 0.15,
      fontSize: 8, fontFace: 'Ubuntu', bold: true, color: GREEN, letterSpacing: 2,
    } as any);

    const detailY = 1.13 + geoRows.length * 0.26 + 0.45;
    const detailW = 8.5 / geoBreakdown.length;

    geoBreakdown.forEach((gb, gi) => {
      const dx = 0.5 + gi * (detailW + 0.15);
      slide.addText(gb.geo.geoLabel.toUpperCase(), {
        x: dx, y: detailY, w: detailW, h: 0.15,
        fontSize: 7, fontFace: 'Ubuntu', bold: true, color: colors[gi % colors.length], letterSpacing: 1,
      } as any);

      const detailHeader: PptxGenJS.TableRow = [
        { text: 'Scenario', options: { fontSize: 7, color: GRAY, bold: true } },
        { text: 'HOs', options: { fontSize: 7, color: GRAY, bold: true, align: 'right' } },
        { text: 'Income', options: { fontSize: 7, color: GRAY, bold: true, align: 'right' } },
        { text: 'Home', options: { fontSize: 7, color: GRAY, bold: true, align: 'right' } },
      ];
      const detailRows: PptxGenJS.TableRow[] = [detailHeader];
      gb.scenarioResults.forEach(sr => {
        const ho = sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0);
        detailRows.push([
          { text: sr.scenario.name, options: { fontSize: 8, color: DARK, bold: true } },
          { text: fmtN(ho), options: { fontSize: 8, color: DARK, align: 'right' } },
          { text: fmt(sr.scenario.medianIncome, 0), options: { fontSize: 8, color: DARK, align: 'right' } },
          { text: fmt(sr.scenario.medianHomeValue, 0), options: { fontSize: 8, color: DARK, align: 'right' } },
        ]);
      });

      slide.addTable(detailRows, {
        x: dx, y: detailY + 0.25, w: detailW,
        fontSize: 8, fontFace: 'Ubuntu',
        border: { type: 'solid', pt: 0.5, color: 'F0F0EC' },
      } as any);
    });
  }

  addPageNumber(slide, pageNum);
}

// ── Top-Off / Affordability Sensitivity Slide (conditional) ──

function buildTopOffSlide(pres: PptxGenJS, data: ProformaData, wordmarkPng: string, pageNum: number) {
  const { fund, topOff } = data;
  if (!topOff || !topOff.length) return;

  const fundName = fund.name || data.programName;
  const hpa = fund.assumptions.hpaPct;
  const wg = fund.assumptions.wageGrowthPct || 0;
  const fixedHomes = fund.program.fixedHomeCount || 0;

  const totalTopOff = topOff[topOff.length - 1].cumulativeTopOff;
  const avgAnnual = totalTopOff / 30;
  const peakYear = topOff.reduce((max, y) => y.annualTopOff > max.annualTopOff ? y : max, topOff[0]);

  const slide = pres.addSlide({ masterName: 'SECTION_SLIDE' });
  addSectionBar(slide, 'Affordability Sensitivity', fundName, wordmarkPng);

  // Left column: Assumptions
  const leftX = 0.4;
  slide.addText('KEY ASSUMPTIONS', {
    x: leftX, y: 0.64, w: 4.2, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true, color: GREEN, letterSpacing: 2,
  } as any);

  const assumptionParams = [
    ['HPA Rate', fmtP(hpa, 1)], ['Wage Growth', fmtP(wg, 1)],
    ['Target AMI', '80%'], ['Fixed Homes', fmtN(fixedHomes)],
    ['HPA − WG Spread', fmtP(hpa - wg, 1)], ['SAM %', fmtP(fund.program.homiumSAPct, 0)],
  ];
  const assumptionRows: PptxGenJS.TableRow[] = [];
  for (let i = 0; i < assumptionParams.length; i += 2) {
    const row: PptxGenJS.TableCell[] = [
      { text: assumptionParams[i][0], options: { fontSize: 8, color: GRAY } },
      { text: assumptionParams[i][1], options: { fontSize: 8, color: DARK, bold: true, align: 'right' } },
    ];
    if (i + 1 < assumptionParams.length) {
      row.push(
        { text: assumptionParams[i + 1][0], options: { fontSize: 8, color: GRAY } },
        { text: assumptionParams[i + 1][1], options: { fontSize: 8, color: DARK, bold: true, align: 'right' } },
      );
    }
    assumptionRows.push(row);
  }
  slide.addTable(assumptionRows, {
    x: leftX, y: 0.83, w: 4.2,
    fontSize: 8, fontFace: 'Ubuntu',
    border: { type: 'solid', pt: 0.5, color: 'F0F0EC' },
    colW: [1.1, 0.8, 1.1, 0.8],
  } as any);

  // Home Value vs Income chart — sample every 4th year for readability
  const chartSampled = topOff.filter((_, i) => i % 4 === 0 || i === topOff.length - 1);
  const chartLabels = chartSampled.map(y => String(y.calendarYear));

  slide.addChart(pres.ChartType.line, [
    { name: 'Home Value', labels: chartLabels, values: chartSampled.map(y => y.homeValue / 1e3) },
    { name: '80% AMI Income', labels: chartLabels, values: chartSampled.map(y => y.income80AMI / 1e3) },
  ], {
    x: leftX, y: 1.5, w: 4.2, h: 2.1,
    showTitle: true, title: 'Home Value vs. Income Growth', titleFontSize: 10, titleColor: DARK,
    chartColors: [DARK, GREEN],
    lineSize: 2,
    catAxisLabelFontSize: 7, catAxisLabelColor: GRAY,
    catAxisLabelRotate: 0,
    valAxisLabelFontSize: 7, valAxisLabelColor: GRAY,
    valAxisNumFmt: '$#,##0"K"',
    valGridLine: { color: BORDER, size: 0.5 },
    showLegend: true, legendPos: 'b', legendFontSize: 8,
  } as any);

  // Summary cards
  const summaryY = 3.75;
  const summaryCards = [
    { val: fmtM(totalTopOff), lbl: 'Total Top-Off' },
    { val: fmtM(avgAnnual), lbl: 'Avg Annual' },
    { val: String(peakYear.calendarYear), lbl: `Peak Year (${fmtM(peakYear.annualTopOff)})` },
  ];
  summaryCards.forEach((s, i) => {
    const sx = leftX + i * 1.45;
    slide.addShape('roundRect' as any, {
      x: sx, y: summaryY, w: 1.3, h: 0.64,
      fill: { color: 'EDF5F0' }, line: { color: 'D5E8DD', width: 0.5 }, rectRadius: 0.06,
    });
    slide.addText(s.val, {
      x: sx, y: summaryY + 0.08, w: 1.3, h: 0.26,
      fontSize: 16, fontFace: 'Taviraj', bold: true, color: DARK, align: 'center',
    });
    slide.addText(s.lbl.toUpperCase(), {
      x: sx, y: summaryY + 0.38, w: 1.3, h: 0.15,
      fontSize: 6, fontFace: 'Ubuntu', bold: true, color: GRAY, align: 'center',
    });
  });

  // Right column: Top-Off Schedule table
  const rightX = 5.0;
  slide.addText('TOP-OFF SCHEDULE', {
    x: rightX, y: 0.64, w: 4.8, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu', bold: true, color: GREEN, letterSpacing: 2,
  } as any);

  const milestones = [0, 1, 3, 5, 8, 13, 18, 23, 29].filter(i => i < topOff.length);
  const toHeader: PptxGenJS.TableRow = [
    { text: 'Year', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK } } },
    { text: 'Home Value', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: '80% AMI', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'SAM Req\'d', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Recycled', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Period', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
    { text: 'Cumulative', options: { fontSize: 7, bold: true, color: WHITE, fill: { color: DARK }, align: 'right' } },
  ];

  const toRows: PptxGenJS.TableRow[] = [toHeader];
  milestones.forEach((idx, mi) => {
    const y = topOff[idx];
    const prevCum = mi > 0 ? topOff[milestones[mi - 1]].cumulativeTopOff : 0;
    const periodTopOff = y.cumulativeTopOff - prevCum;
    const hasPeriod = periodTopOff > 0;
    toRows.push([
      { text: String(y.calendarYear), options: { fontSize: 8, color: DARK, bold: true } },
      { text: fmtM(y.homeValue), options: { fontSize: 8, color: DARK, align: 'right' } },
      { text: fmtM(y.income80AMI), options: { fontSize: 8, color: DARK, align: 'right' } },
      { text: fmtM(y.samRequired), options: { fontSize: 8, color: DARK, align: 'right' } },
      { text: fmtM(y.recycledPerHome), options: { fontSize: 8, color: DARK, align: 'right' } },
      { text: hasPeriod ? fmtM(periodTopOff) : '\u2014', options: { fontSize: 8, color: DARK, align: 'right', bold: hasPeriod } },
      { text: fmtM(y.cumulativeTopOff), options: { fontSize: 8, color: DARK, align: 'right' } },
    ]);
  });

  slide.addTable(toRows, {
    x: rightX, y: 0.83, w: 4.8,
    fontSize: 8, fontFace: 'Ubuntu',
    border: { type: 'solid', pt: 0.5, color: 'F0F0EC' },
    colW: [0.5, 0.75, 0.7, 0.7, 0.65, 0.65, 0.75],
    rowH: 0.23,
  } as any);

  addPageNumber(slide, pageNum);
}

// ── Disclaimer Slide ──

async function buildDisclaimerSlide(pres: PptxGenJS, data: ProformaData, pageNum: number) {
  const fundName = data.fund.name || data.programName;
  const stateCode = data.fund.geography?.state;
  const stateName = stateCode ? STATE_NAMES[stateCode] || data.geoLabel : data.geoLabel;
  const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const slide = pres.addSlide();

  // Wordmark + green rule
  const wmSvg = homiumWordmark('#1A2930', 52);
  const wmPng = await svgToPng(wmSvg, 548, 104);
  slide.addImage({ data: wmPng, x: 0.5, y: 0.3, w: 1.5, h: 0.28 });
  slide.addShape('rect' as any, { x: 0.5, y: 0.63, w: 9, h: 0.02, fill: { color: GREEN } });

  // Title
  slide.addText('Important Disclosures', {
    x: 0.5, y: 0.90, w: 9, h: 0.45,
    fontSize: 28, fontFace: 'Taviraj', bold: false, color: DARK,
  });

  // Two-column text — combined heading + body to eliminate gap
  const colY = 1.50;
  const colH = 3.0;

  slide.addText([
    { text: 'NOTICE OF CONFIDENTIAL INFORMATION\n', options: { fontSize: 9, fontFace: 'Ubuntu', bold: true, color: DARK, letterSpacing: 1 } as any },
    { text: 'This document has been prepared by Homium, Inc. (\u201CHomium\u201D) for informational purposes only and is strictly confidential. ' +
    'This document is not an offer or solicitation to buy or sell any security or to participate in any investment strategy.\n\n' +
    'The projections and estimates contained in this document are based on assumptions that Homium believes to be reasonable as of the date hereof. ' +
    'However, actual results may differ materially from those projected. No representation or warranty, express or implied, is given as to the accuracy, ' +
    'reliability, or completeness of the information contained herein.\n\n' +
    'This material may not be reproduced, distributed, or transmitted to any third party without the prior written consent of Homium, Inc.',
    options: { fontSize: 8, fontFace: 'Ubuntu', color: '666666' } },
  ], { x: 0.5, y: colY, w: 4.3, h: colH, lineSpacingMultiple: 1.35, valign: 'top' } as any);

  slide.addText([
    { text: 'FORWARD-LOOKING STATEMENTS\n', options: { fontSize: 9, fontFace: 'Ubuntu', bold: true, color: DARK, letterSpacing: 1 } as any },
    { text: 'This pro forma contains forward-looking projections. Actual events or results may differ materially. ' +
    'Factors include market conditions, interest rates, housing price appreciation rates, regulatory changes, and other risk factors.\n\n' +
    `The ${fundName} model is based on the Homium Shared Appreciation Mortgage (\u201CSAM\u201D) structure. ` +
    `Key assumptions including home price appreciation (${fmtP(data.fund.assumptions.hpaPct, 1)}), ` +
    `interest rates (${fmtP(data.fund.assumptions.interestRate, 1)}), and geographic market conditions (${stateName}) are subject to significant uncertainty.\n\n` +
    'Past performance is not indicative of future results. All projected returns are hypothetical and not guarantees. ' +
    'Investors should conduct their own independent diligence and consult with professional advisors before investing.\n\n' +
    `\u00A9 ${new Date().getFullYear()} Homium, Inc. All rights reserved.`,
    options: { fontSize: 8, fontFace: 'Ubuntu', color: '666666' } },
  ], { x: 5.2, y: colY, w: 4.3, h: colH, lineSpacingMultiple: 1.35, valign: 'top' } as any);

  // Footer
  slide.addShape('rect' as any, { x: 0.5, y: 5.25, w: 9, h: 0.01, fill: { color: DARK } });
  slide.addText(fundName + ' \u2014 Pro Forma', { x: 0.5, y: 5.29, w: 3, h: 0.19, fontSize: 8, fontFace: 'Ubuntu', color: DARK });
  slide.addText(`Prepared by Homium, Inc. \u00B7 ${date}`, { x: 3.5, y: 5.29, w: 3, h: 0.19, fontSize: 8, fontFace: 'Ubuntu', color: DARK, align: 'center' });
  slide.addText(String(pageNum), { x: 8.5, y: 5.29, w: 1, h: 0.19, fontSize: 8, fontFace: 'Ubuntu', color: DARK, align: 'right' });
}

// ── Helpers ──

function addSectionBar(slide: PptxGenJS.Slide, tag: string, fundName: string, wordmarkPng: string) {
  // Tag + fund name (left)
  slide.addText(tag.toUpperCase(), {
    x: 0.4, y: 0.11, w: 2, h: 0.19,
    fontSize: 8, fontFace: 'Ubuntu', bold: true,
    color: GREEN, letterSpacing: 2,
  } as any);
  slide.addText(fundName, {
    x: 2.5, y: 0.09, w: 5, h: 0.23,
    fontSize: 16, fontFace: 'Taviraj',
    color: DARK, align: 'center',
  });
  // Wordmark (right)
  slide.addImage({
    data: wordmarkPng,
    x: 8.6, y: 0.11, w: 1.0, h: 0.19,
  });
}

function addPageNumber(slide: PptxGenJS.Slide, num: number) {
  slide.addText(String(num), {
    x: 9.0, y: 5.33, w: 0.5, h: 0.15,
    fontSize: 8, fontFace: 'Ubuntu',
    color: LIGHT_GRAY, align: 'right',
  });
}

// ── Main Export ──

export async function generateProformaPptx(data: ProformaData): Promise<Buffer> {
  const pres = new PptxGenJS();

  // 16:9 widescreen (10" × 5.625")
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'Homium, Inc.';
  pres.title = `${data.programName} Pro Forma`;
  pres.subject = 'Homium Shared Appreciation Homeownership Program';

  defineSlideMasters(pres);

  // Pre-render wordmark PNG for section bars
  const wmSvg = homiumWordmark('#AAAAAA', 36);
  const wordmarkPng = await svgToPng(wmSvg, 380, 72);

  // Build all slides
  await buildCoverSlide(pres, data);
  await buildOpportunitySlide(pres, data, wordmarkPng);
  await buildImpactSlide(pres, data, wordmarkPng);
  buildChartsSlide(pres, data, wordmarkPng);

  // Conditional slides
  let pageNum = 5;
  const hasGeo = data.result.geoBreakdown && data.result.geoBreakdown.length > 1;
  if (hasGeo) {
    buildGeoDistributionSlide(pres, data, wordmarkPng, pageNum);
    pageNum++;
  }
  if (data.topOff && data.topOff.length) {
    buildTopOffSlide(pres, data, wordmarkPng, pageNum);
    pageNum++;
  }

  await buildDisclaimerSlide(pres, data, pageNum);

  // Generate buffer
  const output = await pres.write({ outputType: 'nodebuffer' }) as Buffer;
  return Buffer.from(output);
}
