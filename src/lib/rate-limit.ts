import { trustProxy } from "./env";

/**
 * In-memory fixed-window rate limiter. Counters live only in process memory and are keyed by
 * a client address that is never written to the database or logs.
 *
 * Limitation: state is per Node process. A single-process deployment (the Hostinger Node.js
 * default) is fully covered; for multiple instances move this to Redis/Upstash.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    // Hard cap so a flood of unique keys cannot exhaust memory.
    if (buckets.size > 50_000) buckets.clear();
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  b.count++;
  return { ok: true };
}

export function resetRateLimits() {
  buckets.clear();
}

export function clientKey(req: Request): string {
  if (trustProxy()) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "direct";
}

export const LIMITS = {
  session: { limit: 30, windowMs: 10 * 60_000 },
  event: { limit: 60, windowMs: 10 * 60_000 },
  suggest: { limit: 8, windowMs: 10 * 60_000 },
  feedback: { limit: 5, windowMs: 60 * 60_000 },
  login: { limit: 5, windowMs: 15 * 60_000 },
  admin: { limit: 600, windowMs: 10 * 60_000 },
} as const;
