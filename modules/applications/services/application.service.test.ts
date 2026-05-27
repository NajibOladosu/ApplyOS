import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    getApplications,
    createApplication,
    deleteApplications,
    updateApplicationsStatus,
} from './application.service'

// Mock Supabase client
const mockSupabase: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    single: vi.fn(),
    auth: {
        getUser: vi.fn(),
    },
}

vi.mock('@/shared/db/supabase/client', () => ({
    createClient: () => mockSupabase,
}))

describe('Application Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fetches applications correctly', async () => {
        const mockData = [{ id: '1', title: 'Test Job' }]
        mockSupabase.from().select().order.mockResolvedValueOnce({ data: mockData, error: null })

        const result = await getApplications()

        expect(mockSupabase.from).toHaveBeenCalledWith('applications')
        expect(result).toEqual(mockData)
    })

    it('creates an application with a user session', async () => {
        const mockUser = { id: 'user-123' }
        const mockApp = { title: 'Software Engineer', company: 'Google' }
        const createdApp = { id: 'app-1', user_id: 'user-123', ...mockApp }

        mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null })
        mockSupabase.from().insert().single.mockResolvedValueOnce({ data: createdApp, error: null })

        const result = await createApplication(mockApp)

        expect(mockSupabase.from).toHaveBeenCalledWith('applications')
        expect(mockSupabase.from().insert).toHaveBeenCalledWith([
            { user_id: 'user-123', ...mockApp }
        ])
        expect(result).toEqual(createdApp)
    })

    it('throws error if user is not authenticated during creation', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

        await expect(createApplication({ title: 'Test' }))
            .rejects.toThrow('Not authenticated')
    })

    describe('deleteApplications', () => {
        it('calls supabase delete with .in() on provided ids', async () => {
            mockSupabase.in.mockResolvedValueOnce({ error: null })

            await deleteApplications(['id1', 'id2'])

            expect(mockSupabase.from).toHaveBeenCalledWith('applications')
            expect(mockSupabase.delete).toHaveBeenCalled()
            expect(mockSupabase.in).toHaveBeenCalledWith('id', ['id1', 'id2'])
        })

        it('no-op for empty array', async () => {
            await deleteApplications([])

            expect(mockSupabase.from).not.toHaveBeenCalled()
            expect(mockSupabase.delete).not.toHaveBeenCalled()
            expect(mockSupabase.in).not.toHaveBeenCalled()
        })

        it('throws on supabase error', async () => {
            mockSupabase.in.mockResolvedValueOnce({ error: { message: 'boom' } })

            await expect(deleteApplications(['id1'])).rejects.toEqual({ message: 'boom' })
        })
    })

    describe('updateApplicationsStatus', () => {
        it('updates status for all provided ids in a single query', async () => {
            mockSupabase.in.mockResolvedValueOnce({ error: null })

            await updateApplicationsStatus(['id1', 'id2'], 'submitted')

            expect(mockSupabase.from).toHaveBeenCalledWith('applications')
            expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'submitted' })
            expect(mockSupabase.in).toHaveBeenCalledWith('id', ['id1', 'id2'])
        })

        it('no-op for empty array', async () => {
            await updateApplicationsStatus([], 'draft')

            expect(mockSupabase.from).not.toHaveBeenCalled()
            expect(mockSupabase.update).not.toHaveBeenCalled()
        })

        it('throws on supabase error', async () => {
            mockSupabase.in.mockResolvedValueOnce({ error: { message: 'boom' } })

            await expect(updateApplicationsStatus(['id1'], 'rejected')).rejects.toEqual({ message: 'boom' })
        })
    })
})

import {
    getApplication,
    updateApplication,
    deleteApplication,
    getApplicationStats,
    getApplicationDocuments,
    getApplicationDocumentDetails,
    addApplicationDocument,
    removeApplicationDocument,
    updateApplicationDocuments,
} from './application.service'

describe('getApplication', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.select.mockReturnThis()
        mockSupabase.eq.mockReturnThis()
    })

    it('returns single application by id', async () => {
        mockSupabase.single.mockResolvedValueOnce({ data: { id: 'a1', title: 'X' }, error: null })
        const result = await getApplication('a1')
        expect(mockSupabase.from).toHaveBeenCalledWith('applications')
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'a1')
        expect(result).toEqual({ id: 'a1', title: 'X' })
    })

    it('throws on supabase error', async () => {
        mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
        await expect(getApplication('missing')).rejects.toMatchObject({ message: 'not found' })
    })
})

describe('updateApplication', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.update.mockReturnThis()
        mockSupabase.eq.mockReturnThis()
        mockSupabase.select.mockReturnThis()
    })

    it('updates by id and returns updated row', async () => {
        mockSupabase.single.mockResolvedValueOnce({ data: { id: 'a1', status: 'submitted' }, error: null })
        const result = await updateApplication('a1', { status: 'submitted' } as any)
        expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'submitted' })
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'a1')
        expect(result.status).toBe('submitted')
    })

    it('throws on error', async () => {
        mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'denied' } })
        await expect(updateApplication('a1', { status: 'submitted' } as any)).rejects.toMatchObject({ message: 'denied' })
    })
})

describe('deleteApplication', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.delete.mockReturnThis()
    })

    it('deletes by id', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ error: null })
        await deleteApplication('a1')
        expect(mockSupabase.from).toHaveBeenCalledWith('applications')
        expect(mockSupabase.delete).toHaveBeenCalled()
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'a1')
    })

    it('throws on error', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'fail' } })
        await expect(deleteApplication('a1')).rejects.toMatchObject({ message: 'fail' })
    })
})

describe('getApplicationStats', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.select.mockReturnThis()
        mockSupabase.gte.mockReturnThis()
        mockSupabase.lte.mockReturnThis()
    })

    it('returns counts of total, pending, and upcoming deadlines', async () => {
        // First call: .select('status, created_at') returns array
        mockSupabase.select.mockResolvedValueOnce({
            data: [
                { status: 'draft', created_at: '' },
                { status: 'in_review', created_at: '' },
                { status: 'in_review', created_at: '' },
                { status: 'offer', created_at: '' },
            ],
            error: null,
        })
        // Second call: .select('deadline').gte().lte() returns deadline array
        mockSupabase.lte.mockResolvedValueOnce({
            data: [{ deadline: '2026-06-01' }, { deadline: '2026-06-02' }],
            error: null,
        })

        const stats = await getApplicationStats()
        expect(stats.total).toBe(4)
        expect(stats.pending).toBe(2)
        expect(stats.upcomingDeadlines).toBe(2)
    })

    it('handles empty data', async () => {
        mockSupabase.select.mockResolvedValueOnce({ data: [], error: null })
        mockSupabase.lte.mockResolvedValueOnce({ data: [], error: null })
        const stats = await getApplicationStats()
        expect(stats).toEqual({ total: 0, pending: 0, upcomingDeadlines: 0 })
    })

    it('throws on initial supabase error', async () => {
        mockSupabase.select.mockResolvedValueOnce({ data: null, error: { message: 'db down' } })
        await expect(getApplicationStats()).rejects.toMatchObject({ message: 'db down' })
    })
})

describe('getApplicationDocuments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.select.mockReturnThis()
    })

    it('returns array of document ids for given application', async () => {
        mockSupabase.eq.mockResolvedValueOnce({
            data: [{ document_id: 'd1' }, { document_id: 'd2' }],
            error: null,
        })
        const result = await getApplicationDocuments('a1')
        expect(mockSupabase.from).toHaveBeenCalledWith('application_documents')
        expect(mockSupabase.eq).toHaveBeenCalledWith('application_id', 'a1')
        expect(result).toEqual(['d1', 'd2'])
    })

    it('returns empty array when no documents', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null })
        expect(await getApplicationDocuments('a1')).toEqual([])
    })

    it('throws on error', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ data: null, error: { message: 'oh no' } })
        await expect(getApplicationDocuments('a1')).rejects.toMatchObject({ message: 'oh no' })
    })
})

describe('getApplicationDocumentDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.select.mockReturnThis()
    })

    it('returns document analysis details for an application', async () => {
        const mockDetails = [{ document_id: 'd1', analysis_result: {}, analysis_status: 'done', summary_generated_at: null }]
        mockSupabase.eq.mockResolvedValueOnce({ data: mockDetails, error: null })
        const result = await getApplicationDocumentDetails('a1')
        expect(mockSupabase.from).toHaveBeenCalledWith('document_analyses')
        expect(mockSupabase.eq).toHaveBeenCalledWith('application_id', 'a1')
        expect(result).toEqual(mockDetails)
    })

    it('returns empty array when no details found', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null })
        const result = await getApplicationDocumentDetails('a1')
        expect(result).toEqual([])
    })

    it('throws on error', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ data: null, error: { message: 'query failed' } })
        await expect(getApplicationDocumentDetails('a1')).rejects.toMatchObject({ message: 'query failed' })
    })
})

describe('addApplicationDocument', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.insert.mockReturnThis()
    })

    it('inserts application_documents link row', async () => {
        mockSupabase.insert.mockResolvedValueOnce({ error: null })
        await addApplicationDocument('a1', 'd1')
        expect(mockSupabase.from).toHaveBeenCalledWith('application_documents')
        expect(mockSupabase.insert).toHaveBeenCalledWith([
            { application_id: 'a1', document_id: 'd1' },
        ])
    })

    it('throws on insert error', async () => {
        mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'fail' } })
        await expect(addApplicationDocument('a1', 'd1')).rejects.toMatchObject({ message: 'fail' })
    })
})

describe('removeApplicationDocument', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.delete.mockReturnThis()
        mockSupabase.eq.mockReturnThis()
    })

    it('deletes link by both application_id and document_id', async () => {
        let eqCalls = 0
        mockSupabase.eq.mockImplementation(() => {
            eqCalls++
            if (eqCalls === 2) return Promise.resolve({ error: null })
            return mockSupabase
        })
        await removeApplicationDocument('a1', 'd1')
        expect(mockSupabase.from).toHaveBeenCalledWith('application_documents')
        expect(mockSupabase.eq).toHaveBeenCalledWith('application_id', 'a1')
        expect(mockSupabase.eq).toHaveBeenCalledWith('document_id', 'd1')
    })
})

describe('updateApplicationDocuments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockReturnThis()
        mockSupabase.delete.mockReturnThis()
        mockSupabase.eq.mockReturnThis()
        mockSupabase.insert.mockReturnThis()
    })

    it('deletes existing relationships and inserts new ones', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ error: null })
        mockSupabase.insert.mockResolvedValueOnce({ error: null })
        await updateApplicationDocuments('a1', ['d1', 'd2'])
        expect(mockSupabase.delete).toHaveBeenCalled()
        expect(mockSupabase.insert).toHaveBeenCalledWith([
            { application_id: 'a1', document_id: 'd1' },
            { application_id: 'a1', document_id: 'd2' },
        ])
    })

    it('skips insert when documentIds is empty', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ error: null })
        await updateApplicationDocuments('a1', [])
        expect(mockSupabase.insert).not.toHaveBeenCalled()
    })

    it('throws on delete error', async () => {
        mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'delete failed' } })
        await expect(updateApplicationDocuments('a1', ['d1'])).rejects.toMatchObject({ message: 'delete failed' })
    })
})
