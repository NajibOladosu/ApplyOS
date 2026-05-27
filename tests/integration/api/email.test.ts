import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createTestUser, deleteTestUser, TestUser } from '@/tests/helpers/test-user'
import { supabaseAdmin } from '@/tests/helpers/supabase-admin'
import { retry } from '@/tests/helpers/retry'

describe('Email queue integration', () => {
  let user: TestUser
  beforeEach(async () => {
    user = await retry(() => createTestUser())
  })
  afterEach(async () => {
    try {
      await supabaseAdmin.from('email_queue').delete().eq('user_id', user.id)
      await deleteTestUser(user)
    } catch {}
  })

  it('admin can insert email queue row', async () => {
    const { data, error } = await supabaseAdmin
      .from('email_queue')
      .insert({
        user_id: user.id,
        email_to: user.email,
        subject: 'Test',
        body: 'Hello',
        template_type: 'welcome',
        status: 'pending',
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.status).toBe('pending')
  }, 30_000)

  it('user can view own queued emails', async () => {
    await supabaseAdmin.from('email_queue').insert({
      user_id: user.id,
      email_to: user.email,
      subject: 'Test',
      body: 'Hello',
      template_type: 'welcome',
      status: 'pending',
    })
    const { data } = await user.client.from('email_queue').select('*').eq('user_id', user.id)
    expect(data?.length).toBeGreaterThan(0)
  }, 30_000)

  it("user cannot view another user's emails", async () => {
    const other = await retry(() => createTestUser())
    try {
      await supabaseAdmin.from('email_queue').insert({
        user_id: other.id,
        email_to: other.email,
        subject: 'Theirs',
        body: 'theirs',
        template_type: 'welcome',
        status: 'pending',
      })
      const { data } = await user.client.from('email_queue').select('*').eq('user_id', other.id)
      expect(data).toEqual([])
    } finally {
      try { await supabaseAdmin.from('email_queue').delete().eq('user_id', other.id) } catch {}
      await deleteTestUser(other)
    }
  }, 60_000)
})
