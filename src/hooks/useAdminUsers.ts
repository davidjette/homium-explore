/**
 * Admin Users Hook — Homium SSO
 *
 * Manages users via admin API endpoints (Supabase Admin API backed).
 * Supports: list, create, update role, reset password, confirm email, delete, audit log.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../components/shared/AuthProvider';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  organization?: string;
  role_type: string;
  avatar_url?: string;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  providers?: string[];
  // Explore-specific intake fields (present when source=local)
  timing?: string;
  funding_range?: string;
  geographic_focus?: string;
  program_type?: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  payload: {
    action?: string;
    actor_id?: string;
    actor_username?: string;
    log_type?: string;
    traits?: Record<string, unknown>;
  };
  ip_address?: string;
  created_at: string;
}

interface UseAdminUsersParams {
  search?: string;
  role?: string;
  page?: number;
}

export function useAdminUsers({ search = '', role = '', page = 1 }: UseAdminUsersParams) {
  const { session } = useAuthContext();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  const fetchUsers = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      params.set('page', String(page));

      const resp = await fetch(`${API_BASE}/admin/users?${params}`, {
        headers: headers(),
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error || `Failed to load users (${resp.status})`);
      }

      const json = await resp.json();
      if (json.success) {
        setUsers(json.data.users);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, search, role, page, headers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateRole = useCallback(async (userId: string, roleType: string) => {
    if (!session?.access_token) return;

    try {
      const resp = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ role_type: roleType }),
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to update role');
      }

      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role_type: roleType } : u
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
      fetchUsers();
    }
  }, [session?.access_token, fetchUsers, headers]);

  const createUser = useCallback(async (opts: {
    email: string;
    password?: string;
    role_type?: string;
    send_confirmation?: boolean;
  }) => {
    if (!session?.access_token) return;

    const resp = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(opts),
    });

    if (!resp.ok) {
      const json = await resp.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to create user');
    }

    fetchUsers();
    return resp.json();
  }, [session?.access_token, fetchUsers, headers]);

  const resetPassword = useCallback(async (userId: string, email: string) => {
    if (!session?.access_token) return;

    const resp = await fetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email }),
    });

    if (!resp.ok) {
      const json = await resp.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to send password reset');
    }
  }, [session?.access_token, headers]);

  const confirmEmail = useCallback(async (userId: string) => {
    if (!session?.access_token) return;

    const resp = await fetch(`${API_BASE}/admin/users/${userId}/confirm`, {
      method: 'POST',
      headers: headers(),
    });

    if (!resp.ok) {
      const json = await resp.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to confirm email');
    }

    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, email_confirmed_at: new Date().toISOString() } : u
    ));
  }, [session?.access_token, headers]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!session?.access_token) return;

    try {
      const resp = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to delete user');
      }

      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(prev => prev - 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }, [session?.access_token]);

  return {
    users, total, totalPages, loading, error,
    refetch: fetchUsers, updateRole, createUser, resetPassword, confirmEmail, deleteUser,
  };
}

/** Separate hook for audit log (different pagination/filtering) */
export function useAuditLog() {
  const { session } = useAuthContext();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchLog = useCallback(async (opts?: { action?: string; limit?: number }) => {
    if (!session?.access_token) return;

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (opts?.action) params.set('action', opts.action);
      params.set('limit', String(opts?.limit || 100));

      const resp = await fetch(`${API_BASE}/admin/audit-log?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to load audit log');
      }

      const json = await resp.json();
      if (json.success) {
        setEntries(json.data.entries);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  return { entries, loading, error, fetchLog };
}
