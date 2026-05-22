import { describe, expect, it } from 'vitest'
import { isAuthorizedCronRequest } from '@/lib/security/cron-auth'
import { NextRequest } from 'next/server'

describe('Cron — weekly-digest integration', () => {
  it('rejects when no auth header set', () => {
    expect(isAuthorizedCronRequest(new NextRequest('http://x/api/cron/weekly-digest'))).toBe(false)
  })

  it('rejects wrong x-vercel-cron-secret value', () => {
    const req = new NextRequest('http://x/api/cron/weekly-digest', {
      headers: { 'x-vercel-cron-secret': 'wrong' },
    })
    expect(isAuthorizedCronRequest(req)).toBe(false)
  })

  it('accepts x-vercel-cron-secret when configured', () => {
    const secret = process.env.CRON_SECRET
    if (!secret || secret.length < 16) {
      console.warn('CRON_SECRET not set or too short — skipping positive auth test')
      return
    }
    const req = new NextRequest('http://x/api/cron/weekly-digest', {
      headers: { 'x-vercel-cron-secret': secret },
    })
    expect(isAuthorizedCronRequest(req)).toBe(true)
  })
})
