import { NextRequest, NextResponse } from 'next/server'
import { getAISettings, removeAIConnection, saveAIConnection, type AIProvider } from '@/shared/infrastructure/ai/connections'
import { testAIConnection } from '@/shared/infrastructure/ai/providers'
import { authenticatedUser, connectionError, connectionMutationLimit, providers } from './_lib'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request)
    return NextResponse.json(await getAISettings(user.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return connectionError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticatedUser(request)
    const limited = await connectionMutationLimit(request, user.id)
    if (limited) return limited
    const body = await request.json().catch(() => null)
    const provider = body?.provider as AIProvider
    const apiKey = body?.apiKey
    if (!providers.has(provider) || typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 512) {
      return NextResponse.json({ error: 'Choose a provider and enter a valid API key.' }, { status: 400 })
    }
    await testAIConnection(provider, apiKey.trim())
    await saveAIConnection(user.id, provider, apiKey.trim())
    return NextResponse.json(await getAISettings(user.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return connectionError(error) }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticatedUser(request)
    const limited = await connectionMutationLimit(request, user.id)
    if (limited) return limited
    const body = await request.json().catch(() => null)
    const provider = body?.provider as AIProvider
    if (!providers.has(provider)) return NextResponse.json({ error: 'Invalid provider.' }, { status: 400 })
    await removeAIConnection(user.id, provider)
    return NextResponse.json(await getAISettings(user.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return connectionError(error) }
}
