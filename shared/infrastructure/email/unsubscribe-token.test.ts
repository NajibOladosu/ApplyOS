import { describe, expect, it, beforeEach } from 'vitest'
import { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token'

const SECRET = 'a'.repeat(64)

beforeEach(() => {
  process.env.UNSUBSCRIBE_SIGNING_SECRET = SECRET
})

describe('signUnsubscribeToken', () => {
  it('produces deterministic token for same input', () => {
    const t1 = signUnsubscribeToken({ userId: 'u1', category: 'all' })
    const t2 = signUnsubscribeToken({ userId: 'u1', category: 'all' })
    expect(t1).toBe(t2)
  })

  it('produces different tokens for different categories', () => {
    const t1 = signUnsubscribeToken({ userId: 'u1', category: 'all' })
    const t2 = signUnsubscribeToken({ userId: 'u1', category: 'weekly_digest' })
    expect(t1).not.toBe(t2)
  })

  it('produces different tokens for different users', () => {
    const t1 = signUnsubscribeToken({ userId: 'u1', category: 'all' })
    const t2 = signUnsubscribeToken({ userId: 'u2', category: 'all' })
    expect(t1).not.toBe(t2)
  })
})

describe('verifyUnsubscribeToken', () => {
  it('returns payload for valid token', () => {
    const token = signUnsubscribeToken({ userId: 'u1', category: 'all' })
    expect(verifyUnsubscribeToken(token)).toEqual({ userId: 'u1', category: 'all' })
  })

  it('returns payload for valid token with different category', () => {
    const token = signUnsubscribeToken({ userId: 'u1', category: 'deadline_reminders' })
    expect(verifyUnsubscribeToken(token)).toEqual({ userId: 'u1', category: 'deadline_reminders' })
  })

  it('returns null for tampered signature', () => {
    const token = signUnsubscribeToken({ userId: 'u1', category: 'all' })
    const tampered = token.slice(0, -4) + 'XXXX'
    expect(verifyUnsubscribeToken(tampered)).toBeNull()
  })

  it('returns null for malformed token (no dot)', () => {
    expect(verifyUnsubscribeToken('garbage')).toBeNull()
  })

  it('returns null for empty token', () => {
    expect(verifyUnsubscribeToken('')).toBeNull()
  })

  it('returns null when signature wrong length', () => {
    expect(verifyUnsubscribeToken('a.b')).toBeNull()
  })

  it('returns null when category not in allowlist', () => {
    const bogusPayload = Buffer.from(JSON.stringify({ userId: 'u1', category: 'evil' })).toString('base64url')
    const fakeToken = `${bogusPayload}.deadbeef`
    expect(verifyUnsubscribeToken(fakeToken)).toBeNull()
  })

  it('returns null when payload missing userId', () => {
    const bogusPayload = Buffer.from(JSON.stringify({ category: 'all' })).toString('base64url')
    const fakeToken = `${bogusPayload}.deadbeef`
    expect(verifyUnsubscribeToken(fakeToken)).toBeNull()
  })

  it('returns null when secret is missing', () => {
    delete process.env.UNSUBSCRIBE_SIGNING_SECRET
    expect(verifyUnsubscribeToken('any.thing')).toBeNull()
  })
})
