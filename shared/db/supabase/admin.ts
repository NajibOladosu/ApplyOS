import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for trusted server jobs such as cron handlers.
 *
 * It bypasses Row Level Security, so it must only be used in code that runs
 * without a user session (scheduled jobs). Never call it from code that serves
 * an end-user request, and never expose the key to the browser.
 *
 * The cookie-bound client from ./server is not suitable for cron: a scheduled
 * invocation carries no user session, so RLS returns no rows and auth.admin
 * calls fail.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Supabase admin client is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
