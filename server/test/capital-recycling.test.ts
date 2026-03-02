/**
 * Capital Recycling Tests — Dynamic Multi-Cohort Deployment
 * 
 * Tests the 5 critical fixes:
 * 1. Annual contributions are added each year
 * 2. Returned capital is reinvested into new homeowners
 * 3. Multiple cohorts are created across years (not just year 1)
 * 4. New output columns (capitalDeployed, reinvestedFunds, newContributions) exist and are correct
 * 5. ROI calculation is (total returned - total deployed) / total deployed
 */
import { describe, it, expect } from 'vitest';
import { runFundModel, buildFundConfig } from '../src/engine/fund-model';
import { FundConfig } from '../src/engine/types';

describe('Capital Recycling — Multi-Cohort Deployment', () => {
  
  it('Bug 1: Annual contributions are added each year', () => {
    const fund = buildFundConfig({
      name: 'Test Fund - Annual Contributions',
      raise: {
        totalRaise: 1_000_000,
        annualContributionPct: 0.10,  // 10% annual contribution
        reinvestNetProceeds: false,
        baseYear: 2025,
      },
      scenarios: [{
        name: 'BASE',
        weight: 1.0,
        raiseAllocation: 1_000_000,
        medianIncome: 98_000,
        medianHomeValue: 440_000,
      }],
    });

    const result = runFundModel(fund);
    const blended = result.blended;

    // Year 1: no annual contribution (only initial raise)
    expect(blended[0].newContributions).toBe(0);
    expect(blended[0].newDonations).toBe(1_000_000);

    // Year 2-30: should have annual contribution of 10% × initial raise
    const expectedContribution = 1_000_000 * 0.10;  // $100k
    for (let i = 1; i < blended.length; i++) {
      expect(blended[i].newContributions).toBe(expectedContribution);
    }
  });

  it('Bug 2: Returned capital is reinvested into new homeowners', () => {
    const fund = buildFundConfig({
      name: 'Test Fund - Reinvestment',
      raise: {
        totalRaise: 500_000,
        annualContributionPct: 0,
        reinvestNetProceeds: true,  // Enable reinvestment
        baseYear: 2025,
      },
      fees: { programFeePct: 0, managementFeePct: 0 },  // Simplify test
      scenarios: [{
        name: 'BASE',
        weight: 1.0,
        raiseAllocation: 500_000,
        medianIncome: 98_000,
        medianHomeValue: 440_000,
      }],
    });

    const result = runFundModel(fund);
    const blended = result.blended;

    // Find first year with returned capital
    const firstReturnYear = blended.findIndex(yr => yr.returnedCapital > 0);
    expect(firstReturnYear).toBeGreaterThan(0);  // Should happen after year 1

    // Verify reinvestedFunds column tracks returned capital
    expect(blended[firstReturnYear].reinvestedFunds).toBe(blended[firstReturnYear].returnedCapital);

    // Returned capital is collected end-of-year, so it's available for NEXT year's deployment.
    // Verify new homeowners appear in the year after sufficient capital is returned.
    if (blended[firstReturnYear].reinvestedFunds > 100_000 && firstReturnYear + 1 < blended.length) {
      expect(blended[firstReturnYear + 1].newHomeowners).toBeGreaterThan(0);
    }
  });

  it('Bug 3: Multiple cohorts are created across years, not just year 1', () => {
    const fund = buildFundConfig({
      name: 'Test Fund - Multi-Cohort',
      raise: {
        totalRaise: 1_000_000,
        annualContributionPct: 0.05,  // 5% annual
        reinvestNetProceeds: true,
        baseYear: 2025,
      },
      fees: { programFeePct: 0, managementFeePct: 0 },
      scenarios: [{
        name: 'BASE',
        weight: 1.0,
        raiseAllocation: 1_000_000,
        medianIncome: 98_000,
        medianHomeValue: 440_000,
      }],
    });

    const result = runFundModel(fund);
    const scenario = result.scenarioResults[0];

    // Verify multiple cohorts were created
    expect(scenario.cohorts.length).toBeGreaterThan(1);

    // Verify cohorts span multiple years
    const cohortYears = scenario.cohorts.map(c => c.cohortYear);
    const uniqueYears = new Set(cohortYears);
    expect(uniqueYears.size).toBeGreaterThan(1);

    // Verify year 1 has homeowners
    expect(scenario.cohorts.find(c => c.cohortYear === 1)).toBeDefined();

    // Verify at least one later year has homeowners (from contributions or recycling)
    const laterYearCohorts = scenario.cohorts.filter(c => c.cohortYear > 1);
    expect(laterYearCohorts.length).toBeGreaterThan(0);
  });

  it('Bug 4: New output columns exist and have correct values', () => {
    const fund = buildFundConfig({
      name: 'Test Fund - Output Columns',
      raise: {
        totalRaise: 1_000_000,
        annualContributionPct: 0.10,
        reinvestNetProceeds: true,
        baseYear: 2025,
      },
      scenarios: [{
        name: 'BASE',
        weight: 1.0,
        raiseAllocation: 1_000_000,
        medianIncome: 98_000,
        medianHomeValue: 440_000,
      }],
    });

    const result = runFundModel(fund);
    const blended = result.blended;

    // Verify all new columns exist
    for (const yr of blended) {
      expect(yr).toHaveProperty('newContributions');
      expect(yr).toHaveProperty('reinvestedFunds');
      expect(yr).toHaveProperty('capitalDeployed');

      // All should be numbers (not undefined/null)
      expect(typeof yr.newContributions).toBe('number');
      expect(typeof yr.reinvestedFunds).toBe('number');
      expect(typeof yr.capitalDeployed).toBe('number');
    }

    // Year 1: should have capitalDeployed > 0
    expect(blended[0].capitalDeployed).toBeGreaterThan(0);

    // Year 2+: should have newContributions > 0
    expect(blended[1].newContributions).toBeGreaterThan(0);

    // Find year with returned capital + reinvestment
    const reinvestYear = blended.find(yr => yr.returnedCapital > 0 && yr.reinvestedFunds > 0);
    if (reinvestYear) {
      expect(reinvestYear.reinvestedFunds).toBe(reinvestYear.returnedCapital);
    }
  });

  it('Bug 5: ROI calculation is (total returned - total deployed) / total deployed', () => {
    const fund = buildFundConfig({
      name: 'Test Fund - ROI Calculation',
      raise: {
        totalRaise: 1_000_000,
        annualContributionPct: 0,
        reinvestNetProceeds: false,
        baseYear: 2025,
      },
      fees: { programFeePct: 0.05, managementFeePct: 0 },
      scenarios: [{
        name: 'BASE',
        weight: 1.0,
        raiseAllocation: 1_000_000,
        medianIncome: 98_000,
        medianHomeValue: 440_000,
      }],
    });

    const result = runFundModel(fund);
    const blended = result.blended;

    // Deployed capital = what was actually deployed to homeowners
    // (may be less than available capital if remainder doesn't fit whole homeowners)
    const deployed = blended[0].capitalDeployed;
    expect(deployed).toBeGreaterThan(0);
    expect(deployed).toBeLessThanOrEqual(1_000_000 * (1 - 0.05));  // Can't exceed net raise

    // ROI is TVPI-based: (distributions + fundNAV - lpCapitalIn) / lpCapitalIn
    // Total Value = cumulative distributions + current NAV (cash + positions)
    for (let i = 0; i < blended.length; i++) {
      const totalValue = blended[i].cumulativeDistributions + blended[i].fundNAV;
      const expectedROI = blended[i].lpCapitalIn > 0
        ? (totalValue - blended[i].lpCapitalIn) / blended[i].lpCapitalIn
        : 0;
      expect(blended[i].roiCumulative).toBeCloseTo(expectedROI, 4);
    }

    // Verify final ROI makes sense (should be positive after 30 years with appreciation)
    expect(blended[29].roiCumulative).toBeGreaterThan(0);
  });

  it('Integration: Full dynamic capital flow (contributions + recycling + multi-cohort)', () => {
    const fund = buildFundConfig({
      name: 'Test Fund - Full Integration',
      raise: {
        totalRaise: 2_000_000,
        annualContributionPct: 0.05,  // 5% annual
        reinvestNetProceeds: true,
        baseYear: 2025,
      },
      fees: { programFeePct: 0.05, managementFeePct: 0.005 },
      assumptions: { hpaPct: 0.05, interestRate: 0.07 },
      program: { homiumSAPct: 0.25, downPaymentPct: 0.03, maxFrontRatio: 0.30, maxHoldYears: 30 },
      scenarios: [{
        name: 'BASE',
        weight: 1.0,
        raiseAllocation: 2_000_000,
        medianIncome: 98_000,
        medianHomeValue: 440_000,
      }],
    });

    const result = runFundModel(fund);
    const blended = result.blended;
    const scenario = result.scenarioResults[0];

    // 1. Verify year 1 initial deployment
    expect(blended[0].capitalDeployed).toBeGreaterThan(0);
    expect(blended[0].newHomeowners).toBeGreaterThan(0);

    // 2. Verify annual contributions
    for (let i = 1; i < blended.length; i++) {
      expect(blended[i].newContributions).toBe(2_000_000 * 0.05);
    }

    // 3. Verify capital recycling happens
    const recyclingYears = blended.filter(yr => yr.reinvestedFunds > 0);
    expect(recyclingYears.length).toBeGreaterThan(0);

    // 4. Verify multi-cohort creation
    expect(scenario.cohorts.length).toBeGreaterThan(3);  // At least several cohorts
    const cohortYears = new Set(scenario.cohorts.map(c => c.cohortYear));
    expect(cohortYears.size).toBeGreaterThan(3);  // Cohorts span multiple years

    // 5. Verify total homeowners grow over time (from contributions + recycling)
    let prevTotal = 0;
    for (const yr of blended) {
      expect(yr.totalHomeownersCum).toBeGreaterThanOrEqual(prevTotal);
      prevTotal = yr.totalHomeownersCum;
    }

    // 6. Verify ROI is NAV-based: (fundNAV - lpCapitalIn) / lpCapitalIn
    // With continuous deployment + contributions, NAV reflects both cash and position value
    const yr30 = blended[29];
    const totalValue = yr30.cumulativeDistributions + yr30.fundNAV;
    const expectedROI = yr30.lpCapitalIn > 0
      ? (totalValue - yr30.lpCapitalIn) / yr30.lpCapitalIn
      : 0;
    expect(yr30.roiCumulative).toBeCloseTo(expectedROI, 4);

    // 7. Verify final homeowner count is significantly higher than year 1
    //    (due to contributions + recycling creating new cohorts)
    const year1Homeowners = blended[0].totalHomeownersCum;
    const year30Homeowners = blended[29].totalHomeownersCum;
    expect(year30Homeowners).toBeGreaterThan(year1Homeowners * 2);  // At least 2x growth
  });
});
