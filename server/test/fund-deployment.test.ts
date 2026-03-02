/**
 * Fund Model Deployment Integration Tests
 * 
 * Tests that verify the full fund model pipeline: create → persist → retrieve → re-run → export
 * Simulates production usage scenarios
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import { UDF_FUND_CONFIG } from '../src/engine/types';

describe('Fund Model Deployment Integration', () => {
  let firstFundId: string;
  let secondFundId: string;

  describe('Full Fund Lifecycle', () => {
    it('should create a fund, save to DB, retrieve, and re-run', async () => {
      // 1. Create and save fund
      const createResponse = await request(app)
        .post('/api/v2/funds/db')
        .send({
          ...UDF_FUND_CONFIG,
          name: 'Lifecycle Test Fund',
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.fundId).toBeDefined();
      firstFundId = createResponse.body.data.fundId;

      // 2. Retrieve the fund
      const retrieveResponse = await request(app)
        .get(`/api/v2/funds/db/${firstFundId}`);

      expect(retrieveResponse.status).toBe(200);
      expect(retrieveResponse.body.success).toBe(true);
      expect(retrieveResponse.body.data.fund.name).toBe('Lifecycle Test Fund');
      expect(retrieveResponse.body.data.latestRun).toBeDefined();

      // 3. Re-run the fund
      const rerunResponse = await request(app)
        .post(`/api/v2/funds/db/${firstFundId}/run`);

      expect(rerunResponse.status).toBe(200);
      expect(rerunResponse.body.success).toBe(true);
      expect(rerunResponse.body.data.resultId).toBeDefined();
      expect(rerunResponse.body.data.totalHomeowners).toBeGreaterThan(0);
    });

    it('should update fund config and verify changes persist', async () => {
      const updateResponse = await request(app)
        .put(`/api/v2/funds/db/${firstFundId}`)
        .send({
          raise: {
            totalRaise: 15_000_000, // Changed from 20M
            annualContributionPct: 0.02,
            reinvestNetProceeds: false,
            baseYear: 2025,
          },
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.fund.raise.totalRaise).toBe(15_000_000);

      // Verify the change persisted by retrieving again
      const retrieveResponse = await request(app)
        .get(`/api/v2/funds/db/${firstFundId}`);

      expect(retrieveResponse.body.data.fund.raise.totalRaise).toBe(15_000_000);
    });
  });

  describe('Multi-Fund Scenarios', () => {
    it('should create funds for different states and compare them', async () => {
      // Create UT fund
      const utFundResponse = await request(app)
        .post('/api/v2/funds/db')
        .send({
          ...UDF_FUND_CONFIG,
          name: 'Utah Fund',
          geography: { ...UDF_FUND_CONFIG.geography, state: 'UT' },
        });

      expect(utFundResponse.status).toBe(201);
      firstFundId = utFundResponse.body.data.fundId;

      // Create AZ fund
      const azFundResponse = await request(app)
        .post('/api/v2/funds/db')
        .send({
          ...UDF_FUND_CONFIG,
          name: 'Arizona Fund',
          geography: { ...UDF_FUND_CONFIG.geography, state: 'AZ' },
          raise: { ...UDF_FUND_CONFIG.raise, totalRaise: 15_000_000 },
        });

      expect(azFundResponse.status).toBe(201);
      secondFundId = azFundResponse.body.data.fundId;

      // Compare them
      const comparisonResponse = await request(app)
        .post('/api/v2/funds/analytics/comparison')
        .send({ fundIds: [firstFundId, secondFundId] });

      expect(comparisonResponse.status).toBe(200);
      expect(comparisonResponse.body.success).toBe(true);
      expect(comparisonResponse.body.data.comparison[firstFundId]).toBeDefined();
      expect(comparisonResponse.body.data.comparison[secondFundId]).toBeDefined();

      // Verify different state names
      expect(comparisonResponse.body.data.comparison[firstFundId].name).toBe('Utah Fund');
      expect(comparisonResponse.body.data.comparison[secondFundId].name).toBe('Arizona Fund');
    });

    it('should list all created funds with pagination', async () => {
      const listResponse = await request(app)
        .get('/api/v2/funds/db')
        .query({ limit: 10, offset: 0 });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);
      expect(Array.isArray(listResponse.body.data.funds)).toBe(true);
      expect(listResponse.body.data.total).toBeGreaterThanOrEqual(2);

      // Verify fund names are in the list
      const names = listResponse.body.data.funds.map((f: any) => f.name);
      expect(names).toContain('Utah Fund');
      expect(names).toContain('Arizona Fund');
    });
  });

  describe('Analytics Endpoints', () => {
    it('should return summary statistics across all funds', async () => {
      const response = await request(app)
        .get('/api/v2/funds/analytics/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalFunds).toBeGreaterThanOrEqual(2);
      expect(response.body.data.totalRaiseAcrossAllFunds).toBeGreaterThan(0);
      expect(response.body.data.averageTotalRaise).toBeGreaterThan(0);
      expect(response.body.data.stateDistribution).toBeDefined();
    });

    it('should return fund-specific analytics with timeseries', async () => {
      const response = await request(app)
        .get(`/api/v2/funds/db/${firstFundId}/analytics`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.fundId).toBe(firstFundId);
      expect(response.body.data.fund).toBeDefined();

      // Verify timeseries data
      if (response.body.data.latestRun) {
        expect(response.body.data.latestRun.timeseries).toBeDefined();
        expect(Array.isArray(response.body.data.latestRun.timeseries.labels)).toBe(true);
        expect(Array.isArray(response.body.data.latestRun.timeseries.equityCreated)).toBe(true);
        expect(response.body.data.latestRun.timeseries.labels.length).toBe(30); // 30 years
        expect(response.body.data.latestRun.keyMetrics.yr10).toBeDefined();
        expect(response.body.data.latestRun.keyMetrics.yr30).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 400 when creating fund without name', async () => {
      const response = await request(app)
        .post('/api/v2/funds/db')
        .send({ raise: { totalRaise: 10_000_000 } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('name');
    });

    it('should return 404 when retrieving non-existent fund', async () => {
      const response = await request(app)
        .get('/api/v2/funds/db/nonexistent-id-12345');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when comparing with empty fundIds', async () => {
      const response = await request(app)
        .post('/api/v2/funds/analytics/comparison')
        .send({ fundIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('V1/V2 API Coexistence', () => {
    it('should still support V1 UDF endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/udf/scenarios');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support V2 generic fund auto-populate from housing data', async () => {
      const response = await request(app)
        .post('/api/v2/funds/auto-populate')
        .send({
          state: 'UT',
          totalRaise: 10_000_000,
          name: 'UT Auto-Populated Fund',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.housingData).toBeDefined();
      expect(response.body.data.fund).toBeDefined();
      expect(response.body.data.totalHomeowners).toBeGreaterThan(0);
    }, 30000); // Increase timeout to 30s for multi-cohort processing
  });

  describe('Sensitivity Analysis on Persisted Funds', () => {
    it('should run sensitivity analysis on housing fee percentage', async () => {
      // Use the first fund we created
      const response = await request(app)
        .post('/api/v2/funds/sensitivity')
        .send({
          fund: UDF_FUND_CONFIG,
          parameter: 'programFeePct',
          values: [0.03, 0.05, 0.07],
          timeframes: [10, 30],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sensitivity.length).toBe(3);

      // Verify different results for each fee level
      const yr10Values = response.body.data.sensitivity.map((s: any) => s.yr10.equityCreated);
      const uniqueValues = new Set(yr10Values);
      expect(uniqueValues.size).toBe(3); // All three should be different
    });
  });

  describe('Cleanup', () => {
    it('should allow deletion of funds', async () => {
      // Delete first fund
      const deleteResponse = await request(app)
        .delete(`/api/v2/funds/db/${firstFundId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);

      // Verify it's gone
      const retrieveResponse = await request(app)
        .get(`/api/v2/funds/db/${firstFundId}`);

      expect(retrieveResponse.status).toBe(404);
    });
  });
});
