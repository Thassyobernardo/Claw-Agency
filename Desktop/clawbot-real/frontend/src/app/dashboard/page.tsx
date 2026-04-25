"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf, Link2, RefreshCw, FileDown, AlertCircle,
  TrendingDown, Zap, Truck, ShoppingBag, BarChart3, Plane,
  CheckCircle2, XCircle, Loader2, Sparkles, Target, CreditCard,
  Upload, PenLine,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SummaryData {
  company: { name: string; abn: string | null; plan: string };
  reporting_year: number;
  total_co2e_t: number;
  scope1: { co2e_t: number; pct: number; tx_count: number };
  scope2: { co2e_t: number; pct: number; tx_count: number };
  scope3: { co2e_t: number; pct: number; tx_count: number };
  transactions: { total: number; classified: number; needs_review: number; factor_not_found: number };
}

interface TxRow {
  id: string;
  description: string;
  supplier_name: string | null;
  transaction_date: string;
  amount_aud: number;
  co2e_kg: number | null;
  scope: number | null;
  classification_status: string;
  account_name: string | null;
  category: string | null;
  activity: string | null;
}

interface CategoryRow {
  category: string;
  activity: string;
  scope: number;
  co2e_t: number;
  tx_count: number;
}

interface XeroStatus {
  connected: boolean;
  tenantName?: string;
  tokenValid?: boolean;
}

interface BenchmarkData {
  company_intensity:       number;
  sector_p25:              number;
  sector_p50:              number;
  sector_p75:              number;
  sector_avg:              number;
  percentile_rank:         number;
  sector_label:            string;
  size_band:               string;
  total_co2e_kg:           number;
  target_2030_intensity:   number;
  reduction_to_median_pct: number;
  data_quality:            "good" | "estimated" | "insufficient";
  message?:                string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusStyle: Record<string, string> = {
  classified:        "bg-aw-green-light text-aw-green-dark",
  needs_review:      "bg-yellow-100 text-yellow-700",
  factor_not_found:  "bg-red-100 text-red-600",
  pending:           "bg-gray-100 text-gray-500",
};
const statusLabel: Record<string, string> = {
  classified:        "Classified",
  needs_review:      "Needs Review",
  factor_not_found:  "No Factor",
  pending:           "Pending",
};

function categoryIcon(category: string | null) {
  if (!category) return <ShoppingBag size={14} />;
  const c = category.toLowerCase();
  if (c.includes("transport") || c.includes("combustion") || c.includes("petrol")) return <Truck size={14} />;
  if (c.includes("electricity")) return <Zap size={14} />;
  if (c.includes("travel") || c.includes("aviation")) return <Plane size={14} />;
  if (c.includes("freight")) return <Truck size={14} />;
  return <BarChart3 size={14} />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCo2e(kg: number | null) {
  if (kg == null) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg)} kg`;
}

// ─── Inner dashboard (uses useSearchParams) ───────────────────────────────────

function DashboardInner() {
  const searchParams   = useSearchParams();
  const xeroParam      = searchParams.get("xero");
  const xeroOrg        = searchParams.get("org");
  const xeroMsg        = searchParams.get("message");
  const myobParam      = searchParams.get("myob");
  const myobOrg        = searchParams.get("org");
  const myobMsg        = searchParams.get("message");

  const [summary,      setSummary]      = useState<SummaryData | null>(null);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [categories,   setCategories]   = useState<CategoryRow[]>([]);
  const [xeroStatus,   setXeroStatus]   = useState<XeroStatus | null>(null);
  const [benchmark,    setBenchmark]    = useState<BenchmarkData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [syncing,         setSyncing]         = useState(false);
  const [syncResult,      setSyncResult]      = useState<{ imported: number; skipped: number } | null>(null);
  const [classifying,     setClassifying]     = useState(false);
  const [classifyResult,  setClassifyResult]  = useState<{ classified: number; flagged: number; unclassified: number } | null>(null);
  const [flashVisible,    setFlashVisible]    = useState(!!(xeroParam || myobParam));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, c, x, b] = await Promise.all([
        fetch("/api/dashboard/summary").then(r => r.json()),
        fetch("/api/dashboard/transactions?limit=8").then(r => r.json()),
        fetch("/api/dashboard/categories?limit=5").then(r => r.json()),
        fetch("/api/integrations/xero/status").then(r => r.json()),
        fetch("/api/dashboard/benchmark").then(r => r.json()),
      ]);
      setSummary(s);
      setTransactions(t.transactions ?? []);
      setCategories(c.categories ?? []);
      setXeroStatus(x);
      setBenchmark(b?.data_quality !== "insufficient" ? b : null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!flashVisible) return;
    const t = setTimeout(() => setFlashVisible(false), 6000);
    return () => clearTimeout(t);
  }, [flashVisible]);

  const handleClassify = useCallback(async () => {
    setClassifying(true);
    setClassifyResult(null);
    try {
      const res = await fetch("/api/transactions/classify", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setClassifyResult({
          classified: data.classified,
          flagged:    data.flagged,
          unclassified: data.unclassified,
        });
        await loadData(); // Refresh dashboard stats
      } else {
        alert(data.message ?? "Classification failed. Please try again.");
      }
    } catch {
      alert("Network error during classification.");
    } finally {
      setClassifying(false);
    }
  }, [loadData]);

  const handleXeroSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/xero/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult({ imported: data.imported, skipped: data.skipped });
        await loadData();
      } else {
        alert(data.message ?? "Sync failed. Please try again.");
      }
    } catch {
      alert("Network error during sync.");
    } finally {
      setSyncing(false);
    }
  }, [loadData]);

  const scopeConfig = [
    { key: "scope1" as const, label: "Direct Emissions",      color: "bg-blue-500",   light: "bg-blue-50",        text: "text-blue-600"   },
    { key: "scope2" as const, label: "Purchased Electricity",  color: "bg-aw-green",   light: "bg-aw-green-light", text: "text-aw-green"   },
    { key: "scope3" as const, label: "Value Chain Emissions",  color: "bg-purple-500", light: "bg-purple-50",      text: "text-purple-600" },
  ];

  return (
    <div className="min-h-screen bg-aw-gray/40">

      {/* ── Xero Flash Banner ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {flashVisible && xeroParam && (
          <motion.div
            initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
            className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 text-sm font-semibold shadow-lg ${
              xeroParam === "connected" ? "bg-aw-green text-white" : "bg-red-500 text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              {xeroParam === "connected" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {xeroParam === "connected"
                ? `✅ Connected to Xero — ${xeroOrg ?? "your organisation"}`
                : `❌ ${xeroMsg ?? "Failed to connect Xero"}`}
            </div>
            <button onClick={() => setFlashVisible(false)} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MYOB Flash Banner ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {flashVisible && myobParam && !xeroParam && (
          <motion.div
            initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
            className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 text-sm font-semibold shadow-lg ${
              myobParam === "connected" ? "bg-blue-600 text-white" : "bg-red-500 text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              {myobParam === "connected" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {myobParam === "connected"
                ? `✅ Connected to MYOB — ${myobOrg ?? "your company file"}`
                : `❌ ${myobMsg ?? "Failed to connect MYOB"}`}
            </div>
            <button onClick={() => setFlashVisible(false)} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Classify Result Banner ──────────────────────────────────────────── */}
      <AnimatePresence>
        {classifyResult && (
          <motion.div
            initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 text-sm font-semibold shadow-lg bg-aw-green text-white"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <span>
                Classification complete — {classifyResult.classified} auto-classified,&nbsp;
                {classifyResult.flagged} flagged for review,&nbsp;
                {classifyResult.unclassified} could not be matched.
              </span>
            </div>
            <button onClick={() => setClassifyResult(null)} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-aw-gray-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aw-green">
              <Leaf size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-aw-slate">
              EcoLink<span className="text-aw-green">.</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {xeroStatus === null ? (
              <div className="flex items-center gap-2 rounded-xl border border-aw-gray-border bg-white px-5 py-2.5 text-sm font-bold text-aw-slate-mid">
                <Loader2 size={15} className="animate-spin" /> Checking Xero…
              </div>
            ) : xeroStatus.connected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-aw-green/30 bg-aw-green-light px-4 py-2.5 text-sm font-bold text-aw-green">
                  <CheckCircle2 size={15} /> {xeroStatus.tenantName ?? "Xero Connected"}
                </div>
                <button
                  onClick={handleXeroSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-xl border border-aw-gray-border bg-white px-4 py-2.5 text-sm font-bold text-aw-slate transition-all hover:border-aw-green/40 hover:text-aw-green active:scale-95 disabled:opacity-60"
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Syncing…" : syncResult ? `+${syncResult.imported} new` : "Sync Xero"}
                </button>
              </div>
            ) : (
              <Link href="/api/integrations/xero" className="flex items-center gap-2 rounded-xl border border-aw-gray-border bg-white px-5 py-2.5 text-sm font-bold text-aw-slate transition-all hover:border-aw-green/40 hover:text-aw-green active:scale-95">
                <Link2 size={16} /> Connect Xero
              </Link>
            )}

            {/* ── MYOB button — coming soon ── */}
            <div
              title="MYOB integration coming soon"
              className="flex items-center gap-2 rounded-xl border border-aw-gray-border bg-aw-gray/40 px-5 py-2.5 text-sm font-bold text-aw-slate-light cursor-not-allowed select-none"
            >
              <Link2 size={16} /> MYOB
              <span className="rounded-md bg-aw-slate/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-aw-slate-light">
                Soon
              </span>
            </div>

            <button
              onClick={handleClassify}
              disabled={classifying}
              className="flex items-center gap-2 rounded-xl border border-aw-green/40 bg-aw-green-light px-5 py-2.5 text-sm font-bold text-aw-green transition-all hover:bg-aw-green hover:text-white active:scale-95 disabled:opacity-60"
              title="Auto-classify all pending transactions using the EcoLink AI engine"
            >
              {classifying
                ? <><Loader2 size={16} className="animate-spin" /> Classifying…</>
                : classifyResult
                  ? <><CheckCircle2 size={16} /> {classifyResult.classified} classified</>
                  : <><Sparkles size={16} /> Classify</>}
            </button>
            <a
              href="/api/report/generate"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-aw-green px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-aw-green-dark active:scale-95"
            >
              <FileDown size={16} /> Export Report
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">

        {/* ── Page title ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-aw-slate">
              {loading ? <span className="opacity-40">Loading…</span> : summary?.company.name}
            </h1>
            <p className="text-sm text-aw-slate-mid font-medium mt-1">
              {summary?.company.abn ? `ABN ${summary.company.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')} · ` : ""}
              {summary?.company.plan ? (
                <>
                  <Link href="/billing" className="inline-flex items-center gap-1 text-aw-green hover:underline font-semibold">
                    <CreditCard size={12} />
                    {summary.company.plan.charAt(0).toUpperCase() + summary.company.plan.slice(1)} Plan
                  </Link>
                  {" · "}
                </>
              ) : ""}
              FY 2023–24
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(summary?.transactions.needs_review ?? 0) > 0 && (
              <Link
                href="/dashboard/review"
                className="flex items-center gap-1.5 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-100 active:scale-95"
              >
                <AlertCircle size={15} />
                {summary!.transactions.needs_review} transaction{summary!.transactions.needs_review > 1 ? "s" : ""} need review →
              </Link>
            )}
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── Total CO2e hero ──────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-aw-slate p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-aw-green-mid mb-2">
                Total Emissions — FY 2023–24
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-black">
                  {loading ? "—" : summary?.total_co2e_t ?? "0"}
                </span>
                <span className="text-2xl font-bold text-white/50">t CO₂e</span>
              </div>
              <p className="mt-2 text-sm text-white/50 font-medium">
                Across {summary?.transactions.classified ?? "—"} classified transactions · NGA Factors 2023–24
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
              <TrendingDown size={28} className="text-aw-green" />
              <div>
                <p className="text-lg font-black text-white">AASB S2</p>
                <p className="text-xs text-white/50 font-medium">Report ready to export</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Scope 1 / 2 / 3 cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {scopeConfig.map((s, idx) => {
            const data = summary?.[s.key];
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                className="rounded-2xl border border-aw-gray-border bg-white p-6 shadow-sm"
              >
                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${s.text}`}>
                  Scope {idx + 1}
                </p>
                <p className="text-xs text-aw-slate-mid mb-3">{s.label}</p>
                <p className="text-3xl font-black text-aw-slate mb-1">
                  {loading ? "—" : `${data?.co2e_t ?? 0} t`}
                </p>
                <p className="text-xs text-aw-slate-mid mb-4">
                  {data?.pct ?? 0}% of total · {data?.tx_count ?? 0} transactions
                </p>
                <div className="h-1.5 w-full rounded-full bg-aw-gray overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data?.pct ?? 0}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + idx * 0.1, ease: "easeOut" }}
                    className={`h-1.5 rounded-full ${s.color}`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Benchmark card ──────────────────────────────────────────────────── */}
        {benchmark && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-aw-gray-border bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-aw-green" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-aw-slate-mid">
                    Sector Benchmark
                  </h3>
                  {benchmark.data_quality === "estimated" && (
                    <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">Estimated</span>
                  )}
                </div>
                <p className="text-xs text-aw-slate-mid">
                  {benchmark.sector_label} · {benchmark.size_band} business ·{" "}
                  kg CO₂e per AUD 1,000 revenue
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black text-aw-slate">{benchmark.company_intensity}</p>
                <p className="text-xs text-aw-slate-mid">your intensity</p>
              </div>
            </div>

            {/* Percentile bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] font-semibold text-aw-slate-mid mb-1">
                <span>Best (P25)</span>
                <span>Median</span>
                <span>Laggards (P75)</span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-emerald-200 via-yellow-200 to-red-200 overflow-visible">
                {/* Sector markers */}
                <div className="absolute top-0 h-3 w-px bg-emerald-500"
                     style={{ left: `${(benchmark.sector_p25 / benchmark.sector_p75) * 75}%` }} />
                <div className="absolute top-0 h-3 w-px bg-yellow-500" style={{ left: "50%" }} />
                {/* Company position */}
                <motion.div
                  initial={{ left: 0 }}
                  animate={{ left: `${Math.min(98, benchmark.percentile_rank)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-aw-slate shadow-md flex items-center justify-center"
                  style={{ zIndex: 10 }}
                >
                  <div className="h-2 w-2 rounded-full bg-white" />
                </motion.div>
              </div>
              <div className="flex justify-between text-[10px] font-bold mt-1">
                <span className="text-emerald-600">{benchmark.sector_p25}</span>
                <span className="text-yellow-600">{benchmark.sector_p50}</span>
                <span className="text-red-500">{benchmark.sector_p75}</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-aw-gray/60 px-3 py-2.5 text-center">
                <p className="text-lg font-black text-aw-slate">{benchmark.percentile_rank}th</p>
                <p className="text-[10px] text-aw-slate-mid font-semibold">percentile</p>
                <p className="text-[10px] text-aw-slate-mid">
                  {benchmark.percentile_rank <= 25 ? "🏆 Top quartile" :
                   benchmark.percentile_rank <= 50 ? "✅ Above average" :
                   benchmark.percentile_rank <= 75 ? "⚠️ Below average" : "❌ Bottom quartile"}
                </p>
              </div>
              <div className="rounded-xl bg-aw-gray/60 px-3 py-2.5 text-center">
                <p className="text-lg font-black text-aw-slate">{benchmark.reduction_to_median_pct}%</p>
                <p className="text-[10px] text-aw-slate-mid font-semibold">to reach median</p>
                <p className="text-[10px] text-aw-slate-mid">reduction needed</p>
              </div>
              <div className="rounded-xl bg-aw-gray/60 px-3 py-2.5 text-center">
                <p className="text-lg font-black text-aw-green">{benchmark.target_2030_intensity}</p>
                <p className="text-[10px] text-aw-slate-mid font-semibold">2030 target</p>
                <p className="text-[10px] text-aw-slate-mid">−43% from avg</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Bottom row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

          {/* Top emission categories */}
          <div className="md:col-span-2 rounded-2xl border border-aw-gray-border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-aw-slate-mid mb-5">
              Top Emission Categories
            </h3>
            {loading ? (
              <div className="flex items-center justify-center h-32 text-aw-slate-mid"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                {categories.map((cat) => (
                  <div key={cat.activity} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aw-gray text-aw-slate-light shrink-0">
                        {categoryIcon(cat.category)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-aw-slate leading-tight line-clamp-1">{cat.category}</p>
                        <p className="text-xs text-aw-slate-mid">Scope {cat.scope} · {cat.tx_count} transactions</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-aw-slate ml-4 shrink-0">{cat.co2e_t} t</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div className="md:col-span-3 rounded-2xl border border-aw-gray-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-aw-slate-mid">
                Recent Transactions
              </h3>
              <Link href="/dashboard/review" className="text-xs font-bold text-aw-green hover:underline">Review Queue →</Link>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-32 text-aw-slate-mid"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-xl bg-aw-gray/60 px-4 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-aw-slate truncate">{tx.description}</p>
                      <p className="text-xs text-aw-slate-mid mt-0.5">
                        {tx.category ?? tx.account_name ?? "Uncategorised"} · {formatDate(tx.transaction_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black text-aw-slate">{formatCo2e(tx.co2e_kg)}</span>
                      <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${statusStyle[tx.classification_status] ?? statusStyle.pending}`}>
                        {statusLabel[tx.classification_status] ?? "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Data Input Section — always visible ──── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-aw-slate-mid mb-4">Add Transaction Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Option 1 — Connect Xero */}
            <div className={`rounded-2xl border-2 p-6 flex flex-col gap-4 transition-all ${
              xeroStatus?.connected
                ? "border-aw-green/40 bg-aw-green-light/20"
                : "border-dashed border-aw-gray-border bg-white hover:border-aw-green/30"
            }`}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-aw-green-light flex items-center justify-center">
                  <Link2 size={20} className="text-aw-green" />
                </div>
                <div>
                  <p className="font-bold text-aw-slate text-sm">Connect Xero</p>
                  <p className="text-xs text-aw-slate-mid">Auto-import all transactions</p>
                </div>
              </div>
              {xeroStatus?.connected ? (
                <div className="flex items-center gap-2 text-aw-green text-sm font-bold">
                  <CheckCircle2 size={16} /> {xeroStatus.tenantName ?? "Xero Connected"}
                </div>
              ) : (
                <Link href="/api/integrations/xero"
                  className="mt-auto w-full flex items-center justify-center gap-2 rounded-xl bg-aw-green px-4 py-3 text-white font-bold text-sm transition-all hover:bg-aw-green-dark active:scale-95">
                  <Link2 size={16} /> Connect Xero
                </Link>
              )}
            </div>

            {/* Option 2 — Import CSV/Excel */}
            <Link href="/import"
              className="rounded-2xl border-2 border-dashed border-aw-gray-border bg-white p-6 flex flex-col gap-4 hover:border-blue-400/50 hover:bg-blue-50/30 t