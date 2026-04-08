/**
 * Auth Context Provider
 *
 * Wraps the app with auth state from useAuth hook.
 * Components use useAuthContext() to access auth state.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useAuth, type UserProfile } from '../../hooks/useAuth';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isActive: boolean;
  isTeam: boolean;
  isAdmin: boolean;
  needsProfile: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  verifyOtp: (email: string, token: string, type?: 'signup' | 'recovery') => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: (accessToken: string) => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
