import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createTestUser, deleteTestUser, TestUser } from '@/tests/helpers/test-user'
import { supabaseAdmin } from '@/tests/helpers/supabase-admin'
import { retry } from '@/tests/helpers/retry'

describe('Applications integration', () => {
  let user: TestUser
  beforeEach(async () => {
    user = await retry(() => createTestUser())
  })
  afterEach(async () => {
    try { await deleteTestUser(user) } catch {}
  })

  it('creates an application and reads it back', async () => {
    const { data, error } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'Software Engineer', company: 'Acme', status: 'draft' })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.title).toBe('Software Engineer')

    const { data: read } = await user.client.from('applications').select('*').eq('id', data!.id).single()
    expect(read?.company).toBe('Acme')
  }, 30_000)

  it('updates an application status', async () => {
    const { data: created } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'X', status: 'draft' })
      .select()
      .single()

    const { data: updated } = await user.client
      .from('applications')
      .update({ status: 'submitted' })
      .eq('id', created!.id)
      .select()
      .single()
    expect(updated?.status).toBe('submitted')
  }, 30_000)

  it('deletes an application and cascades to questions', async () => {
    const { data: app } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'To delete', status: 'draft' })
      .select()
      .single()

    await user.client.from('questions').insert({ application_id: app!.id, question_text: 'q?' })

    await user.client.from('applications').delete().eq('id', app!.id)

    const { data: remainingQuestions } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('application_id', app!.id)
    expect(remainingQuestions).toEqual([])
  }, 30_000)

  it('cross-user read returns empty (RLS)', async () => {
    const other = await retry(() => createTestUser())
    try {
      const { data: app } = await supabaseAdmin
        .from('applications')
        .insert({ user_id: other.id, title: 'other_secret', status: 'draft' })
        .select()
        .single()

      const { data } = await user.client.from('applications').select('*').eq('id', app!.id)
      expect(data).toEqual([])
    } finally {
      await deleteTestUser(other)
    }
  }, 60_000)

  it('cross-user update returns 0 rows affected (RLS)', async () => {
    const other = await retry(() => createTestUser())
    try {
      const { data: app } = await supabaseAdmin
        .from('applications')
        .insert({ user_id: other.id, title: 'unchanged', status: 'draft' })
        .select()
        .single()

      const { data: updated } = await user.client
        .from('applications')
        .update({ title: 'HACKED' })
        .eq('id', app!.id)
        .select()

      expect(updated).toEqual([])
      const { data: check } = await supabaseAdmin
        .from('applications')
        .select('title')
        .eq('id', app!.id)
        .single()
      expect(check?.title).toBe('unchanged')
    } finally {
      await deleteTestUser(other)
    }
  }, 60_000)

  it('queries return only own applications when multiple users exist', async () => {
    const other = await retry(() => createTestUser())
    try {
      await user.client.from('applications').insert([
        { user_id: user.id, title: 'A', status: 'draft' },
        { user_id: user.id, title: 'B', status: 'in_review' },
      ])
      await other.client.from('applications').insert({ user_id: other.id, title: 'C', status: 'draft' })

      const { data: mine } = await user.client.from('applications').select('*')
      expect(mine?.length).toBe(2)
      expect(mine?.map((a) => a.title).sort()).toEqual(['A', 'B'])
    } finally {
      await deleteTestUser(other)
    }
  }, 60_000)
})
