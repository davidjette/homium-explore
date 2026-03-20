/**
 * Admin Routes — User management
 *
 * GET  /api/admin/users          — List all users (search, role filter, pagination)
 * PATCH /api/admin/users/:id/role — Update a user's role
 *
 * All routes require admin role.
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from './supabase-auth';

const router = Router();

/** GET /api/admin/users — List users with optional search, role filter, pagination */
router.get('/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').trim();
    const role = req.query.role as string || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 25;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(name ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (role && ['registered', 'team', 'admin'].includes(role)) {
      conditions.push(`role_type = $${paramIdx}`);
      params.push(role);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const usersResult = await pool.query(
      `SELECT id, email, name, organization, role_type, avatar_url, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: any) {
    console.error('Admin list users error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** PATCH /api/admin/users/:id/role — Update user role */
router.patch('/users/:id/role', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const { role_type } = req.body;

    if (!role_type || !['registered', 'team', 'admin'].includes(role_type)) {
      res.status(400).json({ success: false, error: 'Invalid role_type. Must be registered, team, or admin.' });
      return;
    }

    // Prevent self-demotion
    if (req.user?.id === targetId && role_type !== 'admin') {
      res.status(400).json({ success: false, error: 'Cannot remove your own admin role.' });
      return;
    }

    const result = await pool.query(
      `UPDATE users SET role_type = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, name, organization, role_type, avatar_url, created_at`,
      [role_type, targetId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (e: any) {
    console.error('Admin update role error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
