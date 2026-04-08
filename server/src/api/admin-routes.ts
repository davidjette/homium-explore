/**
 * Admin Routes — Homium SSO User Management
 *
 * GET    /api/admin/users              — List all Homium users (from Supabase Auth)
 * POST   /api/admin/users              — Create a new user
 * PATCH  /api/admin/users/:id/role     — Update a user's role (writes to app_metadata)
 * POST   /api/admin/users/:id/reset-password — Send password reset email
 * POST   /api/admin/users/:id/confirm  — Manually confirm a user's email
 * DELETE /api/admin/users/:id          — Delete a user (auth + local DB)
 * GET    /api/admin/audit-log          — Auth audit log
 *
 * All routes require admin role.
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from './supabase-auth';
import {
  isAdminApiConfigured,
  listAuthUsers,
  createAuthUser,
  updateAppMetadata,
  sendPasswordResetEmail,
  confirmUserEmail,
  deleteAuthUser,
  fetchAuditLog,
  getAuthUser,
} from './supabase-admin';
import { sendApprovalEmail } from '../reports/email-service';

const router = Router();

/** GET /api/admin/users — List users from Supabase Auth (central directory) */
router.get('/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').trim().toLowerCase();
    const roleFilter = req.query.role as string || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = 25;

    if (isAdminApiConfigured()) {
      // Fetch from Supabase Admin API — central user directory
      const data = await listAuthUsers(page, perPage);
      let users = (data.users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || u.user_metadata?.full_name || null,
        avatar_url: u.user_metadata?.avatar_url || null,
        role_type: u.app_metadata?.role_type || 'registered',
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
        providers: (u.identities || []).map((i: any) => i.provider),
      }));

      // Client-side filtering (Supabase Admin API doesn't support search/filter natively)
      if (search) {
        users = users.filter(
          (u: any) =>
            u.email?.toLowerCase().includes(search) ||
            u.name?.toLowerCase().includes(search),
        );
      }
      if (roleFilter && ['registered', 'active', 'team', 'admin'].includes(roleFilter)) {
        users = users.filter((u: any) => u.role_type === roleFilter);
      }

      const total = data.total || users.length;

      res.json({
        success: true,
        data: {
          users,
          total,
          page,
          totalPages: Math.ceil(total / perPage),
          source: 'supabase',
        },
      });
    } else {
      // Fallback: local DB (no service role key configured)
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (search) {
        conditions.push(`(name ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`);
        params.push(`%${search}%`);
        paramIdx++;
      }
      if (roleFilter && ['registered', 'active', 'team', 'admin'].includes(roleFilter)) {
        conditions.push(`role_type = $${paramIdx}`);
        params.push(roleFilter);
        paramIdx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countResult = await pool.query(`SELECT COUNT(*) FROM users ${where}`, params);
      const total = parseInt(countResult.rows[0].count);

      const usersResult = await pool.query(
        `SELECT id, email, name, organization, role_type, avatar_url, timing, funding_range, geographic_focus, program_type, created_at
         FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, perPage, (page - 1) * perPage],
      );

      res.json({
        success: true,
        data: {
          users: usersResult.rows,
          total,
          page,
          totalPages: Math.ceil(total / perPage),
          source: 'local',
        },
      });
    }
  } catch (e: any) {
    console.error('Admin list users error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/admin/users — Create a new user */
router.post('/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!isAdminApiConfigured()) {
      res.status(501).json({ success: false, error: 'Supabase Admin API not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
      return;
    }

    const { email, password, role_type, send_confirmation } = req.body;

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required.' });
      return;
    }

    const user = await createAuthUser({
      email,
      password: password || undefined,
      role_type: role_type || 'registered',
      email_confirm: !send_confirmation, // If sending confirmation, don't auto-confirm
    });

    res.json({ success: true, data: user });
  } catch (e: any) {
    console.error('Admin create user error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** PATCH /api/admin/users/:id/role — Update user role (writes to Supabase app_metadata) */
router.patch('/users/:id/role', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id as string;
    const { role_type } = req.body;

    if (!role_type || !['registered', 'active', 'team', 'admin'].includes(role_type)) {
      res.status(400).json({ success: false, error: 'Invalid role_type. Must be registered, active, team, or admin.' });
      return;
    }

    // Prevent self-demotion
    if (req.user?.id === targetId && role_type !== 'admin') {
      res.status(400).json({ success: false, error: 'Cannot remove your own admin role.' });
      return;
    }

    // Update Supabase app_metadata (source of truth for SSO)
    if (isAdminApiConfigured()) {
      await updateAppMetadata(targetId, { role_type });
    }

    // Also update local DB for backward compatibility
    const result = await pool.query(
      `UPDATE users SET role_type = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, name, organization, role_type, avatar_url, created_at`,
      [role_type, targetId],
    );

    // Return result even if local user doesn't exist (role was still set in Supabase)
    if (result.rows.length === 0 && !isAdminApiConfigured()) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0] || { id: targetId, role_type },
    });
  } catch (e: any) {
    console.error('Admin update role error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/admin/users/:id/reset-password — Send password reset email */
router.post('/users/:id/reset-password', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!isAdminApiConfigured()) {
      res.status(501).json({ success: false, error: 'Supabase Admin API not configured.' });
      return;
    }

    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required.' });
      return;
    }

    await sendPasswordResetEmail(email, req.body.redirect_to);
    res.json({ success: true, data: { message: 'Password reset email sent.' } });
  } catch (e: any) {
    console.error('Admin reset password error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/admin/users/:id/confirm — Manually confirm email */
router.post('/users/:id/confirm', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!isAdminApiConfigured()) {
      res.status(501).json({ success: false, error: 'Supabase Admin API not configured.' });
      return;
    }

    await confirmUserEmail(req.params.id as string);
    res.json({ success: true, data: { message: 'Email confirmed.' } });
  } catch (e: any) {
    console.error('Admin confirm email error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/admin/users/:id/approve — Approve a registered user (set to active + send email) */
router.post('/users/:id/approve', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id as string;

    // Update role to 'active' in Supabase
    if (isAdminApiConfigured()) {
      await updateAppMetadata(targetId, { role_type: 'active' });
    }

    // Update local DB
    const result = await pool.query(
      `UPDATE users SET role_type = 'active', updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, role_type`,
      [targetId],
    );

    // Get user email for notification
    let userEmail = result.rows[0]?.email;
    let userName = result.rows[0]?.name;

    // If no local record, fetch from Supabase
    if (!userEmail && isAdminApiConfigured()) {
      const authUser = await getAuthUser(targetId) as any;
      userEmail = authUser.email;
      userName = authUser.user_metadata?.name || authUser.user_metadata?.full_name;
    }

    // Send approval notification email
    if (userEmail) {
      try {
        await sendApprovalEmail(userEmail, userName || undefined);
      } catch (emailErr: any) {
        console.error('Approval email failed (user was still approved):', emailErr.message);
      }
    }

    res.json({
      success: true,
      data: result.rows[0] || { id: targetId, role_type: 'active' },
    });
  } catch (e: any) {
    console.error('Admin approve user error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** DELETE /api/admin/users/:id — Delete user from auth + local DB */
router.delete('/users/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id as string;

    // Prevent self-deletion
    if (req.user?.id === targetId) {
      res.status(400).json({ success: false, error: 'Cannot delete your own account.' });
      return;
    }

    // Delete from Supabase Auth (source of truth)
    if (isAdminApiConfigured()) {
      try {
        await deleteAuthUser(targetId);
      } catch (err: any) {
        console.warn('Supabase delete failed (may not exist):', err.message);
      }
    }

    // Nullify ownership on their funds so they aren't orphan-deleted
    await pool.query('UPDATE fund_configs SET owner_id = NULL WHERE owner_id = $1', [targetId]);

    // Delete from local DB
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [targetId]);

    res.json({
      success: true,
      data: result.rows[0] || { id: targetId, deleted: true },
    });
  } catch (e: any) {
    console.error('Admin delete user error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/admin/audit-log — Auth event audit log */
router.get('/audit-log', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!isAdminApiConfigured()) {
      res.status(501).json({ success: false, error: 'Supabase Admin API not configured.' });
      return;
    }

    const { entries, total } = await fetchAuditLog({
      userId: req.query.userId as string,
      action: req.query.action as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });

    res.json({ success: true, data: { entries, total } });
  } catch (e: any) {
    console.error('Admin audit log error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
