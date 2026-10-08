import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  process.env.UNSUBSCRIBE_SIGNING_SECRET = 'x'.repeat(40)
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.applyos.test'
  return {
    sendEmail: vi.fn(async (_message: { to: string }) => ({ id: 'email_1' })),
    createAdminClientCalls: 0,
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

// The digest must use the service-role admin client (cron has no user session).
vi.mock('@/shared/db/supabase/admin', () => ({
  createAdminClient: () => {
    h.createAdminClientCalls += 1
    return client
  },
}))

const client = {
  from: (table: string) => ({
    select: () => {
      const result = table === 'applications' ? { data: h.applications, error: null } : { data: [], error: null }
      const c: Record<string, unknown> = {}
      for (const m of ['not', 'eq', 'order']) c[m] = () => c
      c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej)
      return c
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

import { POST } from '@/app/api/cron/weekly-digest/route'

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

async function runCron() {
  const res = await POST(new NextRequest('http://x/api/cron/weekly-digest', { method: 'POST' }))
  return { status: res.status, body: await res.json() }
}

describe('cron: weekly-digest honours email preferences', () => {
  beforeEach(() => {
    h.sendEmail.mockClear()
    h.createAdminClientCalls = 0
    h.applications = [
      {
        id: 'app_1',
        user_id: 'user_in',
        title: 'Grant A',
        status: 'draft',
        updated_at: daysFromNow(-1),
        deadline: daysFromNow(5),
      },
    ]
    h.users = {}
  })

  it('uses the service-role admin client rather than the cookie-bound client', async () => {
    h.users = { user_in: { email: 'in@example.test', user_metadata: {} } }
    await runCron()
    expect(h.createAdminClientCalls).toBeGreaterThan(0)
  })

  it('sends the digest to a user with no opt-out', async () => {
    h.users = { user_in: { email: 'in@example.test', user_metadata: {} } }
    const { status } = await runCron()
    expect(status).toBe(200)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail.mock.calls[0][0]).toMatchObject({ to: 'in@example.test' })
  })

  it('does not send the digest to a user who unsubscribed from weekly_digest', async () => {
    // The unsubscribe endpoint writes weekly_digest=false; before this fix the
    // digest cron ignored it.
    h.users = { user_in: { email: 'out@example.test', user_metadata: { weekly_digest: false } } }
    await runCron()
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('does not send the digest when the global email switch is off', async () => {
    h.users = { user_in: { email: 'off@example.test', user_metadata: { email_notifications: false } } }
    await runCron()
    expect(h.sendEmail).not.toHaveBeenCalled()
  })
})
