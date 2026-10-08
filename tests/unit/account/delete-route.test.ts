import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const USER_ID = '3f2b9c1e-7a4d-4e8b-9c3a-1234567890ab'

const h = vi.hoisted(() => ({
  userDeletes: 0,
  storageListError: null as string | null,
  fetchCalls: 0,
}))

vi.mock('@/shared/db/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: '3f2b9c1e-7a4d-4e8b-9c3a-1234567890ab' } }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      delete: () => ({
        eq: async () => {
          h.userDeletes += 1
          return { error: null }
        },
      }),
    }),
  }),
}))

vi.mock('@/shared/db/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        list: async () =>
          h.storageListError
            ? { data: null, error: { message: h.storageListError } }
            : { data: [], error: null },
        remove: async () => ({ data: [], error: null }),
      }),
    },
  }),
}))

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimitMiddleware: async () => null,
  RATE_LIMITS: { auth: {} },
}))

import { POST } from '@/app/api/account/delete/route'

beforeEach(() => {
  h.userDeletes = 0
  h.storageListError = null
  h.fetchCalls = 0
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.test'
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      h.fetchCalls += 1
      return new Response(null, { status: 200 })
    }),
  )
})

describe('POST /api/account/delete ordering', () => {
  it('does not delete the profile row when storage cleanup fails', async () => {
    h.storageListError = 'storage unavailable'
    const res = await POST(new NextRequest('http://x/api/account/delete', { method: 'POST' }))
    expect(res.status).toBe(500)
    expect(h.userDeletes).toBe(0)
    expect(h.fetchCalls).toBe(0)
    expect(await res.json()).toEqual({
      error: 'Account deletion could not remove your stored files. Please try again.',
    })
  })

  it('removes files, then the profile row, then the auth user when storage succeeds', async () => {
    const res = await POST(new NextRequest('http://x/api/account/delete', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(h.userDeletes).toBe(1)
    expect(h.fetchCalls).toBe(1)
  })

  it('uses the authenticated user id for the auth deletion URL', async () => {
    await POST(new NextRequest('http://x/api/account/delete', { method: 'POST' }))
    const url = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as string
    expect(url).toBe(`https://supabase.example.test/auth/v1/admin/users/${USER_ID}`)
  })
})
