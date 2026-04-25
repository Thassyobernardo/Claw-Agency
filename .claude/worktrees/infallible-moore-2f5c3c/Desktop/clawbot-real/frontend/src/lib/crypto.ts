/**
 * EcoLink — Token Encryption
 *
 * AES-256-GCM authenticated encryption for OAuth token storage.
 * Tokens are encrypted before being saved to the database so that a database
 * breach does not expose live API credentials.
 *
 * Key: TOKEN_ENCRYPTION_KEY env var — 64 hex chars = 32 bytes (256 bits).
 * Format stored in DB: { _enc: "iv.tag.ciphertext" } as JSONB.
 *
 * Backwards-compatible: if a row does not have the `_enc` key (legacy plain),
 * parseTokenData returns the raw object so the token still works until the next
 * refresh writes the encrypted form.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { XeroTokenSet } from "./xero";

const ALGORITHM  = "aes-256-gcm";
const IV_BYTES   = 12;   // 96-bit IV — recommended for GCM
const TAG_BYTES  = 16;   // 128-bit authentication tag

// ---------------------------------------------------------------------------
// Key loading
// ---------------------------------------------------------------------------

function loadKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "[crypto] TOKEN_ENCRYPTION_KEY is not set. " +
      "Generate one with: node -e \"require('crypto').randomBytes(32).toString('hex')\" " +
      "and add it to your environment variables."
    );
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "[crypto] TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes / 256 bits)."
    );
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Low-level encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypts a UTF-8 string with AES-256-GCM.
 * Returns "ivHex.tagHex.ciphertextHex".
 */
export function encryptString(plaintext: string): string {
  const key = loadKey();
  const iv  = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(".");
}

/**
 * Decrypts a string produced by encryptString.
 * Throws if the authentication tag is invalid (tampered data).
 */
export function decryptString(encryptedStr: string): string {
  const key = loadKey();
  const parts = encryptedStr.split(".");
  if (parts.length !== 3) {
    throw new Error("[crypto] Invalid encrypted string format — expected iv.tag.ciphertext");
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const iv         = Buffer.from(ivHex,    "hex");
  const tag        = Buffer.from(tagHex,   "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ---------------------------------------------------------------------------
// Token-specific helpers
// ---------------------------------------------------------------------------

/**
 * Serialize a XeroTokenSet as an encrypted JSONB-compatible string.
 * Stored in DB as: { _enc: "iv.tag.cipher" }
 */
export function serializeTokenData(tokens: XeroTokenSet): string {
  const plaintext = JSON.stringify(tokens);
  const encrypted = encryptString(plaintext);
  return JSON.stringify({ _enc: encrypted });
}

/**
 * Parse token data from the DB.
 * Handles both:
 *   - New encrypted format: { _enc: "iv.tag.cipher" }
 *   - Legacy plain format:  { access_token: "...", ... }  (backwards-compatible)
 *
 * Returns null if the value is missing or unparseable.
 */
export function parseTokenData(raw: unknown): XeroTokenSet | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;

  // Encrypted format
  if (typeof obj._enc === "string") {
    try {
      const decrypted = decryptString(obj._enc);
      return JSON.parse(decrypted) as XeroTokenSet;
    } catch (err) {
      console.error("[crypto] Failed to decrypt token:", err);
      return null;
    }
  }

  // Legacy plain format — still usable; will be re-encrypted on next write
  if (typeof obj.access_token === "string") {
    return obj as unknown as XeroTokenSet;
  }

  return null;
}
