import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

const h = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.applyos.test'
  return {
    rows: [] as Array<Record<string, unknown>>,
    selected: [] as string[],
    updates: [] as Array<Record<string, unknown>>,
    sendEmail: vi.fn(async (_message: { to: string; html: string; text: string }) => ({ id: 'e1' })),
    renderedUrls: [] as string[],
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const chain = {
        select: (cols: string) => {
          h.selected.push(cols)
          return chain
        },
        eq: () => chain,
        limit: async () => ({ data: h.rows, error: null }),
        update: (payload: Record<string, unknown>) => {
          h.updates.push(payload)
          return { eq: async () => ({ error: null }) }
        },
      }
      return chain
    },
  }),
}))

vi.mock('@/shared/infrastructure/email', () => ({
  sendEmail: (message: { to: string; html: string; text: string }) => h.sendEmail(message),
}))

vi.mock('@react-email/render', () => ({
  render: async (element: { props: { verificationUrl: string } }) => {
    h.renderedUrls.push(element.props.verificationUrl)
    return '<html>mail</html>'
  },
}))

vi.mock('@/emails/verify-email', () => ({
  default: () => null,
}))

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimitMiddleware: async () => null,
  RATE_LIMITS: { auth: {} },
}))

import { POST } from '@/app/api/auth/resend-verification/route'

function req(email: string) {
  return new NextRequest('http://x/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    h.rows = []
    h.selected = []
    h.updates = []
    h.renderedUrls = []
    h.sendEmail.mockClear()
  })

  it('looks up the existing "name" column (the old "full_name" select always failed)', async () => {
    await POST(req('new@example.test'))
    expect(h.selected.length).toBeGreaterThan(0)
    expect(h.selected[0]).toContain('name')
    expect(h.selected[0]).not.toContain('full_name')
  })

  it('returns the generic response and sends nothing for an unknown address', async () => {
    const res = await POST(req('nobody@example.test'))
    expect(res.status).toBe(200)
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.updates).toHaveLength(0)
  })

  it('sends nothing to an already verified account', async () => {
    h.rows = [{ id: 'u1', name: 'Ann', email_verified: true, last_verification_email_sent: null }]
    await POST(req('ann@example.test'))
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.updates).toHaveLength(0)
  })

  it('throttles repeat requests within the minimum interval', async () => {
    h.rows = [
      {
        id: 'u1',
        name: 'Ann',
        email_verified: false,
        last_verification_email_sent: new Date(Date.now() - 10_000).toISOString(),
      },
    ]
    await POST(req('ann@example.test'))
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('stores only the SHA-256 of the token that is emailed', async () => {
    h.rows = [{ id: 'u1', name: 'Ann', email_verified: false, last_verification_email_sent: null }]
    const res = await POST(req('ann@example.test'))
    expect(res.status).toBe(200)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)

    const url = h.renderedUrls[0]
    const emailedToken = /token=([0-9a-f]{64})/.exec(url)?.[1]
    expect(emailedToken).toBeDefined()

    const stored = h.updates[0].verification_token as string
    expect(stored).toBe(crypto.createHash('sha256').update(emailedToken!, 'utf8').digest('hex'))
    expect(stored).not.toBe(emailedToken)
  })

  it('returns an identical body for unknown and eligible addresses (no enumeration)', async () => {
    const unknown = await (await POST(req('nobody@example.test'))).json()
    h.rows = [{ id: 'u1', name: 'Ann', email_verified: false, last_verification_email_sent: null }]
    const known = await (await POST(req('ann@example.test'))).json()
    expect(known).toEqual(unknown)
  })
})
