import { describe, expect, it } from 'vitest'
import { hashVerificationToken } from '@/shared/infrastructure/auth/verification-token'

describe('hashVerificationToken', () => {
  it('returns a 64-char lowercase hex SHA-256 digest', () => {
    expect(hashVerificationToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
  it('is deterministic and never equals the input', () => {
    const t = 'f'.repeat(64)
    expect(hashVerificationToken(t)).toBe(hashVerificationToken(t))
    expect(hashVerificationToken(t)).not.toBe(t)
  })
})
