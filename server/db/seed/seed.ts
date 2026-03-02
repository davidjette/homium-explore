/** Seed default scenarios + payoff schedule into Neon */
import { pool } from '../../src/db/pool';
import { DEFAULT_SCENARIOS, PAYOFF_SCHEDULE } from '../../src/engine/types';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create default model version
    const vRes = await client.query(
      `INSERT INTO udf_model_versions (version, notes, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      ['1.0.0', 'Initial model version — Phase 1 engine']
    );
    
    let versionId: string;
    if (vRes.rows.length > 0) {
      versionId = vRes.rows[0].id;
    } else {
      const existing = await client.query(
        `SELECT id FROM udf_model_versions WHERE version = '1.0.0'`
      );
      versionId = existing.rows[0].id;
    }
    console.log(`Model version: ${versionId}`);

    // 2. Seed scenarios
    for (const [key, s] of Object.entries(DEFAULT_SCENARIOS)) {
      const sRes = await client.query(
        `INSERT INTO udf_scenarios (
          model_version_id, name, weight, initial_raise,
          program_fee_pct, mgmt_fee_pct, utah_hpa_pct, interest_rate,
          median_income, median_home_value, down_payment_pct,
          homium_sa_pct, reinvest_proceeds, annual_contrib_pct, max_front_ratio
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING id`,
        [
          versionId, s.name, s.weight, s.initialRaise,
          s.programFeePct, s.managementFeePct, s.utahHPA, s.interestRate,
          s.medianParticipantIncome, s.medianHomeValue, s.downPaymentPct,
          s.homiumSAPct, s.reinvestNetProceeds, s.annualContributionPct, s.maxFrontRatio,
        ]
      );
      const scenarioId = sRes.rows[0].id;
      console.log(`  Scenario ${key}: ${scenarioId}`);

      // 3. Seed payoff schedule for each scenario
      for (const p of PAYOFF_SCHEDULE) {
        await client.query(
          `INSERT INTO udf_payoff_schedule (scenario_id, year_number, annual_pct, cumulative_pct)
           VALUES ($1, $2, $3, $4)`,
          [scenarioId, p.year, p.annualPct, p.cumulativePct]
        );
      }
      console.log(`    Payoff schedule: 30 years seeded`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed complete.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1); });
