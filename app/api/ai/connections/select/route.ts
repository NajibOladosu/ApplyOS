import { NextRequest, NextResponse } from 'next/server'
import { getAISettings, selectAISource, type AudioSource, type TextSource } from '@/shared/infrastructure/ai/connections'
import { authenticatedUser, connectionError, connectionMutationLimit } from '../_lib'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticatedUser(request)
    const limited = await connectionMutationLimit(request, user.id)
    if (limited) return limited
    const body = await request.json().catch(() => null)
    const kind = body?.kind
    const source = body?.source
    const allowed = kind === 'text'
      ? ['applyos', 'claude', 'openai', 'gemini']
      : kind === 'audio' ? ['applyos', 'gemini', 'openai'] : []
    if (!allowed.includes(source)) return NextResponse.json({ error: 'Invalid AI source.' }, { status: 400 })
    const settings = await getAISettings(user.id)
    if (source !== 'applyos' && !settings.connections.some(connection => connection.provider === source)) {
      return NextResponse.json({ error: `Connect ${source} before selecting it.` }, { status: 400 })
    }
    if ((kind === 'text' && source === 'claude' && settings.audioSource === 'applyos') ||
        (kind === 'audio' && source === 'applyos' && settings.textSource === 'claude')) {
      return NextResponse.json({ error: 'Claude text requires your own Gemini or OpenAI audio connection.' }, { status: 400 })
    }
    await selectAISource(user.id, kind, source as TextSource | AudioSource)
    return NextResponse.json(await getAISettings(user.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return connectionError(error) }
}
