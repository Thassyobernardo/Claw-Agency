# Migration 020 + 019 — AASB S2 Report Aggregation Engine
## Implementation Report — Report Vault & Data Aggregator

| Field | Value |
|---|---|
| **Report ID** | 020_REPORT_AGGREGATION_ENGINE |
| **Execution Date** | 2026-04-28 |
| **Migrations** | 019 (scope columns + audit log) + 020 (report vault + lock triggers) |
| **New Services** | `report_aggregator.ts` |
| **New Tests** | `report_aggregator.test.ts` — 30 tests, 0 failures |
| **Database** | Supabase PostgreSQL — ap-southeast-2 (Sydney, Australia) |
| **Regulatory Target** | AASB S2 Climate-related Financial Disclosures, NGER Act 2007 |

---

## 1. Architecture Overview

```
Financial Year Close
        │
        ▼
aggregateFinancialYear()          ← report_aggregator.ts
  ├── getClassifiedTransactions() ← ReportRepository (injected)
  ├── getTransactionCounts()      ← ReportRepository (injected)
  ├── sumKgToTonnes()             ← integer accumulation (fp-safe)
  ├── computeDataQuality()        ← AASB S2 para. 29 score
  └── AASBReportSnapshot          ← immutable JSON output
        │
        ▼
INSERT INTO aasb_reports (status='generating', ...)
        │
        ▼
PDF generation + SHA-256 hash
        │
        ▼
UPDATE aasb_reports SET status='sealed', sha256_hash=...
        │  ← tg_enforce_report_seal fires on next UPDATE attempt
        ▼
UPDATE transactions SET report_id=...  ← LOCKS each transaction
        │  ← tg_enforce_transaction_lock fires on further edits
        ▼
AASB S2 Disclosure Document (Sealed)
```

---

## 2. Migration 019 — `transactions` v2

**File:** `database/migrations/019_transactions_v2_scope_columns.sql`

Adds columns required by the `/api/transactions/review` route and aggregator:

| Column | Type | Purpose |
|---|---|---|
| `scope1_co2e_kg` | NUMERIC(14,4) | Scope 1 direct combustion (kg CO2e) |
| `scope2_co2e_kg` | NUMERIC(14,4) | Scope 2 purchased electricity (kg CO2e) |
| `scope3_co2e_kg` | NUMERIC(14,4) | Scope 3 upstream lifecycle (kg CO2e) |
| `math_engine_version` | TEXT | Which `calculator.ts` version produced this |
| `classification_notes` | TEXT | Verbatim `auditTrail` from calculator |
| `classified_at` | TIMESTAMPTZ | When the transaction was classified |

Also creates **`transaction_audit_log`** — immutable INSERT-only table:
- Logs every `auto_classified`, `manual_review_resolved`, `report_locked`, and `correction_submitted` event.
- Contains `payload JSONB` with the full state snapshot at event time.

---

## 3. Migration 020 — `aasb_reports` Vault

**File:** `database/migrations/020_aasb_reports_lock.sql`

### Table: `aasb_reports`

| Column | Type | Purpose |
|---|---|---|
| `financial_year` | TEXT | e.g. `'FY24-25'` |
| `status` | TEXT | `generating` → `sealed` (one-way) |
| `total_scope1_tonnes` | NUMERIC(16,4) | Scope 1 total tCO2e |
| `total_scope2_tonnes` | NUMERIC(16,4) | Scope 2 total tCO2e |
| `total_scope3_tonnes` | NUMERIC(16,4) | Scope 3 total tCO2e |
| `total_co2e_tonnes` | GENERATED | Sc1 + Sc2 + Sc3 (DB-computed) |
| `data_quality_score` | NUMERIC(5,2) | 0–100, AASB S2 para. 29 |
| `sha256_hash` | TEXT | SHA-256 of sealed PDF bytes |
| `sealed_at` | TIMESTAMPTZ | Auto-set by trigger on seal |
| `report_id` on `transactions` | UUID FK | Locks the transaction |

### Three Lock Triggers

| Trigger | Table | Effect |
|---|---|---|
| `tg_enforce_report_seal` | `aasb_reports` | Raises EXCEPTION on any UPDATE to a sealed report |
| `tg_enforce_transaction_lock` | `transactions` | Raises EXCEPTION on any UPDATE to a locked transaction |
| `tg_auto_seal_timestamp` | `aasb_reports` | Auto-populates `sealed_at` on `generating → sealed` transition |

> [!CAUTION]
> **The seal is irreversible by design.** Once `status = 'sealed'`, the PostgreSQL trigger
> rejects any further UPDATE with `REPORT_IMMUTABLE`. Corrections require a new amended
> report — matching ASIC and DCCEEW regulatory expectations.

---

## 4. Report Aggregator — `report_aggregator.ts`

### Key Design Decisions

**1. Integer Accumulation Pattern (Floating-Point Safety)**

```typescript
// ❌ WRONG: accumulate in tonnes (rounding error accumulates per row)
transactions.reduce((acc, t) => acc + (t.scope1_co2e_kg / 1000), 0)

// ✅ CORRECT: sum in kg first, divide once
const totalKg = values.reduce((acc, v) => acc + v, 0);
parseFloat((totalKg / 1000).toFixed(4));
```

Proven by test: 100 × 0.1 kg = 10.0 kg = 0.01 t (not 9.9999…)

**2. Injected Repository Interface**

```typescript
interface ReportRepository {
  getClassifiedTransactions(companyId, start, end): Promise<ClassifiedTransaction[]>
  getTransactionCounts(companyId, start, end): Promise<TransactionCounts>
}
```

The aggregator function is tested with zero DB dependency — a mock array is injected.

**3. Data Quality Score (AASB S2 Para. 29)**

```
score = classified / (total - ignored) × 100

Tier 1: score ≥ 95%  → measured data, no special disclosure
Tier 2: score 80–94% → mostly measured, light disclosure
Tier 3: score < 80%  → significant estimation → disclosureRequired = true
```

---

## 5. Test Coverage — `report_aggregator.test.ts`

| Suite | Tests | Key Assertions |
|---|---|---|
| `parseFinancialYear` | 5 | Format validation, correct dates, error messages |
| Scope totals | 7 | Sc1=1.1181t, Sc2=1.188t, Sc3=0, Total=2.3061t |
| Category breakdown | 3 | fuel_petrol=0.1357t, fuel_diesel=0.9824t, electricity=1.188t |
| Data Quality Score | 5 | 100%=T1, 80%=T2, 50%=T3, all-ignored=100%, counts echoed |
| Snapshot structure | 8 | All identity fields, IDs, ISO dates, mathEngineVersion |
| Floating-point safety | 2 | 100×0.1kg=0.01t, 3×(1000/3)kg=1.0000t |

**30 new tests. 135 total. 0 failures.**

---

## 6. AASBReportSnapshot (Output Contract)

```typescript
interface AASBReportSnapshot {
  companyId:     string;         // company UUID
  financialYear: string;         // 'FY24-25'
  periodStart:   string;         // '2024-07-01'
  periodEnd:     string;         // '2025-06-30'
  ngaEditionYear: number;        // 2025

  scope1: ScopeTotal;            // { totalTonnes, transactionCount, byCategory }
  scope2: ScopeTotal;
  scope3: ScopeTotal;
  totalCo2eTonnes: number;       // Sc1 + Sc2 + Sc3

  dataQuality: DataQualityMetrics; // score, tier, disclosureRequired

  mathEngineVersion: "calculator_v1";
  generatedAt: string;           // ISO 8601
  classifiedTransactionIds: string[];
}
```

---

## 7. Files Created / Modified

| File | Action | Description |
|---|---|---|
| `database/migrations/019_transactions_v2_scope_columns.sql` | ✅ Created | Scope columns + audit log |
| `database/migrations/020_aasb_reports_lock.sql` | ✅ Created | Report vault + 3 lock triggers |
| `frontend/src/lib/report_aggregator.ts` | ✅ Created | Pure aggregator, injected repo |
| `frontend/src/lib/report_aggregator.test.ts` | ✅ Created | 30 tests, fp-safety verified |
| `docs/020_REPORT_AGGREGATION_ENGINE.md` | ✅ Created | This document |

---

## 8. Pre-Production Checklist

- [ ] Run migration 019 on staging Supabase branch
- [ ] Run migration 020 on staging (depends on 019)
- [ ] Verify triggers: `SELECT trigger_name FROM information_schema.triggers WHERE table_name IN ('aasb_reports','transactions')`
- [ ] Test seal guard: `UPDATE aasb_reports SET status='sealed' WHERE id=<id>` then attempt second UPDATE — must raise REPORT_IMMUTABLE
- [ ] Test transaction lock: set `report_id`, then attempt any UPDATE — must raise TRANSACTION_LOCKED
- [ ] `npm test` — all 135 tests pass before production merge

---

## 9. Next Steps (PDF Generation)

With this foundation sealed, the next milestone is:

1. **PDF Template:** Populate the AASB S2 disclosure template with `AASBReportSnapshot` data.
2. **SHA-256 Seal:** Hash the PDF bytes and write to `aasb_reports.sha256_hash`.
3. **Supabase Storage:** Upload PDF to private bucket, store pre-signed URL.
4. **Status Transition:** Call `UPDATE aasb_reports SET status='sealed'` — triggers lock.
5. **Batch Lock:** `UPDATE transactions SET report_id=<id> WHERE company_id=<id> AND status='classified'`.

*Report v1 — Generated 2026-04-28. Antigravity Engineering Assistant — EcoLink Australia Project.*
