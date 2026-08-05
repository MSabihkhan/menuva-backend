import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { env } from './env';

// (1) ANON client — public key, no session. Used ONLY for the diner entry point
//     (join_table_session, callable by anon) and health checks.
export const supabaseAnon: SupabaseClient<Database> = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// (2) SERVICE-ROLE client — bypasses RLS. Used ONLY for privileged ops:
//     staff invite emails, nightly jobs, matview refresh, SaaS/admin analytics
//     that legitimately span tenants. NEVER reachable from a diner route.
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// (3) REQUEST-SCOPED client factory — forwards the caller's JWT so RLS applies.
//     Called by the authenticate middleware; the result is attached to req.
export function supabaseForToken(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
