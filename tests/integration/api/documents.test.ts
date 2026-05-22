import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createTestUser, deleteTestUser, TestUser } from '@/tests/helpers/test-user'
import { supabaseAdmin } from '@/tests/helpers/supabase-admin'
import { retry } from '@/tests/helpers/retry'

const SAMPLE_PDF = path.join(process.cwd(), 'tests', 'fixtures', 'pdfs', 'sample-cv.pdf')

describe('Documents integration', () => {
  let user: TestUser
  beforeEach(async () => {
    user = await retry(() => createTestUser())
  })
  afterEach(async () => {
    try { await deleteTestUser(user) } catch {}
  })

  it('uploads PDF to storage and inserts row', async () => {
    const fileBuf = fs.readFileSync(SAMPLE_PDF)
    const fileName = `${user.id}/${Date.now()}_sample-cv.pdf`

    const { data: upload, error: upErr } = await user.client.storage
      .from('documents')
      .upload(fileName, fileBuf, { contentType: 'application/pdf' })
    expect(upErr).toBeNull()
    expect(upload?.path).toBe(fileName)

    const { data: { publicUrl } } = user.client.storage.from('documents').getPublicUrl(fileName)

    const { data: doc, error: insErr } = await user.client
      .from('documents')
      .insert({
        user_id: user.id,
        file_name: 'sample-cv.pdf',
        file_url: publicUrl,
        file_type: 'application/pdf',
        file_size: fileBuf.length,
      })
      .select()
      .single()
    expect(insErr).toBeNull()
    expect(doc?.id).toBeTruthy()
  }, 30_000)

  it('user cannot read documents owned by another user', async () => {
    const other = await retry(() => createTestUser())
    try {
      const { data: othersDoc } = await supabaseAdmin
        .from('documents')
        .insert({
          user_id: other.id,
          file_name: 'secret.pdf',
          file_url: 'https://x/secret.pdf',
          file_type: 'application/pdf',
          file_size: 100,
        })
        .select()
        .single()

      const { data } = await user.client.from('documents').select('*').eq('id', othersDoc!.id)
      expect(data).toEqual([])
    } finally {
      await deleteTestUser(other)
    }
  }, 60_000)

  it('user cannot read storage files in another user folder', async () => {
    const other = await retry(() => createTestUser())
    try {
      const fileBuf = Buffer.from('secret bytes')
      const otherPath = `${other.id}/secret.txt`
      const { error: upErr } = await supabaseAdmin.storage
        .from('documents')
        .upload(otherPath, fileBuf, { contentType: 'text/plain', upsert: true })
      expect(upErr).toBeNull()

      const { data, error } = await user.client.storage.from('documents').download(otherPath)
      expect(data).toBeNull()
      expect(error).toBeTruthy()
    } finally {
      await deleteTestUser(other)
    }
  }, 60_000)

  it('deleting user via admin removes their documents', async () => {
    const { data: doc } = await user.client
      .from('documents')
      .insert({
        user_id: user.id,
        file_name: 'temp.pdf',
        file_url: 'https://x/temp.pdf',
        file_type: 'application/pdf',
        file_size: 1,
      })
      .select()
      .single()

    const docId = doc!.id

    await deleteTestUser(user)
    user = await retry(() => createTestUser())

    const { data: stillThere } = await supabaseAdmin.from('documents').select('*').eq('id', docId)
    expect(stillThere).toEqual([])
  }, 30_000)
})
