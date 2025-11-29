import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Merge secure cookie settings with Supabase's options
          // Don't override httpOnly or maxAge - let Supabase control these based on client type
          const secureOptions: CookieOptions = {
            ...options,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: (options.sameSite as 'lax' | 'strict' | 'none') || 'lax', // CSRF protection
            path: options.path || '/',
          }

          // Set cookie on both request and response
          // Don't create a new response - it would discard previous cookies!
          request.cookies.set({
            name,
            value,
            ...secureOptions,
          })
          response.cookies.set({
            name,
            value,
            ...secureOptions,
          })
        },
        remove(name: string, options: CookieOptions) {
          // Merge secure cookie settings when removing
          // Don't override httpOnly - let Supabase control this based on client type
          const secureOptions: CookieOptions = {
            ...options,
            secure: process.env.NODE_ENV === 'production',
            sameSite: (options.sameSite as 'lax' | 'strict' | 'none') || 'lax',
            path: options.path || '/',
          }

          // Set cookie on both request and response
          // Don't create a new response - it would discard previous cookies!
          request.cookies.set({
            name,
            value: '',
            ...secureOptions,
          })
          response.cookies.set({
            name,
            value: '',
            ...secureOptions,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedRoutes = ['/dashboard', '/applications', '/documents', '/upload', '/notifications', '/profile', '/settings']
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url)
    // Preserve the original URL so we can redirect back after login
    loginUrl.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if ((request.nextUrl.pathname.startsWith('/auth/login') || request.nextUrl.pathname.startsWith('/auth/signup')) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect to dashboard if authenticated user accesses home page
  if (request.nextUrl.pathname === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Apply comprehensive security headers to all responses
  response.headers.set('X-Frame-Options', 'DENY') // Prevent clickjacking
  response.headers.set('X-Content-Type-Options', 'nosniff') // Prevent MIME type sniffing
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin') // Control referrer information
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()') // Restrict browser features (allow microphone for voice interviews)

  // HSTS (HTTP Strict Transport Security) - only in production with HTTPS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload' // Force HTTPS for 1 year
    )
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
