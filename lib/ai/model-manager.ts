/**
 * Model Manager for Gemini AI
 *
 * Manages multiple Gemini models with fallback logic, rate limit tracking,
 * and intelligent model selection based on task complexity.
 */

type TaskComplexity = 'SIMPLE' | 'MEDIUM' | 'COMPLEX'

interface ModelTier {
  models: string[]
  complexity: TaskComplexity
}

interface RateLimitTracker {
  model: string
  limitedUntil: number | null
  retryAfter: number | null
}

// Model tiers by complexity
const MODEL_TIERS: Record<TaskComplexity, ModelTier> = {
  SIMPLE: {
    complexity: 'SIMPLE',
    models: ['models/gemini-2.5-flash-lite', 'models/gemini-2.0-flash-lite'],
  },
  MEDIUM: {
    complexity: 'MEDIUM',
    models: ['models/gemini-2.0-flash', 'models/gemini-2.5-flash', 'models/gemini-2.0-flash-exp'],
  },
  COMPLEX: {
    complexity: 'COMPLEX',
    models: ['models/gemini-2.5-pro', 'models/gemini-2.0-flash', 'models/gemini-2.5-flash'],
  },
}

// In-memory rate limit tracker
const rateLimitTracker: Map<string, RateLimitTracker> = new Map()

// Initialize all models
const allModels = ['models/gemini-2.5-pro', 'models/gemini-2.0-flash', 'models/gemini-2.0-flash-lite', 'models/gemini-2.5-flash-lite', 'models/gemini-2.5-flash', 'models/gemini-2.0-flash-exp']
allModels.forEach((model) => {
  rateLimitTracker.set(model, {
    model,
    limitedUntil: null,
    retryAfter: null,
  })
})

export class AIRateLimitError extends Error {
  constructor(
    public readonly nextAvailableTime: number,
    public readonly allModelsLimited: boolean,
    message: string = 'All AI models are rate limited'
  ) {
    super(message)
    this.name = 'AIRateLimitError'
  }
}

export class ModelManager {
  /**
   * Get the next available model for a given task complexity
   */
  static getAvailableModel(complexity: TaskComplexity = 'MEDIUM'): string | null {
    const tier = MODEL_TIERS[complexity]
    const now = Date.now()

    for (const model of tier.models) {
      const tracker = rateLimitTracker.get(model)
      if (!tracker) continue

      // Check if model is available
      if (!tracker.limitedUntil || tracker.limitedUntil <= now) {
        // Clear the rate limit if time has passed
        tracker.limitedUntil = null
        tracker.retryAfter = null
        return model
      }
    }

    return null
  }

  /**
   * Get all available models (any complexity level)
   */
  static getAllAvailableModels(): string[] {
    const now = Date.now()
    const available: string[] = []

    rateLimitTracker.forEach((tracker) => {
      if (!tracker.limitedUntil || tracker.limitedUntil <= now) {
        tracker.limitedUntil = null
        tracker.retryAfter = null
        available.push(tracker.model)
      }
    })

    return available
  }

  /**
   * Mark a model as rate limited
   * Parses retry-after header if provided
   */
  static markModelRateLimited(model: string, retryAfterHeader?: string | null): void {
    const tracker = rateLimitTracker.get(model)
    if (!tracker) return

    const now = Date.now()
    let retryAfterMs = 60000 // Default 1 minute

    // Try to parse retry-after header
    if (retryAfterHeader) {
      // Retry-After can be in seconds or HTTP-date format
      const seconds = parseInt(retryAfterHeader, 10)
      if (!isNaN(seconds) && seconds > 0) {
        retryAfterMs = seconds * 1000
      }
    }

    tracker.limitedUntil = now + retryAfterMs
    tracker.retryAfter = retryAfterMs

    console.warn(
      `[Model Manager] Model ${model} rate limited until ${new Date(tracker.limitedUntil).toISOString()} (${retryAfterMs}ms from now)`
    )
  }

  /**
   * Get the next time when ANY model will be available
   */
  static getNextAvailableTime(): number {
    const now = Date.now()
    let nextTime = Infinity

    rateLimitTracker.forEach((tracker) => {
      if (tracker.limitedUntil && tracker.limitedUntil > now) {
        nextTime = Math.min(nextTime, tracker.limitedUntil)
      }
    })

    return nextTime === Infinity ? now : nextTime
  }

  /**
   * Check if all models are rate limited
   */
  static areAllModelsLimited(): boolean {
    const now = Date.now()

    for (const tracker of rateLimitTracker.values()) {
      if (!tracker.limitedUntil || tracker.limitedUntil <= now) {
        return false
      }
    }

    return true
  }

  /**
   * Get rate limit status for all models
   */
  static getStatus(): Record<string, { limited: boolean; limitedUntil: number | null; availableIn: string }> {
    const now = Date.now()
    const status: Record<string, any> = {}

    rateLimitTracker.forEach((tracker) => {
      const isLimited = !!tracker.limitedUntil && tracker.limitedUntil > now
      const availableIn = isLimited ? `${Math.ceil((tracker.limitedUntil! - now) / 1000)}s` : 'now'

      status[tracker.model] = {
        limited: isLimited,
        limitedUntil: tracker.limitedUntil,
        availableIn,
      }
    })

    return status
  }

  /**
   * Reset rate limit for a specific model (useful for testing)
   */
  static resetModel(model: string): void {
    const tracker = rateLimitTracker.get(model)
    if (tracker) {
      tracker.limitedUntil = null
      tracker.retryAfter = null
      console.log(`[Model Manager] Reset rate limit for ${model}`)
    }
  }

  /**
   * Reset all models (useful for testing)
   */
  static resetAll(): void {
    rateLimitTracker.forEach((tracker) => {
      tracker.limitedUntil = null
      tracker.retryAfter = null
    })
    console.log('[Model Manager] Reset all rate limits')
  }
}

export default ModelManager
