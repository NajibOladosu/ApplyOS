import { describe, expect, it, afterEach } from 'vitest'
import { createTestUser, deleteTestUser, TestUser } from '@/tests/helpers/test-user'
import { supabaseAdmin } from '@/tests/helpers/supabase-admin'
import { retry } from '@/tests/helpers/retry'

describe('Auth flow integration', () => {
  const cleanupUsers: TestUser[] = []
  afterEach(async () => {
    while (cleanupUsers.length) {
      const u = cleanupUsers.pop()!
      try { await deleteTestUser(u) } catch {}
    }
  })

  it('createTestUser produces a working session', async () => {
    const user = await retry(() => createTestUser())
    cleanupUsers.push(user)

    const { data, error } = await user.client.auth.getUser()
    expect(error).toBeNull()
    expect(data.user?.email).toBe(user.email)
  }, 30_000)

  it('user cannot access another user\'s applications (RLS)', async () => {
    const a = await retry(() => createTestUser())
    const b = await retry(() => createTestUser())
    cleanupUsers.push(a, b)

    const { data: app, error: insErr } = await supabaseAdmin
      .from('applications')
      .insert({ user_id: a.id, title: 'A_secret_app', status: 'draft' })
      .select()
      .single()
    expect(insErr).toBeNull()

    const { data: bData } = await b.client.from('applications').select('*').eq('id', app!.id)
    expect(bData).toEqual([])

    const { data: aData } = await a.client.from('applications').select('*').eq('id', app!.id)
    expect(aData?.length).toBeGreaterThan(0)
  }, 60_000)

  it('user can sign out', async () => {
    const user = await retry(() => createTestUser())
    cleanupUsers.push(user)
    const { error } = await user.client.auth.signOut()
    expect(error).toBeNull()
  }, 30_000)
})
