import { describe, expect, it } from 'vitest'
import { isAuthorizedCronRequest } from '@/lib/security/cron-auth'
import { NextRequest } from 'next/server'

describe('Cron — deadline-reminders integration', () => {
  it('rejects unauthenticated request', () => {
    const req = new NextRequest('http://x/api/cron/deadline-reminders')
    expect(isAuthorizedCronRequest(req)).toBe(false)
  })

  it('rejects wrong Bearer token', () => {
    const req = new NextRequest('http://x/api/cron/deadline-reminders', {
      headers: { authorization: 'Bearer wrong' },
    })
    expect(isAuthorizedCronRequest(req)).toBe(false)
  })

  it('accepts correct Bearer token when CRON_SECRET configured', () => {
    const secret = process.env.CRON_SECRET
    if (!secret || secret.length < 16) {
      console.warn('CRON_SECRET not set or too short — skipping positive auth test')
      return
    }
    const req = new NextRequest('http://x/api/cron/deadline-reminders', {
      headers: { authorization: `Bearer ${secret}` },
    })
    expect(isAuthorizedCronRequest(req)).toBe(true)
  })
})
