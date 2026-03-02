/**
 * Fund Persistence Tests
 * 
 * Test database CRUD operations and persistence API routes
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import app from '../src/api/server';
import { pool } from '../src/db/pool';
import { FundService } from '../src/db/services/fund-service';
import { UDF_FUND_CONFIG } from '../src/engine/types';

describe('Fund Persistence', () => {
  let fundService: FundService;

  beforeAll(async () => {
    fundService = new FundService(pool);
    // Run migrations to ensure tables exist
    // (assuming migrations are run in test setup)
  });

  afterAll(async () => {
    // Clean up test data
    // Note: in a real test environment, you might use transactions or separate test DB
  });

  describe('FundService CRUD', () => {
    it('should create a fund config', async () => {
      const fundData = {
        ...UDF_FUND_CONFIG,
        name: 'Test Fund 1',
      };

      const result = await fundService.createFund(fundData);
      expect(result.id).toBeDefined();
      expect(result.fund.name).toBe('Test Fund 1');
    });

    it('should get a fund by ID', async () => {
      const fundData = {
        ...UDF_FUND_CONFIG,
        name: 'Test Fund 2',
      };

      const created = await fundService.createFund(fundData);
      const retrieved = await fundService.getFund(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Fund 2');
      expect(retrieved?.scenarios.length).toBeGreaterThan(0);
    });

    it('should list funds with pagination', async () => {
      // Create a few test funds
      for (let i = 0; i < 3; i++) {
        await fundService.createFund({
          ...UDF_FUND_CONFIG,
          name: `Pagination Test Fund ${i}`,
        });
      }

      const result = await fundService.listFunds(10, 0);
      expect(result.funds.length).toBeGreaterThanOrEqual(3);
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.funds[0].id).toBeDefined();
      expect(result.funds[0].name).toBeDefined();
    });

    it('should update a fund config', async () => {
      const fundData = {
        ...UDF_FUND_CONFIG,
        name: 'Original Name',
      };

      const created = await fundService.createFund(fundData);

      const updates = {
        name: 'Updated Name',
        raise: {
          ...UDF_FUND_CONFIG.raise,
          totalRaise: 15_000_000,
        },
      };

      const updated = await fundService.updateFund(created.id, updates);
      expect(updated.name).toBe('Updated Name');
      expect(updated.raise.totalRaise).toBe(15_000_000);
    });

    it('should delete a fund', async () => {
      const fundData = {
        ...UDF_FUND_CONFIG,
        name: 'Fund to Delete',
      };

      const created = await fundService.createFund(fundData);
      await fundService.deleteFund(created.id);

      const retrieved = await fundService.getFund(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Fund Run Results', () => {
    it('should save and retrieve fund run results', async () => {
      const fundData = {
        ...UDF_FUND_CONFIG,
        name: 'Test Fund for Results',
      };

      const created = await fundService.createFund(fundData);

      // Mock run result (simplified for testing)
      const runResult = {
        totalHomeowners: 100,
        totalRaise: 10_000_000,
        blended: [
          {
            calendarYear: 2025,
            totalEquityCreated: 1_000_000,
            fundBalance: 8_000_000,
            activeHomeowners: 100,
            roiCumulative: 0.1,
          },
          // ... would have 30 years in a real result
        ],
        scenarioResults: [
          {
            scenario: { name: 'LO', weight: 0.2 },
            cohorts: [],
            affordability: { gapBefore: 10000, gapAfter: 5000 },
            fundResults: [],
          },
        ],
      };

      const saveResult = await fundService.saveFundResult(created.id, runResult);
      expect(saveResult.resultId).toBeDefined();

      const retrieved = await fundService.getLatestFundResult(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.totalHomeowners).toBe(100);
      expect(retrieved?.blended.length).toBeGreaterThan(0);
    });
  });

  describe('Fund Statistics', () => {
    it('should calculate fund statistics', async () => {
      // Create a few funds with different states
      await fundService.createFund({
        ...UDF_FUND_CONFIG,
        name: 'Utah Fund',
        geography: { ...UDF_FUND_CONFIG.geography, state: 'UT' },
      });

      await fundService.createFund({
        ...UDF_FUND_CONFIG,
        name: 'Arizona Fund',
        geography: { ...UDF_FUND_CONFIG.geography, state: 'AZ' },
      });

      const stats = await fundService.getFundStats();
      expect(stats.totalFunds).toBeGreaterThanOrEqual(2);
      expect(stats.totalRaiseAcrossAllFunds).toBeGreaterThan(0);
      expect(stats.stateDistribution).toBeDefined();
    });
  });
});

describe('Fund Persistence API', () => {
  describe('POST /api/v2/funds/db', () => {
    it('should create and run a fund via API', async () => {
      const fundData = {
        ...UDF_FUND_CONFIG,
        name: 'API Test Fund',
      };

      const response = await request(app)
        .post('/api/v2/funds/db')
        .send(fundData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.fundId).toBeDefined();
      expect(response.body.data.resultId).toBeDefined();
      expect(response.body.data.scenarios.length).toBeGreaterThan(0);
    });

    it('should reject fund without name', async () => {
      const response = await request(app)
        .post('/api/v2/funds/db')
        .send({ raise: { totalRaise: 10_000_000 } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('name');
    });
  });

  describe('GET /api/v2/funds/db', () => {
    it('should list saved funds', async () => {
      const response = await request(app).get('/api/v2/funds/db');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.funds)).toBe(true);
      expect(response.body.data.total).toBeGreaterThanOrEqual(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v2/funds/db')
        .query({ limit: 5, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.data.funds.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v2/funds/analytics/summary', () => {
    it('should return fund statistics', async () => {
      const response = await request(app).get('/api/v2/funds/analytics/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalFunds).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totalRaiseAcrossAllFunds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/v2/funds/analytics/comparison', () => {
    it('should compare multiple funds', async () => {
      // Create test funds
      const fund1Response = await request(app)
        .post('/api/v2/funds/db')
        .send({ ...UDF_FUND_CONFIG, name: 'Comparison Fund 1' });

      const fund2Response = await request(app)
        .post('/api/v2/funds/db')
        .send({ ...UDF_FUND_CONFIG, name: 'Comparison Fund 2' });

      const fundIds = [
        fund1Response.body.data.fundId,
        fund2Response.body.data.fundId,
      ];

      const response = await request(app)
        .post('/api/v2/funds/analytics/comparison')
        .send({ fundIds });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comparison).toBeDefined();
      expect(Object.keys(response.body.data.comparison).length).toBe(2);
    });
  });
});
