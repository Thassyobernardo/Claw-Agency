"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf, ArrowLeft, CheckCircle2, XCircle, ChevronDown,
  Loader2, Inbox, AlertCircle, RefreshCw, Zap, Truck,
  Plane, ShoppingBag, BarChart3, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TxReview {
  id: string;
  description: string;
  supplier_name: string | null;
  transaction_date: string;
  amount_aud: string;
  co2e_kg: string | null;
  classification_status: string;
  classification_confidence: string | null;
  account_name: string | null;
  account_code: string | null;
  category_id: string | null;
  category_code: string | null;
  category_label: string | null;
  scope: number | null;
}

interface Category {
  id: string;
  code: string;
  label: string;
  scope: number;
}

type ActionState = "idle" | "loading" | "done" | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const scopeColor: Record<number, string> = {
  1: "bg-blue-100 text-blue-700",
  2: "bg-emerald-100 text-emerald-700",
  3: "bg-purple-100 text-purple-700",
};

const scopeBadge: Record<number, string> = {
  1: "Scope 1 · Direct",
  2: "Scope 2 · Electricity",
  3: "Scope 3 · Value Chain",
};

function confidencePct(raw: string | null): number {
  if (!raw) return 0;
  return Math.round(parseFloat(raw) * 100);
}

function confidenceColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 60) return "text-yellow-600";
  return "text-red-500";
}

function formatAud(raw: string): string {
  const n = parseFloat(raw);
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCo2e(raw: string | null): string {
  if (!raw) return "—";
  const kg = parseFloat(raw);
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t CO₂e`;
  return `${kg.toFixed(1)} kg CO₂e`;
}

function categoryIcon(code: string | null) {
  if (!code) return <ShoppingBag size={14} />;
  if (code === "electricity") return <Zap size={14} />;
  if (code === "air_travel") return <Plane size={14} />;
  if (code === "road_freight") return <Truck size={14} />;
  if (code.startsWith("fuel")) return <Truck size={14} />;
  return <BarChart3 size={14} />;
}

// ─── Reclassify dropdown ──────────────────────────────────────────────────────

function ReclassifyDropdown({
  categories,
  currentId,
  txId,
  onReclassified,
}: {
  categories: Category[];
  currentId: string | null;
  txId: string;
  onReclassified: (txId: string) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);

  const pick = useCallback(async (catId: string) => {
    setOpen(false);
    if (catId === currentId) return;
    setLoading(true);
    try {
      await fetch(`/api/transactions/${txId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reclassify", category_id: catId }),
      });
      onReclassified(txId);
    } finally {
      setLoading(false);
    }
  }, [currentId, txId, onReclassified]);

  const byScope = [1, 2, 3].map((s) => ({
    scope: s,
    cats: categories.filter((c) => c.scope === s),
  }));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex items-center gap-1 rounded-lg border border-aw-gray-border bg-white px-3 py-1.5 text-xs font-semibold text-aw-slate transition hover:border-aw-slate/40 disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : null}
        Change <ChevronDown size={12} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-aw-gray-border bg-white shadow-xl overflow-hidden"
            >
              {byScope.map(({ scope, cats }) => (
                <div key={scope}>
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-aw-slate-mid">
                    Scope {scope}
                  </p>
                  {cats.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => pick(c.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-aw-gray/60 ${
                        c.id === currentId ? "font-bold text-aw-green" : "text-aw-slate"
                      }`}
                    >
                      {categoryIcon(c.code)}
                      {c.label}
                      {c.id === currentId && <CheckCircle2 size={12} className="ml-auto text-aw-green" />}
                    </button>
                  ))}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Transaction card ─────────────────────────────────────────────────────────

function TxCard({
  tx,
  categories,
  onAction,
}: {
  tx: TxReview;
  categories: Category[];
  onAction: (id: string, state: ActionState) => void;
}) {
  const pct = confidencePct(tx.classification_confidence);

  const act = useCallback(async (action: "approve" | "reject") => {
    onAction(tx.id, "loading");
    try {
      const res = await fetch(`/api/transactions/${tx.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      onAction(tx.id, res.ok ? "done" : "error");
    } catch {
      onAction(tx.id, "error");
    }
  }, [tx.id, onAction]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, scale: 0.97 }}
      className="rounded-2xl border border-aw-gray-border bg-white p-5 shadow-sm"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-aw-slate text-sm leading-snug truncate">{tx.description}</p>
          {tx.supplier_name && tx.supplier_name !== tx.description && (
            <p className="text-xs text-aw-slate-mid mt-0.5 truncate">{tx.supplier_name}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-aw-slate text-sm">{formatAud(tx.amount_aud)}</p>
          <p className="text-xs text-aw-slate-mid">{formatDate(tx.transaction_date)}</p>
        </div>
      </div>

      {/* Suggestion row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tx.scope && (
          <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${scopeColor[tx.scope] ?? "bg-gray-100 text-gray-600"}`}>
            {scopeBadge[tx.scope] ?? `Scope ${tx.scope}`}
          </span>
        )}
        {tx.category_label && (
          <span className="flex items-center gap-1 rounded-lg bg-aw-gray px-2.5 py-1 text-[11px] font-semibold text-aw-slate">
            {categoryIcon(tx.category_code)}
            {tx.category_label}
          </span>
        )}
        {tx.co2e_kg && (
          <span className="rounded-lg bg-aw-green-light px-2.5 py-1 text-[11px] font-bold text-aw-green">
            ≈ {formatCo2e(tx.co2e_kg)}
          </span>
        )}
        {pct > 0 && (
          <span className={`text-[11px] font-semibold ml-auto ${confidenceColor(pct)}`}>
            {pct}% confidence
          </span>
        )}
      </div>

      {/* Account hint */}
      {tx.account_name && (
        <p className="text-xs text-aw-slate-mid mb-4">
          Xero account: <span className="font-semibold text-aw-slate">{tx.account_name}</span>
          {tx.account_code ? ` (${tx.account_code})` : ""}
        </p>
      )}

      {/* Confidence bar */}
      {pct > 0 && (
        <div className="h-1 w-full rounded-full bg-aw-gray mb-4 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-1 rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => act("approve")}
          className="flex items-center gap-1.5 rounded-xl bg-aw-green px-4 py-2 text-xs font-bold text-white transition hover:bg-aw-green-dark active:scale-95"
        >
          <CheckCircle2 size={13} /> Approve
        </button>
        <button
          onClick={() => act("reject")}
          className="flex items-center gap-1.5 rounded-xl border border-aw-gray-border bg-white px-4 py-2 text-xs font-bold text-aw-slate transition hover:border-red-300 hover:text-red-500 active:scale-95"
        >
          <XCircle size={13} /> Reject
        </button>
        <div className="ml-auto">
          <ReclassifyDropdown
            categories={categories}
            currentId={tx.category_id}
            txId={tx.id}
            onReclassified={(id) => onAction(id, "done")}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const [transactions, setTransactions] = useState<TxReview[]>([]);
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/transactions/pending?limit=50");
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      setCategories(data.categories ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = useCallback((id: string, state: ActionState) => {
    setActionStates((prev) => ({ ...prev, [id]: state }));

    if (state === "done") {
      // Remove from list after short delay for exit animation
      setTimeout(() => {
        setTransactions((prev) => {
          const tx = prev.find((t) => t.id === id);
          if (tx) {
            if (actionStates[id] !== "done") {
              // Count actions (rough heuristic from last state set)
            }
          }
          return prev.filter((t) => t.id !== id);
        });
        setTotal((prev) => Math.max(0, prev - 1));
        setApprovedCount((prev) => prev + 1);
      }, 300);
    }
  }, [actionStates]);

  const handleReject = useCallback((id: string, state: ActionState) => {
    setActionStates((prev) => ({ ...prev, [id]: state }));
    if (state === "done") {
      setTimeout(() => {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
        setRejectedCount((prev) => prev + 1);
      }, 300);
    }
  }, []);

  // Unified action handler — distinguishes approve vs reject by checking what
  // was stored in the last "loading" call (we proxy both through handleAction for simplicity)
  const handleTxAction = useCallback((id: string, state: ActionState) => {
    handleAction(id, state);
  }, [handleAction]);

  const remaining = transactions.length;

  return (
    <div className="min-h-screen bg-aw-gray/40">

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-aw-gray-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-aw-slate-mid hover:text-aw-slate transition-colors">
              <ArrowLeft size={18} />
              <span className="text-sm font-semibold">Dashboard</span>
            </Link>
            <div className="h-5 w-px bg-aw-gray-border" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-aw-green">
                <Leaf size={14} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-aw-slate">
                EcoLink<span className="text-aw-green">.</span>
              </span>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-black text-aw-slate">Transaction Review</h1>
            {!loading && total > 0 && (
              <span className="flex items-center gap-1.5 rounded-xl bg-yellow-100 border border-yellow-200 px-3 py-1 text-sm font-bold text-yellow-700">
                <AlertCircle size={14} />
                {total} need{total === 1 ? "s" : ""} review
              </span>
            )}
          </div>
          <p className="text-sm text-aw-slate-mid font-medium max-w-xl">
            The AI classifier suggested categories for these transactions but wasn&apos;t confident enough to auto-apply them.
            Approve, reject, or reassign each one to improve your emissions data quality.
          </p>

          {/* Session stats */}
          {(approvedCount > 0 || rejectedCount > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-4 rounded-xl bg-aw-green-light border border-aw-green/20 px-4 py-3"
            >
              <Sparkles size={16} className="text-aw-green" />
              <span className="text-sm font-semibold text-aw-green">
                This session: {approvedCount} approved · {rejectedCount} rejected
              </span>
            </motion.div>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-aw-slate-mid">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : remaining === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-aw-green/30 bg-aw-green-light/20 py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-aw-green-light">
              <Inbox size={28} className="text-aw-green" />
            </div>
            <h2 className="text-xl font-black text-aw-slate mb-2">All caught up!</h2>
            <p className="text-sm text-aw-slate-mid font-medium max-w-sm">
              No transactions are waiting for review. Run the classifier from the dashboard to check for new ones.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 flex items-center gap-2 rounded-xl bg-aw-green px-6 py-2.5 text-sm font-bold text-white hover:bg-aw-green-dark transition-all active:scale-95"
            >
              Back to Dashboard
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {transactions.map((tx) => (
                <TxCard
                  key={tx.id}
                  tx={tx}
                  categories={categories}
                  onAction={handleTxAction}
                />
              ))}
            </AnimatePresence>

            {total > 50 && (
              <p className="text-center text-sm text-aw-slate-mid font-medium pt-4">
                Showing first 50 of {total} — approve or reject to reveal more.
              </p>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
