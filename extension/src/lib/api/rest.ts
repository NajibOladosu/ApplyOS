/**
 * Minimal Supabase REST access for the service worker.
 *
 * The background worker only ever needs one read: the applications that might
 * deserve a follow-up reminder. Importing @supabase/supabase-js to do that
 * pulled 900KB into the worker bundle, which Chrome loads on every browser
 * start — for a query that is a single GET.
 *
 * So this module talks to PostgREST directly with fetch. Auth still goes
 * through Supabase; it just reads the token the popup's client already
 * persisted, rather than spinning up a second client in the worker.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export interface InFlightApplication {
    id: string
    title: string
    company: string | null
    status: string
    created_at: string
}

interface SupabaseSession {
    access_token?: string
    expires_at?: number
}

/**
 * Supabase namespaces its persisted session by project ref, e.g.
 * `sb-abcdefghij-auth-token`. Deriving the ref from the URL keeps this working
 * without hardcoding a project id that differs between environments.
 */
function sessionStorageKey(): string | null {
    if (!SUPABASE_URL) return null
    try {
        const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
        return `sb-${ref}-auth-token`
    } catch {
        return null
    }
}

/** Read the stored session, tolerating both the object and plain-string shapes. */
export async function getStoredSession(): Promise<SupabaseSession | null> {
    const key = sessionStorageKey()
    if (!key) return null

    const stored = await chrome.storage.local.get([key])
    const raw = stored[key]
    if (!raw) return null

    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        return parsed?.access_token ? parsed : (parsed?.currentSession ?? null)
    } catch {
        return null
    }
}

export function isConfigured(): boolean {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

/**
 * Applications still in flight and old enough to be worth chasing.
 *
 * Returns `null` when the request could not be made or the token was rejected,
 * which the caller treats as "skip this sweep" rather than an error the user
 * needs to see. A stale token is expected — the popup refreshes it whenever it
 * opens, and a missed sweep costs nothing.
 */
export async function fetchInFlightApplications(
    followUpAfterDays: number
): Promise<InFlightApplication[] | null> {
    if (!isConfigured()) return null

    const session = await getStoredSession()
    if (!session?.access_token) return null

    // Expired tokens are not worth a round trip; the popup will refresh one on
    // next open and the following sweep picks the work up.
    if (session.expires_at && session.expires_at * 1000 < Date.now()) return null

    const cutoff = new Date(Date.now() - followUpAfterDays * 86_400_000).toISOString()
    const params = new URLSearchParams({
        select: 'id,title,company,status,created_at',
        status: 'in.(submitted,in_review)',
        created_at: `lte.${cutoff}`,
        order: 'created_at.asc',
        limit: '50',
    })

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/applications?${params}`, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${session.access_token}`,
                Accept: 'application/json',
            },
        })

        if (!response.ok) {
            // 401 means the token aged out; anything else is a real failure but
            // still not something to surface as a notification.
            return null
        }

        const rows = (await response.json()) as InFlightApplication[]
        return Array.isArray(rows) ? rows : null
    } catch {
        // Offline, blocked, or malformed — skip quietly.
        return null
    }
}

/** Count of in-flight applications, for the toolbar badge. */
export async function countInFlightApplications(): Promise<number | null> {
    if (!isConfigured()) return null

    const session = await getStoredSession()
    if (!session?.access_token) return null
    if (session.expires_at && session.expires_at * 1000 < Date.now()) return null

    const params = new URLSearchParams({
        select: 'id',
        status: 'in.(submitted,in_review)',
        limit: '1',
    })

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/applications?${params}`, {
            method: 'HEAD',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${session.access_token}`,
                Prefer: 'count=exact',
            },
        })
        if (!response.ok) return null

        const range = response.headers.get('content-range')
        if (!range) return null
        const total = Number(range.split('/')[1])
        return Number.isFinite(total) ? total : null
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Application capture (context menu / keyboard shortcut)
// ---------------------------------------------------------------------------

export interface CapturedApplication {
    title: string
    company: string | null
    url: string | null
    job_description: string | null
}

function authHeaders(session: SupabaseSession): Record<string, string> {
    return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    }
}

async function sessionOrNull(): Promise<SupabaseSession | null> {
    const session = await getStoredSession()
    if (!session?.access_token) return null
    if (session.expires_at && session.expires_at * 1000 < Date.now()) return null
    return session
}

/** Find the user's application for a posting URL, for capture de-duplication. */
export async function findApplicationByUrl(url: string): Promise<string | null> {
    if (!isConfigured()) return null
    const session = await sessionOrNull()
    if (!session) return null

    const normalised = normaliseJobUrl(url)
    if (!normalised) return null

    const params = new URLSearchParams({
        select: 'id,url',
        url: `ilike.*${normalised}*`,
        limit: '5',
    })

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/applications?${params}`, {
            headers: authHeaders(session),
        })
        if (!response.ok) return null

        const rows = (await response.json()) as Array<{ id: string; url: string | null }>
        const exact = rows.find((row) => normaliseJobUrl(row.url ?? '') === normalised)
        return exact?.id ?? null
    } catch {
        return null
    }
}

/**
 * Save a job captured from a page. Updates the existing row when the posting
 * was already saved (matching the popup's behaviour), otherwise inserts.
 * Returns the application id, or null when the request could not be made.
 */
export async function upsertApplication(
    data: CapturedApplication
): Promise<{ id: string; created: boolean } | null> {
    if (!isConfigured()) return null
    const session = await sessionOrNull()
    if (!session) return null

    const existingId = await findApplicationByUrl(data.url ?? '')
    if (existingId) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/applications?id=eq.${existingId}`, {
                method: 'PATCH',
                headers: { ...authHeaders(session), Prefer: 'return=minimal' },
                body: JSON.stringify({
                    title: data.title,
                    company: data.company,
                    job_description: data.job_description,
                }),
            })
            if (response.ok) return { id: existingId, created: false }
        } catch {
            // fall through to insert path only if the id is bogus; safest is to bail
            return null
        }
        return null
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
            method: 'POST',
            headers: { ...authHeaders(session), Prefer: 'return=representation' },
            body: JSON.stringify({
                title: data.title,
                company: data.company,
                url: data.url,
                job_description: data.job_description,
                status: 'draft',
                priority: 'medium',
            }),
        })
        if (!response.ok) return null
        const rows = (await response.json()) as Array<{ id: string }>
        return rows[0]?.id ? { id: rows[0].id, created: true } : null
    } catch {
        return null
    }
}

/** Strip tracking parameters so the same posting matches itself. */
function normaliseJobUrl(url: string): string | null {
    try {
        const parsed = new URL(url)
        parsed.hash = ''
        // Keep only parameters that commonly identify a posting.
        const keep = new URLSearchParams()
        for (const key of ['currentJobId', 'jk', 'ghjk', 'id', 'jobId']) {
            const value = parsed.searchParams.get(key)
            if (value) keep.set(key, value)
        }
        parsed.search = keep.toString()
        return parsed.toString()
    } catch {
        return null
    }
}
