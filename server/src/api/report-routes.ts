/**
 * Pro Forma Report Routes
 *
 * POST /report/email  — Generate PDF + email as attachment
 * POST /report/pdf    — Generate PDF + download
 * GET  /report/preview — Dev: render raw HTML in browser
 */

import { Router } from 'express';
import { buildFundConfig, runFundModel } from '../engine/fund-model';
import { calculateAffordability } from '../engine/affordability';
import { calculateTopOffSchedule } from '../engine/topoff-calculator';
import { toLegacyAssumptions, FundConfig } from '../engine/types';
import { generateProformaHTML, ProformaData } from '../reports/proforma-report';
import { htmlToPdfBuffer } from '../reports/pdf-generator';
import { sendProFormaEmail } from '../reports/email-service';
import { generateProformaExcel } from '../reports/excel-generator';
import { generateFormulaExcel } from '../reports/excel-generator-formula';

const router = Router();

// Concurrency guard — Puppeteer is memory-heavy, reject parallel requests
let generating = false;

function buildProformaData(fundInput: any, programName?: string): ProformaData {
  const fund: FundConfig = buildFundConfig({
    name: fundInput.name || programName || 'Homeownership Program',
    ...fundInput,
  });

  const result = runFundModel(fund);
  const blended = result.blended;

  // Use MID scenario for affordability display
  const midScenario = fund.scenarios.find(s => s.name === 'MID') || fund.scenarios[0];
  const legacy = toLegacyAssumptions(fund, midScenario);
  const affordability = calculateAffordability(legacy);

  // State-based geography: prefer full state name, fall back to label
  const stateCode = fund.geography?.state;
  const stateNames: Record<string, string> = {
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
  const geoLabel = (stateCode && stateNames[stateCode])
    || fund.geography?.label
    || 'Target Geography';

  // Top-off calculation if wage growth is specified
  // Use fixedHomeCount if set, otherwise fall back to totalHomeowners from the model
  const homeCount = fund.program.fixedHomeCount || result.totalHomeowners;
  const topOff = (fund.assumptions.wageGrowthPct != null && homeCount)
    ? calculateTopOffSchedule(fund, fund.assumptions.wageGrowthPct, homeCount)
    : undefined;

  return {
    fund,
    result,
    blended,
    affordability,
    programName: programName || fund.name,
    geoLabel,
    topOff,
  };
}

// POST /report/email — Generate + email pro forma
router.post('/report/email', async (req, res) => {
  if (generating) {
    return res.status(503).json({
      success: false,
      error: 'PDF generation already in progress. Please wait and retry.',
    });
  }

  const { fund, email, recipientName, programName, includeAffordabilitySensitivity } = req.body;
  if (!fund) {
    return res.status(400).json({ success: false, error: 'fund configuration required' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email address required' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ success: false, error: 'Email service not configured' });
  }

  generating = true;
  const start = Date.now();

  try {
    const data = buildProformaData(fund, programName);
    if (!includeAffordabilitySensitivity) data.topOff = undefined;
    const html = generateProformaHTML(data);
    const pdfBuffer = await htmlToPdfBuffer(html);
    const { id: messageId } = await sendProFormaEmail(
      email,
      data.programName,
      data.geoLabel,
      pdfBuffer,
      recipientName,
    );

    res.json({
      success: true,
      data: {
        messageId,
        email,
        pdfSizeBytes: pdfBuffer.length,
        programName: data.programName,
      },
      meta: { timestamp: new Date().toISOString(), duration_ms: Date.now() - start },
    });
  } catch (err: any) {
    console.error('Pro forma email error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    generating = false;
  }
});

// POST /report/pdf — Generate + download pro forma PDF
router.post('/report/pdf', async (req, res) => {
  if (generating) {
    return res.status(503).json({
      success: false,
      error: 'PDF generation already in progress. Please wait and retry.',
    });
  }

  const { fund, programName, includeAffordabilitySensitivity } = req.body;
  if (!fund) {
    return res.status(400).json({ success: false, error: 'fund configuration required' });
  }

  generating = true;

  try {
    const data = buildProformaData(fund, programName);
    if (!includeAffordabilitySensitivity) data.topOff = undefined;
    const html = generateProformaHTML(data);
    const pdfBuffer = await htmlToPdfBuffer(html);
    const filename = `${data.programName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}-Pro-Forma.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('Pro forma PDF error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    generating = false;
  }
});

// POST /report/xlsx — Generate + download pro forma Excel
router.post('/report/xlsx', async (req, res) => {
  const { fund, programName, useFormulas } = req.body;
  if (!fund) {
    return res.status(400).json({ success: false, error: 'fund configuration required' });
  }

  try {
    const data = buildProformaData(fund, programName);
    const buffer = useFormulas
      ? await generateFormulaExcel(data)
      : await generateProformaExcel(data);
    const filename = `${data.programName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}-Pro-Forma.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err: any) {
    console.error('Pro forma Excel error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /report/preview — Dev: render raw HTML in browser for iteration
router.get('/report/preview', (req, res) => {
  try {
    const data = buildProformaData({
      name: 'SLC 46-Home Program',
      geography: { state: 'UT', label: 'Salt Lake City' },
      raise: { totalRaise: 5_500_000, annualContributionPct: 0, reinvestNetProceeds: true, baseYear: 2026 },
      fees: { programFeePct: 0.05, managementFeePct: 0.005 },
      assumptions: { hpaPct: 0.05, interestRate: 0.07, wageGrowthPct: 0.03 },
      program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30, fixedHomeCount: 46 },
      scenarios: [
        { name: 'LO', weight: 0.20, raiseAllocation: 1_100_000, medianIncome: 76_000, medianHomeValue: 350_000 },
        { name: 'MID', weight: 0.60, raiseAllocation: 3_300_000, medianIncome: 98_000, medianHomeValue: 440_000 },
        { name: 'HI', weight: 0.20, raiseAllocation: 1_100_000, medianIncome: 132_000, medianHomeValue: 600_000 },
      ],
    });
    const html = generateProformaHTML(data);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
