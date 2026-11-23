import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/db/supabase/server'
import { AIConnectionError, type AIProvider } from '@/shared/infrastructure/ai/connections'
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit'

export const providers = new Set<AIProvider>(['claude', 'openai', 'gemini'])

export async function authenticatedUser(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) throw new AIConnectionError('Invalid request origin.')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AIConnectionError('Sign in to manage AI connections.')
  return user
}

export async function connectionMutationLimit(request: NextRequest, userId: string) {
  return rateLimitMiddleware(request, RATE_LIMITS.ai, async () => userId)
}

export function connectionError(error: unknown) {
  const status = error instanceof AIConnectionError
    ? error.message === 'Sign in to manage AI connections.' ? 401
      : error.message === 'Invalid request origin.' ? 403 : 503
    : 500
  return NextResponse.json(
    { error: error instanceof AIConnectionError ? error.message : 'Could not manage the AI connection.' },
    { status },
  )
}
