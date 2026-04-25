/**
 * In-memory rate limiter for Next.js API routes.
 *
 * In production, swap this for Redis (e.g. upstash/ratelimit) so the
 * counter works across multiple serverless instances.
 *
 * Current limits:
 *  - Login: 5 attempts per 15 minutes per IP
 *  - API:   60 requests per minute per IP
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/** Purge expired buckets every 5 minutes to prevent memory leaks */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(identifier);

  if (!existing || now > existing.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  existing.count += 1;
  const allowed    = existing.count <= limit;
  const remaining  = Math.max(0, limit - existing.count);
  return { allowed, remaining, resetAt: existing.resetAt };
}

/** Extract a best-effort client IP from a Next.js Request */
export function getClientIp(req: Request): string {
  const headers = new Headers((req as any).headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
