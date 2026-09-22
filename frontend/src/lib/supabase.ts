import { createClient } from '@supabase/supabase-js'

import { env } from '@/lib/env'

/**
 * The browser's Supabase client. Used for auth only - signup, login, session.
 *
 * Application data is never read from here directly. It goes through the
 * FastAPI backend, which re-verifies the JWT and runs every query under the
 * caller's identity so RLS applies. Keeping data access on one path means
 * there is one place to audit.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    // Keeps the user signed in across refreshes, and swaps the access token
    // before it expires so the API does not start 401-ing mid-session.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'prd-drafter-auth',
  },
})

/** The current access token, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
