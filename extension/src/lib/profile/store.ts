/**
 * Profile storage: a chrome.storage.local cache in front of
 * `users.autofill_profile` in Postgres.
 *
 * The web app is the source of truth (so the profile follows the user across
 * devices), but autofill must work with the popup open for two seconds on a
 * flaky connection — so the cache is always read first and the remote is
 * reconciled in the background.
 *
 * Conflict policy is intentionally simple and one-sided:
 *  - a successful push clears `dirty`;
 *  - a failed push sets `dirty`, and while it is set a pull never overwrites
 *    the cache — local edits win until they have been pushed.
 */

import { supabase } from '../api/supabase-client'
import {
    normalizeProfile,
    seedFromUser,
    type AutofillProfile,
    type ImportedProfile,
    mergeImportedProfile,
    learnScreeningAnswers,
} from '../../shared/profile'

const CACHE_KEY = 'autofillProfile'
const DIRTY_KEY = 'autofillProfileDirty'

/** Read the local cache instantly. Never hits the network. */
export async function loadCachedProfile(): Promise<AutofillProfile> {
    const stored = await chrome.storage.local.get([CACHE_KEY])
    return normalizeProfile(stored[CACHE_KEY])
}

/**
 * Pull the profile from the server. Adopts the remote copy unless there are
 * unsynced local edits (`dirty`), in which case the caller keeps the cache.
 */
export async function pullRemoteProfile(): Promise<{
    profile: AutofillProfile
    origin: 'remote' | 'cache'
}> {
    const cached = await loadCachedProfile()
    const flags = await chrome.storage.local.get([DIRTY_KEY])

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return { profile: cached, origin: 'cache' }

    const { data, error } = await supabase
        .from('users')
        .select('autofill_profile, email, name')
        .single()

    if (error || !data) return { profile: cached, origin: 'cache' }

    if (flags[DIRTY_KEY]) return { profile: cached, origin: 'cache' }

    const remote = seedFromUser(normalizeProfile(data.autofill_profile), {
        email: data.email,
        name: data.name,
    })

    await chrome.storage.local.set({ [CACHE_KEY]: remote })
    return { profile: remote, origin: 'remote' }
}

/**
 * Save the profile: cache locally, then push to the server. A failed push
 * (offline, expired token) still saves locally and marks the cache dirty so a
 * later pull cannot clobber it.
 */
export async function saveProfile(profile: AutofillProfile): Promise<{ synced: boolean }> {
    await chrome.storage.local.set({ [CACHE_KEY]: profile })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token || !session.user?.id) {
        await chrome.storage.local.set({ [DIRTY_KEY]: true })
        return { synced: false }
    }

    const { error } = await supabase
        .from('users')
        .update({ autofill_profile: profile })
        .eq('id', session.user.id)

    if (error) {
        await chrome.storage.local.set({ [DIRTY_KEY]: true })
        return { synced: false }
    }

    await chrome.storage.local.remove([DIRTY_KEY])
    return { synced: true }
}

/** Merge an imported resume profile and persist it (import fills blanks only). */
export async function importIntoProfile(
    imported: ImportedProfile
): Promise<{ profile: AutofillProfile; filled: string[]; kept: string[]; synced: boolean }> {
    const current = await loadCachedProfile()
    const { profile, filled, kept } = mergeImportedProfile(current, imported)
    const { synced } = await saveProfile(profile)
    return { profile, filled, kept, synced }
}

/** Persist answers learned from a fill session. */
export async function saveLearnedAnswers(
    learned: Array<{ question: string; answer: string }>
): Promise<{ profile: AutofillProfile; synced: boolean }> {
    const current = await loadCachedProfile()
    const profile = learnScreeningAnswers(current, learned)
    const { synced } = await saveProfile(profile)
    return { profile, synced }
}

/**
 * Push a dirty cache up if possible. Called when the popup or options page
 * opens — the moment a fresh session is most likely to be at hand.
 */
export async function flushDirtyCache(): Promise<boolean> {
    const flags = await chrome.storage.local.get([DIRTY_KEY])
    if (!flags[DIRTY_KEY]) return true

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token || !session.user?.id) return false

    const profile = await loadCachedProfile()
    const { error } = await supabase
        .from('users')
        .update({ autofill_profile: profile })
        .eq('id', session.user.id)
    if (error) return false

    await chrome.storage.local.remove([DIRTY_KEY])
    return true
}
