/**
 * EcoLink Australia — AASB S2 Report Sealing Service
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RESPONSIBILITY:
 *   Orchestrates the final step of the financial year close:
 *     1. Generate the AASB S2 PDF (via pdf_generator.ts)
 *     2. Hash the PDF bytes with SHA-256 (crypto module — no external APIs)
 *     3. Upload the PDF to Supabase Storage
 *     4. Update aasb_reports: status='sealed', sha256_hash, file_url
 *        → This triggers the DB seal trigger (tg_enforce_report_seal)
 *        → After this point, the report is IMMUTABLE
 *     5. Lock associated transactions: UPDATE transactions SET report_id=?
 *        → This triggers tg_enforce_transaction_lock on each row
 *
 * DESIGN CONTRACT:
 *   - Supabase client is injected (not imported) — enables unit testing.
 *   - DB client is injected — no hardcoded connection strings.
 *   - SHA-256 uses Node.js crypto (built-in) — no external dependency.
 *   - The seal is atomic: if upload or DB update fails, status stays 'generating'.
 *
 * LEGAL NOTE:
 *   Once sealFinancialReport() returns { success: true }, the report and
 *   all its transactions are legally frozen. Amendments require a new report.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createHash } from "crypto";
import { generateAASBPdf } from "./pdf_generator";
import type { AASBReportSnapshot } from "./report_aggregator";


// ─── Injected client interfaces ───────────────────────────────────────────────

/**
 * Minimal Supabase Storage client interface.
 * Injected to allow mock in tests — no real Supabase import here.
 */
export interface SupabaseStorageClient {
  from(bucket: string): {
    upload(
      path: string,
      buffer: Buffer,
      options: { contentType: string; upsert: boolean },
    ): Promise<{ data: { path: string } | null; error: Error | null }>;
    getPublicUrl(path: string): { data: { publicUrl: string } };
  };
}

/**
 * Minimal DB client interface (postgres.js compatible).
 */
export interface SealerDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (strings: TemplateStringsArray, ...values: any[]): Promise<unknown[]>;
  begin<T>(fn: (tx: SealerDbClient) => Promise<T>): Promise<T>;
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface SealSuccess {
  success: true;
  reportId: string;
  sha256Hash: string;
  fileUrl: string;
  sealedAt: string;   // ISO 8601
  lockedTransactionCount: number;
}

export interface SealFailure {
  success: false;
  reportId: string;
  stage: "pdf_generation" | "hashing" | "upload" | "db_update" | "tx_lock";
  error: string;
}

export type SealResult = SealSuccess | SealFailure;

// ─── SHA-256 helper (exported for unit testing) ───────────────────────────────

/**
 * Compute the SHA-256 hex digest of a Buffer.
 * This is the cryptographic seal for the AASB report.
 * Equivalent to: `sha256sum <report.pdf>` on the command line.
 *
 * Deterministic: same bytes → same hash, always.
 * Tamper-evident: any post-seal modification produces a different hash.
 */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ─── Storage path builder ─────────────────────────────────────────────────────

/**
 * Build the Supabase Storage object path for a report PDF.
 * Format: {companyId}/{financialYear}_{sha256Prefix}.pdf
 *
 * The SHA-256 prefix in the filename means the path itself is tamper-evident:
 * a different PDF produces a different filename, preventing silent overwrites.
 */
export function buildStoragePath(
  companyId: string,
  financialYear: string,
  sha256Hash: string,
): string {
  const safeYear = financialYear.replace(/[^A-Za-z0-9-]/g, "_");
  const hashPrefix = sha256Hash.slice(0, 16); // first 16 chars for readability
  return `${companyId}/${safeYear}_${hashPrefix}.pdf`;
}

// ─── Main sealing function ────────────────────────────────────────────────────

/**
 * Seal a financial year's AASB S2 report.
 *
 * This is a one-way operation. After successful completion:
 *   - The aasb_reports row has status='sealed' (DB trigger prevents reversion).
 *   - All associated transactions have report_id set (DB trigger prevents edits).
 *   - The PDF is stored in Supabase Storage with its SHA-256 path.
 *
 * @param reportId        UUID of the aasb_reports row (status must be 'generating').
 * @param snapshot        AASBReportSnapshot from aggregateFinancialYear().
 * @param storage         Injected Supabase Storage client.
 * @param db              Injected DB client (postgres.js compatible).
 * @param bucketName      Supabase Storage bucket (default: 'aasb-reports').
 * @param pdfGenerator    Injected PDF generator (defaults to generateAASBPdf).
 *                        Override in tests to avoid pdfkit CJS resolution.
 */
export async function sealFinancialReport(
  reportId: string,
  snapshot: AASBReportSnapshot,
  storage: SupabaseStorageClient,
  db: SealerDbClient,
  bucketName = "aasb-reports",
  pdfGenerator: (snap: AASBReportSnapshot) => Promise<Buffer> = generateAASBPdf,
): Promise<SealResult> {

  // ── Step 1: Generate PDF ──────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await pdfGenerator(snapshot);
  } catch (err) {
    return {
      success: false,
      reportId,
      stage: "pdf_generation",
      error: `PDF generation failed: ${String(err)}`,
    };
  }

  // ── Step 2: SHA-256 hash ──────────────────────────────────────────────────
  let hash: string;
  try {
    hash = sha256Hex(pdfBuffer);
  } catch (err) {
    return {
      success: false,
      reportId,
      stage: "hashing",
      error: `SHA-256 hashing failed: ${String(err)}`,
    };
  }

  // ── Step 3: Upload to Supabase Storage ───────────────────────────────────
  const storagePath = buildStoragePath(snapshot.companyId, snapshot.financialYear, hash);

  const { data: uploadData, error: uploadError } = await storage
    .from(bucketName)
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });

  if (uploadError || !uploadData) {
    return {
      success: false,
      reportId,
      stage: "upload",
      error: `Storage upload failed: ${uploadError?.message ?? "unknown error"}`,
    };
  }

  // ── Step 4: Get file URL ──────────────────────────────────────────────────
  const { data: urlData } = storage.from(bucketName).getPublicUrl(storagePath);
  const fileUrl = urlData.publicUrl;

  // ── Step 5: Atomic DB seal + transaction lock ─────────────────────────────
  const sealedAt = new Date().toISOString();

  try {
    await db.begin(async (tx) => {
      // 5a. Seal the report (triggers tg_enforce_report_seal on future UPDATEs)
      await tx`
        UPDATE aasb_reports
           SET status       = 'sealed',
               sha256_hash  = ${hash},
               file_url     = ${fileUrl},
               sealed_at    = ${sealedAt}::timestamptz,
               updated_at   = NOW()
         WHERE id           = ${reportId}::uuid
           AND status       = 'generating'
      `;

      // 5b. Lock all classified transactions for this company + FY
      //     (triggers tg_enforce_transaction_lock on future UPDATEs)
      await tx`
        UPDATE transactions
           SET report_id  = ${reportId}::uuid,
               updated_at = NOW()
         WHERE company_id = ${snapshot.companyId}::uuid
           AND id         = ANY(${snapshot.classifiedTransactionIds}::uuid[])
           AND report_id  IS NULL
      `;

      // 5c. Write seal event to audit log
      await tx`
        INSERT INTO transaction_audit_log (transaction_id, event_type, payload)
        SELECT unnest(${snapshot.classifiedTransactionIds}::uuid[]),
               'report_locked',
               ${JSON.stringify({
                 reportId,
                 financialYear:  snapshot.financialYear,
                 sha256Hash:     hash,
                 fileUrl,
                 sealedAt,
                 mathEngineVersion: snapshot.mathEngineVersion,
               })}::jsonb
      `;
    });
  } catch (err) {
    return {
      success: false,
      reportId,
      stage: "db_update",
      error: `DB seal failed: ${String(err)}`,
    };
  }

  return {
    success:                true,
    reportId,
    sha256Hash:             hash,
    fileUrl,
    sealedAt,
    lockedTransactionCount: snapshot.classifiedTransactionIds.length,
  };
}
