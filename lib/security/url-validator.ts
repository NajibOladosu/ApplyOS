import 'server-only'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const PRIVATE_IPV4_RANGES: Array<[number, number, number]> = [
  [10, 0, 0xff000000],
  [172, 16, 0xfff00000],
  [192, 168, 0xffff0000],
  [127, 0, 0xff000000],
  [169, 254, 0xffff0000],
  [100, 64, 0xffc00000],
  [0, 0, 0xff000000],
]

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const o = Number(p)
    if (!Number.isInteger(o) || o < 0 || o > 255) return null
    n = (n << 8) | o
  }
  return n >>> 0
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true
  for (const [a, b, mask] of PRIVATE_IPV4_RANGES) {
    const range = ((a << 24) | (b << 16)) >>> 0
    if ((n & mask) >>> 0 === (range & mask) >>> 0) return true
  }
  return false
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('fe80')) return true
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.replace('::ffff:', '')
    if (isIP(v4) === 4) return isPrivateIpv4(v4)
  }
  return false
}

export function parseHttpUrl(input: string): URL | null {
  try {
    const u = new URL(input)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u
  } catch {
    return null
  }
}

export async function isPublicHttpUrl(input: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  const u = parseHttpUrl(input)
  if (!u) return { ok: false, reason: 'Invalid URL or unsupported protocol' }

  const host = u.hostname
  if (!host) return { ok: false, reason: 'Missing host' }

  const lowerHost = host.toLowerCase()
  if (lowerHost === 'localhost' || lowerHost.endsWith('.localhost') || lowerHost.endsWith('.local')) {
    return { ok: false, reason: 'Loopback host blocked' }
  }
  if (lowerHost === 'metadata.google.internal') {
    return { ok: false, reason: 'Cloud metadata host blocked' }
  }

  const ipVersion = isIP(host)
  if (ipVersion === 4) {
    if (isPrivateIpv4(host)) return { ok: false, reason: 'Private/reserved IPv4 blocked' }
    return { ok: true, url: u }
  }
  if (ipVersion === 6) {
    if (isPrivateIpv6(host)) return { ok: false, reason: 'Private/reserved IPv6 blocked' }
    return { ok: true, url: u }
  }

  try {
    const records = await dnsLookup(host, { all: true })
    for (const r of records) {
      if (r.family === 4 && isPrivateIpv4(r.address)) {
        return { ok: false, reason: 'Host resolves to private IPv4' }
      }
      if (r.family === 6 && isPrivateIpv6(r.address)) {
        return { ok: false, reason: 'Host resolves to private IPv6' }
      }
    }
  } catch {
    return { ok: false, reason: 'DNS lookup failed' }
  }

  return { ok: true, url: u }
}

function supabaseStorageHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return null
  try {
    return new URL(raw).host.toLowerCase()
  } catch {
    return null
  }
}

export function isOwnedStorageUrl(input: string): boolean {
  const u = parseHttpUrl(input)
  if (!u) return false
  const expected = supabaseStorageHost()
  if (!expected) return false
  if (u.host.toLowerCase() !== expected) return false
  return u.pathname.startsWith('/storage/v1/object/')
}
