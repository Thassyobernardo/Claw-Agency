/**
 * Rate limiter for Next.js API routes.
 *
 * Uses an in-memory Map. This is sufficient for a single-instance deployment
 * (Vercel serverless functions scale per-function, but most traffic in the
 * initial EcoLink launch will hit the same warm instance). If/when we scale
 * to multiple concurrent containers, we can readd a Redis-backed store —
 * previous Redis implementation was removed because the `redis` package was
 * never installed via npm install and blocked Turbopack builds.
 *
 * Current limits (unchanged):
 *  - Login:    5 attempts per 15 minutes per IP
 *  - Register: 3 attempts per hour per IP
 *  - API:      60 requests per minute per IP
 */

// ── In-memory store ─────────────────────────────────────────────────────────

interface Bucket { count: number; resetAt: number }
const store = new Map<string, Bucket>();

/** Purge expired buckets every 5 minutes to prevent memory leaks */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

function memoryCheck(
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
  const allowed   = existing.count <= limit;
  const remaining = Math.max(0, limit - existing.count);
  return { allowed, remaining, resetAt: existing.resetAt };
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Increment the counter for `identifier` and return whether the request is
 * allowed. In-memory only.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return memoryCheck(identifier, limit, windowMs);
}

/**
 * Synchronous variant for call sites that cannot be made async easily
 * (e.g. NextAuth `authorize` callback). Uses the in-memory store only.
 * Prefer `checkRateLimit` everywhere else.
 */
export function checkRateLimitSync(
  identifier: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  return memoryCheck(identifier, limit, windowMs);
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
