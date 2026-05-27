import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { isAuthorizedCronRequest } from '@/lib/security/cron-auth'
import { NextRequest } from 'next/server'

const SECRET = 'a'.repeat(32)

function makeReq(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://x/api/cron/x', { headers })
}

describe('isAuthorizedCronRequest', () => {
  const ORIGINAL = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET
  })
  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL
  })

  it('accepts correct Bearer token', () => {
    expect(isAuthorizedCronRequest(makeReq({ authorization: `Bearer ${SECRET}` }))).toBe(true)
  })
  it('accepts correct x-vercel-cron-secret header', () => {
    expect(isAuthorizedCronRequest(makeReq({ 'x-vercel-cron-secret': SECRET }))).toBe(true)
  })
  it('rejects missing auth headers', () => {
    expect(isAuthorizedCronRequest(makeReq({}))).toBe(false)
  })
  it('rejects wrong Bearer token', () => {
    expect(isAuthorizedCronRequest(makeReq({ authorization: 'Bearer wrong' }))).toBe(false)
  })
  it('rejects Bearer of correct length but wrong content', () => {
    expect(isAuthorizedCronRequest(makeReq({ authorization: `Bearer ${'b'.repeat(32)}` }))).toBe(false)
  })
  it('rejects when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCronRequest(makeReq({ authorization: `Bearer ${SECRET}` }))).toBe(false)
  })
  it('rejects when CRON_SECRET is too short (under 16 chars)', () => {
    process.env.CRON_SECRET = 'short'
    expect(isAuthorizedCronRequest(makeReq({ authorization: 'Bearer short' }))).toBe(false)
  })
  it('rejects Bearer prefix with empty token', () => {
    expect(isAuthorizedCronRequest(makeReq({ authorization: 'Bearer ' }))).toBe(false)
  })
  it('rejects wrong x-vercel-cron-secret value', () => {
    expect(isAuthorizedCronRequest(makeReq({ 'x-vercel-cron-secret': 'wrong' }))).toBe(false)
  })
})
