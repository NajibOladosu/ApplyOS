import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()

vi.mock('@/shared/infrastructure/ai/client', () => ({
  isGeminiConfigured: () => true,
  getGenerativeModel: vi.fn(() => ({
    generateContent: mockGenerateContent,
  })),
}))

vi.mock('@/shared/infrastructure/ai/model-manager', () => {
  class AIRateLimitError extends Error {
    constructor(public nextAvailableTime: number, public queued: boolean, message: string) {
      super(message)
      this.name = 'AIRateLimitError'
    }
  }
  return {
    default: {
      getAvailableModel: vi.fn(() => 'gemini-2.0-flash'),
      getNextAvailableTime: vi.fn(() => Date.now() + 60_000),
      markModelRateLimited: vi.fn(),
    },
    AIRateLimitError,
  }
})

vi.mock('@/shared/infrastructure/ai/queue-manager', () => ({
  queueManager: { enqueue: vi.fn() },
}))

vi.mock('@/shared/infrastructure/ai/telemetry', () => ({
  classifyError: vi.fn(() => ({ category: 'unknown', status: 500, message: 'err' })),
  logAICall: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

import { parseDocument, generateAnswer } from '@/shared/infrastructure/ai'

function mockGeminiResponse(text: string) {
  mockGenerateContent.mockResolvedValueOnce({
    response: { text: () => text },
  })
}

describe('parseDocument', () => {
  it('parses JSON response with markdown code fences', async () => {
    mockGeminiResponse(
      '```json\n{"education":[{"institution":"X","degree":"BSc","field":"CS","start_date":"2020","end_date":"2024","description":""}],"experience":[],"projects":[],"skills":{"technical":["ts"],"soft":[],"other":[]},"achievements":[],"certifications":[],"keywords":[],"raw_highlights":[]}\n```'
    )
    const result = await parseDocument('some cv text')
    expect(result.education).toHaveLength(1)
    expect(result.education[0].institution).toBe('X')
    expect(result.skills.technical).toContain('ts')
  })

  it('parses JSON response without code fences', async () => {
    mockGeminiResponse(
      '{"education":[],"experience":[],"projects":[],"skills":{"technical":["js"],"soft":[],"other":[]},"achievements":[],"certifications":[],"keywords":[],"raw_highlights":[]}'
    )
    const result = await parseDocument('text')
    expect(result.skills.technical).toContain('js')
  })

  it('returns empty ParsedDocument when JSON is malformed', async () => {
    mockGeminiResponse('not json at all')
    const result = await parseDocument('text')
    expect(result.education).toEqual([])
    expect(result.experience).toEqual([])
    expect(result.skills.technical).toEqual([])
  })

  it('returns empty ParsedDocument when Gemini errors (catches non-rate-limit errors)', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Generic failure'))
    const result = await parseDocument('text')
    expect(result.education).toEqual([])
  })

  it('normalizes missing fields to empty strings/arrays', async () => {
    mockGeminiResponse(
      '{"education":[{"institution":"X"}],"experience":[],"projects":[],"skills":{},"achievements":[],"certifications":[],"keywords":[],"raw_highlights":[]}'
    )
    const result = await parseDocument('text')
    expect(result.education[0].degree).toBe('')
    expect(result.education[0].field).toBe('')
    expect(result.skills.soft).toEqual([])
  })

  it('extracts experience entries', async () => {
    mockGeminiResponse(
      '{"education":[],"experience":[{"company":"Co","role":"Dev","start_date":"2024","end_date":"2025","description":"work"}],"projects":[],"skills":{"technical":[],"soft":[],"other":[]},"achievements":[],"certifications":[],"keywords":[],"raw_highlights":[]}'
    )
    const result = await parseDocument('text')
    expect(result.experience).toHaveLength(1)
    expect(result.experience[0].company).toBe('Co')
    expect(result.experience[0].role).toBe('Dev')
  })
})

describe('generateAnswer', () => {
  it('returns the Gemini text directly', async () => {
    mockGeminiResponse('My answer to the question.')
    const result = await generateAnswer('Why X?', { resume: 'My resume context' })
    expect(result).toBe('My answer to the question.')
  })

  it('passes context into the prompt (verifies behavior end-to-end)', async () => {
    mockGeminiResponse('answer')
    await generateAnswer('Tell me about your work', { resume: 'I worked at Acme' })
    // Verify getGenerativeModel was called (which means Gemini was invoked)
    expect(mockGenerateContent).toHaveBeenCalledOnce()
    const promptArg = mockGenerateContent.mock.calls[0][0]
    expect(promptArg).toContain('I worked at Acme')
  })

  it('includes anti-hallucination grounding rules in every prompt', async () => {
    mockGeminiResponse('answer')
    await generateAnswer('Why X?', { resume: 'I worked at Acme' })
    const promptArg = mockGenerateContent.mock.calls[0][0]
    expect(promptArg).toContain('Grounding Rules')
    expect(promptArg).toMatch(/Do NOT invent/i)
    // Forbid fabricated quantified achievements
    expect(promptArg).toMatch(/quantified achievement/i)
  })

  it('switches to the no-background path when no resume/experience/education given', async () => {
    mockGeminiResponse('answer')
    await generateAnswer('Why do you want this scholarship?', {})
    const promptArg = mockGenerateContent.mock.calls[0][0]
    expect(promptArg).toContain('(No background provided)')
    expect(promptArg).toMatch(/keep the answer general/i)
  })

  it('injects previously answered questions for cross-question coherence', async () => {
    mockGeminiResponse('answer')
    await generateAnswer('What are your weaknesses?', {
      resume: 'I worked at Acme',
      previousAnswers: [
        { question: 'What are your strengths?', answer: 'I lead teams well.' },
      ],
    })
    const promptArg = mockGenerateContent.mock.calls[0][0]
    expect(promptArg).toContain('Previously answered questions')
    expect(promptArg).toContain('What are your strengths?')
    expect(promptArg).toContain('I lead teams well.')
    expect(promptArg).toMatch(/do NOT repeat the same anecdotes/i)
  })

  it('omits the previous-answers block when none are provided', async () => {
    mockGeminiResponse('answer')
    await generateAnswer('Why X?', { resume: 'I worked at Acme' })
    const promptArg = mockGenerateContent.mock.calls[0][0]
    expect(promptArg).not.toContain('Previously answered questions')
  })
})
