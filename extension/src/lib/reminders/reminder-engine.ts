/**
 * Follow-up reminders.
 *
 * This module exists because the Chrome Web Store removed ApplyOS 1.0.0 for
 * declaring `notifications` while never calling it. Rather than delete the
 * permission and lose the feature, the feature is now real: ApplyOS watches
 * applications that are sitting with no response and nudges the user.
 *
 * The rule is deliberately conservative — one reminder per application per
 * threshold, ever. A job tool that spams notifications gets muted, and a muted
 * notification is indistinguishable from no notification.
 */

export interface ReminderCandidate {
    id: string
    title: string
    company: string | null
    status: string
    /** ISO date the application was created (i.e. when it was sent). */
    createdAt: string
    lastNotifiedAt?: string | null
}

export interface ReminderDecision {
    notificationId: string
    applicationId: string
    title: string
    message: string
    kind: 'follow_up' | 'stale'
    /** Days since the application was sent. */
    days: number
}

/** Days after sending at which a follow-up is worth sending. */
export const FOLLOW_UP_AFTER_DAYS = 7
/** Days after which silence is itself the signal, and the user should decide. */
export const STALE_AFTER_DAYS = 21

/** Statuses that are still "in flight" and therefore worth chasing. */
const IN_FLIGHT = new Set(['submitted', 'in_review'])

/**
 * Decide which reminders are due for a set of applications.
 *
 * Pure and synchronous so it can be unit-tested without a browser: the caller
 * supplies `now` and the list. The service worker is only responsible for
 * fetching candidates, persisting `lastNotifiedAt`, and calling
 * chrome.notifications.create with the results.
 */
export function dueReminders(
    candidates: ReminderCandidate[],
    now: Date,
    options: { followUpAfterDays?: number; staleAfterDays?: number; alreadySent?: Set<string> } = {}
): ReminderDecision[] {
    const followUpAfter = options.followUpAfterDays ?? FOLLOW_UP_AFTER_DAYS
    const staleAfter = options.staleAfterDays ?? STALE_AFTER_DAYS
    const alreadySent = options.alreadySent ?? new Set<string>()
    const decisions: ReminderDecision[] = []

    for (const candidate of candidates) {
        if (!IN_FLIGHT.has(candidate.status)) continue

        const sent = new Date(candidate.createdAt)
        if (Number.isNaN(sent.getTime())) continue

        const days = Math.floor((now.getTime() - sent.getTime()) / 86_400_000)
        if (days < followUpAfter) continue

        const kind: ReminderDecision['kind'] = days >= staleAfter ? 'stale' : 'follow_up'
        const notificationId = `applyos:${kind}:${candidate.id}`

        // Two guards against re-notifying. `lastNotifiedAt` survives restarts;
        // `alreadySent` covers the window where an alarm fires again while the
        // previous run is still awaiting storage.
        if (candidate.lastNotifiedAt) continue
        if (alreadySent.has(notificationId)) continue

        const company = candidate.company?.trim() || 'this company'
        const message =
            kind === 'stale'
                ? `It has been ${days} days since you applied to ${candidate.title} at ${company}. Time to move on, or chase one last time?`
                : `${days} days since you applied to ${candidate.title} at ${company}. A short follow-up is usually welcome around now.`

        decisions.push({
            notificationId,
            applicationId: candidate.id,
            title: kind === 'stale' ? `Still waiting on ${company}?` : `Follow up with ${company}`,
            message,
            kind,
            days,
        })
    }

    return decisions
}

/** Shape of the Supabase row, kept loose so the extension does not depend on the web types. */
export interface ApplicationRow {
    id: string
    title: string
    company: string | null
    status: string
    created_at: string
}

export function toCandidates(rows: ApplicationRow[]): ReminderCandidate[] {
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        company: row.company,
        status: row.status,
        createdAt: row.created_at,
    }))
}
