import { createBrowserClient } from '@supabase/ssr'
import { PREVIEW_ENABLED, createPreviewClient } from './preview'

export function createClient() {
  const realClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Dev-only harness: serve seeded rows so the authenticated pages can be
  // rendered and reviewed without Supabase access (see preview.ts).
  // Casting the preview client to `typeof realClient` keeps this function's
  // return type identical to the real one — any wider type (or a union) breaks
  // contextual typing for every `.map((row) => …)` in the app.
  if (PREVIEW_ENABLED) {
    return createPreviewClient() as typeof realClient
  }

  return realClient
}
