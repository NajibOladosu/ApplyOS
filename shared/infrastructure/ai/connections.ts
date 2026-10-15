import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/shared/db/supabase/server'

export type AIProvider = 'claude' | 'openai' | 'gemini'
export type TextSource = 'applyos' | AIProvider
export type AudioSource = 'applyos' | 'openai' | 'gemini'
export type AISourceKind = 'text' | 'audio'

export class AIConnectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIConnectionError'
  }
}

const userContext = new AsyncLocalStorage<string>()

export function withAIUser<T>(userId: string, work: () => Promise<T>): Promise<T> {
  return userContext.run(userId, work)
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new AIConnectionError('AI connections are not configured on this server.')
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function encryptionKey(): Buffer {
  const encoded = process.env.AI_CONNECTION_ENCRYPTION_KEY
  const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0)
  if (key.length !== 32) throw new AIConnectionError('AI connection encryption is not configured on this server.')
  return key
}

function encrypt(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`
}

function decrypt(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(':')
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new AIConnectionError('Saved AI connection is invalid. Reconnect it in Settings.')
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    throw new AIConnectionError('Saved AI connection could not be read. Reconnect it in Settings.')
  }
}

export async function currentAIUserId(): Promise<string> {
  const contextual = userContext.getStore()
  if (contextual) return contextual
  const client = await createServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new AIConnectionError('Sign in to use AI features.')
  return user.id
}

export async function getAISettings(userId: string) {
  const client = serviceClient()
  const [prefs, connections] = await Promise.all([
    client.from('user_ai_preferences').select('text_source,audio_source').eq('user_id', userId).maybeSingle(),
    client.from('user_ai_connections').select('provider,tested_at').eq('user_id', userId),
  ])
  if (prefs.error || connections.error) throw new AIConnectionError('Could not load AI connections. Please try again.')
  return {
    textSource: (prefs.data?.text_source ?? 'applyos') as TextSource,
    audioSource: (prefs.data?.audio_source ?? 'applyos') as AudioSource,
    connections: (connections.data ?? []).map(row => ({ provider: row.provider as AIProvider, testedAt: row.tested_at as string })),
  }
}

export async function saveAIConnection(userId: string, provider: AIProvider, apiKey: string): Promise<void> {
  const { error } = await serviceClient().from('user_ai_connections').upsert({
    user_id: userId, provider, encrypted_key: encrypt(apiKey), tested_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' })
  if (error) throw new AIConnectionError('Could not save the AI connection. Please try again.')
}

export async function removeAIConnection(userId: string, provider: AIProvider): Promise<void> {
  const { error } = await serviceClient().from('user_ai_connections').delete().eq('user_id', userId).eq('provider', provider)
  if (error) throw new AIConnectionError('Could not disconnect the AI provider. Please try again.')
}

export async function deleteUserAIData(userId: string): Promise<void> {
  const client = serviceClient()
  const credentials = await client.from('user_ai_connections').delete().eq('user_id', userId)
  if (credentials.error && !['42P01', 'PGRST205'].includes(credentials.error.code)) {
    throw new AIConnectionError('Could not remove saved AI credentials.')
  }
  const preferences = await client.from('user_ai_preferences').delete().eq('user_id', userId)
  if (preferences.error && !['42P01', 'PGRST205'].includes(preferences.error.code)) {
    throw new AIConnectionError('Could not remove AI preferences.')
  }
}

export async function selectAISource(userId: string, kind: AISourceKind, source: TextSource | AudioSource): Promise<void> {
  const current = await getAISettings(userId)
  const { error } = await serviceClient().from('user_ai_preferences').upsert({
    user_id: userId,
    text_source: kind === 'text' ? source : current.textSource,
    audio_source: kind === 'audio' ? source : current.audioSource,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw new AIConnectionError('Could not save the AI source. Please try again.')
}

export async function resolveAISource(kind: AISourceKind, userId?: string): Promise<{
  source: TextSource | AudioSource; apiKey: string | null
}> {
  const resolvedUserId = userId ?? await currentAIUserId()
  const settings = await getAISettings(resolvedUserId)
  const source = kind === 'text' ? settings.textSource : settings.audioSource
  if (source === 'applyos') return { source, apiKey: null }
  const { data, error } = await serviceClient().from('user_ai_connections')
    .select('encrypted_key').eq('user_id', resolvedUserId).eq('provider', source).maybeSingle()
  if (error) throw new AIConnectionError('Could not load the selected AI connection. Please try again.')
  if (!data) throw new AIConnectionError(`Your selected ${source} connection is missing. Reconnect it in Settings or select ApplyOS.`)
  return { source, apiKey: decrypt(data.encrypted_key) }
}

export async function getConnectionKey(userId: string, provider: AIProvider): Promise<string> {
  const { data, error } = await serviceClient().from('user_ai_connections')
    .select('encrypted_key').eq('user_id', userId).eq('provider', provider).maybeSingle()
  if (error || !data) throw new AIConnectionError(`Your ${provider} connection is missing. Reconnect it in Settings.`)
  return decrypt(data.encrypted_key)
}

export async function isAIConfigured(kind: AISourceKind = 'text'): Promise<boolean> {
  const selected = await resolveAISource(kind)
  return selected.source !== 'applyos' || Boolean(process.env.GEMINI_API_KEY)
}
