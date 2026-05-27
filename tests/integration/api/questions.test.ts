import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createTestUser, deleteTestUser, TestUser } from '@/tests/helpers/test-user'
import { retry } from '@/tests/helpers/retry'

describe('Questions integration', () => {
  let user: TestUser
  beforeEach(async () => {
    user = await retry(() => createTestUser())
  })
  afterEach(async () => {
    try { await deleteTestUser(user) } catch {}
  })

  it('creates and reads questions linked to an application', async () => {
    const { data: app } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'Job', status: 'draft' })
      .select()
      .single()

    await user.client.from('questions').insert([
      { application_id: app!.id, question_text: 'Why us?' },
      { application_id: app!.id, question_text: 'Strengths?' },
    ])

    const { data } = await user.client
      .from('questions')
      .select('*')
      .eq('application_id', app!.id)
      .order('created_at')

    expect(data?.length).toBe(2)
    expect(data?.map((q) => q.question_text).sort()).toEqual(['Strengths?', 'Why us?'])
  }, 30_000)

  it('user cannot read questions from another user\'s application (RLS)', async () => {
    const other = await retry(() => createTestUser())
    try {
      const { data: app } = await other.client
        .from('applications')
        .insert({ user_id: other.id, title: 'secret', status: 'draft' })
        .select()
        .single()

      await other.client.from('questions').insert({ application_id: app!.id, question_text: 'secret Q?' })

      const { data } = await user.client.from('questions').select('*').eq('application_id', app!.id)
      expect(data).toEqual([])
    } finally {
      await deleteTestUser(other)
    }
  }, 60_000)

  it('updates an answer on existing question', async () => {
    const { data: app } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'X', status: 'draft' })
      .select()
      .single()
    const { data: q } = await user.client
      .from('questions')
      .insert({ application_id: app!.id, question_text: 'Why?' })
      .select()
      .single()

    const { data: updated } = await user.client
      .from('questions')
      .update({ manual_answer: 'Because reasons.' })
      .eq('id', q!.id)
      .select()
      .single()
    expect(updated?.manual_answer).toBe('Because reasons.')
  }, 30_000)

  it('user cannot update another user\'s question (RLS)', async () => {
    const other = await retry(() => createTestUser())
    try {
      const { data: app } = await other.client
        .from('applications')
        .insert({ user_id: other.id, title: 'X', status: 'draft' })
        .select()
        .single()
      const { data: q } = await other.client
        .from('questions')
        .insert({ application_id: app!.id, question_text: 'Q?' })
        .select()
        .single()

      const { data: hackAttempt } = await user.client
        .from('questions')
        .update({ manual_answer: 'HACKED' })
        .eq('id', q!.id)
        .select()
      expect(hackAttempt).toEqual([])
    } finally {
      await deleteTestUser(other)
    }
  }, 60_000)
})
