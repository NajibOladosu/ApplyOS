import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  userText: vi.fn(),
  geminiModel: vi.fn(),
}))

vi.mock('@/shared/infrastructure/ai/connections', () => ({
  AIConnectionError: class AIConnectionError extends Error {},
  isAIConfigured: vi.fn(async () => true),
  resolveAISource: mocks.resolve,
}))
vi.mock('@/shared/infrastructure/ai/providers', () => ({ generateUserText: mocks.userText }))
vi.mock('@/shared/infrastructure/ai/client', () => ({ getGenerativeModel: mocks.geminiModel }))
vi.mock('@/shared/infrastructure/ai/model-manager', () => ({
  default: { getAvailableModel: vi.fn(() => 'gemini-2.5-flash') },
  AIRateLimitError: class AIRateLimitError extends Error {},
}))
vi.mock('@/shared/infrastructure/ai/telemetry', () => ({
  classifyError: vi.fn(() => ({ category: 'client_error', status: 500, message: 'failed' })),
  logAICall: vi.fn(),
}))

import { callGeminiWithFallback } from '@/shared/infrastructure/ai'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('user-owned AI routing', () => {
  it('uses the selected provider and never calls ApplyOS Gemini', async () => {
    mocks.resolve.mockResolvedValue({ source: 'claude', apiKey: 'private-key' })
    mocks.userText.mockResolvedValue('Draft answer')

    await expect(callGeminiWithFallback('Write an answer')).resolves.toBe('Draft answer')
    expect(mocks.userText).toHaveBeenCalledWith('claude', 'private-key', expect.stringContaining('Write an answer'), 4000)
    expect(mocks.geminiModel).not.toHaveBeenCalled()
  })

  it('fails closed when the selected provider rejects the request', async () => {
    mocks.resolve.mockResolvedValue({ source: 'openai', apiKey: 'private-key' })
    mocks.userText.mockRejectedValue(new Error('quota exhausted'))

    await expect(callGeminiWithFallback('Write an answer')).rejects.toThrow('quota exhausted')
    expect(mocks.geminiModel).not.toHaveBeenCalled()
  })

  it('keeps the existing ApplyOS Gemini path for default users', async () => {
    mocks.resolve.mockResolvedValue({ source: 'applyos', apiKey: null })
    mocks.geminiModel.mockReturnValue({ generateContent: vi.fn(async () => ({ response: { text: () => 'Default answer' } })) })

    await expect(callGeminiWithFallback('Write an answer')).resolves.toBe('Default answer')
    expect(mocks.geminiModel).toHaveBeenCalled()
    expect(mocks.userText).not.toHaveBeenCalled()
  })
})
