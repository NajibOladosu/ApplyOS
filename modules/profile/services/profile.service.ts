/**
 * Autofill profile CRUD — public.user_profiles (033_create_user_profiles.sql).
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 9.5.
 *
 * EEO IS NOT HERE, AND CANNOT BE. 033 grants `authenticated` no privilege on
 * public.user_profile_eeo and no EXECUTE on get_eeo_for_editing / upsert_eeo /
 * set_eeo_autofill_enabled / delete_eeo (033:749-757). This module runs under
 * the browser client — the anon key plus the user's JWT — so every EEO call it
 * could make would come back "permission denied for function". The settings UI
 * reaches that data through a server route holding the service-role client,
 * which is what those RPCs' p_user_id parameter exists for (033:569-572).
 */

import { createClient } from '@/shared/db/supabase/client'
import {
  CORE_PROFILE_KEYS,
  COLUMN_TO_KEY,
  isKeyPopulated,
} from '@/modules/profile/lib/canonical-keys'
import type { ProfileKey } from '@/shared/autofill/types'
import type {
  FieldProvenance,
  ProvenanceSource,
  UserProfile,
} from '@/types/database'

/**
 * What a caller may write. field_provenance is absent on purpose: it is derived
 * from the patch by updateProfile, and a caller that could set it directly
 * could also claim source 'user' for a machine-generated value — the one thing
 * the provenance column exists to make impossible.
 */
export type ProfileUpdate = Partial<
  Omit<UserProfile, 'user_id' | 'field_provenance' | 'created_at' | 'updated_at'>
>

/**
 * Who is asserting the values in a patch.
 *
 * A user edit cannot state a confidence — the person typed it, so it is 1.0 and
 * verified. A machine write must state one: 033:208-209 records confidence per
 * key, and the resume importer's own score is the only honest source for it.
 */
export type ProvenanceStamp =
  | { source?: 'user' }
  | { source: 'resume_import' | 'ats_capture'; confidence: number; verified?: boolean }

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as UserProfile | null
}

/**
 * The profile row, created on first read if it does not exist.
 *
 * LOAD-BEARING. 033's backfill is one-shot over the users that existed when it
 * was pasted, and it is deliberately NOT wired into public.handle_new_user()
 * (033:762-765): that trigger is SECURITY DEFINER and runs inside the signup
 * transaction (014:18-28), where a failure breaks account creation outright. So
 * every account created after 033 was applied has no profile row, and this
 * function is the "service layer's upsert on first profile read" that 033's
 * comment promises will make one.
 *
 * Read first, then upsert, rather than upserting unconditionally: PostgREST
 * resolves an upsert as ON CONFLICT DO UPDATE, which fires
 * trg_user_profiles_updated_at (033:428-432) and would rewrite updated_at on
 * every single profile read. The write path is still an upsert, not an insert,
 * because two tabs opening /profile at once both miss the select.
 */
export async function getOrCreateProfile(userId: string): Promise<UserProfile> {
  const existing = await getProfile(userId)
  if (existing !== null) return existing

  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...(await seedFromUserRow(userId)) }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) throw error
  return data as UserProfile
}

/**
 * The same seed 033's backfill writes (033:793-807), so an account created
 * after the migration does not start emptier than one created before it — the
 * M0 metric counts email and both name parts among the core keys.
 *
 * Writes NO field_provenance, exactly as the backfill does not: splitting a
 * display name on whitespace is lossy for multi-part surnames, and the absence
 * of provenance is what keeps the profile UI asking the user to confirm the
 * guess instead of asserting it on a legal form.
 */
async function seedFromUserRow(
  userId: string,
): Promise<Pick<UserProfile, 'contact_email' | 'legal_first_name' | 'legal_last_name'>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', userId)
    .maybeSingle()

  // A profile row with no seed is still a correct profile row, and the UI asks
  // for these values anyway. Failing the create because the seed read failed
  // would leave the user with no row at all — the state this function exists to
  // end.
  if (data === null) {
    return { contact_email: null, legal_first_name: null, legal_last_name: null }
  }

  const row = data as { email: string | null; name: string | null }
  // Whitespace is normalized first, as in the SQL: '  Ada  Lovelace  ' must
  // split to ('Ada', 'Lovelace'), not to (null, the whole padded string).
  const fullName = (row.name ?? '').replace(/\s+/g, ' ').trim()
  const [first = ''] = fullName.split(' ')

  return {
    contact_email: row.email,
    legal_first_name: first === '' ? null : first,
    legal_last_name: fullName.replace(/^\S+\s*/, '') || null,
  }
}

/**
 * Writes a patch and stamps provenance for every canonical key it touches.
 *
 * THE MERGE RULE (033:208-209): "The resume importer refuses to overwrite any
 * key whose source is 'user' — the user always wins." Enforced here, per
 * column, because the database has no constraint for it: field_provenance is
 * checked only for jsonb_typeof and for the absence of EEO keys (033:176-179,
 * 497-507). A dropped column is dropped from the write as well as from the
 * stamp, so the stored value and its recorded origin cannot disagree.
 */
export async function updateProfile(
  userId: string,
  patch: ProfileUpdate,
  stamp: ProvenanceStamp = {},
): Promise<UserProfile> {
  const current = await getOrCreateProfile(userId)
  const { accepted, provenance } = mergeProvenance(current.field_provenance, patch, stamp)

  // Every column was refused, so there is nothing to say. Writing an empty
  // patch would still fire the updated_at trigger and report a change that
  // never happened.
  if (Object.keys(accepted).length === 0) return current

  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ ...accepted, field_provenance: provenance })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as UserProfile
}

/**
 * TypeScript cannot type `to[k] = from[k]` when k is a union of keys — it wants
 * the intersection of the value types. A generic binding says what the union
 * index cannot: both sides are the same key.
 */
function copyColumn<K extends keyof ProfileUpdate>(
  from: ProfileUpdate,
  to: ProfileUpdate,
  column: K,
): void {
  to[column] = from[column]
}

function mergeProvenance(
  existing: FieldProvenance | null,
  patch: ProfileUpdate,
  stamp: ProvenanceStamp,
): { accepted: ProfileUpdate; provenance: FieldProvenance } {
  const source: ProvenanceSource = stamp.source ?? 'user'
  const confidence = 'confidence' in stamp ? stamp.confidence : 1
  const verified = 'verified' in stamp ? stamp.verified === true : source === 'user'
  const updatedAt = new Date().toISOString()

  const provenance: FieldProvenance = { ...(existing ?? {}) }
  const accepted: ProfileUpdate = {}

  for (const column of Object.keys(patch) as Array<keyof ProfileUpdate>) {
    const key = COLUMN_TO_KEY.get(column)

    // Columns no canonical key owns — autofill_enabled, legal_middle_name,
    // is_over_18 — are written without a stamp. There is no key to record them
    // under, and inventing one would put a string outside PROFILE_KEYS into a
    // JSONB column the engine reads back.
    if (key === undefined) {
      copyColumn(patch, accepted, column)
      continue
    }

    if (source !== 'user' && provenance[key]?.source === 'user') continue

    copyColumn(patch, accepted, column)
    provenance[key] = { source, confidence, updated_at: updatedAt, verified }
  }

  return { accepted, provenance }
}

/**
 * Routed through updateProfile so the choice is stamped source 'user' on
 * resume_file — which is what later stops a resume import from silently
 * repointing the default to a document it parsed.
 *
 * A document belonging to another user is rejected by the database, not here:
 * validate_user_profiles_write raises 42501 (033:473-479), because a plain FK
 * cannot check ownership — referential integrity bypasses RLS.
 */
export async function setDefaultResumeDocument(
  userId: string,
  documentId: string | null,
): Promise<UserProfile> {
  return updateProfile(userId, { default_resume_document_id: documentId })
}

export interface ProfileCompleteness {
  populated: ProfileKey[]
  missing: ProfileKey[]
  /** CORE_PROFILE_KEYS.length, so a caller never re-derives the denominator. */
  total: number
  /** 0–1. M0 ships at ≥ 0.7 for ≥ 50% of weekly-active users (section 13). */
  ratio: number
}

/**
 * The M0 ship metric, per user. Pure: it reads the row it is handed, so the
 * dashboard that aggregates it does one query rather than one per user.
 */
export function profileCompleteness(profile: UserProfile): ProfileCompleteness {
  const populated: ProfileKey[] = []
  const missing: ProfileKey[] = []

  for (const key of CORE_PROFILE_KEYS) {
    if (isKeyPopulated(profile, key)) populated.push(key)
    else missing.push(key)
  }

  return {
    populated,
    missing,
    total: CORE_PROFILE_KEYS.length,
    ratio: populated.length / CORE_PROFILE_KEYS.length,
  }
}
