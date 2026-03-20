/**
 * Admin Users Hook
 *
 * Fetches and manages users via admin API endpoints.
 * Uses plain fetch (matches existing patterns in the codebase).
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
  timing?: string;
  funding_range?: string;
  geographic_focus?: string;
  program_type?: string;
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
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
  }, [session?.access_token, search, role, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateRole = useCallback(async (userId: string, roleType: string) => {
    if (!session?.access_token) return;

    try {
      const resp = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role_type: roleType }),
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to update role');
      }

      // Update local state immediately
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role_type: roleType } : u
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
      // Refetch to ensure consistency
      fetchUsers();
    }
  }, [session?.access_token, fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!session?.access_token) return;

    try {
      const resp = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to delete user');
      }

      // Remove from local state
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(prev => prev - 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }, [session?.access_token]);

  return { users, total, totalPages, loading, error, refetch: fetchUsers, updateRole, deleteUser };
}
