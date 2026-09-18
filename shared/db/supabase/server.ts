import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { PREVIEW_ENABLED, createPreviewClient } from './preview'

export async function createClient() {
  const cookieStore = await cookies()

  const realClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Merge secure cookie settings with Supabase's options
            // Don't override httpOnly or maxAge - let Supabase control these based on client type
            const secureOptions: CookieOptions = {
              ...options,
              secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
              sameSite: (options.sameSite as 'lax' | 'strict' | 'none') || 'lax', // CSRF protection: allow same-site and top-level navigation
              path: options.path || '/', // Cookie available across entire site
            }
            cookieStore.set({ name, value, ...secureOptions })
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Merge secure cookie settings when removing
            // Don't override httpOnly - let Supabase control this based on client type
            const secureOptions: CookieOptions = {
              ...options,
              secure: process.env.NODE_ENV === 'production',
              sameSite: (options.sameSite as 'lax' | 'strict' | 'none') || 'lax',
              path: options.path || '/',
            }
            cookieStore.set({ name, value: '', ...secureOptions })
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Dev-only harness: API routes read the same seeded rows as the browser
  // client so authenticated pages can render without Supabase (see preview.ts).
  // The cast keeps the return type identical to the real client's — a union or
  // a `ReturnType<…>` cast widens it and breaks contextual typing across the
  // API routes (`.map((row) => …)` loses its inferred parameter type).
  if (PREVIEW_ENABLED) {
    return createPreviewClient() as typeof realClient
  }

  return realClient
}
