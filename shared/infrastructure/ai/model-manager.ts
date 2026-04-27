/**
 * Model Manager for Gemini AI
 *
 * Manages multiple Gemini models with fallback logic, rate limit tracking,
 * and intelligent model selection based on task complexity.
 *
 * Updated: Expanded model pool to reduce rate limit impact
 * - Added Gemini 3 preview models as fallbacks
 * - Added "latest" aliases for automatic updates
 * - Diversified fallback chains across model families
 */

import { isModelAvailableSync, getValidatedModels } from './model-validator'

type TaskComplexity = 'SIMPLE' | 'MEDIUM' | 'COMPLEX'

/**
 * Specialized model identifiers for tasks that cannot use the text-only
 * fallback chain (multimodal audio, real-time bidirectional streaming).
 *
 * These are kept centralized so model upgrades happen in one place.
 */
export const SPECIALIZED_MODELS = {
  /** Real-time bidirectional audio (Gemini Live WebSocket API). */
  LIVE_AUDIO: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
  /** One-shot audio transcription via inlineData. */
  AUDIO_TRANSCRIPTION: 'models/gemini-2.5-flash',
} as const

interface ModelTier {
  models: string[]
  complexity: TaskComplexity
}

interface RateLimitTracker {
  model: string
  limitedUntil: number | null
  retryAfter: number | null
}

// Model tiers by complexity - Diversified to reduce rate limit impact
// Each tier has multiple fallback options across different model families
const MODEL_TIERS: Record<TaskComplexity, ModelTier> = {
  SIMPLE: {
    complexity: 'SIMPLE',
    models: [
      'models/gemini-2.5-flash-lite',      // Primary: fast, cheap (30 RPM)
      'models/gemini-flash-lite-latest',   // Latest alias fallback
      'models/gemini-2.5-flash',           // Upgrade fallback if lite exhausted
      'models/gemini-3-flash-preview',     // Gemini 3 fallback
    ],
  },
  MEDIUM: {
    complexity: 'MEDIUM',
    models: [
      'models/gemini-2.5-flash',           // Primary (15 RPM)
      'models/gemini-flash-latest',        // Latest alias
      'models/gemini-3-flash-preview',     // Gemini 3 fallback
      'models/gemini-2.5-flash-lite',      // Downgrade fallback
      'models/gemini-flash-lite-latest',   // Latest lite fallback
    ],
  },
  COMPLEX: {
    complexity: 'COMPLEX',
    models: [
      'models/gemini-2.5-pro',             // Primary for quality (2 RPM)
      'models/gemini-pro-latest',          // Latest alias
      'models/gemini-3-pro-preview',       // Gemini 3 Pro fallback
      'models/gemini-2.5-flash',           // Quality fallback (still good)
      'models/gemini-3-flash-preview',     // Gemini 3 Flash fallback
      'models/gemini-flash-latest',        // Last resort
    ],
  },
}

// In-memory rate limit tracker
const rateLimitTracker: Map<string, RateLimitTracker> = new Map()

// Initialize all unique models from all tiers
const allModels = [...new Set([
  ...MODEL_TIERS.SIMPLE.models,
  ...MODEL_TIERS.MEDIUM.models,
  ...MODEL_TIERS.COMPLEX.models,
])]

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

      // Skip models the live API does not advertise (validator fails open if cache empty)
      if (!isModelAvailableSync(model)) continue

      if (!tracker.limitedUntil || tracker.limitedUntil <= now) {
        tracker.limitedUntil = null
        tracker.retryAfter = null
        return model
      }
    }

    return null
  }

  /**
   * Warm the validator cache. Safe to call at boot or before first AI request.
   */
  static async warmValidatorCache(): Promise<void> {
    await getValidatedModels()
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

  }
}

export default ModelManager
