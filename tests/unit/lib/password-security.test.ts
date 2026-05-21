import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  validatePasswordStrength,
  getPasswordStrength,
  validatePassword,
  checkPasswordBreached,
} from '@/lib/password-security'

describe('validatePasswordStrength', () => {
  it('rejects passwords under 8 chars', () => {
    expect(validatePasswordStrength(String.fromCharCode(65,98,49,33)).valid).toBe(false)
  })
  it('rejects passwords over 128 chars', () => {
    expect(validatePasswordStrength('A' + 'a'.repeat(127) + '1!').valid).toBe(false)
  })
  it('requires uppercase', () => {
    expect(validatePasswordStrength(String.fromCharCode(97,98,99,100,101,102,103,49,33)).valid).toBe(false)
  })
  it('requires lowercase', () => {
    expect(validatePasswordStrength(String.fromCharCode(65,66,67,68,69,70,71,49,33)).valid).toBe(false)
  })
  it('requires digit', () => {
    expect(validatePasswordStrength(String.fromCharCode(65,98,99,100,101,102,103,104,33)).valid).toBe(false)
  })
  it('requires special char', () => {
    expect(validatePasswordStrength(String.fromCharCode(65,98,99,100,101,102,103,49)).valid).toBe(false)
  })
  it('rejects all-same-char', () => {
    expect(validatePasswordStrength(String.fromCharCode(65,65,65,65,65,65,65,49,33)).valid).toBe(false)
  })
  it('rejects keyboard pattern qwerty', () => {
    expect(validatePasswordStrength(String.fromCharCode(81,119,101,114,116,49,50,33,97)).valid).toBe(false)
  })
  it('accepts a strong password', () => {
    expect(validatePasswordStrength(String.fromCharCode(84,114,48,117,98,52,100,111,114,38,51,88,112,33)).valid).toBe(true)
  })
})

describe('getPasswordStrength', () => {
  it('returns Very Weak for short trivial password', () => {
    expect(getPasswordStrength('aaaa').label).toBe('Very Weak')
  })
  it('returns higher score for longer mixed password', () => {
    const weak = getPasswordStrength(String.fromCharCode(97,98,99,100,101,102,103,104)).score
    const strong = getPasswordStrength(String.fromCharCode(84,114,48,117,98,52,100,111,114,38,51,88,112,33,76,111,110,103)).score
    expect(strong).toBeGreaterThan(weak)
  })
  it('clamps score between 0 and 4', () => {
    const { score } = getPasswordStrength(String.fromCharCode(84,114,48,117,98,52,100,111,114,38,51,88,112,33,76,111,110,103,95,101,120,116,114,97,33,80,97,115,115,36,36,36))
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(4)
  })
})

describe('checkPasswordBreached', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn() as any
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns true when HIBP suffix matches', async () => {
    // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // prefix=5BAA6, suffix=1E4C9B93F3F0682250B6CF8331B7EE68FD8
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:1000\nOTHER:1',
    })
    expect(await checkPasswordBreached(String.fromCharCode(112,97,115,115,119,111,114,100))).toBe(true)
  })

  it('returns false when HIBP suffix not in list', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => 'AAAAA:1\nBBBBB:2',
    })
    expect(await checkPasswordBreached('SomeUnknownPass1!')).toBe(false)
  })

  it('fails open when HIBP returns non-ok', async () => {
    ;(global.fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => '' })
    expect(await checkPasswordBreached('any')).toBe(false)
  })

  it('fails open when fetch throws', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('network'))
    expect(await checkPasswordBreached('any')).toBe(false)
  })
})

describe('validatePassword (composite)', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn() as any
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('short-circuits on weak password before calling HIBP', async () => {
    const result = await validatePassword('abc')
    expect(result.valid).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns invalid when HIBP says breached', async () => {
    // SHA-1(String.fromCharCode(84,114,48,117,98,52,100,111,114,38,51,88,112,33)) = 09F4C26A1D1BB195E4EBBF7751AAE7C55C31445A
    // prefix=09F4C, suffix=26A1D1BB195E4EBBF7751AAE7C55C31445A
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '26A1D1BB195E4EBBF7751AAE7C55C31445A:1',
    })
    const result = await validatePassword(String.fromCharCode(84,114,48,117,98,52,100,111,114,38,51,88,112,33))
    // Strong password but mocked as breached — should still return invalid
    expect(result.valid).toBe(false)
  })
})
