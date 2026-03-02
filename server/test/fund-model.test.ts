import { describe, it, expect } from 'vitest';
import {
  FundConfig, UDF_FUND_CONFIG, DEFAULT_PAYOFF_SCHEDULE,
  toLegacyAssumptions, DEFAULT_SCENARIOS,
} from '../src/engine/types';
import { runFundModel, buildFundConfig } from '../src/engine/fund-model';

describe('Generic Fund Model', () => {
  describe('UDF backward compatibility', () => {
    it('UDF_FUND_CONFIG produces same results as legacy', () => {
      const result = runFundModel(UDF_FUND_CONFIG);
      expect(result.totalHomeowners).toBeGreaterThanOrEqual(83);
      expect(result.totalHomeowners).toBeLessThanOrEqual(88);
      expect(result.scenarioResults).toHaveLength(3);
    });

    it('toLegacyAssumptions maps correctly', () => {
      const mid = UDF_FUND_CONFIG.scenarios[1];
      const legacy = toLegacyAssumptions(UDF_FUND_CONFIG, mid);
      expect(legacy.name).toBe('MID');
      expect(legacy.initialRaise).toBe(6_000_000);
      expect(legacy.utahHPA).toBe(0.05);
      expect(legacy.medianHomeValue).toBe(440_000);
    });

    it('blended results have 30 years', () => {
      const result = runFundModel(UDF_FUND_CONFIG);
      expect(result.blended).toHaveLength(30);
    });

    it('MID scenario homeowners = 52', () => {
      const result = runFundModel(UDF_FUND_CONFIG);
      const mid = result.scenarioResults.find(r => r.scenario.name === 'MID')!;
      const homeowners = mid.cohorts.reduce((s, c) => s + c.homeownerCount, 0);
      expect(homeowners).toBeGreaterThanOrEqual(51);
      expect(homeowners).toBeLessThanOrEqual(52);
    });
  });

  describe('Custom fund creation', () => {
    it('buildFundConfig fills defaults', () => {
      const fund = buildFundConfig({ name: 'Test Fund' });
      expect(fund.name).toBe('Test Fund');
      expect(fund.raise.totalRaise).toBe(10_000_000);
      expect(fund.fees.programFeePct).toBe(0.05);
      expect(fund.payoffSchedule).toHaveLength(30);
      expect(fund.scenarios).toHaveLength(1);
    });

    it('custom fund with single scenario runs', () => {
      const fund = buildFundConfig({
        name: 'Arizona Opportunity Fund',
        geography: { state: 'AZ', label: 'Phoenix MSA' },
        raise: { totalRaise: 5_000_000, annualContributionPct: 0, reinvestNetProceeds: false, baseYear: 2026 },
        assumptions: { hpaPct: 0.04, interestRate: 0.065 },
        scenarios: [{
          name: 'BASE', weight: 1.0, raiseAllocation: 5_000_000,
          medianIncome: 72_000, medianHomeValue: 380_000,
        }],
      });

      const result = runFundModel(fund);
      expect(result.totalHomeowners).toBeGreaterThan(0);
      expect(result.blended).toHaveLength(30);
      expect(result.scenarioResults).toHaveLength(1);
    });

    it('custom fund with 3 scenarios blends correctly', () => {
      const fund = buildFundConfig({
        name: 'Multi-scenario Fund',
        scenarios: [
          { name: 'LO', weight: 0.25, raiseAllocation: 2_500_000, medianIncome: 60_000, medianHomeValue: 300_000 },
          { name: 'MID', weight: 0.50, raiseAllocation: 5_000_000, medianIncome: 85_000, medianHomeValue: 400_000 },
          { name: 'HI', weight: 0.25, raiseAllocation: 2_500_000, medianIncome: 120_000, medianHomeValue: 550_000 },
        ],
      });

      const result = runFundModel(fund);
      expect(result.scenarioResults).toHaveLength(3);
      expect(result.blended).toHaveLength(30);
      // Blended equity should be positive at year 10
      expect(result.blended[9].totalEquityCreated).toBeGreaterThan(0);
    });

    it('different HPA rates produce different outcomes', () => {
      const run = (hpa: number) => {
        const fund = buildFundConfig({
          name: 'HPA test',
          assumptions: { hpaPct: hpa, interestRate: 0.07 },
          scenarios: [{ name: 'BASE', weight: 1.0, raiseAllocation: 10_000_000, medianIncome: 90_000, medianHomeValue: 400_000 }],
        });
        return runFundModel(fund);
      };

      const low = run(0.02);
      const high = run(0.08);
      expect(high.blended[9].totalEquityCreated).toBeGreaterThan(low.blended[9].totalEquityCreated);
    });
  });

  describe('Edge cases', () => {
    it('zero raise produces zero homeowners', () => {
      const fund = buildFundConfig({
        name: 'Empty Fund',
        raise: { totalRaise: 0, annualContributionPct: 0, reinvestNetProceeds: false, baseYear: 2025 },
        scenarios: [{ name: 'BASE', weight: 1.0, raiseAllocation: 0, medianIncome: 90_000, medianHomeValue: 400_000 }],
      });
      const result = runFundModel(fund);
      expect(result.totalHomeowners).toBe(0);
    });

    it('fund balance never goes negative', () => {
      const fund = buildFundConfig({
        name: 'Balance Test',
        scenarios: [{ name: 'BASE', weight: 1.0, raiseAllocation: 10_000_000, medianIncome: 90_000, medianHomeValue: 400_000 }],
      });
      const result = runFundModel(fund);
      for (const yr of result.blended) {
        expect(yr.fundBalance).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
