# 023 — AASB S2 Report Generation UI
## Phase: Final Delivery — Report Vault Frontend

| Field | Value |
|---|---|
| **Report ID** | 023_REPORT_GENERATION_UI |
| **Execution Date** | 2026-04-29 |
| **TypeScript** | 0 errors (`tsc --noEmit` clean) |
| **Tests** | 174 passing — 0 regressions |
| **Zero external deps added** | Storage uses plain `fetch` against Supabase REST API |

---

## Files Created

| File | Role |
|---|---|
| `src/app/api/reports/route.ts` | `GET /api/reports` — list all sealed reports |
| `src/app/api/reports/preview/route.ts` | `POST /api/reports/preview` — read-only aggregation |
| `src/app/api/reports/generate/route.ts` | `POST /api/reports/generate` — seal + PDF + SHA-256 |
| `src/app/dashboard/reports/page.tsx` | Reports UI page |

---

## API Contract

### `GET /api/reports`
Returns `{ reports: AASBReportRow[] }` ordered by `sealed_at DESC`.

### `POST /api/reports/preview`
```json
{ "financialYear": "FY24-25" }
```
Returns totals without writing anything. Safe to call multiple times.

### `POST /api/reports/generate`
```json
{ "financialYear": "FY24-25" }
```

**Pre-condition guards (server-enforced):**

| Guard | Code | HTTP |
|---|---|---|
| Transactions with `needs_review` exist | `PENDING_REVIEW_TRANSACTIONS` | 400 |
| Report already sealed | `ALREADY_SEALED` | 409 |
| Invalid FY format | `Validation failed` | 400 |

**Success response:**
```json
{
  "reportId": "uuid",
  "fileUrl": "https://…/storage/v1/object/public/aasb-reports/…pdf",
  "sha256Hash": "64 hex chars",
  "sealedAt": "2026-04-29T…Z",
  "lockedTransactionCount": 142,
  "scope1Tonnes": 12.3400,
  "scope2Tonnes": 8.5600,
  "scope3Tonnes": 3.2100,
  "totalCo2eTonnes": 24.1100,
  "dataQualityScore": 97.3,
  "uncertaintyTier": "Tier 1"
}
```

---

## UI Flow

```
/dashboard/reports
       │
       ├─ [History table]
       │    ├─ SHA-256 truncated: "a1b2c3d4…e5f6g7h8"
       │    ├─ Data quality badge (🟢 Tier 1 / 🟡 Tier 2 / 🔴 Tier 3)
       │    └─ Download PDF button → Supabase Storage public URL
       │
       └─ [New Report card — FY24-25]
            ├─ [Preview Totals] → POST /api/reports/preview
            │    └─ Shows Scope 1/2/3 grid + quality score
            │
            └─ [Seal & Generate Official PDF]
                 └─ Opens SealModal
                      ├─ Shows final totals
                      ├─ Red warning: irreversible action
                      ├─ ⬜ Required checkbox (red)
                      │    "I understand this action is irreversible…"
                      └─ [🔒 Seal Report] (only enabled after checkbox)
                           └─ POST /api/reports/generate
                                ├─ Guard 1: pendingCount > 0 → 400 → link to /dashboard/review
                                ├─ Guard 2: already sealed → 409
                                ├─ aggregateFinancialYear()
                                ├─ INSERT aasb_reports (status='generating')
                                ├─ generateAASBPdf() → Buffer
                                ├─ sha256Hex(buffer)
                                ├─ fetch → Supabase Storage REST API
                                ├─ UPDATE aasb_reports SET status='sealed'
                                ├─ UPDATE transactions SET report_id=…
                                └─ INSERT transaction_audit_log (report_locked)
```

---

## Design Decisions

### No `@supabase/supabase-js` in route
The generate route implements `SupabaseStorageClient` directly with `fetch` against the Supabase Storage REST API (`/storage/v1/object/{bucket}/{path}`). This avoids adding the SDK as a dependency while remaining fully compatible with the injected interface from `report_sealer.ts`.

### `sql as unknown as SealerDbClient`
The `postgres.js` `Sql<{}>` type and `SealerDbClient` interface don't overlap in TypeScript's structural comparison because of `begin()` signature differences. The `unknown` intermediate cast is the correct, intentional escape hatch — both implement the same runtime contract.

### Preview before Seal
The "Preview Totals" button calls a read-only `/api/reports/preview` endpoint (no DB writes). The Seal modal reuses the preview data already in memory — no redundant aggregation call on confirm.

### Pending-review guard
The 400 response includes `pendingCount` and `reviewUrl: "/dashboard/review"`. The frontend surfaces a direct link to the Review Queue when this guard fires.

---

## Env Vars Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc…        # preferred (bypasses RLS)
# fallback:
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc…  # only if service role not available
```

> [!IMPORTANT]
> Use `SUPABASE_SERVICE_ROLE_KEY` for PDF uploads — the anon key may be blocked
> by Storage RLS policies on the `aasb-reports` bucket.

---

## Complete Frontend Journey

```
Login → Connect Xero → Sync Year to Date → Review Queue → Reports
  ↑                         ↑                    ↑             ↑
auth.ts               xero_client.ts       ManualEntry      generate/route.ts
                      /integrations/       Drawer           report_sealer.ts
                      xero/sync            POST /review     pdf_generator.ts
```

*Report v1 — Generated 2026-04-29. Antigravity Engineering — EcoLink Australia.*
