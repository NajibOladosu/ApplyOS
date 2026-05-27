import { BrowserContext } from '@playwright/test'
import { createTestUser, deleteTestUser, TestUser } from '@/tests/helpers/test-user'

/**
 * Inject Supabase session cookies into a Playwright browser context
 * so the app sees the user as authenticated without going through the UI login flow.
 *
 * If this doesn't work (cookie name/format changes upstream), fall back to:
 *   await page.goto('/auth/login'); fill form; submit.
 */
export async function loginAs(context: BrowserContext, user: TestUser): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`

  const sessionPayload = {
    access_token: user.accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: '',
    user: {
      id: user.id,
      email: user.email,
      app_metadata: {},
      user_metadata: { is_test: true },
      aud: 'authenticated',
      role: 'authenticated',
    },
  }

  await context.addCookies([
    {
      name: cookieName,
      value: encodeURIComponent(JSON.stringify(sessionPayload)),
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

export { createTestUser, deleteTestUser }
export type { TestUser }
