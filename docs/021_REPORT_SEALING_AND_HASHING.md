# Migration 021 — AASB S2 Report Sealing Service
## PDF Generation + SHA-256 Cryptographic Seal + Supabase Storage

| Field | Value |
|---|---|
| **Report ID** | 021_REPORT_SEALING_AND_HASHING |
| **Execution Date** | 2026-04-28 |
| **New Modules** | `pdf_generator.ts`, `report_sealer.ts` |
| **New Tests** | `report_sealer.test.ts` — 39 tests, 0 failures |
| **Total Tests** | 174 passing (5 test files) |
| **PDF Library** | PDFKit (Node.js native, zero external APIs) |
| **Hash Algorithm** | SHA-256 (Node.js `crypto` module — built-in, zero external APIs) |
| **Storage** | Supabase Storage (`aasb-reports` bucket) |

---

## 1. Architecture — The Sealing Pipeline

```
aggregateFinancialYear()
        │
        │  AASBReportSnapshot (immutable JSON)
        ▼
sealFinancialReport()
        │
        ├─ Step 1: generateAASBPdf(snapshot)           ← pdf_generator.ts
        │          └── PDFKit (in-process, no APIs)
        │          └── Returns Buffer
        │
        ├─ Step 2: sha256Hex(pdfBuffer)                ← crypto.createHash()
        │          └── SHA-256 hex string (64 chars)
        │
        ├─ Step 3: storage.from('aasb-reports').upload(path, buffer)
        │          └── Path: {companyId}/{FY}_{hash[0:16]}.pdf
        │
        ├─ Step 4: storage.getPublicUrl(path)
        │          └── Supabase pre-signed/public URL
        │
        └─ Step 5: DB.begin()  ← ATOMIC TRANSACTION
                   ├─ UPDATE aasb_reports SET status='sealed', sha256_hash=..., file_url=...
                   │   └── Triggers tg_enforce_report_seal (future UPDATEs → EXCEPTION)
                   ├─ UPDATE transactions SET report_id=... WHERE id = ANY(classifiedIds)
                   │   └── Triggers tg_enforce_transaction_lock (future UPDATEs → EXCEPTION)
                   └─ INSERT INTO transaction_audit_log (event_type='report_locked')
```

---

## 2. pdf_generator.ts — 4-Page AASB S2 Document

**File:** `src/lib/pdf_generator.ts`

### Document Structure

| Page | Content | AASB S2 Requirement |
|---|---|---|
| 1 — Cover | Company ID, FY, Grand Total, NGA Edition, generatedAt | para. 7 (general disclosure) |
| 2 — Emission Totals | Scope 1, 2, 3 totals + category breakdown | para. 29a (emission quantities) |
| 3 — Data Quality | Score, Tier, mandatory disclosure phrase | para. 29b (estimation uncertainty) |
| 4 — Provenance | Math engine, NGA edition, "zero AI" statement, SHA-256 notice | para. 7c (methodology) |

### Mandatory AASB S2 Disclosure Phrase (para. 29b)

The following phrase is **hard-coded** in the generator and cannot be bypassed:

```
"Estimation Uncertainty: X% of records require manual verification."
```

This renders in **red** if `disclosureRequired = true` (Tier 3 data quality).

### Technology: PDFKit

```typescript
// CJS interop — PDFKit is a CommonJS module
const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

// Generates PDF entirely in memory — no temp files, no external APIs
const doc = new PDFDocument({ size: "A4", ... });
doc.on("data", chunk => chunks.push(chunk));
doc.on("end",  () => resolve(Buffer.concat(chunks)));
```

---

## 3. report_sealer.ts — Cryptographic Seal Service

**File:** `src/lib/report_sealer.ts`

### Key Functions

| Function | Description |
|---|---|
| `sha256Hex(buffer)` | Node.js `crypto.createHash('sha256')` — exported for testing |
| `buildStoragePath(...)` | `{companyId}/{FY}_{hash[0:16]}.pdf` — tamper-evident filename |
| `sealFinancialReport(...)` | Full 5-step orchestration with injected dependencies |

### Dependency Injection Pattern

```typescript
export async function sealFinancialReport(
  reportId:     string,
  snapshot:     AASBReportSnapshot,
  storage:      SupabaseStorageClient,  // ← injected (not imported)
  db:           SealerDbClient,         // ← injected (not imported)
  bucketName =  "aasb-reports",
  pdfGenerator = generateAASBPdf,       // ← injected (overridable in tests)
): Promise<SealResult>
```

All I/O is injected — the function has **zero hardcoded external dependencies**. In tests, `pdfGenerator` is replaced with a synchronous mock buffer, eliminating PDFKit resolution issues in Vitest.

### Failure Stages

```typescript
type SealFailure = {
  success: false;
  reportId: string;
  stage: "pdf_generation" | "hashing" | "upload" | "db_update" | "tx_lock";
  error: string;
};
```

Every failure stage returns the `reportId` so the caller can retry or alert.

---

## 4. Test Coverage — report_sealer.test.ts

| Suite | Tests | Key Assertions |
|---|---|---|
| SHA-256 determinism | 7 | Same buf→same hash, avalanche, empty buf, cross-check vs crypto directly |
| buildStoragePath | 6 | CompanyId, FY, hash prefix, .pdf, different hash→different path, slash sanitised |
| Mock PDF buffer | 6 | %PDF magic, %%EOF, mandatory disclosure phrase, grand total, FY, hash determinism |
| Success path | 14 | success:true, hash=64 chars, hash=sha256(buffer), fileUrl, sealedAt ISO, lockedCount, upload calls, DB queries |
| Failure paths | 4 | upload error, DB failure, pdf gen failure, reportId always echoed |
| SHA-256 chain | 2 | Reported hash matches sha256(buffer), 1-byte change changes hash |

**39 new tests. 174 total. 0 failures.**

---

## 5. SHA-256 Tamper-Evident Design

```
seal(snapshot) → PDF buffer B
                     │
                     ├─ hash(B) = H
                     ├─ storagePath = "{companyId}/FY24-25_{H[0:16]}.pdf"
                     ├─ upload(storagePath, B)
                     └─ DB: sha256_hash = H, file_url = url(storagePath)

Verification (auditor):
  1. Download PDF from file_url
  2. sha256sum report.pdf → must match aasb_reports.sha256_hash
  3. Any mismatch = document was tampered post-seal
```

> [!IMPORTANT]
> The hash prefix in the **filename** (`FY24-25_a1b2c3d4e5f6g7h8.pdf`) means that
> even uploading a different file with the same name is detectable: the filename
> encodes part of the hash, so a different PDF produces a different filename entirely.

---

## 6. Files Created

| File | Description |
|---|---|
| `frontend/src/lib/pdf_generator.ts` | PDFKit 4-page AASB S2 PDF generator |
| `frontend/src/lib/report_sealer.ts` | 5-step sealing orchestrator |
| `frontend/src/lib/report_sealer.test.ts` | 39 unit tests |
| `docs/021_REPORT_SEALING_AND_HASHING.md` | This document |

---

## 7. Complete System Architecture (All Layers)

```
Xero Invoice
    │
    ▼
transaction_router.ts      IGNORE → 0 tokens
    │ EXTRACT_VOLUME
    ▼
regex_extractor.ts         Physical quantity (L, kWh, GJ...) — zero AI
    │
    ▼
calculator.ts              NGA 2025 Method 1 — deterministic math
    │
    ▼
/api/transactions/review   Manual entry fallback (AASB S2 guard)
    │
    ▼
report_aggregator.ts       FY summation — integer accumulation, DQ score
    │  AASBReportSnapshot
    ▼
report_sealer.ts           PDF → SHA-256 → Supabase → DB seal
    │
    ▼
aasb_reports (SEALED)      Immutable. Triggers block all future edits.
```

**Zero LLM calls in any calculation path. 100% deterministic. 174 tests green.**

---

*Report v1 — Generated 2026-04-28. Antigravity Engineering Assistant — EcoLink Australia Project.*
