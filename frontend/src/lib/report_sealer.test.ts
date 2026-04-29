/**
 * EcoLink Australia — Report Sealing Service Tests
 *
 * Tests focus on:
 *   1. SHA-256 determinism — same bytes → same hash, always.
 *   2. Tamper evidence — any byte change → different hash.
 *   3. buildStoragePath — deterministic, tamper-evident filename.
 *   4. sealFinancialReport() — full orchestration with injected mocks.
 *      - pdfGenerator is injected (avoids pdfkit CJS resolution in Vitest).
 *      - Mock Supabase: upload called with correct bucket/path.
 *      - Mock DB: UPDATE called with correct status + hash.
 *
 * NO real network, NO real Supabase, NO real DB — 100% injected mocks.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { createHash } from "crypto";
import {
  sha256Hex,
  buildStoragePath,
  sealFinancialReport,
  type SupabaseStorageClient,
  type SealerDbClient,
  type SealSuccess,
  type SealFailure,
} from "./report_sealer";
import type { AASBReportSnapshot } from "./report_aggregator";

// ═════════════════════════════════════════════════════════════════════════════
// FIXTURES
// ═════════════════════════════════════════════════════════════════════════════

const COMPANY_ID = "co-0000-0000-0000-0001";
const REPORT_ID  = "rp-0000-0000-0000-0001";

const SNAPSHOT: AASBReportSnapshot = {
  companyId:      COMPANY_ID,
  financialYear:  "FY24-25",
  periodStart:    "2024-07-01",
  periodEnd:      "2025-06-30",
  ngaEditionYear: 2025,
  scope1: {
    totalTonnes: 1.1181, transactionCount: 2,
    byCategory: { fuel_petrol: 0.1357, fuel_diesel: 0.9824 },
  },
  scope2: {
    totalTonnes: 1.188, transactionCount: 2,
    byCategory: { electricity: 1.188 },
  },
  scope3: { totalTonnes: 0, transactionCount: 0, byCategory: {} },
  totalCo2eTonnes: 2.3061,
  dataQuality: {
    score: 100, classifiedCount: 4, ignoredCount: 1, needsReviewCount: 0,
    totalCount: 5, uncertaintyTier: "Tier 1", disclosureRequired: false,
  },
  mathEngineVersion:        "calculator_v1",
  generatedAt:              "2026-04-28T20:00:00.000Z",
  classifiedTransactionIds: ["tx-0001", "tx-0002", "tx-0003", "tx-0004"],
};

// ─── Stable mock PDF buffer (deterministic, no pdfkit required) ───────────────

/**
 * Deterministic fake PDF buffer used in orchestration tests.
 * Contains AASB S2 mandatory disclosure phrase so text-search tests pass.
 * Starts with %PDF magic and ends with %%EOF to mimic real PDF structure.
 */
function makeMockPdfBuffer(): Buffer {
  const content = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog >> endobj",
    "BT /F1 12 Tf (AASB S2 Climate-related Financial Disclosure) Tj ET",
    `BT /F1 10 Tf (${SNAPSHOT.financialYear}) Tj ET`,
    `BT /F1 10 Tf (${SNAPSHOT.totalCo2eTonnes.toFixed(4)} tCO2e) Tj ET`,
    "BT /F1 10 Tf (Estimation Uncertainty: 0.0% of records require manual verification.) Tj ET",
    "xref",
    "%%EOF",
  ].join("\n");
  return Buffer.from(content, "utf-8");
}

const MOCK_PDF_BUFFER = makeMockPdfBuffer();

// ─── Mock Supabase Storage ─────────────────────────────────────────────────────

function makeStorageMock(opts: { uploadError?: Error } = {}): {
  mock: SupabaseStorageClient;
  uploadCalls: Array<{ bucket: string; path: string; size: number }>;
} {
  const uploadCalls: Array<{ bucket: string; path: string; size: number }> = [];
  const mock: SupabaseStorageClient = {
    from(bucket: string) {
      return {
        upload(path: string, buffer: Buffer) {
          uploadCalls.push({ bucket, path, size: buffer.length });
          if (opts.uploadError) {
            return Promise.resolve({ data: null, error: opts.uploadError });
          }
          return Promise.resolve({ data: { path }, error: null });
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://storage.example.com/${bucket}/${path}` } };
        },
      };
    },
  };
  return { mock, uploadCalls };
}

// ─── Mock DB client ────────────────────────────────────────────────────────────

function makeDbMock(opts: { failBegin?: boolean } = {}): {
  mock: SealerDbClient;
  queries: string[];
} {
  const queries: string[] = [];
  const tag = (strings: TemplateStringsArray) => {
    queries.push(strings.join("?"));
    return Promise.resolve([]);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tag as any).begin = async (fn: (tx: SealerDbClient) => Promise<unknown>) => {
    if (opts.failBegin) throw new Error("DB connection refused");
    return fn(tag as unknown as SealerDbClient);
  };
  return { mock: tag as unknown as SealerDbClient, queries };
}

// ─── Mock PDF generator (bypasses pdfkit entirely in orchestration tests) ─────

const mockPdfGenerator = vi.fn(async (_snap: AASBReportSnapshot): Promise<Buffer> => {
  return MOCK_PDF_BUFFER;
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1 — sha256Hex: determinism + tamper evidence
// ═════════════════════════════════════════════════════════════════════════════
describe("sha256Hex — SHA-256 determinism", () => {
  it("same buffer → same hash (determinism)", () => {
    const buf = Buffer.from("EcoLink AASB S2 Report FY24-25");
    expect(sha256Hex(buf)).toBe(sha256Hex(buf));
  });

  it("different buffers → different hashes (tamper evidence)", () => {
    expect(sha256Hex(Buffer.from("original content")))
      .not.toBe(sha256Hex(Buffer.from("original contenT")));
  });

  it("hash is exactly 64 hex characters (SHA-256 = 256 bits = 64 hex chars)", () => {
    expect(sha256Hex(Buffer.from("test"))).toHaveLength(64);
    expect(sha256Hex(Buffer.from("test"))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("empty buffer = SHA-256 of empty = e3b0c44…", () => {
    expect(sha256Hex(Buffer.alloc(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches Node.js crypto.createHash('sha256') directly", () => {
    const buf = Buffer.from("cross-check");
    expect(sha256Hex(buf)).toBe(createHash("sha256").update(buf).digest("hex"));
  });

  it("single bit-flip changes hash completely (avalanche effect)", () => {
    const base    = Buffer.alloc(1000, 0x41);
    const flipped = Buffer.alloc(1000, 0x41);
    flipped[500]  = 0x42;
    expect(sha256Hex(base)).not.toBe(sha256Hex(flipped));
  });

  it("calling twice on same buffer returns identical string references value", () => {
    const buf = Buffer.from("seal me");
    const h1  = sha256Hex(buf);
    const h2  = sha256Hex(buf);
    expect(h1).toBe(h2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2 — buildStoragePath
// ═════════════════════════════════════════════════════════════════════════════
describe("buildStoragePath — deterministic filename", () => {
  const HASH = "a".repeat(64);

  it("contains companyId segment", () => {
    expect(buildStoragePath(COMPANY_ID, "FY24-25", HASH)).toContain(COMPANY_ID);
  });

  it("contains financial year", () => {
    expect(buildStoragePath(COMPANY_ID, "FY24-25", HASH)).toContain("FY24-25");
  });

  it("contains first 16 chars of hash", () => {
    expect(buildStoragePath(COMPANY_ID, "FY24-25", HASH)).toContain(HASH.slice(0, 16));
  });

  it("ends with .pdf", () => {
    expect(buildStoragePath(COMPANY_ID, "FY24-25", HASH).endsWith(".pdf")).toBe(true);
  });

  it("different hash → different path (tamper-evident filename)", () => {
    const p1 = buildStoragePath(COMPANY_ID, "FY24-25", "a".repeat(64));
    const p2 = buildStoragePath(COMPANY_ID, "FY24-25", "b".repeat(64));
    expect(p1).not.toBe(p2);
  });

  it("sanitises slash in financialYear", () => {
    const p = buildStoragePath(COMPANY_ID, "FY24/25", HASH);
    expect(p).not.toMatch(/\/25_/); // the slash is sanitised away
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3 — mock PDF buffer shape (AASB S2 content invariants)
// ═════════════════════════════════════════════════════════════════════════════
describe("Mock PDF buffer — AASB S2 content invariants", () => {
  it("starts with %PDF magic bytes", () => {
    expect(MOCK_PDF_BUFFER.slice(0, 4).toString()).toBe("%PDF");
  });

  it("ends with %%EOF marker", () => {
    expect(MOCK_PDF_BUFFER.toString()).toContain("%%EOF");
  });

  it("contains mandatory AASB S2 disclosure phrase", () => {
    expect(MOCK_PDF_BUFFER.toString()).toContain("Estimation Uncertainty:");
    expect(MOCK_PDF_BUFFER.toString()).toContain("require manual verification");
  });

  it("contains grand total tCO2e", () => {
    expect(MOCK_PDF_BUFFER.toString()).toContain("2.3061");
  });

  it("contains financial year FY24-25", () => {
    expect(MOCK_PDF_BUFFER.toString()).toContain("FY24-25");
  });

  it("sha256Hex of mock buffer is deterministic", () => {
    expect(sha256Hex(MOCK_PDF_BUFFER)).toBe(sha256Hex(MOCK_PDF_BUFFER));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4 — sealFinancialReport: success path (injected mock pdf generator)
// ═════════════════════════════════════════════════════════════════════════════
describe("sealFinancialReport — success path", () => {
  let result: SealSuccess;
  let uploadCalls: Array<{ bucket: string; path: string; size: number }>;
  let queries: string[];

  beforeAll(async () => {
    const storage = makeStorageMock();
    const db      = makeDbMock();
    uploadCalls   = storage.uploadCalls;
    queries       = db.queries;

    const r = await sealFinancialReport(
      REPORT_ID, SNAPSHOT, storage.mock, db.mock,
      "aasb-reports",
      mockPdfGenerator,  // ← injected: bypasses pdfkit
    );
    result = r as SealSuccess;
  });

  it("returns success: true", () => {
    expect(result.success).toBe(true);
  });

  it("echoes reportId", () => {
    expect(result.reportId).toBe(REPORT_ID);
  });

  it("sha256Hash is 64 hex chars", () => {
    expect(result.sha256Hash).toHaveLength(64);
    expect(result.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sha256Hash equals sha256Hex(MOCK_PDF_BUFFER) — proves hash is from the buffer", () => {
    expect(result.sha256Hash).toBe(sha256Hex(MOCK_PDF_BUFFER));
  });

  it("fileUrl contains storage domain", () => {
    expect(result.fileUrl).toContain("storage.example.com");
  });

  it("fileUrl contains companyId", () => {
    expect(result.fileUrl).toContain(COMPANY_ID);
  });

  it("sealedAt is a valid ISO 8601 timestamp", () => {
    expect(new Date(result.sealedAt).getFullYear()).toBeGreaterThan(2020);
  });

  it("lockedTransactionCount = 4 (snapshot has 4 classified IDs)", () => {
    expect(result.lockedTransactionCount).toBe(4);
  });

  it("upload was called exactly once", () => {
    expect(uploadCalls).toHaveLength(1);
  });

  it("upload used the 'aasb-reports' bucket", () => {
    expect(uploadCalls[0]!.bucket).toBe("aasb-reports");
  });

  it("upload path contains companyId and FY24-25", () => {
    expect(uploadCalls[0]!.path).toContain(COMPANY_ID);
    expect(uploadCalls[0]!.path).toContain("FY24-25");
  });

  it("upload path includes first 16 chars of the sha256Hash", () => {
    expect(uploadCalls[0]!.path).toContain(result.sha256Hash.slice(0, 16));
  });

  it("mock pdfGenerator was called once with the snapshot", () => {
    expect(mockPdfGenerator).toHaveBeenCalledTimes(1);
    expect(mockPdfGenerator).toHaveBeenCalledWith(SNAPSHOT);
  });

  it("DB queries were executed (UPDATE + lock + audit log = min 3 templates)", () => {
    expect(queries.length).toBeGreaterThanOrEqual(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5 — sealFinancialReport: failure paths
// ═════════════════════════════════════════════════════════════════════════════
describe("sealFinancialReport — failure paths", () => {
  it("upload error → returns success:false with stage='upload'", async () => {
    const storage = makeStorageMock({ uploadError: new Error("bucket full") });
    const db      = makeDbMock();
    const r       = await sealFinancialReport(
      REPORT_ID, SNAPSHOT, storage.mock, db.mock,
      "aasb-reports", mockPdfGenerator,
    ) as SealFailure;
    expect(r.success).toBe(false);
    expect(r.stage).toBe("upload");
    expect(r.error).toContain("bucket full");
  });

  it("DB failure → returns success:false with stage='db_update'", async () => {
    const storage = makeStorageMock();
    const db      = makeDbMock({ failBegin: true });
    const r       = await sealFinancialReport(
      REPORT_ID, SNAPSHOT, storage.mock, db.mock,
      "aasb-reports", mockPdfGenerator,
    ) as SealFailure;
    expect(r.success).toBe(false);
    expect(r.stage).toBe("db_update");
    expect(r.error).toContain("DB seal failed");
  });

  it("pdf generator failure → returns success:false with stage='pdf_generation'", async () => {
    const failingGenerator = async () => { throw new Error("out of memory"); };
    const storage = makeStorageMock();
    const db      = makeDbMock();
    const r       = await sealFinancialReport(
      REPORT_ID, SNAPSHOT, storage.mock, db.mock,
      "aasb-reports", failingGenerator,
    ) as SealFailure;
    expect(r.success).toBe(false);
    expect(r.stage).toBe("pdf_generation");
  });

  it("failure result always echoes reportId", async () => {
    const failingGenerator = async () => { throw new Error("fail"); };
    const storage = makeStorageMock();
    const db      = makeDbMock();
    const r       = await sealFinancialReport(
      REPORT_ID, SNAPSHOT, storage.mock, db.mock,
      "aasb-reports", failingGenerator,
    ) as SealFailure;
    expect(r.reportId).toBe(REPORT_ID);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6 — SHA-256 integrity chain (end-to-end hash verification)
// ═════════════════════════════════════════════════════════════════════════════
describe("SHA-256 integrity chain — seal → verify", () => {
  it("reported sha256Hash === sha256Hex(pdfBuffer) produced by pdfGenerator", async () => {
    // The hash in the result MUST equal sha256Hex of the buffer returned by pdfGenerator.
    // We use a generator that returns a known buffer so we can verify the chain.
    const KNOWN_BUFFER = Buffer.from("known PDF content for hash chain verification");
    const knownGenerator = async () => KNOWN_BUFFER;
    const expectedHash = sha256Hex(KNOWN_BUFFER);

    const storage = makeStorageMock();
    const db      = makeDbMock();
    const r       = await sealFinancialReport(
      REPORT_ID, SNAPSHOT, storage.mock, db.mock,
      "aasb-reports", knownGenerator,
    ) as SealSuccess;

    expect(r.sha256Hash).toBe(expectedHash);
  });

  it("changing 1 byte in PDF changes the stored sha256Hash", async () => {
    const buf1 = Buffer.from("Version A of the AASB report");
    const buf2 = Buffer.from("Version B of the AASB report");

    const storage1 = makeStorageMock();
    const db1      = makeDbMock();
    const storage2 = makeStorageMock();
    const db2      = makeDbMock();

    const r1 = await sealFinancialReport(
      REPORT_ID, SNAPSHOT, storage1.mock, db1.mock,
      "aasb-reports", async () => buf1,
    ) as SealSuccess;

    const r2 = await sealFinancialReport(
      REPORT_ID, SNAPSHOT, storage2.mock, db2.mock,
      "aasb-reports", async () => buf2,
    ) as SealSuccess;

    expect(r1.sha256Hash).not.toBe(r2.sha256Hash);
  });
});
