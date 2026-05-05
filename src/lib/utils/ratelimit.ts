/**
 * Simple in-memory rate limiter for API routes
 * Prevents hammering free external APIs
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 300_000)

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address or route name)
 * @param config - Rate limit configuration
 * @returns true if rate limit exceeded, false otherwise
 */
export function isRateLimited(
  identifier: string,
  config: RateLimitConfig
): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || entry.resetAt < now) {
    // First request or window expired - reset
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    return false
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return true
  }

  // Increment count
  entry.count++
  return false
}

/**
 * Get rate limit info for a request
 */
export function getRateLimitInfo(identifier: string) {
  const entry = rateLimitStore.get(identifier)
  if (!entry) {
    return { remaining: Infinity, resetAt: null }
  }

  const now = Date.now()
  if (entry.resetAt < now) {
    return { remaining: Infinity, resetAt: null }
  }

  return {
    remaining: Math.max(0, entry.resetAt - now),
    resetAt: new Date(entry.resetAt).toISOString(),
  }
}

/**
 * Standard rate limit configs for different API types
 */
export const RATE_LIMITS = {
  // Environmental data - cached heavily, allow frequent checks
  ENV_API: { maxRequests: 60, windowMs: 60_000 }, // 60 req/min
  
  // Forex data - updates frequently
  FOREX_API: { maxRequests: 120, windowMs: 60_000 }, // 120 req/min
  
  // AI analysis - expensive, limit strictly
  AI_API: { maxRequests: 10, windowMs: 60_000 }, // 10 req/min
  
  // General API
  GENERAL: { maxRequests: 100, windowMs: 60_000 }, // 100 req/min
} as const
