/**
 * Supabase Client
 *
 * Initialized with public project URL and anon key (safe to embed in frontend).
 * Uses PKCE flow — works with GitHub Pages (no server-side auth needed).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
