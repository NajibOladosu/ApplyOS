import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSupabase: any = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  single: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
}

vi.mock('@/shared/db/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

import {
  getNotifications,
  getRecentNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
} from '@/lib/services/notifications'

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.from.mockReturnThis()
  mockSupabase.select.mockReturnThis()
  mockSupabase.order.mockReturnThis()
  mockSupabase.limit.mockReturnThis()
  mockSupabase.eq.mockReturnThis()
  mockSupabase.gte.mockReturnThis()
  mockSupabase.update.mockReturnThis()
  mockSupabase.insert.mockReturnThis()
})

describe('getNotifications', () => {
  it('queries notifications ordered desc by created_at, limited to 10', async () => {
    const fake = [{ id: 'n1', message: 'hello' }]
    mockSupabase.limit.mockResolvedValueOnce({ data: fake, error: null })
    const result = await getNotifications()
    expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
    expect(mockSupabase.select).toHaveBeenCalledWith('*')
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockSupabase.limit).toHaveBeenCalledWith(10)
    expect(result).toEqual(fake)
  })

  it('throws on supabase error', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(getNotifications()).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('getRecentNotifications', () => {
  it('filters by created_at >= (now - days) and applies the given limit', async () => {
    const fake = [{ id: 'n1', message: 'hello' }]
    mockSupabase.limit.mockResolvedValueOnce({ data: fake, error: null })
    const before = Date.now()

    const result = await getRecentNotifications(30, 50)

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
    expect(mockSupabase.select).toHaveBeenCalledWith('*')
    const [col, since] = mockSupabase.gte.mock.calls[0]
    expect(col).toBe('created_at')
    // ~30 days before now (allow clock skew between the two calls)
    expect(Date.parse(since)).toBeGreaterThan(before - 30 * 86_400_000 - 5_000)
    expect(Date.parse(since)).toBeLessThanOrEqual(before)
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockSupabase.limit).toHaveBeenCalledWith(50)
    expect(result).toEqual(fake)
  })

  it('defaults to a 30-day window and a 50-row cap', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    await getRecentNotifications()
    expect(mockSupabase.gte).toHaveBeenCalledTimes(1)
    expect(mockSupabase.limit).toHaveBeenCalledWith(50)
  })

  it('throws on supabase error', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(getRecentNotifications(30)).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('markAsRead', () => {
  it('updates is_read=true for given id', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await markAsRead('n1')
    expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
    expect(mockSupabase.update).toHaveBeenCalledWith({ is_read: true })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'n1')
  })

  it('throws on supabase error', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'fail' } })
    await expect(markAsRead('n1')).rejects.toMatchObject({ message: 'fail' })
  })
})

describe('markAllAsRead', () => {
  it('no-ops when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await markAllAsRead()
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })

  it('updates unread notifications for current user', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    // The chain: .from().update().eq('user_id', ...).eq('is_read', false)
    // Second .eq is the final awaited call — return the promise only on that call
    let eqCalls = 0
    mockSupabase.eq.mockImplementation(() => {
      eqCalls++
      if (eqCalls === 2) {
        return Promise.resolve({ error: null })
      }
      return mockSupabase
    })
    await markAllAsRead()
    expect(mockSupabase.update).toHaveBeenCalledWith({ is_read: true })
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockSupabase.eq).toHaveBeenCalledWith('is_read', false)
  })
})

describe('createNotification', () => {
  it('throws if not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(createNotification({ type: 'info', message: 'hi' })).rejects.toThrow('Not authenticated')
  })

  it('inserts notification with user_id when authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    // chain: .from().insert([...]).select().single()
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'n1' }, error: null })
    const result = await createNotification({ type: 'info', message: 'hi' })
    expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
    expect(mockSupabase.insert).toHaveBeenCalledWith([
      { user_id: 'u1', type: 'info', message: 'hi' },
    ])
    expect(result).toMatchObject({ id: 'n1' })
  })

  it('throws on insert error', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'db fail' } })
    await expect(createNotification({ type: 'info', message: 'hi' })).rejects.toMatchObject({ message: 'db fail' })
  })
})
