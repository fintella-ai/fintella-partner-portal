// ---------------------------------------------------------------------------
// Public Tariff API — IP-based rate limiter
//
// In-memory sliding window: 60 requests per IP per 60-second window.
// Resets automatically after the window expires.
// ---------------------------------------------------------------------------

const ipRequests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export function checkPublicRateLimit(ip: string): {
  ok: boolean;
  remaining: number;
  retryAfterMs?: number;
} {
  const now = Date.now();
  const entry = ipRequests.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1 };
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    return { ok: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  return { ok: true, remaining: MAX_REQUESTS - entry.count };
}
