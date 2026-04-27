import { NextRequest, NextResponse } from 'next/server'

/**
 * Build a per-request CSP using a cryptographic nonce.
 * - script-src: nonce + 'strict-dynamic' (drops 'unsafe-inline' in production)
 * - style-src: keeps 'unsafe-inline' (Next.js streaming inserts inline <style> tags
 *   that cannot all be nonced today; revisit when next/font + next 16 supports it)
 */
function buildCsp(nonce: string, isProd: boolean): string {
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`
    : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://hvmaerptxgeldviarcuj.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://hvmaerptxgeldviarcuj.supabase.co https://*.supabase.co https://generativelanguage.googleapis.com wss://hvmaerptxgeldviarcuj.supabase.co wss://generativelanguage.googleapis.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ]

  return directives.join('; ')
}

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce()
  const isProd = process.env.NODE_ENV === 'production'
  const csp = buildCsp(nonce, isProd)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets and image optimization.
     * Excluded so nonce isn't required for cached assets the browser fetches directly.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.webp$|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
