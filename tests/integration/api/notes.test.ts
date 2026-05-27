import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createTestUser, deleteTestUser, TestUser } from '@/tests/helpers/test-user'
import { retry } from '@/tests/helpers/retry'

describe('Notes integration', () => {
  let user: TestUser
  beforeEach(async () => {
    user = await retry(() => createTestUser())
  })
  afterEach(async () => {
    try { await deleteTestUser(user) } catch {}
  })

  it('creates a note on an application', async () => {
    const { data: app } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'X', status: 'draft' })
      .select()
      .single()

    const { data: note, error } = await user.client
      .from('application_notes')
      .insert({ application_id: app!.id, content: 'My note', user_id: user.id })
      .select()
      .single()
    expect(error).toBeNull()
    expect(note?.content).toBe('My note')
  }, 30_000)

  it('reads own notes back', async () => {
    const { data: app } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'X', status: 'draft' })
      .select()
      .single()

    await user.client.from('application_notes').insert([
      { application_id: app!.id, content: 'Note 1', user_id: user.id },
      { application_id: app!.id, content: 'Note 2', user_id: user.id },
    ])

    const { data } = await user.client
      .from('application_notes')
      .select('*')
      .eq('application_id', app!.id)
    expect(data?.length).toBe(2)
  }, 30_000)

  it('cross-user cannot read notes (RLS)', async () => {
    const other = await retry(() => createTestUser())
    try {
      const { data: app } = await other.client
        .from('applications')
        .insert({ user_id: other.id, title: 'X', status: 'draft' })
        .select()
        .single()
      await other.client
        .from('application_notes')
        .insert({ application_id: app!.id, content: 'secret note', user_id: other.id })

      const { data } = await user.client
        .from('application_notes')
        .select('*')
        .eq('application_id', app!.id)
      expect(data).toEqual([])
    } finally {
      await deleteTestUser(other)
    }
  }, 60_000)

  it('updates own note', async () => {
    const { data: app } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'X', status: 'draft' })
      .select()
      .single()

    const { data: note } = await user.client
      .from('application_notes')
      .insert({ application_id: app!.id, content: 'Original', user_id: user.id })
      .select()
      .single()

    const { data: updated } = await user.client
      .from('application_notes')
      .update({ content: 'Updated' })
      .eq('id', note!.id)
      .select()
      .single()
    expect(updated?.content).toBe('Updated')
  }, 30_000)
})
