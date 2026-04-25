/**
 * EcoLink Australia — Input validators & guards.
 *
 * Used by API routes to reject malformed input before it ever
 * reaches the database or business logic.
 */

// UUID v4 regex (also accepts v1-v5 and nil UUID)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true if the string is a valid UUID */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Throws if value is not a valid UUID */
export function assertUuid(value: unknown, fieldName = "id"): string {
  if (!isUuid(value)) {
    throw new Error(`Invalid ${fieldName}: must be a UUID`);
  }
  return value;
}

/** Clamp an integer within [min, max] — safe for LIMIT/OFFSET params */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Strips any HTML tags from a string (extra defence for display) */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

/** Safe email normalisation */
export function normaliseEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}
