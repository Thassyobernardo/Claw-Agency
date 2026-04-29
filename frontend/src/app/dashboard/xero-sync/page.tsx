"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertCircle, ExternalLink, Building2,
  Loader2, ShieldCheck, RefreshCw, ArrowRight,
  BarChart3, Layers, XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface XeroStatus {
  connected:   boolean;
  tenantName?: string;
  tenantId?:   string;
  tokenValid?: boolean;
}

interface PageResult {
  page:      number;
  processed: number;
  imported:  number;
  skipped:   number;
  hasMore:   boolean;
}

interface SyncState {
  running:    boolean;
  done:       boolean;
  error:      string | null;
  pages:      PageResult[];
  totalImported: number;
  totalSkipped:  number;
}

// ─── Xero logo ────────────────────────────────────────────────────────────────

function XeroLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <rect width="512" height="512" rx="96" fill="#1AB4D7" />
      <path
        d="M256 152c-57.4 0-104 46.6-104 104s46.6 104 104 104 104-46.6 104-104-46.6-104-104-104zm0 176c-39.8 0-72-32.2-72-72s32.2-72 72-72 72 32.2 72 72-32.2 72-72 72z"
        fill="white"
      />
      <path d="M146 236h-36l36-36-36-36h36l36 36-36 36z" fill="white" />
      <path d="M366 236h36l-36-36 36-36h-36l-36 36 36 36z" fill="white" />
    </svg>
  );
}

// ─── Progress log row ─────────────────────────────────────────────────────────

function LogRow({ result }: { result: PageResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 text-sm"
    >
      <CheckCircle2 size={14} className="text-aw-green shrink-0" />
      <span className="text-aw-slate font-medium">
        Page {result.page}
      </span>
      <span className="text-aw-slate-mid">—</span>
      <span className="text-aw-slate-mid">
        {result.processed} processed · <strong className="text-aw-green">{result.imported} new</strong>
        {result.skipped > 0 && <> · {result.skipped} skipped</>}
      </span>
      {!result.hasMore && result.page > 1 && (
        <span className="ml-auto text-xs font-bold text-aw-slate-light">last page</span>
      )}
    </motion.div>
  );
}

// ─── Info card ────────────────────────────────────────────────────────────────

function InfoCard({ icon, label, value, valueClass = "text-aw-slate" }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-aw-gray/50 px-4 py-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[11px] font-bold text-aw-slate-light uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold mt-0.5 ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Main component (inner — uses hooks) ──────────────────────────────────────

function XeroSyncInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [status,  setStatus]  = useState<XeroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sync, setSync]       = useState<SyncState>({
    running: false, done: false, error: null,
    pages: [], totalImported: 0, totalSkipped: 0,
  });

  // Abort signal so we can cancel mid-loop
  const abortRef = useRef(false);

  // Flash from Xero callback: ?xero=connected&org=Demo+Company+(AU)
  const xeroParam = searchParams.get("xero");
  const orgParam  = searchParams.get("org");
  const msgParam  = searchParams.get("message");

  async function fetchStatus() {
    setLoading(true);
    try {
      const d = await fetch("/api/integrations/xero/status").then((r) => r.json());
      setStatus(d);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  // ── Frontend sync loop ──────────────────────────────────────────────────────

  async function startSync() {
    abortRef.current = false;
    setSync({ running: true, done: false, error: null, pages: [], totalImported: 0, totalSkipped: 0 });

    let page = 1;
    let totalImported = 0;
    let totalSkipped  = 0;

    while (true) {
      if (abortRef.current) break;

      let result: PageResult;
      try {
        const res = await fetch(`/api/integrations/xero/sync?page=${page}`, {
          method: "POST",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { message?: string };
          setSync((prev) => ({
            ...prev, running: false,
            error: err.message ?? `Server error on page ${page} (${res.status})`,
          }));
          return;
        }
        result = await res.json() as PageResult;
      } catch (e) {
        setSync((prev) => ({
          ...prev, running: false,
          error: `Network error on page ${page}: ${e instanceof Error ? e.message : String(e)}`,
        }));
        return;
      }

      totalImported += result.imported;
      totalSkipped  += result.skipped;

      setSync((prev) => ({
        ...prev,
        pages: [...prev.pages, result],
        totalImported,
        totalSkipped,
      }));

      if (!result.hasMore || result.processed === 0) break;

      page += 1;

      // Xero rate limit: max 60 req/min → 1s gap between pages
      await new Promise((r) => setTimeout(r, 1000));
    }

    setSync((prev) => ({ ...prev, running: false, done: true }));

    // Redirect to review queue after 2s
    setTimeout(() => {
      router.push("/dashboard/review?from=xero_sync");
    }, 2000);
  }

  function cancelSync() {
    abortRef.current = true;
    setSync((prev) => ({ ...prev, running: false }));
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black text-aw-slate">Xero Integration</h1>
        <p className="mt-1 text-sm text-aw-slate-mid">
          Connect your Xero account to auto-import transactions for carbon accounting.
        </p>
      </div>

      {/* Success flash from OAuth callback */}
      {xeroParam === "connected" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-aw-green/30 bg-aw-green-light px-5 py-4"
        >
          <CheckCircle2 size={18} className="text-aw-green shrink-0" />
          <div>
            <p className="text-sm font-black text-aw-green">
              ✅ Xero connected{orgParam ? ` — ${decodeURIComponent(orgParam)}` : ""}
            </p>
            <p className="text-xs text-aw-green/70 mt-0.5">
              Click "Sync Year to Date" to import your transactions.
            </p>
          </div>
        </motion.div>
      )}

      {/* Error flash from OAuth callback */}
      {xeroParam === "error" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600"
        >
          <AlertCircle size={16} className="shrink-0" />
          {msgParam ? decodeURIComponent(msgParam) : "Xero connection failed. Please try again."}
        </motion.div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-aw-slate-mid">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}

      {/* NOT CONNECTED */}
      {!loading && !status?.connected && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border-2 border-dashed border-[#1AB4D7]/40 bg-white p-10 flex flex-col items-center text-center gap-6 shadow-sm"
        >
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-[#1AB4D7]/10">
            <XeroLogo size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-aw-slate">Connect to Xero</h2>
            <p className="text-sm text-aw-slate-mid max-w-sm">
              Link your Xero account to automatically import all your business transactions.
              EcoLink will classify them and calculate your Scope 1, 2 and 3 emissions.
            </p>
          </div>
          <Link
            id="xero-connect-btn"
            href="/api/auth/xero/login"
            className="inline-flex items-center gap-3 rounded-2xl bg-[#1AB4D7] px-8 py-4 text-base font-black text-white shadow-lg shadow-[#1AB4D7]/30 transition-all hover:bg-[#1699b8] hover:shadow-xl active:scale-[0.98]"
          >
            <XeroLogo size={22} />
            Connect to Xero
            <ExternalLink size={16} />
          </Link>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-aw-slate-mid">
            {["Read-only access", "Bank-grade encryption", "Disconnect anytime"].map((t) => (
              <span key={t} className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-aw-green" /> {t}
              </span>
            ))}
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-3 text-xs text-amber-700 font-medium max-w-sm">
            <strong>🧪 Developer:</strong> Use <em>Demo Company (AU)</em> in the Xero developer portal.
          </div>
        </motion.div>
      )}

      {/* CONNECTED */}
      {!loading && status?.connected && (
        <AnimatePresence mode="wait">

          {/* ── Sync complete ──────────────────────────────────────────── */}
          {sync.done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl border border-aw-green/30 bg-white p-8 shadow-sm text-center space-y-4"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-aw-green-light flex items-center justify-center">
                <CheckCircle2 size={28} className="text-aw-green" />
              </div>
              <p className="text-xl font-black text-aw-slate">Sync Complete!</p>
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-black text-aw-green">{sync.totalImported}</p>
                  <p className="text-xs text-aw-slate-mid font-semibold mt-0.5">Imported</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black text-aw-slate-mid">{sync.totalSkipped}</p>
                  <p className="text-xs text-aw-slate-mid font-semibold mt-0.5">Already existed</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black text-aw-slate">{sync.pages.length}</p>
                  <p className="text-xs text-aw-slate-mid font-semibold mt-0.5">Pages synced</p>
                </div>
              </div>
              <p className="text-sm text-aw-slate-mid animate-pulse">
                Redirecting to Review Queue…
              </p>
            </motion.div>

          ) : (

            /* ── Status card + sync controls ───────────────────────────── */
            <motion.div
              key="connected"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-aw-green/30 bg-white p-8 shadow-sm space-y-6"
            >
              {/* Connection header */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1AB4D7]/10">
                    <XeroLogo size={34} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-aw-green" />
                      <span className="text-sm font-black text-aw-green">Connected</span>
                    </div>
                    <p className="text-lg font-black text-aw-slate mt-0.5">
                      {status.tenantName ?? "Xero Organisation"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoCard
                  icon={<Building2 size={16} className="text-aw-slate-light" />}
                  label="Organisation"
                  value={status.tenantName ?? "—"}
                />
                <InfoCard
                  icon={<ShieldCheck size={16} className="text-aw-green" />}
                  label="Token Status"
                  value={status.tokenValid ? "Valid ✓" : "Expired — reconnect"}
                  valueClass={status.tokenValid ? "text-aw-green" : "text-red-500"}
                />
              </div>

              {/* Sync error banner */}
              {sync.error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Sync error</p>
                    <p>{sync.error}</p>
                  </div>
                </motion.div>
              )}

              {/* Progress log */}
              {sync.pages.length > 0 && (
                <div className="rounded-2xl border border-aw-gray-border bg-aw-gray/30 px-5 py-4 space-y-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-aw-slate-mid">
                      Sync Progress
                    </p>
                    <div className="flex items-center gap-3 text-xs text-aw-slate-mid">
                      <span className="flex items-center gap-1">
                        <BarChart3 size={12} className="text-aw-green" />
                        {sync.totalImported} imported
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers size={12} />
                        {sync.pages.length} pages
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {sync.pages.map((r) => (
                      <LogRow key={r.page} result={r} />
                    ))}
                  </div>
                  {sync.running && (
                    <div className="flex items-center gap-2 text-xs text-aw-slate-mid animate-pulse pt-1">
                      <Loader2 size={12} className="animate-spin" />
                      Fetching page {(sync.pages.at(-1)?.page ?? 0) + 1}…
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {sync.running ? (
                  <button
                    id="xero-cancel-btn"
                    onClick={cancelSync}
                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-500 transition-all hover:bg-red-50"
                  >
                    <XCircle size={15} /> Cancel Sync
                  </button>
                ) : (
                  <>
                    <button
                      id="xero-sync-btn"
                      onClick={startSync}
                      disabled={!status.tokenValid}
                      className="flex items-center gap-2 rounded-xl bg-aw-green px-6 py-3 text-sm font-bold text-white shadow-md shadow-aw-green/20 transition-all hover:bg-aw-green-dark active:scale-[0.98] disabled:opacity-60"
                    >
                      <RefreshCw size={15} />
                      Sync Year to Date
                    </button>
                    <Link
                      href="/dashboard/review"
                      className="flex items-center gap-2 rounded-xl border border-aw-gray-border bg-white px-5 py-3 text-sm font-bold text-aw-slate transition-all hover:border-aw-slate/30"
                    >
                      Go to Review Queue <ArrowRight size={15} />
                    </Link>
                  </>
                )}
              </div>

              {/* Disconnect */}
              <div className="pt-2 border-t border-aw-gray-border">
                <p className="text-xs text-aw-slate-mid mb-1.5">
                  Disconnecting removes the Xero token. Your data in Xero is unchanged.
                </p>
                <Link href="/api/auth/xero/disconnect" className="text-xs font-bold text-red-500 hover:underline">
                  Disconnect Xero →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* How it works */}
      {!loading && !status?.connected && (
        <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-aw-slate-mid">How it works</h3>
          <ol className="space-y-3">
            {[
              { n: 1, t: "Connect Xero",        d: "Authorise EcoLink with read-only access." },
              { n: 2, t: "Sync Year to Date",   d: "Import transactions page-by-page — Vercel timeout safe." },
              { n: 3, t: "Auto-classify",        d: "Our deterministic engine routes each transaction (0 LLM calls)." },
              { n: 4, t: "AASB S2 Report",       d: "Download your sealed, SHA-256 verified compliance report." },
            ].map(({ n, t, d }) => (
              <li key={n} className="flex gap-4 items-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aw-green-light text-xs font-black text-aw-green">{n}</span>
                <div>
                  <p className="text-sm font-bold text-aw-slate">{t}</p>
                  <p className="text-xs text-aw-slate-mid">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Page export (wrapped in Suspense for useSearchParams) ────────────────────

export default function XeroSyncPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-aw-slate-mid" />
      </div>
    }>
      <XeroSyncInner />
    </Suspense>
  );
}
