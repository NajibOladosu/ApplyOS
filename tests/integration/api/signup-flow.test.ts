/**
 * End-to-end signup flow integration test.
 *
 * Exercises the real route handlers + real Supabase (no real Resend call)
 * across every stage of account creation:
 *
 *   1. POST /api/auth/signup
 *      - validates input
 *      - creates auth.users
 *      - creates public.users with email_verified=false + verification_token
 *      - triggers verification email through `sendEmail`
 *
 *   2. GET /api/auth/verify-email?token=...
 *      - validates token + expiry
 *      - flips public.users.email_verified to true
 *      - clears verification_token + token_expires_at
 *      - confirms email at the Supabase Auth layer
 *      - redirects to /auth/verified
 *
 *   3. POST /api/auth/resend-verification
 *      - regenerates token + dispatches a fresh email
 *
 *   4. Duplicate / failure modes
 *      - duplicate (already-verified) email returns 400
 *      - duplicate (unverified) email re-issues token + email
 *      - missing fields returns 400
 *      - if email send fails, the newly-created auth user is rolled back
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/tests/helpers/supabase-admin'
import { TEST_PASSWORD } from '@/tests/helpers/test-user'

// ---------------------------------------------------------------------------
// Mock next/headers — route handlers reach for cookies and would otherwise
// throw "cookies was called outside a request scope" under vitest.
// ---------------------------------------------------------------------------
vi.mock('next/headers', () => {
  const noop = () => {}
  const cookieStore = {
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: noop,
    delete: noop,
  }
  return {
    cookies: () => Promise.resolve(cookieStore),
    headers: () => Promise.resolve(new Headers()),
  }
})

// ---------------------------------------------------------------------------
// Mock the email module so tests never hit Resend.
// ---------------------------------------------------------------------------
vi.mock('@/shared/infrastructure/email', () => ({
  sendEmail: vi.fn(async () => ({ id: `mock-${Math.random().toString(36).slice(2)}` })),
}))

// Import handlers AFTER the mocks so they pick up the mocked module.
import { POST as signupRoute } from '@/app/api/auth/signup/route'
import { GET as verifyEmailRoute } from '@/app/api/auth/verify-email/route'
import { POST as resendVerificationRoute } from '@/app/api/auth/resend-verification/route'
import { sendEmail } from '@/shared/infrastructure/email'

const mockedSendEmail = vi.mocked(sendEmail)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STRONG_PASSWORD = TEST_PASSWORD
const createdUserIds = new Set<string>()

function uniqueEmail(): string {
  // Unique per test, unique IP via the local part so rate-limit buckets don't collide.
  return `test+${randomUUID()}@applyos-test.local`
}

function uniqueIp(): string {
  // 10.x.x.x is safe non-routable space; randomise to dodge rate-limit collisions.
  const r = () => Math.floor(Math.random() * 254) + 1
  return `10.${r()}.${r()}.${r()}`
}

function makeReq(
  path: string,
  method: 'GET' | 'POST' = 'POST',
  body?: unknown,
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      // Each test gets its own simulated client IP so the in-memory
      // rate-limit middleware never trips during the suite.
      'x-forwarded-for': uniqueIp(),
    },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(
    `http://localhost${path}`,
    init as ConstructorParameters<typeof NextRequest>[1],
  )
}

async function deleteUserByEmail(email: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (data?.id) {
    createdUserIds.add(data.id)
  } else {
    // user may exist in auth.users but not public.users
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const u = list.users.find((x) => x.email === email)
    if (u) createdUserIds.add(u.id)
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: clean up real auth + public.users rows created by each test.
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockedSendEmail.mockClear()
})

afterEach(async () => {
  for (const id of createdUserIds) {
    try {
      await supabaseAdmin.from('users').delete().eq('id', id)
      await supabaseAdmin.auth.admin.deleteUser(id)
    } catch {
      /* best-effort */
    }
  }
  createdUserIds.clear()
})

// ===========================================================================
// 1. POST /api/auth/signup  — happy path
// ===========================================================================
describe('POST /api/auth/signup — happy path', () => {
  it(
    'creates auth user, creates public.users row with verification token, and dispatches one verification email',
    async () => {
      const email = uniqueEmail()
      const name = 'Test Signup User'

      const res = await signupRoute(
        makeReq('/api/auth/signup', 'POST', { email, password: STRONG_PASSWORD, name }),
      )

      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.user?.email).toBe(email)
      expect(json.user?.id).toBeTruthy()
      createdUserIds.add(json.user.id)

      // ---- Supabase Auth layer ----
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const authUser = authList.users.find((u) => u.email === email)
      expect(authUser).toBeTruthy()
      expect(authUser?.email_confirmed_at).toBeFalsy() // still unverified at auth level

      // ---- Application users table ----
      const { data: appUser, error: appUserErr } = await supabaseAdmin
        .from('users')
        .select('id, email, email_verified, verification_token, verification_token_expires_at')
        .eq('email', email)
        .single()
      expect(appUserErr).toBeNull()
      expect(appUser?.id).toBe(json.user.id)
      expect(appUser?.email_verified).toBe(false)
      expect(appUser?.verification_token).toBeTruthy()
      expect(appUser?.verification_token).toHaveLength(64) // 32 random bytes → 64 hex chars
      const exp = new Date(appUser!.verification_token_expires_at!).getTime()
      expect(exp).toBeGreaterThan(Date.now())
      expect(exp - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 60_000)

      // ---- Email dispatch ----
      expect(mockedSendEmail).toHaveBeenCalledTimes(1)
      const args = mockedSendEmail.mock.calls[0][0]
      expect(args.to).toBe(email)
      expect(args.from).toBe('noreply')
      expect(args.subject).toMatch(/verify/i)
      expect(args.html).toContain(appUser!.verification_token!)
      expect(args.text).toBeTruthy()
    },
    60_000,
  )
})

// ===========================================================================
// 2. GET /api/auth/verify-email — happy path
// ===========================================================================
describe('GET /api/auth/verify-email — happy path', () => {
  it(
    'verifies the token, flips email_verified, clears the token, and confirms the auth user',
    async () => {
      const email = uniqueEmail()

      // 1. Run signup first to obtain a real token.
      const signupRes = await signupRoute(
        makeReq('/api/auth/signup', 'POST', {
          email,
          password: STRONG_PASSWORD,
          name: 'Verify Flow User',
        }),
      )
      expect(signupRes.status).toBe(201)
      const signupJson = await signupRes.json()
      createdUserIds.add(signupJson.user.id)

      const { data: pending } = await supabaseAdmin
        .from('users')
        .select('verification_token')
        .eq('email', email)
        .single()
      const token = pending?.verification_token as string
      expect(token).toBeTruthy()

      // 2. Hit verify-email with the token.
      const verifyRes = await verifyEmailRoute(
        makeReq(`/api/auth/verify-email?token=${token}`, 'GET'),
      )
      expect(verifyRes.status).toBe(307) // NextResponse.redirect default
      expect(verifyRes.headers.get('location')).toContain('/auth/verified')

      // 3. App-level flag flipped.
      const { data: after } = await supabaseAdmin
        .from('users')
        .select('email_verified, verification_token, verification_token_expires_at')
        .eq('email', email)
        .single()
      expect(after?.email_verified).toBe(true)
      expect(after?.verification_token).toBeNull()
      expect(after?.verification_token_expires_at).toBeNull()

      // 4. Auth-level confirmation set.
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const authUser = authList.users.find((u) => u.email === email)
      expect(authUser?.email_confirmed_at).toBeTruthy()
    },
    60_000,
  )

  it('rejects an unknown token with 400', async () => {
    const res = await verifyEmailRoute(
      makeReq(`/api/auth/verify-email?token=${'a'.repeat(64)}`, 'GET'),
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/invalid|expired/i)
  }, 30_000)

  it('rejects when no token is supplied', async () => {
    const res = await verifyEmailRoute(makeReq('/api/auth/verify-email', 'GET'))
    expect(res.status).toBe(400)
  }, 15_000)

  it(
    'rejects an expired token with 400 and does not flip email_verified',
    async () => {
      const email = uniqueEmail()
      // Create a user manually with an expired token.
      const { data: created } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: STRONG_PASSWORD,
        email_confirm: false,
        user_metadata: { name: 'Expired Token User' },
      })
      const userId = created!.user!.id
      createdUserIds.add(userId)

      const expiredToken = randomUUID().replace(/-/g, '').repeat(2).slice(0, 64)
      await supabaseAdmin.from('users').upsert({
        id: userId,
        email,
        email_verified: false,
        verification_token: expiredToken,
        verification_token_expires_at: new Date(Date.now() - 60_000).toISOString(),
      })

      const res = await verifyEmailRoute(
        makeReq(`/api/auth/verify-email?token=${expiredToken}`, 'GET'),
      )
      expect(res.status).toBe(400)

      const { data: after } = await supabaseAdmin
        .from('users')
        .select('email_verified')
        .eq('email', email)
        .single()
      expect(after?.email_verified).toBe(false)
    },
    45_000,
  )
})

// ===========================================================================
// 3. POST /api/auth/resend-verification
// ===========================================================================
describe('POST /api/auth/resend-verification', () => {
  it(
    'issues a fresh token and sends a new verification email for an existing unverified user',
    async () => {
      const email = uniqueEmail()

      // Initial signup
      const signupRes = await signupRoute(
        makeReq('/api/auth/signup', 'POST', {
          email,
          password: STRONG_PASSWORD,
          name: 'Resend Flow User',
        }),
      )
      expect(signupRes.status).toBe(201)
      const signupJson = await signupRes.json()
      createdUserIds.add(signupJson.user.id)

      const { data: first } = await supabaseAdmin
        .from('users')
        .select('verification_token')
        .eq('email', email)
        .single()
      const firstToken = first?.verification_token as string

      mockedSendEmail.mockClear()

      // Resend
      const resendRes = await resendVerificationRoute(
        makeReq('/api/auth/resend-verification', 'POST', { email }),
      )
      expect(resendRes.status).toBe(200)
      const resendJson = await resendRes.json()
      expect(resendJson.success).toBe(true)

      // Token rotated
      const { data: second } = await supabaseAdmin
        .from('users')
        .select('verification_token')
        .eq('email', email)
        .single()
      expect(second?.verification_token).toBeTruthy()
      expect(second?.verification_token).not.toBe(firstToken)

      // Exactly one new email dispatched
      expect(mockedSendEmail).toHaveBeenCalledTimes(1)
      expect(mockedSendEmail.mock.calls[0][0].to).toBe(email)
      expect(mockedSendEmail.mock.calls[0][0].from).toBe('noreply')
    },
    60_000,
  )

  it('returns a generic success even when the email does not exist (no enumeration)', async () => {
    const res = await resendVerificationRoute(
      makeReq('/api/auth/resend-verification', 'POST', {
        email: `nobody+${randomUUID()}@applyos-test.local`,
      }),
    )
    expect(res.status).toBe(200)
    expect(mockedSendEmail).not.toHaveBeenCalled()
  }, 30_000)

  it('rejects missing email with 400', async () => {
    const res = await resendVerificationRoute(
      makeReq('/api/auth/resend-verification', 'POST', {}),
    )
    expect(res.status).toBe(400)
  }, 15_000)
})

// ===========================================================================
// 4. POST /api/auth/signup — duplicate handling
// ===========================================================================
describe('POST /api/auth/signup — duplicate handling', () => {
  it(
    'rejects re-signup for an already verified email with 400',
    async () => {
      const email = uniqueEmail()
      const { data: created } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: STRONG_PASSWORD,
        email_confirm: true,
        user_metadata: { name: 'Already Verified' },
      })
      createdUserIds.add(created!.user!.id)
      await supabaseAdmin.from('users').upsert({
        id: created!.user!.id,
        email,
        email_verified: true,
      })

      const res = await signupRoute(
        makeReq('/api/auth/signup', 'POST', {
          email,
          password: STRONG_PASSWORD,
          name: 'Already Verified',
        }),
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toMatch(/already/i)
      expect(mockedSendEmail).not.toHaveBeenCalled()
    },
    45_000,
  )

  it(
    'allows re-signup for an existing unverified email and re-sends the verification email',
    async () => {
      const email = uniqueEmail()
      // First signup
      const first = await signupRoute(
        makeReq('/api/auth/signup', 'POST', {
          email,
          password: STRONG_PASSWORD,
          name: 'Dup Unverified',
        }),
      )
      expect(first.status).toBe(201)
      const firstJson = await first.json()
      createdUserIds.add(firstJson.user.id)

      mockedSendEmail.mockClear()

      // Second signup with same email (still unverified)
      const second = await signupRoute(
        makeReq('/api/auth/signup', 'POST', {
          email,
          password: STRONG_PASSWORD,
          name: 'Dup Unverified',
        }),
      )
      expect(second.status).toBe(201)
      expect(mockedSendEmail).toHaveBeenCalledTimes(1)
      expect(mockedSendEmail.mock.calls[0][0].to).toBe(email)
    },
    60_000,
  )
})

// ===========================================================================
// 5. POST /api/auth/signup — input validation
// ===========================================================================
describe('POST /api/auth/signup — input validation', () => {
  it('rejects missing email/password/name with 400', async () => {
    const res = await signupRoute(makeReq('/api/auth/signup', 'POST', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/missing required fields/i)
    expect(mockedSendEmail).not.toHaveBeenCalled()
  }, 15_000)

  it('rejects a malformed email payload with 400', async () => {
    const res = await signupRoute(
      makeReq('/api/auth/signup', 'POST', {
        email: 'not-an-email',
        password: STRONG_PASSWORD,
        name: 'Bad Email',
      }),
    )
    // Supabase auth will reject the malformed email at creation time.
    expect(res.status).toBe(400)
    expect(mockedSendEmail).not.toHaveBeenCalled()
  }, 30_000)
})

// ===========================================================================
// 6. POST /api/auth/signup — email send failure rolls back the new auth user
// ===========================================================================
describe('POST /api/auth/signup — email send failure cleanup', () => {
  it(
    'returns 500 and deletes the freshly-created auth user when sendEmail throws',
    async () => {
      const email = uniqueEmail()
      mockedSendEmail.mockRejectedValueOnce(new Error('simulated Resend outage'))

      const res = await signupRoute(
        makeReq('/api/auth/signup', 'POST', {
          email,
          password: STRONG_PASSWORD,
          name: 'Send Fail Rollback',
        }),
      )
      expect(res.status).toBe(500)

      // Auth user should have been rolled back; no zombie account left behind.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const orphan = list.users.find((u) => u.email === email)
      expect(orphan, 'auth user must be deleted after a send failure').toBeUndefined()

      // public.users either gone (FK cascade) or absent.
      await deleteUserByEmail(email)
    },
    60_000,
  )
})
