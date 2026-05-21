import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

function constantTimeStringEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected || expected.length < 16) {
    console.error('CRON_SECRET is not configured or too short — cron request rejected')
    return false
  }

  const bearer = request.headers.get('authorization')
  if (bearer && bearer.startsWith('Bearer ')) {
    if (constantTimeStringEquals(bearer.slice('Bearer '.length), expected)) return true
  }

  const vercelCron = request.headers.get('x-vercel-cron-secret')
  if (vercelCron && constantTimeStringEquals(vercelCron, expected)) return true

  return false
}
