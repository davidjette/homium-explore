/**
 * Fund Database Service
 * 
 * CRUD operations for FundConfig and FundRunResults persistence in Neon PostgreSQL
 */
import { Pool, QueryResult } from 'pg';
import { FundConfig, ScenarioConfig } from '../../engine/types';

export class FundService {
  constructor(private pool: Pool) {}

  /**
   * Create a new fund config in the database
   */
  async createFund(fund: FundConfig): Promise<{ id: string; fund: FundConfig }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert fund_configs
      const fundResult = await client.query(
        `INSERT INTO fund_configs (
          name, state, county, zip_codes, geography_label,
          total_raise, annual_contribution_pct, reinvest_proceeds, base_year,
          program_fee_pct, mgmt_fee_pct, hpa_pct, interest_rate,
          homium_sa_pct, down_payment_pct, max_front_ratio, max_hold_years
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id`,
        [
          fund.name,
          fund.geography?.state || null,
          fund.geography?.county || null,
          fund.geography?.zipCodes?.length ? `{${fund.geography.zipCodes.join(',')}}` : null,
          fund.geography?.label || null,
          fund.raise.totalRaise,
          fund.raise.annualContributionPct,
          fund.raise.reinvestNetProceeds,
          fund.raise.baseYear,
          fund.fees.programFeePct,
          fund.fees.managementFeePct,
          fund.assumptions.hpaPct,
          fund.assumptions.interestRate,
          fund.program.homiumSAPct,
          fund.program.downPaymentPct,
          fund.program.maxFrontRatio,
          fund.program.maxHoldYears,
        ]
      );

      const fundId = fundResult.rows[0].id;

      // Insert fund_scenarios
      for (const scenario of fund.scenarios) {
        await client.query(
          `INSERT INTO fund_scenarios (fund_id, name, weight, raise_allocation, median_income, median_home_value)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            fundId,
            scenario.name,
            scenario.weight,
            scenario.raiseAllocation,
            scenario.medianIncome || null,
            scenario.medianHomeValue || null,
          ]
        );
      }

      // Insert fund_payoff_schedules
      if (fund.payoffSchedule && fund.payoffSchedule.length > 0) {
        for (const [idx, payout] of fund.payoffSchedule.entries()) {
          await client.query(
            `INSERT INTO fund_payoff_schedules (fund_id, year_number, annual_pct, cumulative_pct)
             VALUES ($1, $2, $3, $4)`,
            [fundId, idx + 1, payout.annualPct, payout.cumulativePct]
          );
        }
      }

      await client.query('COMMIT');
      return { id: fundId, fund };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Get a fund config by ID
   */
  async getFund(fundId: string): Promise<FundConfig | null> {
    // Validate UUID format to avoid PostgreSQL errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fundId)) return null;

    const result = await this.pool.query(
      'SELECT * FROM fund_configs WHERE id = $1',
      [fundId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    // Get scenarios
    const scenariosResult = await this.pool.query(
      'SELECT * FROM fund_scenarios WHERE fund_id = $1 ORDER BY name',
      [fundId]
    );

    // Get payoff schedule
    const payoffResult = await this.pool.query(
      'SELECT * FROM fund_payoff_schedules WHERE fund_id = $1 ORDER BY year_number',
      [fundId]
    );

    // Reconstruct FundConfig
    const fund: FundConfig = {
      name: row.name,
      geography: {
        state: row.state,
        county: row.county,
        zipCodes: row.zip_codes ? (Array.isArray(row.zip_codes) ? row.zip_codes : JSON.parse(row.zip_codes)) : [],
        label: row.geography_label,
      },
      raise: {
        totalRaise: parseFloat(row.total_raise),
        annualContributionPct: parseFloat(row.annual_contribution_pct),
        reinvestNetProceeds: row.reinvest_proceeds,
        baseYear: row.base_year,
      },
      fees: {
        programFeePct: parseFloat(row.program_fee_pct),
        managementFeePct: parseFloat(row.mgmt_fee_pct),
      },
      assumptions: {
        hpaPct: parseFloat(row.hpa_pct),
        interestRate: parseFloat(row.interest_rate),
      },
      program: {
        homiumSAPct: parseFloat(row.homium_sa_pct),
        downPaymentPct: parseFloat(row.down_payment_pct),
        maxFrontRatio: parseFloat(row.max_front_ratio),
        maxHoldYears: row.max_hold_years,
      },
      scenarios: scenariosResult.rows.map(s => ({
        name: s.name,
        weight: parseFloat(s.weight),
        raiseAllocation: parseFloat(s.raise_allocation),
        medianIncome: s.median_income ? parseFloat(s.median_income) : 0,
        medianHomeValue: s.median_home_value ? parseFloat(s.median_home_value) : 0,
      })),
      payoffSchedule: payoffResult.rows.map(p => ({
        year: p.year_number,
        annualPct: parseFloat(p.annual_pct),
        cumulativePct: parseFloat(p.cumulative_pct),
      })),
    };

    return fund;
  }

  /**
   * Update a fund config
   */
  async updateFund(fundId: string, updates: Partial<FundConfig>): Promise<FundConfig> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update fund_configs
      if (updates.raise || updates.fees || updates.assumptions || updates.program || updates.geography) {
        const current = await this.getFund(fundId);
        if (!current) throw new Error(`Fund ${fundId} not found`);

        const merged = { ...current, ...updates };

        await client.query(
          `UPDATE fund_configs SET
            name = $1,
            state = $2, county = $3, zip_codes = $4, geography_label = $5,
            total_raise = $6, annual_contribution_pct = $7, reinvest_proceeds = $8, base_year = $9,
            program_fee_pct = $10, mgmt_fee_pct = $11, hpa_pct = $12, interest_rate = $13,
            homium_sa_pct = $14, down_payment_pct = $15, max_front_ratio = $16, max_hold_years = $17,
            updated_at = NOW()
            WHERE id = $18`,
          [
            merged.name,
            merged.geography.state,
            merged.geography.county,
            merged.geography.zipCodes?.length ? `{${merged.geography.zipCodes.join(',')}}` : null,
            merged.geography.label,
            merged.raise.totalRaise,
            merged.raise.annualContributionPct,
            merged.raise.reinvestNetProceeds,
            merged.raise.baseYear,
            merged.fees.programFeePct,
            merged.fees.managementFeePct,
            merged.assumptions.hpaPct,
            merged.assumptions.interestRate,
            merged.program.homiumSAPct,
            merged.program.downPaymentPct,
            merged.program.maxFrontRatio,
            merged.program.maxHoldYears,
            fundId,
          ]
        );

        // Update scenarios if provided
        if (updates.scenarios) {
          await client.query('DELETE FROM fund_scenarios WHERE fund_id = $1', [fundId]);
          for (const scenario of updates.scenarios) {
            await client.query(
              `INSERT INTO fund_scenarios (fund_id, name, weight, raise_allocation, median_income, median_home_value)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                fundId,
                scenario.name,
                scenario.weight,
                scenario.raiseAllocation,
                scenario.medianIncome || null,
                scenario.medianHomeValue || null,
              ]
            );
          }
        }
      }

      await client.query('COMMIT');
      const updated = await this.getFund(fundId);
      if (!updated) throw new Error('Failed to retrieve updated fund');
      return updated;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a fund and all associated data
   */
  async deleteFund(fundId: string): Promise<void> {
    await this.pool.query('DELETE FROM fund_configs WHERE id = $1', [fundId]);
  }

  /**
   * List all funds with summary info
   */
  async listFunds(limit = 50, offset = 0): Promise<{
    funds: Array<{ id: string; name: string; state?: string; totalRaise: number; scenarioCount: number; createdAt: Date }>;
    total: number;
  }> {
    const countResult = await this.pool.query('SELECT COUNT(*) as count FROM fund_configs');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT fc.id, fc.name, fc.state, fc.total_raise, fc.created_at,
              COUNT(fs.id) as scenario_count
       FROM fund_configs fc
       LEFT JOIN fund_scenarios fs ON fc.id = fs.fund_id
       GROUP BY fc.id
       ORDER BY fc.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const funds = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      state: row.state,
      totalRaise: parseFloat(row.total_raise),
      scenarioCount: parseInt(row.scenario_count, 10),
      createdAt: row.created_at,
    }));

    return { funds, total };
  }

  /**
   * Save a fund run result
   */
  async saveFundResult(
    fundId: string,
    runResult: {
      totalHomeowners: number;
      totalRaise: number;
      blended: any[];
      scenarioResults: any[];
    }
  ): Promise<{ resultId: string }> {
    const result = await this.pool.query(
      `INSERT INTO fund_run_results (fund_id, total_homeowners, total_raise, blended_json, scenarios_json, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        fundId,
        runResult.totalHomeowners,
        runResult.totalRaise,
        JSON.stringify(runResult.blended),
        JSON.stringify(runResult.scenarioResults),
        JSON.stringify({ computedAt: new Date().toISOString(), version: '2.0' }),
      ]
    );

    return { resultId: result.rows[0].id };
  }

  /**
   * Get the latest run result for a fund
   */
  async getLatestFundResult(fundId: string): Promise<any | null> {
    const result = await this.pool.query(
      'SELECT * FROM fund_run_results WHERE fund_id = $1 ORDER BY run_at DESC LIMIT 1',
      [fundId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      fundId: row.fund_id,
      runAt: row.run_at,
      totalHomeowners: row.total_homeowners,
      totalRaise: parseFloat(row.total_raise),
      blended: typeof row.blended_json === 'string' ? JSON.parse(row.blended_json) : row.blended_json,
      scenarios: typeof row.scenarios_json === 'string' ? JSON.parse(row.scenarios_json) : row.scenarios_json,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  }

  /**
   * Get fund statistics for analytics
   */
  async getFundStats(): Promise<{
    totalFunds: number;
    totalRaiseAcrossAllFunds: number;
    averageTotalRaise: number;
    stateDistribution: Record<string, number>;
  }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(id) as total_funds,
        SUM(total_raise) as total_raise,
        AVG(total_raise) as avg_raise,
        state
       FROM fund_configs
       GROUP BY state`
    );

    const totalResult = await this.pool.query('SELECT COUNT(id) as count, SUM(total_raise) as sum FROM fund_configs');
    const totalRow = totalResult.rows[0];

    const stateDistribution: Record<string, number> = {};
    for (const row of result.rows) {
      if (row.state) {
        stateDistribution[row.state] = parseInt(row.total_funds, 10);
      }
    }

    return {
      totalFunds: parseInt(totalRow.count, 10),
      totalRaiseAcrossAllFunds: parseFloat(totalRow.sum || 0),
      averageTotalRaise: parseInt(totalRow.count, 10) > 0 ? parseFloat(totalRow.sum || 0) / parseInt(totalRow.count, 10) : 0,
      stateDistribution,
    };
  }
}
