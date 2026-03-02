import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';

const TEST_PORT = 3003;
let server: any;

beforeAll(() => {
  server = app.listen(TEST_PORT);
});
afterAll(() => {
  server?.close();
});

describe('V2 Fund Model API', () => {
  describe('POST /api/v2/funds/create', () => {
    it('creates and runs a simple fund', async () => {
      const res = await request(app)
        .post('/api/v2/funds/create')
        .send({
          name: 'Arizona Test Fund',
          geography: { state: 'AZ', label: 'Phoenix' },
          raise: { totalRaise: 5_000_000 },
          assumptions: { hpaPct: 0.04, interestRate: 0.065 },
          scenarios: [
            { name: 'BASE', weight: 1.0, raiseAllocation: 5_000_000, medianIncome: 72_000, medianHomeValue: 380_000 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fund.name).toBe('Arizona Test Fund');
      expect(res.body.data.totalHomeowners).toBeGreaterThan(0);
      expect(res.body.data.blended.labels).toHaveLength(30);
    });

    it('rejects without name', async () => {
      const res = await request(app).post('/api/v2/funds/create').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v2/funds/run', () => {
    it('runs a full fund config', async () => {
      const res = await request(app)
        .post('/api/v2/funds/run')
        .send({
          name: 'Full Config Test',
          geography: { state: 'UT', label: 'Utah' },
          raise: { totalRaise: 10_000_000, annualContributionPct: 0, reinvestNetProceeds: false, baseYear: 2025 },
          fees: { programFeePct: 0.05, managementFeePct: 0.005 },
          assumptions: { hpaPct: 0.05, interestRate: 0.07 },
          program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30 },
          scenarios: [
            { name: 'LO', weight: 0.20, raiseAllocation: 2_000_000, medianIncome: 76_000, medianHomeValue: 350_000 },
            { name: 'MID', weight: 0.60, raiseAllocation: 6_000_000, medianIncome: 98_000, medianHomeValue: 440_000 },
            { name: 'HI', weight: 0.20, raiseAllocation: 2_000_000, medianIncome: 132_000, medianHomeValue: 600_000 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.scenarioResults).toHaveLength(3);
      expect(res.body.data.blended).toHaveLength(30);
    });
  });

  describe('POST /api/v2/funds/sensitivity', () => {
    it('runs HPA sensitivity analysis', async () => {
      const res = await request(app)
        .post('/api/v2/funds/sensitivity')
        .send({
          fund: {
            name: 'Sensitivity Test',
            scenarios: [{ name: 'BASE', weight: 1.0, raiseAllocation: 10_000_000, medianIncome: 90_000, medianHomeValue: 400_000 }],
          },
          parameter: 'hpaPct',
          values: [0.02, 0.05, 0.08],
          timeframes: [10, 30],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.sensitivity).toHaveLength(3);
      // Higher HPA should produce more equity
      const equities = res.body.data.sensitivity.map((s: any) => s.yr10?.equityCreated || 0);
      expect(equities[2]).toBeGreaterThan(equities[0]);
    });
  });

  describe('POST /api/v2/funds/share-conversion', () => {
    it('calculates share conversion', async () => {
      const res = await request(app)
        .post('/api/v2/funds/share-conversion')
        .send({ fundsRaised: 20_000_000, loanAmount: 100_000 });

      expect(res.status).toBe(200);
      expect(res.body.data.classASharesIssued).toBe(19047619);
    });
  });
});
