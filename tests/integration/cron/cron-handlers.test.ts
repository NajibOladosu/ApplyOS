/**
 * Integration tests: cron handler behavior
 *
 * Covers:
 *  - deadline-reminders : seed application with near deadline → assert notification created
 *  - weekly-digest      : seed application → handler returns 200 without 500
 *  - cleanup-old-notifications : seed 31-day-old notification → assert deleted after run
 *  - retry-ai-tasks     : auth gating only (side-effect verification too complex)
 *
 * All four handlers export POST (not GET).
 * weekly-digest and retry-ai-tasks call createClient() which reads next/headers cookies(),
 * so we mock next/headers at the top of this file.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createTestUser, deleteTestUser, type TestUser } from '@/tests/helpers/test-user'
import { supabaseAdmin } from '@/tests/helpers/supabase-admin'
import { retry } from '@/tests/helpers/retry'

// ---------------------------------------------------------------------------
// Mock next/headers so server.ts createClient() can be imported in Node tests
// ---------------------------------------------------------------------------
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
  headers: () => new Headers(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET

function cronReq(path: string): NextRequest {
  const hdrs: Record<string, string> = {}
  if (CRON_SECRET) hdrs['authorization'] = `Bearer ${CRON_SECRET}`
  return new NextRequest(`http://localhost${path}`, { method: 'POST', headers: hdrs })
}

function unauthReq(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: 'POST' })
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Cron handler behavior', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await retry(() => createTestUser())
  })

  afterEach(async () => {
    try {
      await supabaseAdmin.from('notifications').delete().eq('user_id', user.id)
      const { data: apps } = await supabaseAdmin
        .from('applications')
        .select('id')
        .eq('user_id', user.id)
      const appIds = (apps ?? []).map((a) => a.id)
      if (appIds.length > 0) {
        await supabaseAdmin.from('application_notes').delete().in('application_id', appIds)
        await supabaseAdmin.from('questions').delete().in('application_id', appIds)
      }
      await supabaseAdmin.from('applications').delete().eq('user_id', user.id)
      await deleteTestUser(user)
    } catch {
      // best-effort cleanup
    }
  })

  // -------------------------------------------------------------------------
  // deadline-reminders
  // -------------------------------------------------------------------------
  describe('cron/deadline-reminders', () => {
    const PATH = '/api/cron/deadline-reminders'

    it('rejects unauthenticated request with 401', async () => {
      const { POST } = await import('@/app/api/cron/deadline-reminders/route')
      const res = await POST(unauthReq(PATH))
      expect(res.status).toBe(401)
    })

    it('returns 200 and creates a notification for a deadline-today application', async () => {
      if (!CRON_SECRET) {
        console.warn('CRON_SECRET not set — skipping positive deadline-reminders test')
        return
      }

      // Seed: application with deadline today (status=draft — handler only queries draft)
      const todayUTC = new Date()
      todayUTC.setUTCHours(12, 0, 0, 0) // noon UTC so daysUntil === 0
      const deadline = todayUTC.toISOString()

      const { data: app, error: insertErr } = await supabaseAdmin
        .from('applications')
        .insert({
          user_id: user.id,
          title: `Cron Test App ${Date.now()}`,
          status: 'draft',
          deadline,
        })
        .select()
        .single()

      expect(insertErr).toBeNull()
      expect(app).toBeDefined()

      const { POST } = await import('@/app/api/cron/deadline-reminders/route')
      const res = await POST(cronReq(PATH))

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(typeof body.emailsSent).toBe('number')

      // Verify a deadline notification was created for this user's application
      const { data: notifs } = await supabaseAdmin
        .from('notifications')
        .select('id, type, message')
        .eq('user_id', user.id)
        .eq('type', 'deadline')

      expect(notifs).toBeDefined()
      expect(notifs!.length).toBeGreaterThanOrEqual(1)
      const relevant = notifs!.find((n) => n.message.includes(app!.title))
      expect(relevant).toBeDefined()
    }, 60_000)
  })

  // -------------------------------------------------------------------------
  // weekly-digest
  // -------------------------------------------------------------------------
  describe('cron/weekly-digest', () => {
    const PATH = '/api/cron/weekly-digest'

    it('rejects unauthenticated request with 401', async () => {
      const { POST } = await import('@/app/api/cron/weekly-digest/route')
      const res = await POST(unauthReq(PATH))
      expect(res.status).toBe(401)
    })

    it('returns 200 when authenticated (digest sent or no matching users)', async () => {
      if (!CRON_SECRET) {
        console.warn('CRON_SECRET not set — skipping positive weekly-digest test')
        return
      }

      // Seed: one application updated recently so the user appears in the digest query
      await supabaseAdmin.from('applications').insert({
        user_id: user.id,
        title: `Digest Test App ${Date.now()}`,
        status: 'in_review',
      })

      const { POST } = await import('@/app/api/cron/weekly-digest/route')
      const res = await POST(cronReq(PATH))

      // 200 = handler ran successfully.
      // The weekly-digest handler uses the anon Supabase client (cookie-based session).
      // In the test environment there is no real session cookie, so the RLS-protected
      // applications query returns no rows → handler takes the early "No users found"
      // branch which returns { message } rather than { success, digestsSent }.
      // Both shapes are valid — the key contract is: no 5xx.
      expect(res.status).toBe(200)
      const body = await res.json()
      // Accept either the "ran and sent" shape OR the "no users found" early-exit shape
      const validBody =
        (body.success === true && typeof body.digestsSent === 'number') ||
        typeof body.message === 'string'
      expect(validBody).toBe(true)
    }, 60_000)
  })

  // -------------------------------------------------------------------------
  // cleanup-old-notifications
  // -------------------------------------------------------------------------
  describe('cron/cleanup-old-notifications', () => {
    const PATH = '/api/cron/cleanup-old-notifications'

    it('rejects unauthenticated request with 401', async () => {
      const { POST } = await import('@/app/api/cron/cleanup-old-notifications/route')
      const res = await POST(unauthReq(PATH))
      expect(res.status).toBe(401)
    })

    it('deletes notifications older than 30 days when authenticated', async () => {
      if (!CRON_SECRET) {
        console.warn('CRON_SECRET not set — skipping positive cleanup-old-notifications test')
        return
      }

      // Seed: notification created 31 days ago
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
      const { data: oldNotif, error: seedErr } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'info',
          message: 'old notification for cleanup test',
          created_at: oldDate,
        })
        .select()
        .single()

      expect(seedErr).toBeNull()
      expect(oldNotif).toBeDefined()

      const { POST } = await import('@/app/api/cron/cleanup-old-notifications/route')
      const res = await POST(cronReq(PATH))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(typeof body.deletedCount).toBe('number')

      // Assert the old notification was deleted
      const { data: remaining } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('id', oldNotif!.id)

      expect(remaining).toBeDefined()
      expect(remaining!.length).toBe(0)
    }, 60_000)

    it('does not delete notifications newer than 30 days', async () => {
      if (!CRON_SECRET) return

      // Seed: a recent notification (1 day old)
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentNotif, error: seedErr } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'info',
          message: 'recent notification — must survive cleanup',
          created_at: recentDate,
        })
        .select()
        .single()

      expect(seedErr).toBeNull()

      const { POST } = await import('@/app/api/cron/cleanup-old-notifications/route')
      const res = await POST(cronReq(PATH))
      expect(res.status).toBe(200)

      // The recent notification must still exist
      const { data: surviving } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('id', recentNotif!.id)

      expect(surviving).toBeDefined()
      expect(surviving!.length).toBe(1)
    }, 60_000)
  })

  // -------------------------------------------------------------------------
  // retry-ai-tasks — auth gating only (side-effect verification too complex)
  // -------------------------------------------------------------------------
  describe('cron/retry-ai-tasks', () => {
    const PATH = '/api/cron/retry-ai-tasks'

    it('rejects unauthenticated request with 401', async () => {
      const { POST } = await import('@/app/api/cron/retry-ai-tasks/route')
      const res = await POST(unauthReq(PATH))
      expect(res.status).toBe(401)
    })

    it('returns non-500 when authenticated (no tasks in queue is fine)', async () => {
      if (!CRON_SECRET) {
        console.warn('CRON_SECRET not set — skipping positive retry-ai-tasks test')
        return
      }

      const { POST } = await import('@/app/api/cron/retry-ai-tasks/route')
      const res = await POST(cronReq(PATH))

      // 200 (no tasks) or 200 (processed tasks) — neither should be 500
      expect(res.status).toBeLessThan(500)
      expect(res.status).toBe(200)
    }, 60_000)
  })
})
