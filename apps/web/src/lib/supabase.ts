import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.ts';

let _supabase: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!url || !key) throw new Error('Supabase env vars not configured — create apps/web/.env.local');
    _supabase = createClient<Database>(url, key);
  }
  return _supabase;
}

// Convenience: null when Supabase is not configured (used for auth-gated features)
export const supabaseConfigured = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);
