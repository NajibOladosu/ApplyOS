import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockStorageBucket = {
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
}

const mockSupabase: any = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  single: vi.fn(),
  auth: { getUser: vi.fn() },
  storage: {
    from: vi.fn(() => mockStorageBucket),
  },
}

vi.mock('@/shared/db/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

import {
  getDocuments,
  getAnalyzedDocuments,
  buildContextFromDocument,
  getDocumentById,
  uploadDocument,
  deleteDocument,
  updateDocumentParsedData,
} from '@/modules/documents/services/document.service'

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.from.mockReturnThis()
  mockSupabase.select.mockReturnThis()
  mockSupabase.order.mockReturnThis()
  mockSupabase.eq.mockReturnThis()
  mockSupabase.insert.mockReturnThis()
  mockSupabase.update.mockReturnThis()
  mockSupabase.delete.mockReturnThis()
  mockSupabase.storage.from.mockReturnValue(mockStorageBucket)
})

describe('getDocuments', () => {
  it('queries documents ordered desc by created_at', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [{ id: 'd1' }], error: null })
    const result = await getDocuments()
    expect(mockSupabase.from).toHaveBeenCalledWith('documents')
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([{ id: 'd1' }])
  })

  it('throws on supabase error', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(getDocuments()).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('getAnalyzedDocuments', () => {
  it('filters out docs without success status or null parsed_data', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { id: 'd1', analysis_status: 'success', parsed_data: { a: 1 } },
        { id: 'd2', analysis_status: 'success', parsed_data: null },
        { id: 'd3', analysis_status: 'failed', parsed_data: { a: 1 } },
        { id: 'd4', analysis_status: 'pending', parsed_data: null },
      ],
      error: null,
    })
    const result = await getAnalyzedDocuments()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('d1')
  })

  it('returns empty array when no docs', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [], error: null })
    expect(await getAnalyzedDocuments()).toEqual([])
  })
})

describe('buildContextFromDocument', () => {
  it('returns empty object when parsed_data is missing', () => {
    expect(buildContextFromDocument({ id: 'x', parsed_data: null } as any)).toEqual({
      resume: undefined,
      experience: undefined,
      education: undefined,
    })
  })

  it('formats experience strings', () => {
    const doc: any = {
      parsed_data: {
        experience: [
          { role: 'Eng', company: 'X', start_date: '2024', end_date: '2025', description: 'did stuff' },
        ],
      },
    }
    const ctx = buildContextFromDocument(doc)
    expect(ctx.experience).toContain('Eng at X')
    expect(ctx.experience).toContain('did stuff')
    expect(ctx.resume).toContain('Experience:')
  })

  it('formats education strings', () => {
    const doc: any = {
      parsed_data: {
        education: [
          { degree: 'BSc', field: 'CS', institution: 'Y', start_date: '2018', end_date: '2022', description: 'graduated' },
        ],
      },
    }
    const ctx = buildContextFromDocument(doc)
    expect(ctx.education).toContain('BSc in CS from Y')
    expect(ctx.resume).toContain('Education:')
  })

  it('joins all skill categories into resume', () => {
    const doc: any = {
      parsed_data: {
        skills: { technical: ['ts', 'react'], soft: ['leadership'], other: ['ux'] },
      },
    }
    const ctx = buildContextFromDocument(doc)
    expect(ctx.resume).toMatch(/Skills: ts, react, leadership, ux/)
  })

  it('combines experience + education + skills into resume', () => {
    const doc: any = {
      parsed_data: {
        experience: [{ role: 'Eng', company: 'X', start_date: '2024', end_date: '2025', description: 'work' }],
        education: [{ degree: 'BSc', field: 'CS', institution: 'Y', start_date: '2018', end_date: '2022', description: 'study' }],
        skills: { technical: ['ts'], soft: [], other: [] },
      },
    }
    const ctx = buildContextFromDocument(doc)
    expect(ctx.resume).toContain('Experience:')
    expect(ctx.resume).toContain('Education:')
    expect(ctx.resume).toContain('Skills: ts')
  })
})

describe('getDocumentById', () => {
  it('returns single doc by id', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'd1' }, error: null })
    const result = await getDocumentById('d1')
    expect(mockSupabase.from).toHaveBeenCalledWith('documents')
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'd1')
    expect(result.id).toBe('d1')
  })

  it('throws on error', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    await expect(getDocumentById('d1')).rejects.toMatchObject({ message: 'not found' })
  })
})

describe('uploadDocument', () => {
  const fakeFile = new File(['hello'], 'cv.pdf', { type: 'application/pdf' })

  it('throws when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(uploadDocument(fakeFile)).rejects.toThrow('Not authenticated')
  })

  it('uploads file, gets public URL, inserts row', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    mockStorageBucket.upload.mockResolvedValueOnce({ data: { path: 'u1/...' }, error: null })
    mockStorageBucket.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://x/cv.pdf' } })
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'd1' }, error: null })

    const result = await uploadDocument(fakeFile)
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('documents')
    expect(mockStorageBucket.upload).toHaveBeenCalled()
    expect(mockSupabase.from).toHaveBeenCalledWith('documents')
    expect(mockSupabase.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'u1',
        file_name: 'cv.pdf',
        file_url: 'https://x/cv.pdf',
        file_type: 'application/pdf',
      }),
    ])
    expect(result).toMatchObject({ id: 'd1' })
  })

  it('throws when storage upload fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    mockStorageBucket.upload.mockResolvedValueOnce({ data: null, error: { message: 'storage fail' } })
    await expect(uploadDocument(fakeFile)).rejects.toMatchObject({ message: 'storage fail' })
  })

  it('throws when db insert fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    mockStorageBucket.upload.mockResolvedValueOnce({ data: { path: 'u1/...' }, error: null })
    mockStorageBucket.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://x/cv.pdf' } })
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'db fail' } })
    await expect(uploadDocument(fakeFile)).rejects.toMatchObject({ message: 'db fail' })
  })
})

describe('deleteDocument', () => {
  it('removes file from storage then deletes db row', async () => {
    mockStorageBucket.remove.mockResolvedValueOnce({ error: null })
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await deleteDocument('d1', 'https://x.supabase.co/storage/v1/object/sign/documents/u1/file.pdf')
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('documents')
    expect(mockStorageBucket.remove).toHaveBeenCalled()
    expect(mockSupabase.delete).toHaveBeenCalled()
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'd1')
  })

  it('continues to delete db row even when storage fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockStorageBucket.remove.mockResolvedValueOnce({ error: { message: 'storage fail' } })
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await deleteDocument('d1', 'https://x/u1/file.pdf')
    expect(mockSupabase.delete).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('throws when db delete fails', async () => {
    mockStorageBucket.remove.mockResolvedValueOnce({ error: null })
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db delete fail' } })
    await expect(deleteDocument('d1', 'https://x/u1/file.pdf')).rejects.toMatchObject({ message: 'db delete fail' })
  })
})

describe('updateDocumentParsedData', () => {
  it('updates parsed_data column for given id', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'd1' }, error: null })
    await updateDocumentParsedData('d1', { skills: ['ts'] })
    expect(mockSupabase.update).toHaveBeenCalledWith({ parsed_data: { skills: ['ts'] } })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'd1')
  })

  it('throws on error', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    await expect(updateDocumentParsedData('d1', {})).rejects.toMatchObject({ message: 'fail' })
  })
})
