import { describe, expect, it } from 'vitest'

import {
    dueReminders,
    toCandidates,
    FOLLOW_UP_AFTER_DAYS,
    STALE_AFTER_DAYS,
    type ReminderCandidate,
} from '../reminder-engine'

const NOW = new Date('2026-09-25T12:00:00.000Z')

function daysAgo(days: number): string {
    return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
    return {
        id: 'app-1',
        title: 'Frontend Engineer',
        company: 'Acme',
        status: 'submitted',
        createdAt: daysAgo(10),
        ...overrides,
    }
}

describe('dueReminders', () => {
    it('does not remind about an application inside the follow-up window', () => {
        const decisions = dueReminders([candidate({ createdAt: daysAgo(3) })], NOW)

        expect(decisions).toHaveLength(0)
    })

    it('reminds once the follow-up threshold has passed', () => {
        const decisions = dueReminders([candidate({ createdAt: daysAgo(FOLLOW_UP_AFTER_DAYS) })], NOW)

        expect(decisions).toHaveLength(1)
        expect(decisions[0].kind).toBe('follow_up')
        expect(decisions[0].applicationId).toBe('app-1')
        expect(decisions[0].days).toBe(FOLLOW_UP_AFTER_DAYS)
    })

    it('escalates to a stale reminder after the longer threshold', () => {
        const decisions = dueReminders([candidate({ createdAt: daysAgo(STALE_AFTER_DAYS) })], NOW)

        expect(decisions).toHaveLength(1)
        expect(decisions[0].kind).toBe('stale')
    })

    it('ignores applications that are no longer in flight', () => {
        for (const status of ['draft', 'offer', 'rejected', 'interview']) {
            expect(dueReminders([candidate({ status })], NOW)).toHaveLength(0)
        }
    })

    it('includes both submitted and in_review', () => {
        const decisions = dueReminders(
            [candidate({ id: 'a', status: 'submitted' }), candidate({ id: 'b', status: 'in_review' })],
            NOW
        )

        expect(decisions.map((d) => d.applicationId).sort()).toEqual(['a', 'b'])
    })

    it('never reminds twice for the same application', () => {
        const already = candidate({ lastNotifiedAt: daysAgo(2) })

        expect(dueReminders([already], NOW)).toHaveLength(0)
    })

    it('honours the in-session suppression set', () => {
        // Covers an alarm firing again while the previous run is still awaiting
        // storage, where `lastNotifiedAt` has not been persisted yet.
        const decisions = dueReminders([candidate()], NOW, {
            alreadySent: new Set(['applyos:follow_up:app-1']),
        })

        expect(decisions).toHaveLength(0)
    })

    it('gives the same application different ids per kind, so an escalation is not suppressed', () => {
        const followUp = dueReminders([candidate({ createdAt: daysAgo(7) })], NOW)[0]
        const stale = dueReminders([candidate({ createdAt: daysAgo(30) })], NOW)[0]

        expect(followUp.notificationId).not.toBe(stale.notificationId)
    })

    it('respects a custom follow-up window', () => {
        const decision = dueReminders([candidate({ createdAt: daysAgo(4) })], NOW, {
            followUpAfterDays: 3,
        })

        expect(decision).toHaveLength(1)
    })

    it('skips rows with an unparseable date rather than throwing', () => {
        const decisions = dueReminders([candidate({ createdAt: 'not-a-date' })], NOW)

        expect(decisions).toHaveLength(0)
    })

    it('falls back to a readable company when the field is empty', () => {
        const decisions = dueReminders([candidate({ company: null })], NOW)

        expect(decisions[0].message).toContain('this company')
    })

    it('names the company and role in the message', () => {
        const decisions = dueReminders([candidate()], NOW)

        expect(decisions[0].message).toContain('Frontend Engineer')
        expect(decisions[0].message).toContain('Acme')
        expect(decisions[0].title).toContain('Acme')
    })

    it('sorts nothing out of order — one decision per overdue application', () => {
        const decisions = dueReminders(
            [
                candidate({ id: 'a', createdAt: daysAgo(7) }),
                candidate({ id: 'b', createdAt: daysAgo(30) }),
                candidate({ id: 'c', createdAt: daysAgo(1) }),
            ],
            NOW
        )

        expect(decisions).toHaveLength(2)
        expect(decisions.map((d) => d.kind)).toEqual(['follow_up', 'stale'])
    })
})

describe('toCandidates', () => {
    it('maps Supabase rows onto the candidate shape', () => {
        const rows = toCandidates([
            {
                id: 'x',
                title: 'Designer',
                company: 'Globex',
                status: 'submitted',
                created_at: daysAgo(9),
            },
        ])

        expect(rows).toEqual([
            {
                id: 'x',
                title: 'Designer',
                company: 'Globex',
                status: 'submitted',
                createdAt: daysAgo(9),
            },
        ])
    })
})
