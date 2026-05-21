import { vi } from 'vitest'

export const mockAiService = {
    generateContent: vi.fn().mockResolvedValue({
        response: {
            text: () => 'Mocked AI response',
        },
    }),
}

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue(mockAiService),
    })),
}))

vi.mock('@/shared/infrastructure/ai/model-manager', () => ({
    modelManager: {
        generateWithRetry: vi.fn().mockResolvedValue('Mocked AI response'),
        getRecommendedModel: vi.fn().mockReturnValue({ id: 'gemini-1.5-flash' }),
    },
}))
