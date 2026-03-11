/**
 * Usage Analytics Routes
 *
 * POST /api/v2/usage       — log a usage event (unauthenticated, fire-and-forget from client)
 * GET  /api/v2/usage/sessions — admin query for recent sessions (API key required)
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { strictAuthMiddleware } from './auth';

const router = Router();

// ── POST /api/v2/usage — log a single event ──
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      eventType,
      eventData,
      leadEmail,
      leadOrg,
      leadName,
      state,
      utmSource,
      utmMedium,
      utmCampaign,
    } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({ success: false, error: 'sessionId and eventType required' });
    }

    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
      || req.ip
      || null;
    const userAgent = req.headers['user-agent'] || null;
    const referrer = req.headers['referer'] || req.headers['referrer'] || null;

    await pool.query(
      `INSERT INTO usage_events
        (session_id, event_type, event_data, lead_email, lead_org, lead_name, state,
         ip_address, user_agent, referrer, utm_source, utm_medium, utm_campaign)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        sessionId,
        eventType,
        eventData ? JSON.stringify(eventData) : null,
        leadEmail || null,
        leadOrg || null,
        leadName || null,
        state || null,
        ipAddress,
        userAgent,
        referrer,
        utmSource || null,
        utmMedium || null,
        utmCampaign || null,
      ]
    );

    // If this is a lead_submitted event, backfill prior anonymous events
    if (eventType === 'lead_submitted' && leadEmail && sessionId) {
      await pool.query(
        `UPDATE usage_events
         SET lead_email = $1, lead_org = $2, lead_name = $3
         WHERE session_id = $4 AND lead_email IS NULL`,
        [leadEmail, leadOrg || null, leadName || null, sessionId]
      );
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('Usage event error:', e.message);
    // Still return 200 — don't fail the client for analytics errors
    res.json({ success: false });
  }
});

// ── GET /api/v2/usage/sessions — admin query ──
router.get('/sessions', strictAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string | undefined;
    const state = req.query.state as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (email) {
      params.push(email);
      where += ` AND lead_email = $${params.length}`;
    }
    if (state) {
      params.push(state);
      where += ` AND state = $${params.length}`;
    }

    // Get recent sessions with aggregated event info
    params.push(limit);
    const result = await pool.query(
      `SELECT
         session_id,
         MIN(created_at) AS first_seen,
         MAX(created_at) AS last_seen,
         COUNT(*) AS event_count,
         MAX(lead_email) AS lead_email,
         MAX(lead_org) AS lead_org,
         MAX(lead_name) AS lead_name,
         array_agg(DISTINCT event_type) AS event_types,
         array_agg(DISTINCT state) FILTER (WHERE state IS NOT NULL) AS states
       FROM usage_events
       ${where}
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { count: result.rows.length },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v2/usage/sessions/:sessionId — get all events for a session ──
router.get('/sessions/:sessionId', strictAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, event_type, event_data, lead_email, lead_org, lead_name, state,
              ip_address, user_agent, referrer, utm_source, utm_medium, utm_campaign, created_at
       FROM usage_events
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [req.params.sessionId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { count: result.rows.length, sessionId: req.params.sessionId },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
