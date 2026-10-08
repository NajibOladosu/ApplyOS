import crypto from 'crypto'

/**
 * Email verification tokens are sent to the user as raw values in the verify
 * link, but only their SHA-256 hash is stored in public.users.verification_token.
 * A database read (backup, support tool, or a self-service select of the user's
 * own row) then does not expose a usable verification link.
 */
export function hashVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}
