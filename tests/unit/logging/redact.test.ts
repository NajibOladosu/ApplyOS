import { describe, expect, it } from 'vitest'
import { redactEmail } from '@/shared/infrastructure/logging/redact'

describe('redactEmail', () => {
  it('keeps the first character and the domain only', () => {
    expect(redactEmail('alice@example.com')).toBe('a***@example.com')
  })
  it('handles missing or malformed input without throwing', () => {
    expect(redactEmail(undefined)).toBe('[no-email]')
    expect(redactEmail('')).toBe('[no-email]')
    expect(redactEmail('no-at-sign')).toBe('[redacted]')
    expect(redactEmail('@example.com')).toBe('[redacted]')
    expect(redactEmail('trailing@')).toBe('[redacted]')
  })
  it('never returns the full local part', () => {
    expect(redactEmail('bob.smith@example.com')).not.toContain('smith')
  })
})
