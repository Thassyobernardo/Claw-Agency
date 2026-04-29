/**
 * EcoLink Australia — Manual Entry Types
 *
 * Schema used when a transaction cannot be automatically processed
 * (status = 'needs_review') and requires human physical quantity entry.
 *
 * AASB S2 COMPLIANCE:
 *   Manual entries are the authoritative fallback for AASB S2.29 compliance
 *   when automated extraction fails. Every manual entry must record:
 *     - WHO entered the data (userOverrideId)
 *     - WHAT evidence supports it (evidenceType)
 *     - WHAT was entered (physicalQuantity + unit)
 *   This enables full audit traceability without AI involvement.
 */

/**
 * Payload submitted by the frontend when a user manually completes
 * a transaction that was flagged `needs_review` by the Transaction Router.
 */
export interface ManualEntryPayload {
  /** EcoLink internal transaction UUID — links to the `transactions` table. */
  transactionId: string;

  /**
   * Physical quantity as entered by the user.
   * Must be a positive finite number.
   * AUD amounts are PROHIBITED — this field must contain a physical measure.
   */
  physicalQuantity: number;

  /**
   * Physical unit corresponding to physicalQuantity.
   * Must be one of the NGA Factors 2025 Method 1 accepted units.
   * AUD is not an accepted unit.
   */
  unit: "L" | "kWh" | "GJ" | "m3" | "t" | "kg" | "passenger_km" | "vehicle_km" | "tonne_km";

  /**
   * ID of the authenticated user who entered this data.
   * Required for AASB S2 audit trail — "who authorised this data point?".
   * Maps to `users.id` in the EcoLink database.
   */
  userOverrideId: string;

  /**
   * Type of evidence supporting the manual entry.
   *
   * 'invoice_receipt'  → user uploaded or referenced an original document
   * 'direct_entry'     → user typed the value from a physical document they hold
   * 'estimate'         → no document available; value is a best estimate
   *                      (lowers AASB S2 confidence level — must be flagged)
   */
  evidenceType: "invoice_receipt" | "direct_entry" | "estimate";

  /**
   * Optional free-text note from the user explaining the entry.
   * Recommended for 'estimate' entries to document the basis.
   * Stored in `transactions.classification_notes`.
   */
  note?: string;

  /**
   * Optional: file path or URL of an uploaded supporting document.
   * Should reference a Supabase Storage object URL.
   */
  evidenceDocumentUrl?: string;
}

/**
 * Response returned by the API after a manual entry is processed.
 */
export interface ManualEntryResult {
  /** The transaction ID that was updated. */
  transactionId: string;
  /** New classification status after manual entry. */
  status: "classified" | "flagged_estimate";
  /** CO2e calculated by calculator.ts from the manually entered quantity. */
  co2eTonnes: number;
  /** Audit trail string from calculator.ts — stored in transactions table. */
  auditTrail: string;
  /** Math engine version used for the calculation. */
  mathEngineVersion: "calculator_v1";
}

/**
 * Summary of a pending manual review item, used by the
 * frontend Review Queue UI component.
 */
export interface ManualReviewItem {
  transactionId: string;
  xeroTransactionId?: string;
  merchantName: string;
  description: string;
  amountAud: number;
  /** Pre-filled category from the router (if a rule matched). */
  categoryCode?: string;
  scope?: 1 | 2 | 3;
  /** Human-readable reason why this transaction needs review. */
  needsReviewReason: string;
  createdAt: string; // ISO 8601
}
