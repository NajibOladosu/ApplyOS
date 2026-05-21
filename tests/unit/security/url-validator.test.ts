import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { parseHttpUrl, isPublicHttpUrl, isOwnedStorageUrl } from '@/lib/security/url-validator'

describe('parseHttpUrl', () => {
  it('returns URL for valid http', () => {
    expect(parseHttpUrl('http://example.com')?.host).toBe('example.com')
  })
  it('returns URL for valid https', () => {
    expect(parseHttpUrl('https://example.com/path')?.pathname).toBe('/path')
  })
  it('returns null for ftp://', () => {
    expect(parseHttpUrl('ftp://example.com')).toBeNull()
  })
  it('returns null for javascript:', () => {
    expect(parseHttpUrl('javascript:alert(1)')).toBeNull()
  })
  it('returns null for malformed input', () => {
    expect(parseHttpUrl('not a url')).toBeNull()
  })
})

describe('isPublicHttpUrl', () => {
  it('rejects loopback hostname', async () => {
    const res = await isPublicHttpUrl('http://localhost/x')
    expect(res.ok).toBe(false)
  })
  it('rejects .local TLD', async () => {
    const res = await isPublicHttpUrl('http://service.local')
    expect(res.ok).toBe(false)
  })
  it('rejects 127.0.0.1', async () => {
    const res = await isPublicHttpUrl('http://127.0.0.1')
    expect(res.ok).toBe(false)
  })
  it('rejects 10.0.0.0/8', async () => {
    const res = await isPublicHttpUrl('http://10.1.2.3')
    expect(res.ok).toBe(false)
  })
  it('rejects 192.168.0.0/16', async () => {
    const res = await isPublicHttpUrl('http://192.168.1.1')
    expect(res.ok).toBe(false)
  })
  it('rejects 169.254.169.254 (AWS metadata)', async () => {
    const res = await isPublicHttpUrl('http://169.254.169.254/latest/meta-data')
    expect(res.ok).toBe(false)
  })
  it('rejects metadata.google.internal', async () => {
    const res = await isPublicHttpUrl('http://metadata.google.internal/')
    expect(res.ok).toBe(false)
  })
  it('rejects IPv6 loopback ::1', async () => {
    const res = await isPublicHttpUrl('http://[::1]/')
    expect(res.ok).toBe(false)
  })
  it('rejects unsupported protocol', async () => {
    const res = await isPublicHttpUrl('file:///etc/passwd')
    expect(res.ok).toBe(false)
  })
  it('accepts a public IP literal', async () => {
    const res = await isPublicHttpUrl('http://8.8.8.8')
    expect(res.ok).toBe(true)
  })
})

describe('isOwnedStorageUrl', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_SUPABASE_URL
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL
  })
  it('accepts URL on Supabase storage host with /storage/v1/object/ prefix', () => {
    expect(
      isOwnedStorageUrl('https://abc.supabase.co/storage/v1/object/sign/documents/user/file.pdf')
    ).toBe(true)
  })
  it('rejects same host but wrong path', () => {
    expect(isOwnedStorageUrl('https://abc.supabase.co/auth/v1/token')).toBe(false)
  })
  it('rejects different host', () => {
    expect(isOwnedStorageUrl('https://evil.com/storage/v1/object/x')).toBe(false)
  })
  it('rejects malformed URL', () => {
    expect(isOwnedStorageUrl('not a url')).toBe(false)
  })
  it('returns false when env var unset', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(isOwnedStorageUrl('https://abc.supabase.co/storage/v1/object/x')).toBe(false)
  })
})
