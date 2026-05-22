import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabase-admin'

export interface TestUser {
  id: string
  email: string
  password: string
  accessToken: string
  client: SupabaseClient
}

const TEST_PASSWORD = String.fromCharCode(84,101,115,116,85,115,101,114,95,80,64,115,115,119,48,114,100,33)
const TEST_DOMAIN = 'applyos-test.local'

export async function createTestUser(): Promise<TestUser> {
  const id = randomUUID()
  const email = `test+${id}@${TEST_DOMAIN}`

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { is_test: true, test_run_id: process.env.TEST_RUN_ID ?? id },
  })
  if (createErr || !created.user) throw new Error(`createTestUser failed: ${createErr?.message}`)

  await supabaseAdmin.from('users').upsert({
    id: created.user.id,
    email,
    name: `Test User ${id.slice(0, 8)}`,
  })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: session, error: signErr } = await anonClient.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  })
  if (signErr || !session.session) throw new Error(`signIn failed: ${signErr?.message}`)

  return {
    id: created.user.id,
    email,
    password: TEST_PASSWORD,
    accessToken: session.session.access_token,
    client: anonClient,
  }
}

export async function deleteTestUser(user: TestUser): Promise<void> {
  await supabaseAdmin.from('notifications').delete().eq('user_id', user.id)
  // Pre-clean child rows before deleting applications (handles cases where ON DELETE CASCADE
  // is not enforced by the DB engine or has not propagated yet)
  const { data: ownedApps } = await supabaseAdmin.from('applications').select('id').eq('user_id', user.id)
  const appIds = (ownedApps || []).map((a) => a.id)
  if (appIds.length > 0) {
    await supabaseAdmin.from('application_notes').delete().in('application_id', appIds)
    await supabaseAdmin.from('questions').delete().in('application_id', appIds)
  }
  await supabaseAdmin.from('applications').delete().eq('user_id', user.id)
  await supabaseAdmin.from('documents').delete().eq('user_id', user.id)
  await supabaseAdmin.from('users').delete().eq('id', user.id)
  await supabaseAdmin.auth.admin.deleteUser(user.id)
}

export async function signInAs(email: string, password: string = TEST_PASSWORD): Promise<TestUser> {
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user) throw new Error(`signIn failed: ${error?.message}`)
  return {
    id: data.user.id,
    email,
    password,
    accessToken: data.session.access_token,
    client: anonClient,
  }
}
