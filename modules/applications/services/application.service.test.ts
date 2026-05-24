import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    getApplications,
    createApplication,
    deleteApplications,
    updateApplicationsStatus,
} from './application.service'

// Mock Supabase client
const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    in: vi.fn(),
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
