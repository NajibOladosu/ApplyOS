#!/usr/bin/env tsx
import { supabaseAdmin } from './supabase-admin'

async function nuke() {
  console.log('[nuke] Finding test users (is_test=true in user_metadata)...')

  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error

  const testUsers = users.filter((u) => u.user_metadata?.is_test === true || u.email?.endsWith('@applyos-test.local'))
  console.log(`[nuke] Found ${testUsers.length} test users`)

  for (const u of testUsers) {
    try {
      await supabaseAdmin.from('notifications').delete().eq('user_id', u.id)
      await supabaseAdmin.from('applications').delete().eq('user_id', u.id)
      await supabaseAdmin.from('documents').delete().eq('user_id', u.id)
      await supabaseAdmin.from('users').delete().eq('id', u.id)
      await supabaseAdmin.auth.admin.deleteUser(u.id)
      console.log(`[nuke] Removed ${u.email}`)
    } catch (e) {
      console.error(`[nuke] Failed to remove ${u.email}:`, e)
    }
  }

  console.log('[nuke] Done')
}

nuke().catch((e) => {
  console.error(e)
  process.exit(1)
})
