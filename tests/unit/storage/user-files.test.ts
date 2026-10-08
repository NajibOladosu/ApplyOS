import { describe, expect, it, vi } from 'vitest'
import { deleteAllUserStorageObjects } from '@/shared/infrastructure/storage/user-files'

const USER = '3f2b9c1e-7a4d-4e8b-9c3a-1234567890ab'

type Entry = { name: string; id: string | null }

function fakeAdmin(files: Record<string, Entry[]>, opts: { listError?: string; removeError?: string } = {}) {
  const removed: Array<{ bucket: string; paths: string[] }> = []
  const listCalls: Array<{ bucket: string; folder: string; offset: number }> = []
  const admin = {
    storage: {
      from: (bucket: string) => ({
        list: vi.fn(async (folder: string, o: { limit: number; offset: number }) => {
          listCalls.push({ bucket, folder, offset: o.offset })
          if (opts.listError) return { data: null, error: { message: opts.listError } }
          const all = files[bucket] ?? []
          return { data: all.slice(o.offset, o.offset + o.limit), error: null }
        }),
        remove: vi.fn(async (paths: string[]) => {
          if (opts.removeError) return { data: null, error: { message: opts.removeError } }
          removed.push({ bucket, paths })
          return { data: [], error: null }
        }),
      }),
    },
  }
  return { admin: admin as never, removed, listCalls }
}

describe('deleteAllUserStorageObjects', () => {
  it('removes every file under the user folder in both buckets', async () => {
    const { admin, removed } = fakeAdmin({
      documents: [{ name: '1700_resume.pdf', id: 'a' }],
      avatars: [{ name: 'avatar', id: 'b' }],
    })
    const result = await deleteAllUserStorageObjects(admin, USER)
    expect(result).toEqual({ removed: 2, skippedFolders: 0 })
    expect(removed).toEqual([
      { bucket: 'documents', paths: [`${USER}/1700_resume.pdf`] },
      { bucket: 'avatars', paths: [`${USER}/avatar`] },
    ])
  })

  it('pages through listings larger than one page', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ name: `f${i}.pdf`, id: `id${i}` }))
    const { admin, removed, listCalls } = fakeAdmin({ documents: many })
    const result = await deleteAllUserStorageObjects(admin, USER)
    expect(result.removed).toBe(250)
    expect(listCalls.filter((c) => c.bucket === 'documents').map((c) => c.offset)).toEqual([0, 100, 200])
    const docRemovals = removed.filter((r) => r.bucket === 'documents')
    expect(docRemovals.map((r) => r.paths.length)).toEqual([100, 100, 50])
  })

  it('reports folders (null id) without deleting them', async () => {
    const { admin, removed } = fakeAdmin({
      documents: [{ name: 'nested', id: null }, { name: 'a.pdf', id: 'x' }],
    })
    const result = await deleteAllUserStorageObjects(admin, USER)
    expect(result).toEqual({ removed: 1, skippedFolders: 1 })
    expect(removed[0].paths).toEqual([`${USER}/a.pdf`])
  })

  it('fails closed when listing fails, so the caller can stop before deleting rows', async () => {
    const { admin } = fakeAdmin({}, { listError: 'boom' })
    await expect(deleteAllUserStorageObjects(admin, USER)).rejects.toThrow(/Listing documents failed/)
  })

  it('fails closed when removal fails', async () => {
    const { admin } = fakeAdmin({ documents: [{ name: 'a.pdf', id: 'x' }] }, { removeError: 'denied' })
    await expect(deleteAllUserStorageObjects(admin, USER)).rejects.toThrow(/Removing from documents failed/)
  })

  it('rejects anything that is not a UUID (no path traversal into other folders)', async () => {
    const { admin } = fakeAdmin({})
    for (const bad of ['', '../other', `${USER}/..`, 'abc', '*']) {
      await expect(deleteAllUserStorageObjects(admin, bad)).rejects.toThrow(/Invalid user id/)
    }
  })

  it('does nothing when the user has no stored files', async () => {
    const { admin, removed } = fakeAdmin({})
    expect(await deleteAllUserStorageObjects(admin, USER)).toEqual({ removed: 0, skippedFolders: 0 })
    expect(removed).toHaveLength(0)
  })
})
