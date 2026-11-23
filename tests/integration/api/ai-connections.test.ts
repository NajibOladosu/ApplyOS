import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createTestUser, deleteTestUser, type TestUser } from '@/tests/helpers/test-user'

let user: TestUser | undefined

afterEach(async () => {
  vi.doUnmock('next/headers')
  if (user) await deleteTestUser(user)
  user = undefined
})

describe('AI connection settings against Supabase', () => {
  it('loads defaults and saves an ApplyOS source for an authenticated user', async () => {
    user = await createTestUser()
    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    const cookieValue = JSON.stringify({
      access_token: user.accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: '',
      user: { id: user.id, email: user.email, app_metadata: {}, user_metadata: {}, aud: 'authenticated', role: 'authenticated' },
    })
    vi.doMock('next/headers', () => ({
      cookies: () => Promise.resolve({
        get: (name: string) => name === cookieName ? { value: cookieValue } : undefined,
        getAll: () => [{ name: cookieName, value: cookieValue }],
        set: () => {},
      }),
    }))
    vi.resetModules()

    const { GET } = await import('@/app/api/ai/connections/route')
    const { PATCH } = await import('@/app/api/ai/connections/select/route')
    const initial = await GET(new NextRequest('http://localhost/api/ai/connections'))
    expect(initial.status).toBe(200)
    expect(await initial.json()).toEqual({ textSource: 'applyos', audioSource: 'applyos', connections: [] })

    const selected = await PATCH(new NextRequest('http://localhost/api/ai/connections/select', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'text', source: 'applyos' }),
    }))
    expect(selected.status).toBe(200)
    expect((await selected.json()).textSource).toBe('applyos')
  }, 60_000)
})
