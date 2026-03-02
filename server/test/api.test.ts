/**
 * API Integration Tests — Verify all endpoints return correct shapes
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';

describe('Health Endpoint', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Scenarios Endpoints', () => {
  it('GET /api/v1/udf/scenarios returns all scenarios', async () => {
    const res = await request(app).get('/api/v1/udf/scenarios');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.map((s: any) => s.name)).toContain('MID');
  });

  it('GET /api/v1/udf/scenarios/MID returns MID scenario', async () => {
    const res = await request(app).get('/api/v1/udf/scenarios/MID');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('MID');
    expect(res.body.data.affordability).toBeDefined();
    expect(res.body.data.affordability.gapAfter).toBeCloseTo(133.32, 0);
  });

  it('GET /api/v1/udf/scenarios/INVALID returns 404', async () => {
    const res = await request(app).get('/api/v1/udf/scenarios/INVALID');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/udf/scenarios/LO/results returns 30 years', async () => {
    const res = await request(app).get('/api/v1/udf/scenarios/LO/results');
    expect(res.status).toBe(200);
    expect(res.body.data.years).toHaveLength(30);
    expect(res.body.data.cohorts).toBeDefined();
    expect(res.body.data.affordability).toBeDefined();
    expect(res.body.meta.compute_time_ms).toBeDefined();
  });

  it('GET /api/v1/udf/scenarios/MID/impact returns impact metrics', async () => {
    const res = await request(app).get('/api/v1/udf/scenarios/MID/impact');
    expect(res.status).toBe(200);
    expect(res.body.data.homeowners10yr).toBeDefined();
    expect(res.body.data.equityCreated10yr).toBeGreaterThan(0);
    expect(res.body.data.leverage10yr).toBeGreaterThan(0);
  });
});

describe('Blended Endpoints', () => {
  it('GET /api/v1/udf/blended returns blended results', async () => {
    const res = await request(app).get('/api/v1/udf/blended');
    expect(res.status).toBe(200);
    expect(res.body.data.totalRaise).toBe(10_000_000);
    expect(res.body.data.totalHomeowners).toBeGreaterThan(80);
    expect(res.body.data.years).toHaveLength(30);
  });

  it('GET /api/v1/udf/blended/chart-data returns chart-ready data', async () => {
    const res = await request(app).get('/api/v1/udf/blended/chart-data');
    expect(res.status).toBe(200);
    expect(res.body.data.labels).toHaveLength(30);
    expect(res.body.data.datasets.returnedCapital).toHaveLength(30);
    expect(res.body.data.datasets.fundBalance).toHaveLength(30);
    expect(res.body.data.datasets.roiCumulative).toHaveLength(30);
  });
});

describe('Simulate Endpoint', () => {
  it('POST /api/v1/udf/simulate with custom assumptions', async () => {
    const res = await request(app)
      .post('/api/v1/udf/simulate')
      .send({ initialRaise: 5_000_000, utahHPA: 0.06 });
    expect(res.status).toBe(200);
    expect(res.body.data.assumptions.initialRaise).toBe(5_000_000);
    expect(res.body.data.assumptions.utahHPA).toBe(0.06);
    expect(res.body.data.years).toHaveLength(30);
  });

  it('POST /api/v1/udf/simulate without initialRaise returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/udf/simulate')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Sensitivity Endpoint', () => {
  it('POST /api/v1/udf/sensitivity returns sensitivity matrix', async () => {
    const res = await request(app)
      .post('/api/v1/udf/sensitivity')
      .send({
        parameter: 'utahHPA',
        values: [0.03, 0.05, 0.07],
        timeframes: [10, 30],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.parameter).toBe('utahHPA');
    expect(res.body.data.sensitivity).toHaveLength(3);
    expect(res.body.data.sensitivity[0].yr10).toBeDefined();
    expect(res.body.data.sensitivity[0].yr30).toBeDefined();
  });
});

describe('Validation Endpoint', () => {
  it('GET /api/v1/udf/validation returns all checkpoints', async () => {
    const res = await request(app).get('/api/v1/udf/validation');
    expect(res.status).toBe(200);
    expect(res.body.data.checkpoints).toHaveLength(11);
    expect(res.body.data.summary.total).toBe(11);
    const cp10 = res.body.data.checkpoints.find((c: any) => c.id === 10);
    expect(cp10.pass).toBe(true);
    const cp11 = res.body.data.checkpoints.find((c: any) => c.id === 11);
    expect(cp11.pass).toBe(true);
  });
});

describe('Share Conversion Endpoint', () => {
  it('GET /api/v1/udf/share-conversion returns conversion math', async () => {
    const res = await request(app).get('/api/v1/udf/share-conversion?raise=20000000&loanAmount=100000');
    expect(res.status).toBe(200);
    expect(res.body.data.classASharesIssued).toBe(19_047_619);
    expect(res.body.data.portfolioInvestorPnL).toBeCloseTo(-952_381, 0);
  });
});
