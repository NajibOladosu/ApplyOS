import { describe, expect, it, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  checkRateLimit,
  clearRateLimit,
  getRateLimitStatus,
  getRateLimitStoreSize,
  RATE_LIMITS,
} from '@/lib/middleware/rate-limit'

function makeReq(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://x${path}`, { headers })
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    clearRateLimit('ip:1.2.3.4')
    clearRateLimit('ip:5.6.7.8')
    clearRateLimit('ip:9.9.9.9')
    clearRateLimit('user:u1')
    clearRateLimit('user:u2')
  })

  it('allows first request', () => {
    const req = makeReq('/api/x', { 'x-forwarded-for': '1.2.3.4' })
    expect(checkRateLimit(req, RATE_LIMITS.general)).toBeNull()
  })

  it('blocks after exceeding limit', () => {
    const req = makeReq('/api/x', { 'x-forwarded-for': '1.2.3.4' })
    const cfg = { maxRequests: 2, windowMs: 60_000 }
    expect(checkRateLimit(req, cfg)).toBeNull()
    expect(checkRateLimit(req, cfg)).toBeNull()
    const blocked = checkRateLimit(req, cfg)
    expect(blocked?.status).toBe(429)
  })

  it('separates limits by pathname', () => {
    const a = makeReq('/api/a', { 'x-forwarded-for': '1.2.3.4' })
    const b = makeReq('/api/b', { 'x-forwarded-for': '1.2.3.4' })
    const cfg = { maxRequests: 1, windowMs: 60_000 }
    expect(checkRateLimit(a, cfg)).toBeNull()
    expect(checkRateLimit(b, cfg)).toBeNull()
    expect(checkRateLimit(a, cfg)?.status).toBe(429)
  })

  it('separates limits by user id', () => {
    const req = makeReq('/api/x', { 'x-forwarded-for': '1.2.3.4' })
    const cfg = { maxRequests: 1, windowMs: 60_000 }
    expect(checkRateLimit(req, cfg, 'u1')).toBeNull()
    expect(checkRateLimit(req, cfg, 'u2')).toBeNull()
    expect(checkRateLimit(req, cfg, 'u1')?.status).toBe(429)
  })

  it('falls back to ip header chain (x-real-ip)', () => {
    const req = makeReq('/api/x', { 'x-real-ip': '5.6.7.8' })
    const cfg = { maxRequests: 1, windowMs: 60_000 }
    expect(checkRateLimit(req, cfg)).toBeNull()
    expect(checkRateLimit(req, cfg)?.status).toBe(429)
  })

  it('includes correct headers in 429 response', () => {
    const req = makeReq('/api/headers', { 'x-forwarded-for': '1.2.3.4' })
    const cfg = { maxRequests: 1, windowMs: 60_000 }
    checkRateLimit(req, cfg)
    const blocked = checkRateLimit(req, cfg)
    expect(blocked?.headers.get('X-RateLimit-Limit')).toBe('1')
    expect(blocked?.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(blocked?.headers.get('Retry-After')).toMatch(/^\d+$/)
  })

  it('RATE_LIMITS constants have expected shape', () => {
    expect(RATE_LIMITS.general.maxRequests).toBe(100)
    expect(RATE_LIMITS.upload.maxRequests).toBe(10)
    expect(RATE_LIMITS.ai.maxRequests).toBe(20)
    expect(RATE_LIMITS.auth.maxRequests).toBe(5)
    expect(RATE_LIMITS.email.maxRequests).toBe(10)
  })
})

describe('clearRateLimit + getRateLimitStatus', () => {
  it('clearRateLimit removes entry for specific path', () => {
    const req = makeReq('/api/clear-a', { 'x-forwarded-for': '9.9.9.9' })
    checkRateLimit(req, { maxRequests: 1, windowMs: 60_000 })
    expect(getRateLimitStatus('ip:9.9.9.9', '/api/clear-a')).not.toBeNull()
    clearRateLimit('ip:9.9.9.9', '/api/clear-a')
    expect(getRateLimitStatus('ip:9.9.9.9', '/api/clear-a')).toBeNull()
  })

  it('getRateLimitStoreSize is non-negative', () => {
    expect(getRateLimitStoreSize()).toBeGreaterThanOrEqual(0)
  })
})
