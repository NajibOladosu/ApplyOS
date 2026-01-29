/**
 * Unit tests for Model Manager
 * Tests model selection, rate limiting, and fallback logic
 */

import { describe, it, expect, beforeEach } from 'vitest'
import ModelManager, { AIRateLimitError } from '@/shared/infrastructure/ai/model-manager'

describe('ModelManager', () => {
    beforeEach(() => {
        // Reset all rate limits before each test
        ModelManager.resetAll()
    })

    describe('getAvailableModel', () => {
        it('should return a model for SIMPLE complexity', () => {
            const model = ModelManager.getAvailableModel('SIMPLE')
            expect(model).toBeTruthy()
            expect(model).toContain('gemini')
        })

        it('should return a model for MEDIUM complexity', () => {
            const model = ModelManager.getAvailableModel('MEDIUM')
            expect(model).toBeTruthy()
            expect(model).toContain('gemini')
        })

        it('should return a model for COMPLEX complexity', () => {
            const model = ModelManager.getAvailableModel('COMPLEX')
            expect(model).toBeTruthy()
            expect(model).toContain('gemini')
        })

        it('should default to MEDIUM complexity', () => {
            const model = ModelManager.getAvailableModel()
            expect(model).toBeTruthy()
        })
    })

    describe('markModelRateLimited', () => {
        it('should mark a model as rate limited', () => {
            const model = ModelManager.getAvailableModel('SIMPLE')
            expect(model).toBeTruthy()

            ModelManager.markModelRateLimited(model!, '60')

            const status = ModelManager.getStatus()
            expect(status[model!].limited).toBe(true)
        })

        it('should use default 60 second timeout when no retry-after provided', () => {
            const model = ModelManager.getAvailableModel('SIMPLE')
            expect(model).toBeTruthy()

            ModelManager.markModelRateLimited(model!)

            const status = ModelManager.getStatus()
            expect(status[model!].limited).toBe(true)
        })
    })

    describe('getAllAvailableModels', () => {
        it('should return all available models when none are rate limited', () => {
            const models = ModelManager.getAllAvailableModels()
            expect(models.length).toBeGreaterThan(0)
        })

        it('should exclude rate limited models', () => {
            const allModels = ModelManager.getAllAvailableModels()
            const modelToLimit = allModels[0]

            ModelManager.markModelRateLimited(modelToLimit, '60')

            const availableAfter = ModelManager.getAllAvailableModels()
            expect(availableAfter).not.toContain(modelToLimit)
        })
    })

    describe('areAllModelsLimited', () => {
        it('should return false when models are available', () => {
            expect(ModelManager.areAllModelsLimited()).toBe(false)
        })
    })

    describe('getNextAvailableTime', () => {
        it('should return current time when models are available', () => {
            const nextTime = ModelManager.getNextAvailableTime()
            expect(nextTime).toBeLessThanOrEqual(Date.now())
        })
    })

    describe('resetModel', () => {
        it('should reset a specific model rate limit', () => {
            const model = ModelManager.getAvailableModel('SIMPLE')
            ModelManager.markModelRateLimited(model!, '60')

            let status = ModelManager.getStatus()
            expect(status[model!].limited).toBe(true)

            ModelManager.resetModel(model!)

            status = ModelManager.getStatus()
            expect(status[model!].limited).toBe(false)
        })
    })

    describe('resetAll', () => {
        it('should reset all model rate limits', () => {
            const models = ModelManager.getAllAvailableModels()
            models.slice(0, 2).forEach(m => ModelManager.markModelRateLimited(m, '60'))

            ModelManager.resetAll()

            expect(ModelManager.areAllModelsLimited()).toBe(false)
        })
    })
})

describe('AIRateLimitError', () => {
    it('should create error with correct properties', () => {
        const nextTime = Date.now() + 60000
        const error = new AIRateLimitError(nextTime, true, 'Test error')

        expect(error.name).toBe('AIRateLimitError')
        expect(error.message).toBe('Test error')
        expect(error.nextAvailableTime).toBe(nextTime)
        expect(error.allModelsLimited).toBe(true)
    })
})
