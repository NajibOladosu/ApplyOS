import { NextRequest, NextResponse } from 'next/server'
import { getConnectionKey, type AIProvider } from '@/shared/infrastructure/ai/connections'
import { testAIConnection } from '@/shared/infrastructure/ai/providers'
import { authenticatedUser, connectionError, connectionMutationLimit, providers } from '../_lib'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticatedUser(request)
    const limited = await connectionMutationLimit(request, user.id)
    if (limited) return limited
    const body = await request.json().catch(() => null)
    const provider = body?.provider as AIProvider
    if (!providers.has(provider)) return NextResponse.json({ error: 'Invalid provider.' }, { status: 400 })
    const key = typeof body?.apiKey === 'string' && body.apiKey.length <= 512 && body.apiKey.trim()
      ? body.apiKey.trim() : await getConnectionKey(user.id, provider)
    await testAIConnection(provider, key)
    return NextResponse.json({ ok: true })
  } catch (error) { return connectionError(error) }
}
