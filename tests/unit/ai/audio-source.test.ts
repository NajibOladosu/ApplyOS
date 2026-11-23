import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  applyosClient: vi.fn(),
  userGeminiContent: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/shared/infrastructure/ai/connections', () => ({
  AIConnectionError: class AIConnectionError extends Error {},
  resolveAISource: mocks.resolve,
}))
vi.mock('@/shared/infrastructure/ai/client', () => ({ getGeminiClient: mocks.applyosClient }))
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() { return { generateContent: mocks.userGeminiContent } }
  },
}))

import { transcribeAudio } from '@/shared/infrastructure/ai-audio'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('user-owned audio routing', () => {
  it('transcribes with the selected OpenAI API account', async () => {
    mocks.resolve.mockResolvedValue({ source: 'openai', apiKey: 'user-audio-key' })
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'Interview answer' }) })
    vi.stubGlobal('fetch', fetch)

    await expect(transcribeAudio(Buffer.from('sound').toString('base64'), { mimeType: 'audio/wav' }))
      .resolves.toMatchObject({ text: 'Interview answer' })
    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/audio/transcriptions', expect.objectContaining({
      headers: { authorization: 'Bearer user-audio-key' },
    }))
    expect(mocks.applyosClient).not.toHaveBeenCalled()
  })

  it('reports a selected Gemini key failure without using ApplyOS Gemini', async () => {
    mocks.resolve.mockResolvedValue({ source: 'gemini', apiKey: 'user-audio-key' })
    mocks.userGeminiContent.mockRejectedValue(new Error('quota exhausted'))

    await expect(transcribeAudio(Buffer.from('sound').toString('base64'), { mimeType: 'audio/wav' }))
      .rejects.toThrow('Your audio connection failed')
    expect(mocks.applyosClient).not.toHaveBeenCalled()
  })
})
