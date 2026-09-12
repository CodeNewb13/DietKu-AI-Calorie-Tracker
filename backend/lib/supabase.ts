import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  '';

/**
 * Routes that bypass RLS (scan quota, subscription sync) only work with the service-role
 * key. Falling back to the anon key keeps AI-only local dev bootable, but the failure then
 * surfaces as an opaque "row-level security policy" error deep in a request, so say so here.
 */
export const hasServiceRoleKey = Boolean(supabaseServiceRoleKey);

if (!hasServiceRoleKey) {
  console.error(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY is not set - falling back to the anon key. ' +
      'Routes needing elevated access (scan quota, subscription sync) will fail until it is configured.'
  );
}

const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
