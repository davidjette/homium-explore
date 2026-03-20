/**
 * Authentication Hook
 *
 * Wraps Supabase auth state + role info from user profile.
 * Provides signInWithGoogle, signOut, and role checks.
 */
import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  organization?: string;
  role_type: string;
  avatar_url?: string;
  needsProfile?: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from our API
  const fetchProfile = useCallback(async (accessToken: string) => {
    try {
      const resp = await fetch(`${API_BASE}/users/me`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success) {
          setProfile(json.data);
          return json.data as UserProfile;
        }
      }
    } catch {
      // Profile fetch failed — user may need to create profile
    }
    return null;
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        fetchProfile(s.access_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.access_token) {
          fetchProfile(s.access_token);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + (import.meta.env.BASE_URL || '/'),
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, []);

  const isAuthenticated = !!session && !!user;
  const roleType = profile?.role_type || 'registered';
  const isTeam = roleType === 'team' || roleType === 'admin';
  const isAdmin = roleType === 'admin';
  const needsProfile = profile?.needsProfile === true || (isAuthenticated && !profile);

  return {
    user,
    session,
    profile,
    loading,
    isAuthenticated,
    isTeam,
    isAdmin,
    needsProfile,
    signInWithGoogle,
    signOut,
    fetchProfile,
  };
}
