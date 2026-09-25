import { NextRequest } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/shared/db/supabase/server"
import type { User } from "@supabase/supabase-js"

/**
 * Auth for the browser extension's API calls.
 *
 * The extension popup runs in an origin-less context, so it cannot send the
 * web app's cookies. It authenticates with the Supabase session it already
 * holds, sending the access token as a Bearer header — the same arrangement
 * the cover-letter and question routes already support.
 *
 * A helper rather than copy-pasted blocks: every /api/extension route needs
 * exactly this decision (Bearer client vs. cookie server client) before it
 * can do anything else.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const authHeader = req.headers.get("Authorization")

  if (authHeader?.startsWith("Bearer ")) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return { user: null, supabase }
    return { user, supabase }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { user: null, supabase }
  return { user, supabase }
}
