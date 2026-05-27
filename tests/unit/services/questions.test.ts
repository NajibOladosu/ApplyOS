import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSupabase: any = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

vi.mock('@/shared/db/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

import {
  getQuestionsByApplicationId,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '@/modules/interviews/services/question.service'

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.from.mockReturnThis()
  mockSupabase.select.mockReturnThis()
  mockSupabase.eq.mockReturnThis()
  mockSupabase.order.mockReturnThis()
  mockSupabase.insert.mockReturnThis()
  mockSupabase.update.mockReturnThis()
  mockSupabase.delete.mockReturnThis()
})

describe('getQuestionsByApplicationId', () => {
  it('selects questions filtered by application_id, ordered asc', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [{ id: 'q1' }], error: null })
    const result = await getQuestionsByApplicationId('a1')
    expect(mockSupabase.from).toHaveBeenCalledWith('questions')
    expect(mockSupabase.select).toHaveBeenCalledWith('*')
    expect(mockSupabase.eq).toHaveBeenCalledWith('application_id', 'a1')
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toEqual([{ id: 'q1' }])
  })

  it('returns empty array when no questions', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [], error: null })
    expect(await getQuestionsByApplicationId('a1')).toEqual([])
  })

  it('throws on supabase error', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(getQuestionsByApplicationId('a1')).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('createQuestion', () => {
  it('inserts question with null defaults for answers', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'q1' }, error: null })
    const result = await createQuestion({
      application_id: 'a1',
      question_text: 'Why X?',
    })
    expect(mockSupabase.from).toHaveBeenCalledWith('questions')
    expect(mockSupabase.insert).toHaveBeenCalledWith([
      {
        application_id: 'a1',
        question_text: 'Why X?',
        ai_answer: null,
        manual_answer: null,
      },
    ])
    expect(result).toMatchObject({ id: 'q1' })
  })

  it('preserves provided ai_answer + manual_answer', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'q1' }, error: null })
    await createQuestion({
      application_id: 'a1',
      question_text: 'Why X?',
      ai_answer: 'AI says ...',
      manual_answer: 'I say ...',
    })
    expect(mockSupabase.insert).toHaveBeenCalledWith([
      {
        application_id: 'a1',
        question_text: 'Why X?',
        ai_answer: 'AI says ...',
        manual_answer: 'I say ...',
      },
    ])
  })

  it('throws on insert error', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    await expect(
      createQuestion({ application_id: 'a1', question_text: 'Q?' })
    ).rejects.toMatchObject({ message: 'fail' })
  })
})

describe('updateQuestion', () => {
  it('updates question by id', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'q1', manual_answer: 'new' }, error: null })
    const result = await updateQuestion('q1', { manual_answer: 'new' } as any)
    expect(mockSupabase.from).toHaveBeenCalledWith('questions')
    expect(mockSupabase.update).toHaveBeenCalledWith({ manual_answer: 'new' })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'q1')
    expect(result).toMatchObject({ id: 'q1', manual_answer: 'new' })
  })

  it('throws on error', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    await expect(updateQuestion('q1', {} as any)).rejects.toMatchObject({ message: 'fail' })
  })
})

describe('deleteQuestion', () => {
  it('deletes question by id', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await deleteQuestion('q1')
    expect(mockSupabase.from).toHaveBeenCalledWith('questions')
    expect(mockSupabase.delete).toHaveBeenCalled()
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'q1')
  })

  it('throws on error', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'fail' } })
    await expect(deleteQuestion('q1')).rejects.toMatchObject({ message: 'fail' })
  })
})
