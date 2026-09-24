/**
 * EEO self-identification — the ONLY HTTP surface for public.user_profile_eeo.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md sections 9.2 and 11.2.
 *
 * WHY THIS ROUTE EXISTS AT ALL. Migration 033 grants `authenticated` no
 * privilege on public.user_profile_eeo and no EXECUTE on the four EEO RPCs
 * (033:749-757). That is deliberate: `authenticated` is the role the browser
 * extension's JWT assumes, and Postgres cannot tell the first-party settings UI
 * from a content script running inside greenhouse.io — both present a Supabase
 * Auth JWT with role=authenticated. So the RPCs are service-role only and are
 * reached here, where the user is verified server-side first.
 *
 * COOKIE SESSIONS ONLY — NO Bearer BRANCH, UNLIKE THE OTHER ROUTES.
 * app/api/applications/analyze/route.ts:12-27 accepts `Authorization: Bearer`
 * so the extension can call it. Doing that here would hand the extension the
 * EEO surface through the front door and undo the whole separation. The
 * extension receives EEO values only through public.get_autofill_bundle()
 * (migration 034), which returns the block only when the user has opted in.
 *
 * The fill engine never calls this route.
 */

import { createClient } from '@/shared/db/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Closed vocabularies, mirroring the CHECK constraints in 033. Validating here
 * turns a raw 23514 into a 400 that names the field. The database remains the
 * authority — this is a better error message, not the control.
 */
const VOCAB = {
  gender: ['male', 'female', 'non_binary', 'decline_to_self_identify'],
  hispanic_or_latino: ['yes', 'no', 'decline_to_self_identify'],
  race: [
    'american_indian_or_alaska_native',
    'asian',
    'black_or_african_american',
    'native_hawaiian_or_other_pacific_islander',
    'white',
    'two_or_more_races',
    'decline_to_self_identify',
  ],
  veteran_status: ['not_a_protected_veteran', 'protected_veteran', 'decline_to_self_identify'],
  disability_status: ['yes', 'no', 'decline_to_self_identify'],
} as const

type VocabField = keyof typeof VOCAB

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role is not configured')
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

/** Resolves the caller from the cookie session. Bearer is deliberately not accepted. */
async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limited = await rateLimitMiddleware(req, RATE_LIMITS.general, async () => user.id)
    if (limited) return limited

    const { data, error } = await serviceClient().rpc('get_eeo_for_editing', { p_user_id: user.id })
    if (error) throw error

    // SETOF returns an array; zero rows means "never answered", which is a
    // different fact from "answered decline_to_self_identify" and must stay
    // distinguishable at the client boundary (033 column comment).
    const row = Array.isArray(data) ? data[0] ?? null : data ?? null
    return NextResponse.json({ eeo: row, answered: row !== null })
  } catch (error) {
    console.error('Error reading EEO self-identification:', error)
    return NextResponse.json({ error: 'Failed to read EEO self-identification' }, { status: 500 })
  }
}

/** Full replace of the answer set. Does NOT change consent — see PATCH. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limited = await rateLimitMiddleware(req, RATE_LIMITS.general, async () => user.id)
    if (limited) return limited

    const body = (await req.json()) as Record<string, unknown>

    for (const field of Object.keys(VOCAB) as VocabField[]) {
      const value = body[field]
      if (value === undefined || value === null) continue
      if (typeof value !== 'string' || !(VOCAB[field] as readonly string[]).includes(value)) {
        return NextResponse.json(
          { error: `Invalid value for ${field}`, allowed: VOCAB[field] },
          { status: 400 },
        )
      }
    }

    const jurisdiction = body.jurisdiction
    if (jurisdiction !== undefined && jurisdiction !== null) {
      if (typeof jurisdiction !== 'string' || !/^[A-Z]{2}$/.test(jurisdiction)) {
        return NextResponse.json(
          { error: 'jurisdiction must be an ISO-3166-1 alpha-2 code' },
          { status: 400 },
        )
      }
    }

    const { data, error } = await serviceClient().rpc('upsert_eeo', {
      p_user_id: user.id,
      // Omitted means "leave the stored jurisdiction alone" — passing 'US' here
      // would silently relocate a non-US user on every settings save.
      p_jurisdiction: (jurisdiction as string | undefined) ?? null,
      p_gender: (body.gender as string | undefined) ?? null,
      p_hispanic_or_latino: (body.hispanic_or_latino as string | undefined) ?? null,
      p_race: (body.race as string | undefined) ?? null,
      p_veteran_status: (body.veteran_status as string | undefined) ?? null,
      p_disability_status: (body.disability_status as string | undefined) ?? null,
      p_disability_form_version: (body.disability_form_version as string | undefined) ?? null,
    })
    if (error) throw error

    return NextResponse.json({ eeo: Array.isArray(data) ? data[0] ?? null : data })
  } catch (error) {
    console.error('Error saving EEO self-identification:', error)
    return NextResponse.json({ error: 'Failed to save EEO self-identification' }, { status: 500 })
  }
}

/**
 * Consent toggle. Separate from PUT because answering the questions and agreeing
 * to have them auto-filled are two distinct acts, and this is the single record
 * of the second one.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limited = await rateLimitMiddleware(req, RATE_LIMITS.general, async () => user.id)
    if (limited) return limited

    const { autofill_eeo_enabled: enabled } = (await req.json()) as { autofill_eeo_enabled?: unknown }
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'autofill_eeo_enabled must be a boolean' }, { status: 400 })
    }

    const { data, error } = await serviceClient().rpc('set_eeo_autofill_enabled', {
      p_enabled: enabled,
      p_user_id: user.id,
    })
    if (error) throw error

    // Withdrawing consent that was never granted is a no-op and returns no row,
    // rather than materialising an empty special-category row (033).
    return NextResponse.json({ eeo: Array.isArray(data) ? data[0] ?? null : data })
  } catch (error) {
    console.error('Error updating EEO autofill consent:', error)
    return NextResponse.json({ error: 'Failed to update EEO autofill consent' }, { status: 500 })
  }
}

/** Hard delete. Withdrawing consent stops the engine; this erases the answers. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limited = await rateLimitMiddleware(req, RATE_LIMITS.general, async () => user.id)
    if (limited) return limited

    const { data, error } = await serviceClient().rpc('delete_eeo', { p_user_id: user.id })
    if (error) throw error

    return NextResponse.json({ deleted: data === true })
  } catch (error) {
    console.error('Error deleting EEO self-identification:', error)
    return NextResponse.json({ error: 'Failed to delete EEO self-identification' }, { status: 500 })
  }
}
