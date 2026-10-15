import { beforeEach, describe, expect, it, vi } from 'vitest'

const rows = vi.hoisted(() => ({
  preferences: new Map<string, Record<string, string>>(),
  connections: new Map<string, Record<string, string>>(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from }) }))
vi.mock('@/shared/db/supabase/server', () => ({ createClient: vi.fn() }))

function from(table: string) {
  const filters: Record<string, string> = {}
  let action = 'select'
  const query = {
    select() { return query },
    delete() { action = 'delete'; return query },
    eq(column: string, value: string) { filters[column] = value; return query },
    async maybeSingle() {
      const key = table === 'user_ai_preferences' ? filters.user_id : `${filters.user_id}:${filters.provider}`
      return { data: (table === 'user_ai_preferences' ? rows.preferences : rows.connections).get(key) ?? null, error: null }
    },
    async upsert(row: Record<string, string>) {
      const key = table === 'user_ai_preferences' ? row.user_id : `${row.user_id}:${row.provider}`
      ;(table === 'user_ai_preferences' ? rows.preferences : rows.connections).set(key, row)
      return { error: null }
    },
    then(resolve: (value: unknown) => void) {
      const data = table === 'user_ai_preferences' ? rows.preferences : rows.connections
      if (action === 'delete') {
        for (const [key, row] of data) {
          if (Object.entries(filters).every(([column, value]) => row[column] === value)) data.delete(key)
        }
        resolve({ error: null })
      } else {
        resolve({ data: [...data.values()].filter(row => Object.entries(filters).every(([column, value]) => row[column] === value)), error: null })
      }
    },
  }
  return query
}

import { deleteUserAIData, getAISettings, removeAIConnection, resolveAISource, saveAIConnection, selectAISource, withAIUser } from '@/shared/infrastructure/ai/connections'

beforeEach(() => {
  rows.preferences.clear()
  rows.connections.clear()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key'
  process.env.AI_CONNECTION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
})

describe('saved AI connections', () => {
  it('keeps credentials encrypted and returns only connection metadata', async () => {
    await saveAIConnection('user-1', 'claude', 'sk-private-user-key')
    expect(rows.connections.get('user-1:claude')?.encrypted_key).not.toContain('sk-private-user-key')
    const settings = await getAISettings('user-1')
    expect(settings).toEqual({
      textSource: 'applyos', audioSource: 'applyos',
      connections: [{ provider: 'claude', testedAt: expect.any(String) }],
    })
    expect(JSON.stringify(settings)).not.toContain('sk-private-user-key')
  })

  it('fails closed after removing a selected credential', async () => {
    await saveAIConnection('user-1', 'openai', 'sk-private-user-key')
    await selectAISource('user-1', 'text', 'openai')
    await withAIUser('user-1', async () => {
      await expect(resolveAISource('text')).resolves.toEqual({ source: 'openai', apiKey: 'sk-private-user-key' })
    })
    await removeAIConnection('user-1', 'openai')
    await expect(resolveAISource('text', 'user-1')).rejects.toThrow('connection is missing')
    expect((await getAISettings('user-1')).textSource).toBe('openai')
  })

  it('removes credentials and preferences during account deletion', async () => {
    await saveAIConnection('user-1', 'gemini', 'private-key')
    await selectAISource('user-1', 'audio', 'gemini')
    await deleteUserAIData('user-1')
    expect(rows.connections.size).toBe(0)
    expect(rows.preferences.size).toBe(0)
  })
})
