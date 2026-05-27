import { createHmac, timingSafeEqual } from 'crypto'

export type UnsubscribeCategory = 'all' | 'deadline_reminders' | 'status_updates' | 'weekly_digest'

const CATEGORIES: readonly UnsubscribeCategory[] = [
  'all',
  'deadline_reminders',
  'status_updates',
  'weekly_digest',
] as const

export interface UnsubscribePayload {
  userId: string
  category: UnsubscribeCategory
}

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SIGNING_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('UNSUBSCRIBE_SIGNING_SECRET must be set (32+ chars)')
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function signUnsubscribeToken(payload: UnsubscribePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = sign(encoded)
  return `${encoded}.${sig}`
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  if (!token || !token.includes('.')) return null
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null

  let expectedSig: string
  try {
    expectedSig = sign(encoded)
  } catch {
    return null
  }

  let sigBuf: Buffer
  let expectedBuf: Buffer
  try {
    sigBuf = Buffer.from(sig, 'hex')
    expectedBuf = Buffer.from(expectedSig, 'hex')
  } catch {
    return null
  }
  if (sigBuf.length === 0 || sigBuf.length !== expectedBuf.length) return null
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<UnsubscribePayload>
    if (!parsed.userId || typeof parsed.userId !== 'string') return null
    if (!parsed.category || !CATEGORIES.includes(parsed.category)) return null
    return { userId: parsed.userId, category: parsed.category }
  } catch {
    return null
  }
}
