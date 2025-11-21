/**
 * Rate Limiting Middleware
 *
 * Basic in-memory rate limiting for API endpoints.
 *
 * IMPORTANT: This is a single-server solution that stores rate limit data in memory.
 * For production deployments with multiple serverless functions or horizontal scaling,
 * upgrade to Upstash Redis for distributed rate limiting.
 *
 * See TODO_UPSTASH_UPGRADE.md for migration guide.
 */

import { NextRequest, NextResponse } from 'next/server'

// Rate limit configuration
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number

  /**
   * Time window in milliseconds
   */
  windowMs: number

  /**
   * Optional message to return when rate limit is exceeded
   */
  message?: string
}

// Default rate limits for different endpoint types
export const RATE_LIMITS = {
  // General API endpoints: 100 requests per 15 minutes
  general: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many requests. Please try again later.',
  },

  // Upload endpoints: 10 requests per 15 minutes
  upload: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Too many upload requests. Please try again in 15 minutes.',
  },

  // AI endpoints (parse, summarize, etc.): 20 requests per 15 minutes
  ai: {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
    message: 'Too many AI requests. Please try again in 15 minutes.',
  },

  // Auth endpoints (login, signup): 5 requests per 15 minutes
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },

  // Email endpoints: 10 requests per hour
  email: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many email requests. Please try again later.',
  },
} as const

// In-memory storage for rate limit tracking
// Map structure: identifier -> { count, resetTime }
const rateLimitStore = new Map<
  string,
  {
    count: number
    resetTime: number
  }
>()

// Cleanup interval: Remove expired entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

// Start cleanup interval (only runs in Node.js environment, not Edge Runtime)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS)
}

/**
 * Get identifier for rate limiting
 * Prefers user ID (from auth), falls back to IP address
 */
function getIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`
  }

  // Try to get IP from various headers (supports Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0].trim() || real || 'unknown'

  return `ip:${ip}`
}

/**
 * Check if request is rate limited
 * Returns null if allowed, error response if rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  userId?: string
): NextResponse | null {
  const identifier = getIdentifier(request, userId)
  const key = `${identifier}:${request.nextUrl.pathname}`
  const now = Date.now()

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)
  }

  // Increment request count
  entry.count++

  // Check if rate limit exceeded
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000) // seconds

    return NextResponse.json(
      {
        error: config.message || 'Too many requests',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': entry.resetTime.toString(),
        },
      }
    )
  }

  // Request allowed
  return null
}

/**
 * Rate limit middleware wrapper for API routes
 *
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await rateLimitMiddleware(request, RATE_LIMITS.upload)
 *   if (rateLimitResponse) return rateLimitResponse
 *
 *   // ... your API route logic
 * }
 * ```
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig,
  getUserId?: () => Promise<string | undefined>
): Promise<NextResponse | null> {
  // Get user ID if getUserId function is provided
  let userId: string | undefined
  if (getUserId) {
    try {
      userId = await getUserId()
    } catch (error) {
      console.error('Error getting user ID for rate limiting:', error)
      // Continue with IP-based rate limiting
    }
  }

  return checkRateLimit(request, config, userId)
}

/**
 * Get current rate limit status for debugging
 */
export function getRateLimitStatus(
  identifier: string,
  pathname: string
): { count: number; resetTime: number; remaining: number } | null {
  const key = `${identifier}:${pathname}`
  const entry = rateLimitStore.get(key)

  if (!entry) return null

  return {
    count: entry.count,
    resetTime: entry.resetTime,
    remaining: Math.max(0, 100 - entry.count), // Assumes general limit
  }
}

/**
 * Clear rate limit for specific identifier (useful for testing)
 */
export function clearRateLimit(identifier: string, pathname?: string): void {
  if (pathname) {
    const key = `${identifier}:${pathname}`
    rateLimitStore.delete(key)
  } else {
    // Clear all entries for this identifier
    for (const key of rateLimitStore.keys()) {
      if (key.startsWith(identifier)) {
        rateLimitStore.delete(key)
      }
    }
  }
}

/**
 * Get total number of tracked rate limit entries (for monitoring)
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size
}
