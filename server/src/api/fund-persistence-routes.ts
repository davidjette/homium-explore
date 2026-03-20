/**
 * Fund Persistence & Comparison Routes
 * 
 * Database CRUD for saved funds + analytics and comparison endpoints
 */
import { Router, Request, Response } from 'express';
import { FundService } from '../db/services/fund-service';
import { runFundModel, buildFundConfig } from '../engine/fund-model';
import { pool } from '../db/pool';

export function createFundPersistenceRoutes(fundService: FundService): Router {
  const router = Router();

  const ok = (data: any, meta: any = {}) => ({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), ...meta },
  });
  const err = (msg: string) => ({ success: false, error: msg });

  // ── Fund CRUD ──

  /** GET /api/v2/funds/db — List saved funds (filtered by ownership) */
  router.get('/db', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Team/admin see all funds, registered users see only their own
      const userRole = req.user?.role_type || 'registered';
      if (req.user?.id && (userRole === 'team' || userRole === 'admin')) {
        const result = await fundService.listFunds(limit, offset);
        res.json(ok(result));
      } else if (req.user?.id) {
        // Filter by owner_id for registered users
        const countResult = await pool.query(
          'SELECT COUNT(*) as count FROM fund_configs WHERE owner_id = $1',
          [req.user.id]
        );
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await pool.query(
          `SELECT fc.id, fc.name, fc.state, fc.total_raise, fc.created_at,
                  COUNT(fs.id) as scenario_count
           FROM fund_configs fc
           LEFT JOIN fund_scenarios fs ON fc.id = fs.fund_id
           WHERE fc.owner_id = $1
           GROUP BY fc.id
           ORDER BY fc.created_at DESC
           LIMIT $2 OFFSET $3`,
          [req.user.id, limit, offset]
        );
        const funds = result.rows.map(row => ({
          id: row.id,
          name: row.name,
          state: row.state,
          totalRaise: parseFloat(row.total_raise),
          scenarioCount: parseInt(row.scenario_count, 10),
          createdAt: row.created_at,
        }));
        res.json(ok({ funds, total }));
      } else {
        // Anonymous — return all (legacy behavior)
        const result = await fundService.listFunds(limit, offset);
        res.json(ok(result));
      }
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /** POST /api/v2/funds/db — Save a fund to the database and run it */
  router.post('/db', async (req: Request, res: Response) => {
    try {
      const rawConfig = req.body;
      if (!rawConfig.name) return res.status(400).json(err('Fund name required'));

      const start = Date.now();

      // Normalize config — frontend may send flat fields, buildFundConfig fills defaults
      const fundConfig = buildFundConfig(rawConfig);

      // Save to DB
      const { id: fundId, fund } = await fundService.createFund(fundConfig);

      // Set owner_id if authenticated
      if (req.user?.id) {
        await pool.query('UPDATE fund_configs SET owner_id = $1 WHERE id = $2', [req.user.id, fundId]);
      }

      // Run the model
      const runResult = await Promise.resolve(runFundModel(fund));

      // Save the result
      const { resultId } = await fundService.saveFundResult(fundId, runResult);

      res.status(201).json(ok({
        fundId,
        resultId,
        name: fund.name,
        scenarios: runResult.scenarioResults.map((sr: any) => ({
          name: sr.scenario.name,
          homeowners: sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0),
          yr10: sr.fundResults[9]
            ? {
                equityCreated: Math.round(sr.fundResults[9].totalEquityCreated),
                fundBalance: Math.round(sr.fundResults[9].fundBalance),
                roiCumulative: sr.fundResults[9].roiCumulative,
              }
            : null,
        })),
      }, { compute_time_ms: Date.now() - start }));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /** GET /api/v2/funds/db/:id — Get a saved fund config and latest run result */
  router.get('/db/:id', async (req: Request, res: Response) => {
    try {
      const fundId = String(req.params.id);
      const fund = await fundService.getFund(fundId);
      if (!fund) return res.status(404).json(err('Fund not found'));

      const result = await fundService.getLatestFundResult(fundId);

      res.json(ok({
        fund,
        latestRun: result,
      }));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /** PUT /api/v2/funds/db/:id — Update a fund config */
  router.put('/db/:id', async (req: Request, res: Response) => {
    try {
      const fundId = String(req.params.id);
      const updated = await fundService.updateFund(fundId, req.body);
      res.json(ok({ fund: updated }));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /** DELETE /api/v2/funds/db/:id — Delete a fund (ownership-checked) */
  router.delete('/db/:id', async (req: Request, res: Response) => {
    try {
      const fundId = String(req.params.id);

      // Verify ownership if authenticated (team/admin can delete any)
      if (req.user?.id) {
        const userRole = req.user.role_type || 'registered';
        if (userRole !== 'team' && userRole !== 'admin') {
          const ownerCheck = await pool.query(
            'SELECT owner_id FROM fund_configs WHERE id = $1', [fundId]
          );
          if (ownerCheck.rows.length > 0 && ownerCheck.rows[0].owner_id &&
              ownerCheck.rows[0].owner_id !== req.user.id) {
            res.status(403).json(err('You can only delete your own funds'));
            return;
          }
        }
      }

      await fundService.deleteFund(fundId);
      res.json(ok({ deleted: fundId }));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /** POST /api/v2/funds/db/:id/run — Retrieve a saved fund and re-run it */
  router.post('/db/:id/run', async (req: Request, res: Response) => {
    try {
      const fundId = String(req.params.id);
      const fund = await fundService.getFund(fundId);
      if (!fund) return res.status(404).json(err('Fund not found'));

      const start = Date.now();
      const runResult = await Promise.resolve(runFundModel(fund));

      // Save the result
      const { resultId } = await fundService.saveFundResult(fundId, runResult);

      res.json(ok({
        fundId,
        resultId,
        totalHomeowners: runResult.totalHomeowners,
        scenarios: runResult.scenarioResults.map((sr: any) => ({
          name: sr.scenario.name,
          homeowners: sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0),
          affordability: sr.affordability,
        })),
        blended: {
          yrEnd: (() => {
            const ei = runResult.blended.length - 1;
            const y = runResult.blended[ei];
            return y ? {
              equityCreated: Math.round(y.totalEquityCreated),
              fundBalance: Math.round(y.fundBalance),
              activeHomeowners: y.activeHomeowners,
              roiCumulative: y.roiCumulative,
            } : null;
          })(),
          yr30: runResult.blended[29]
            ? {
                equityCreated: Math.round(runResult.blended[29].totalEquityCreated),
                fundBalance: Math.round(runResult.blended[29].fundBalance),
                activeHomeowners: runResult.blended[29].activeHomeowners,
                roiCumulative: runResult.blended[29].roiCumulative,
              }
            : null,
        },
      }, { compute_time_ms: Date.now() - start }));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  // ── Analytics ──

  /** GET /api/v2/funds/analytics/summary — Overall fund statistics */
  router.get('/analytics/summary', async (req: Request, res: Response) => {
    try {
      const stats = await fundService.getFundStats();
      res.json(ok(stats));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /** POST /api/v2/funds/analytics/comparison — Compare multiple funds */
  router.post('/analytics/comparison', async (req: Request, res: Response) => {
    try {
      const { fundIds } = req.body;
      if (!fundIds || !Array.isArray(fundIds) || fundIds.length === 0) {
        return res.status(400).json(err('fundIds array required'));
      }

      const comparison: Record<string, any> = {};

      for (const fundId of fundIds) {
        const fund = await fundService.getFund(fundId);
        if (!fund) continue;

        const result = await fundService.getLatestFundResult(fundId);

        comparison[fundId] = {
          name: fund.name,
          state: fund.geography?.state,
          totalRaise: fund.raise.totalRaise,
          scenarioCount: fund.scenarios.length,
          latestRun: result ? {
            runAt: result.runAt,
            totalHomeowners: result.totalHomeowners,
            blended: {
              yrEnd: (() => {
                const ei = result.blended.length - 1;
                const y = result.blended[ei];
                return y ? {
                  equityCreated: Math.round(y.totalEquityCreated),
                  fundBalance: Math.round(y.fundBalance),
                  activeHomeowners: y.activeHomeowners,
                  roiCumulative: y.roiCumulative,
                } : null;
              })(),
              yr30: result.blended[29]
                ? {
                    equityCreated: Math.round(result.blended[29].totalEquityCreated),
                    fundBalance: Math.round(result.blended[29].fundBalance),
                    activeHomeowners: result.blended[29].activeHomeowners,
                    roiCumulative: result.blended[29].roiCumulative,
                  }
                : null,
            },
          } : null,
        };
      }

      res.json(ok({ comparison }));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  /** GET /api/v2/funds/db/:id/analytics — Fund-specific analytics */
  router.get('/db/:id/analytics', async (req: Request, res: Response) => {
    try {
      const fundId = String(req.params.id);
      const fund = await fundService.getFund(fundId);
      if (!fund) return res.status(404).json(err('Fund not found'));

      const result = await fundService.getLatestFundResult(fundId);

      if (!result) {
        return res.json(ok({
          fundId,
          fund: { name: fund.name, state: fund.geography?.state, totalRaise: fund.raise.totalRaise },
          message: 'No run results yet',
        }));
      }

      // Build analytics summary
      const analytics = {
        fundId,
        fund: {
          ...fund,
          state: fund.geography?.state,
        },
        latestRun: {
          runAt: result.runAt,
          totalHomeowners: result.totalHomeowners,
          totalRaise: result.totalRaise,
          scenarios: result.scenarios.map((sr: any) => ({
            scenario: sr.scenario,
            affordability: sr.affordability,
            homeowners: sr.cohorts ? sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0) : 0,
            fundResults: sr.fundResults,
          })),
          // Legacy compat
          scenarioBreakdown: result.scenarios.map((sr: any) => ({
            name: sr.scenario.name,
            affordability: sr.affordability,
            homeowners: sr.cohorts ? sr.cohorts.reduce((s: number, c: any) => s + c.homeownerCount, 0) : 0,
          })),
          blended: result.blended,
          timeseries: {
            labels: result.blended.map((y: any) => y.calendarYear),
            equityCreated: result.blended.map((y: any) => Math.round(y.totalEquityCreated)),
            fundBalance: result.blended.map((y: any) => Math.round(y.fundBalance)),
            activeHomeowners: result.blended.map((y: any) => y.activeHomeowners),
            roiCumulative: result.blended.map((y: any) => y.roiCumulative),
          },
          keyMetrics: {
            yrEnd: (() => {
              const ei = result.blended.length - 1;
              const y = result.blended[ei];
              return y ? {
                equityCreated: Math.round(y.totalEquityCreated),
                fundBalance: Math.round(y.fundBalance),
                activeHomeowners: y.activeHomeowners,
                totalHomeownersCum: y.totalHomeownersCum,
                roiCumulative: y.roiCumulative,
              } : null;
            })(),
            yr10: result.blended[9]
              ? {
                  equityCreated: Math.round(result.blended[9].totalEquityCreated),
                  fundBalance: Math.round(result.blended[9].fundBalance),
                  activeHomeowners: result.blended[9].activeHomeowners,
                  totalHomeownersCum: result.blended[9].totalHomeownersCum,
                  roiCumulative: result.blended[9].roiCumulative,
                }
              : null,
            yr30: result.blended[29]
              ? {
                  equityCreated: Math.round(result.blended[29].totalEquityCreated),
                  fundBalance: Math.round(result.blended[29].fundBalance),
                  activeHomeowners: result.blended[29].activeHomeowners,
                  totalHomeownersCum: result.blended[29].totalHomeownersCum,
                  roiCumulative: result.blended[29].roiCumulative,
                }
              : null,
          },
        },
      };

      res.json(ok(analytics));
    } catch (e: any) {
      res.status(500).json(err(e.message));
    }
  });

  return router;
}
