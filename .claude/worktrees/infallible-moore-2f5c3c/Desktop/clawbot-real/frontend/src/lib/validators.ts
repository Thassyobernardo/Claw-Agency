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

// ---------------------------------------------------------------------------
// Australian Business Number (ABN) validation
// ---------------------------------------------------------------------------
// The ATO specifies a Mod-89 checksum for ABNs:
//   1. Subtract 1 from the first digit.
//   2. Multiply each digit by its weight: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19].
//   3. Sum the results.
//   4. Divide by 89 — if the remainder is 0, the ABN is valid.
// Reference: https://abr.business.gov.au/Help/AbnFormat
//
// This is a FORMAT/CHECKSUM check only. It does NOT confirm the ABN is active
// or that it belongs to the registering company — that requires a live lookup
// to the ABN Lookup web service (https://abr.business.gov.au/abrxmlsearch/).

const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;

/** Strip spaces/hyphens from an ABN input */
export function normaliseAbn(abn: unknown): string | null {
  if (typeof abn !== "string") return null;
  const clean = abn.replace(/[\s-]/g, "");
  return /^\d{11}$/.test(clean) ? clean : null;
}

/** Returns true if the string is a well-formed ABN that passes the ATO mod-89 checksum. */
export function isValidAbn(abn: unknown): boolean {
  const clean = normaliseAbn(abn);
  if (!clean) return false;

  const digits = clean.split("").map(Number);
  digits[0] -= 1;                                               // ATO step 1

  const weightedSum = digits.reduce(
    (acc, digit, i) => acc + digit * ABN_WEIGHTS[i],
    0,
  );
  return weightedSum % 89 === 0;
}

/** Throws with a user-friendly message if the ABN is invalid. */
export function assertValidAbn(abn: unknown): string {
  const clean = normaliseAbn(abn);
  if (!clean) {
    throw new Error("ABN must be 11 digits");
  }
  if (!isValidAbn(clean)) {
    throw new Error("ABN checksum is invalid — please double-check the number");
  }
  return clean;
}
