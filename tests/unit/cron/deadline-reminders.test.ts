import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  process.env.UNSUBSCRIBE_SIGNING_SECRET = 'x'.repeat(40)
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.applyos.test'
  return {
    sendEmail: vi.fn(async (_message: { to: string }) => ({ id: 'email_1' })),
    inserted: [] as Array<{ table: string; row: Record<string, unknown> }>,
    applications: [] as Array<Record<string, unknown>>,
    users: {} as Record<string, { email: string; user_metadata: Record<string, unknown> }>,
  }
})

vi.mock('@/shared/infrastructure/email', () => ({
  sendEmail: (...args: unknown[]) => (h.sendEmail as (...a: unknown[]) => Promise<unknown>)(...args),
}))

vi.mock('@/lib/security/cron-auth', () => ({
  isAuthorizedCronRequest: () => true,
}))

vi.mock('@supabase/supabase-js', () => {
  // Thenable query builder: every filter returns the same builder and awaiting
  // it yields the configured result.
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'not', 'eq', 'contains', 'gte', 'is', 'limit']) {
      c[m] = () => c
    }
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej)
    return c
  }
  const client = {
    from: (table: string) => ({
      select: () =>
        chain(table === 'applications' ? { data: h.applications, error: null } : { data: [], error: null }),
      insert: async (row: Record<string, unknown>) => {
        h.inserted.push({ table, row })
        return { error: null }
      },
    }),
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: h.users[id] ? { id, ...h.users[id] } : null },
          error: null,
        }),
      },
    },
  }
  return { createClient: () => client }
})

import { POST } from '@/app/api/cron/deadline-reminders/route'

function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

async function runCron() {
  const res = await POST(new NextRequest('http://x/api/cron/deadline-reminders', { method: 'POST' }))
  return { status: res.status, body: await res.json() }
}

describe('cron: deadline-reminders honours email preferences', () => {
  beforeEach(() => {
    h.sendEmail.mockClear()
    h.inserted.length = 0
    h.applications = [
      { id: 'app_1', user_id: 'user_in', title: 'Grant A', deadline: inDays(3), status: 'draft' },
    ]
    h.users = {}
  })

  it('sends the reminder email to a user with no opt-out', async () => {
    h.users = { user_in: { email: 'in@example.test', user_metadata: {} } }
    const { status } = await runCron()
    expect(status).toBe(200)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail.mock.calls[0][0]).toMatchObject({ to: 'in@example.test' })
    // The in-app notification is still created for the user.
    expect(h.inserted.some((i) => i.table === 'notifications')).toBe(true)
  })

  it('does not email a user who opted out of deadline reminders, but keeps the in-app notice', async () => {
    h.users = {
      user_in: { email: 'out@example.test', user_metadata: { deadline_reminders: false } },
    }
    const { status } = await runCron()
    expect(status).toBe(200)
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.inserted.some((i) => i.table === 'notifications')).toBe(true)
  })

  it('does not email a user with the global email switch turned off', async () => {
    h.users = {
      user_in: { email: 'off@example.test', user_metadata: { email_notifications: false } },
    }
    await runCron()
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('does not email when the stored opt-out is the string "false"', async () => {
    h.users = {
      user_in: { email: 'str@example.test', user_metadata: { deadline_reminders: 'false' } },
    }
    await runCron()
    expect(h.sendEmail).not.toHaveBeenCalled()
  })
})
