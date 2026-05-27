import { describe, expect, it } from 'vitest'
import { createTestUser, deleteTestUser } from '@/tests/helpers/test-user'
import { supabaseAdmin } from '@/tests/helpers/supabase-admin'
import { retry } from '@/tests/helpers/retry'

describe('Account deletion integration', () => {
  it('deleting a user removes all owned rows across tables', async () => {
    const user = await retry(() => createTestUser())

    const { data: app } = await user.client
      .from('applications')
      .insert({ user_id: user.id, title: 'X', status: 'draft' })
      .select()
      .single()
    await user.client.from('documents').insert({
      user_id: user.id,
      file_name: 't.pdf',
      file_url: 'https://x/t.pdf',
      file_type: 'application/pdf',
      file_size: 1,
    })
    await user.client.from('questions').insert({ application_id: app!.id, question_text: 'q' })
    await user.client
      .from('application_notes')
      .insert({ application_id: app!.id, content: 'n', user_id: user.id })
    await supabaseAdmin
      .from('notifications')
      .insert({ user_id: user.id, type: 'info', message: 'hi' })

    const userId = user.id
    const appId = app!.id

    await deleteTestUser(user)

    // After deleteTestUser ran the manual cascade, all rows should be gone
    const checks: { table: string; filter: { col: string; val: string } }[] = [
      { table: 'applications', filter: { col: 'user_id', val: userId } },
      { table: 'documents', filter: { col: 'user_id', val: userId } },
      { table: 'notifications', filter: { col: 'user_id', val: userId } },
      { table: 'questions', filter: { col: 'application_id', val: appId } },
      { table: 'application_notes', filter: { col: 'application_id', val: appId } },
    ]
    for (const { table, filter } of checks) {
      const { data } = await supabaseAdmin.from(table).select('id').eq(filter.col, filter.val)
      expect(data, `${table} should be empty for ${filter.col}=${filter.val}`).toEqual([])
    }

    // Auth user gone too
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const found = users.find((u) => u.id === userId)
    expect(found).toBeUndefined()
  }, 60_000)
})
