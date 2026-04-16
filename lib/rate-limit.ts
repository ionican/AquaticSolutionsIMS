/**
 * Simple in-memory sliding-window rate limiter.
 * At this app's scale, in-memory is fine — no Redis needed.
 * State resets on server restart, which is acceptable.
 */

interface RateWindow {
  timestamps: number[]
}

// Map of "userId:method:path" → window
const windows = new Map<string, RateWindow>()

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - 3600_000 // Remove entries older than 1 hour
  for (const [key, window] of windows) {
    window.timestamps = window.timestamps.filter((t) => t > cutoff)
    if (window.timestamps.length === 0) windows.delete(key)
  }
}

/**
 * Check and consume a rate limit token.
 * @returns null if allowed, or a Response with 429 if rate-limited.
 */
export function checkRateLimit(
  userId: string,
  method: string,
  path: string,
  maxRequests: number,
  windowSeconds: number
): Response | null {
  cleanup()

  // Normalize path: strip dynamic segments like /api/jobs/123 → /api/jobs
  const normalizedPath = path.replace(/\/\d+/g, "")
  const key = `${userId}:${method}:${normalizedPath}`
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  let window = windows.get(key)
  if (!window) {
    window = { timestamps: [] }
    windows.set(key, window)
  }

  // Remove timestamps outside the current window
  window.timestamps = window.timestamps.filter((t) => t > now - windowMs)

  if (window.timestamps.length >= maxRequests) {
    const oldestInWindow = window.timestamps[0]
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000)
    return Response.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    )
  }

  window.timestamps.push(now)
  return null
}
