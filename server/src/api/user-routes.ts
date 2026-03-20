/**
 * User Profile Routes
 *
 * POST /api/users/profile — upsert user profile (called after first OAuth sign-in)
 * GET  /api/users/me       — get current user's profile
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from './supabase-auth';

const router = Router();

/** POST /api/users/profile — Create or update user profile */
router.post('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const { name, organization, avatar_url } = req.body;

    const result = await pool.query(
      `INSERT INTO users (id, email, name, organization, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, users.name),
         organization = COALESCE(EXCLUDED.organization, users.organization),
         avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
         updated_at = NOW()
       RETURNING id, email, name, organization, role_type, avatar_url, created_at`,
      [user.id, user.email, name || null, organization || null, avatar_url || null]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (e: any) {
    console.error('User profile upsert error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/users/me — Get current user's profile */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const result = await pool.query(
      `SELECT id, email, name, organization, role_type, avatar_url, created_at
       FROM users WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      // User authenticated via Supabase but no profile yet
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role_type: 'registered',
          needsProfile: true,
        },
      });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
