import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  process.env.UNSUBSCRIBE_SIGNING_SECRET = 'x'.repeat(40)
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.applyos.test'
  return {
  sendEmail: vi.fn(async (_message: { to: string }) => ({ id: 'email_1' })),
  user: { id: 'user_1', email: 'me@example.test', user_metadata: { name: 'Me' } } as
    | { id: string; email: string; user_metadata: Record<string, unknown> }
    | null,
  }
})

vi.mock('@/shared/infrastructure/email', () => ({
  sendEmail: (message: { to: string }) => h.sendEmail(message),
}))

vi.mock('@/shared/db/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
  }),
}))

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimitMiddleware: async () => null,
  RATE_LIMITS: { email: {} },
}))

import { POST as testPOST } from '@/app/api/email/test/route'
import { POST as welcomePOST } from '@/app/api/email/welcome/route'

function req(body: unknown) {
  return new NextRequest('http://x/api/email/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('email routes only send to the signed-in user (F-B)', () => {
  beforeEach(() => {
    h.sendEmail.mockClear()
    h.user = { id: 'user_1', email: 'me@example.test', user_metadata: { name: 'Me' } }
  })

  it('/api/email/test ignores a body address and sends to the user', async () => {
    const res = await testPOST(req({ email: 'victim@example.test' }))
    expect(res.status).toBe(200)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail.mock.calls[0][0].to).toBe('me@example.test')
  })

  it('/api/email/welcome ignores a body address and sends to the user', async () => {
    const res = await welcomePOST(req({ email: 'victim@example.test' }))
    expect(res.status).toBe(200)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail.mock.calls[0][0].to).toBe('me@example.test')
  })

  it('/api/email/welcome still works with no body', async () => {
    const res = await welcomePOST(new NextRequest('http://x/api/email/welcome', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(h.sendEmail.mock.calls[0][0].to).toBe('me@example.test')
  })

  it('rejects unauthenticated callers without sending', async () => {
    h.user = null
    const res = await testPOST(req({ email: 'victim@example.test' }))
    expect(res.status).toBe(401)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })
})
