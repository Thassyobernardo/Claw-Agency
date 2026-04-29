"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, ShieldCheck, Loader2, AlertCircle,
  CheckCircle2, Lock, Eye, ChevronRight, BarChart3,
} from "lucide-react";
import Link from "next/link";


// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportRow {
  id: string;
  financial_year: string;
  status: "generating" | "sealed" | "failed";
  total_scope1_tonnes: number | null;
  total_scope2_tonnes: number | null;
  total_scope3_tonnes: number | null;
  data_quality_score: number | null;
  sha256_hash: string | null;
  file_url: string | null;   // kept for presence check; NEVER used as href
  sealed_at: string | null;
  created_at: string;
}


interface PreviewData {
  scope1Tonnes: number;
  scope2Tonnes: number;
  scope3Tonnes: number;
  totalCo2eTonnes: number;
  dataQualityScore: number;
  uncertaintyTier: string;
  classifiedCount: number;
  needsReviewCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateHash(hash: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function tierColor(tier: string): string {
  if (tier === "Tier 1") return "text-aw-green";
  if (tier === "Tier 2") return "text-yellow-600";
  return "text-red-500";
}

function qualityBadge(score: number | null): string {
  if (!score) return "bg-gray-100 text-gray-600";
  if (score >= 95) return "bg-aw-green-light text-aw-green border border-aw-green/20";
  if (score >= 80) return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  return "bg-red-50 text-red-600 border border-red-200";
}

// Current Australian FY
function currentFY(): string {
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const start = String(y).slice(2);
  const end   = String(y + 1).slice(2);
  return `FY${start}-${end}`;
}

// ─── Secure Download Button ───────────────────────────────────────────────────
//
// Fetches a 5-minute pre-signed URL from /api/reports/[id]/download
// (server-side, SERVICE_ROLE key) then opens it in a new tab.
// No public bucket URL ever reaches the client.

function DownloadButton({
  reportId,
  hasFile,
  label = "PDF",
  className = "",
}: {
  reportId: string;
  hasFile: boolean;
  label?: string;
  className?: string;
}) {
  const [fetching, setFetching] = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  if (!hasFile) return <span className="text-aw-slate-light text-xs">—</span>;

  async function handleClick() {
    setFetching(true);
    setErr(null);
    try {
      const res  = await fetch(`/api/reports/${reportId}/download`);
      const data = await res.json() as { signedUrl?: string; error?: string };
      if (!res.ok || !data.signedUrl) {
        setErr(data.error ?? "Download failed.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setErr("Network error.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={fetching}
        className={`inline-flex items-center gap-1 rounded-lg border border-aw-gray-border bg-white px-3 py-1.5 text-xs font-bold text-aw-slate transition hover:border-aw-green/40 hover:text-aw-green disabled:opacity-60 ${className}`}
      >
        {fetching ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
        {label}
      </button>
      {err && <span className="text-[10px] text-red-500">{err}</span>}
    </div>
  );
}


// ─── Seal Confirmation Modal ──────────────────────────────────────────────────

function SealModal({
  fy,
  preview,
  onConfirm,
  onClose,
  sealing,
}: {
  fy: string;
  preview: PreviewData;
  onConfirm: () => void;
  onClose: () => void;
  sealing: boolean;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-aw-gray-border overflow-hidden"
      >
        {/* Red accent top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-red-400 to-orange-400" />

        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 border border-red-100">
              <Lock size={22} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-aw-slate">Seal & Generate Official PDF</h2>
              <p className="text-sm text-aw-slate-mid mt-0.5">
                {fy} · AASB S2 Climate-related Financial Disclosure
              </p>
            </div>
          </div>

          {/* Totals summary */}
          <div className="rounded-2xl bg-aw-gray/50 border border-aw-gray-border p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-aw-slate-mid">
              Report Totals
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Scope 1", val: preview.scope1Tonnes, color: "text-blue-600" },
                { label: "Scope 2", val: preview.scope2Tonnes, color: "text-emerald-600" },
                { label: "Scope 3", val: preview.scope3Tonnes, color: "text-aw-slate" },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white rounded-xl py-3 px-2 border border-aw-gray-border">
                  <p className={`text-lg font-black ${color}`}>{val.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-aw-slate-light mt-0.5">{label} · t CO₂e</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm font-bold text-aw-slate pt-1 border-t border-aw-gray-border">
              <span>Total Emissions</span>
              <span className="text-aw-green text-lg">{preview.totalCo2eTonnes.toFixed(4)} t CO₂e</span>
            </div>
          </div>

          {/* Data quality note */}
          <div className={`rounded-xl px-4 py-3 text-xs font-semibold ${qualityBadge(preview.dataQualityScore)}`}>
            Data Quality: {preview.dataQualityScore.toFixed(1)}% ({preview.uncertaintyTier})
            {preview.needsReviewCount > 0 && (
              <span className="ml-2 text-amber-600">
                · {preview.needsReviewCount} unresolved transaction(s) will be excluded
              </span>
            )}
          </div>

          {/* Irreversibility warning */}
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-3">
            <p className="text-sm font-black text-red-700 flex items-center gap-2">
              <AlertCircle size={15} /> This action is irreversible
            </p>
            <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
              <li>All {preview.classifiedCount} classified transactions will be permanently locked</li>
              <li>The SHA-256 sealed PDF will be stored in Supabase Storage</li>
              <li>Amendments require a new supplementary report</li>
            </ul>

            {/* Required checkbox */}
            <label className="flex items-start gap-3 cursor-pointer pt-1">
              <div className="relative mt-0.5">
                <input
                  id="seal-confirm-checkbox"
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="sr-only"
                />
                <div
                  onClick={() => setChecked((v) => !v)}
                  className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
                    checked
                      ? "border-red-500 bg-red-500"
                      : "border-red-300 bg-white hover:border-red-400"
                  }`}
                >
                  {checked && <CheckCircle2 size={12} className="text-white" />}
                </div>
              </div>
              <span className="text-xs font-bold text-red-700 leading-relaxed">
                I understand this action is irreversible and locks all transactions for {fy}.
                I confirm the data has been reviewed and is accurate.
              </span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={sealing}
              className="flex-1 rounded-xl border border-aw-gray-border bg-white py-3 text-sm font-bold text-aw-slate-mid transition-all hover:border-aw-slate/30 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="seal-confirm-btn"
              onClick={onConfirm}
              disabled={!checked || sealing}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-red-600/20"
            >
              {sealing ? (
                <><Loader2 size={15} className="animate-spin" /> Sealing…</>
              ) : (
                <><Lock size={15} /> Seal Report</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const fy = currentFY();

  const [reports,  setReports]  = useState<ReportRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [preview,  setPreview]  = useState<PreviewData | null>(null);
  const [prevLoad, setPrevLoad] = useState(false);
  const [prevErr,  setPrevErr]  = useState<string | null>(null);
  const [showModal,setShowModal]= useState(false);
  const [sealing,  setSealing]  = useState(false);
  const [sealErr,  setSealErr]  = useState<string | null>(null);
  // After seal: store reportId for signed download (not file_url)
  const [sealDone, setSealDone] = useState<{ reportId: string; hash: string } | null>(null);


  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch("/api/reports").then((r) => r.json()) as { reports?: ReportRow[] };
      setReports(d.reports ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReports(); }, [loadReports]);

  // ── Preview totals ────────────────────────────────────────────────────────

  async function fetchPreview() {
    setPrevLoad(true);
    setPrevErr(null);
    try {
      const res  = await fetch("/api/reports/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ financialYear: fy }) });
      const data = await res.json() as { error?: string; message?: string } & Partial<PreviewData>;
      if (!res.ok) {
        setPrevErr(data.message ?? data.error ?? "Preview failed.");
        return;
      }
      setPreview(data as PreviewData);
    } catch {
      setPrevErr("Network error.");
    } finally {
      setPrevLoad(false);
    }
  }

  // ── Seal ──────────────────────────────────────────────────────────────────

  async function handleSeal() {
    setSealing(true);
    setSealErr(null);
    try {
      const res  = await fetch("/api/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ financialYear: fy }) });
      const data = await res.json() as { error?: string; message?: string; reportId?: string; sha256Hash?: string };
      if (!res.ok) {
        setSealErr(data.message ?? data.error ?? "Sealing failed.");
        setShowModal(false);
        return;
      }
      // Store reportId — download uses signed URL, never direct file_url
      setSealDone({ reportId: data.reportId!, hash: data.sha256Hash! });

      setShowModal(false);
      await loadReports();
    } catch {
      setSealErr("Network error during sealing.");
      setShowModal(false);
    } finally {
      setSealing(false);
    }
  }

  const currentSealed = reports.find((r) => r.financial_year === fy && r.status === "sealed");

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-10">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black text-aw-slate">AASB S2 Reports</h1>
        <p className="mt-1 text-sm text-aw-slate-mid">
          Generate and download sealed climate-related financial disclosure reports.
        </p>
      </div>

      {/* ── Seal success banner ───────────────────────────────────────────── */}
      <AnimatePresence>
        {sealDone && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-2xl border border-aw-green/30 bg-aw-green-light px-5 py-4"
          >
            <CheckCircle2 size={18} className="text-aw-green shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-aw-green">✅ Report sealed successfully!</p>
              <p className="text-xs text-aw-slate-mid mt-1 font-mono break-all">SHA-256: {sealDone.hash}</p>
              <div className="mt-2">
                <DownloadButton reportId={sealDone.reportId} hasFile label="Download PDF" />
              </div>
            </div>
          </motion.div>

        )}
      </AnimatePresence>

      {/* ── Part 1: Historical reports table ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-black text-aw-slate flex items-center gap-2">
          <FileText size={16} className="text-aw-slate-light" /> Report History
        </h2>

        <div className="rounded-2xl border border-aw-gray-border bg-white overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-aw-slate-mid">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-aw-gray flex items-center justify-center mb-3">
                <FileText size={20} className="text-aw-slate-light" />
              </div>
              <p className="text-sm font-bold text-aw-slate">No reports yet</p>
              <p className="text-xs text-aw-slate-mid mt-1">Generate your first AASB S2 report below.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aw-gray-border bg-aw-gray/40">
                  {["Financial Year", "Status", "Scope 1+2+3 (tCO₂e)", "Data Quality", "SHA-256", "Sealed", ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-aw-slate-light">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => {
                  const total = ((r.total_scope1_tonnes ?? 0) + (r.total_scope2_tonnes ?? 0) + (r.total_scope3_tonnes ?? 0)).toFixed(4);
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-aw-gray-border/50 last:border-0 hover:bg-aw-gray/20 transition-colors"
                    >
                      <td className="px-5 py-4 font-black text-aw-slate">{r.financial_year}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                          r.status === "sealed" ? "bg-aw-green-light text-aw-green border border-aw-green/20"
                          : r.status === "failed" ? "bg-red-50 text-red-500 border border-red-200"
                          : "bg-amber-50 text-amber-600 border border-amber-200"
                        }`}>
                          {r.status === "sealed" && <ShieldCheck size={11} />}
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-aw-slate tabular-nums">{total}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${qualityBadge(r.data_quality_score)}`}>
                          {r.data_quality_score?.toFixed(1) ?? "—"}%
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-aw-slate-mid" title={r.sha256_hash ?? ""}>
                        {truncateHash(r.sha256_hash)}
                      </td>
                      <td className="px-5 py-4 text-aw-slate-mid">{formatDate(r.sealed_at)}</td>
                      <td className="px-5 py-4">
                        <DownloadButton reportId={r.id} hasFile={!!r.file_url} />
                      </td>

                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Part 2: New report card ───────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-black text-aw-slate flex items-center gap-2">
          <BarChart3 size={16} className="text-aw-slate-light" /> Generate New Report
        </h2>

        <div className="rounded-3xl border border-aw-gray-border bg-white p-8 shadow-sm space-y-6">
          {/* FY badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-aw-green-light border border-aw-green/20">
                <FileText size={22} className="text-aw-green" />
              </div>
              <div>
                <p className="text-xl font-black text-aw-slate">{fy}</p>
                <p className="text-xs text-aw-slate-mid">Australian Financial Year · 1 Jul → 30 Jun</p>
              </div>
            </div>
            {currentSealed && (
              <span className="flex items-center gap-1.5 rounded-xl bg-aw-green-light border border-aw-green/20 px-4 py-2 text-sm font-bold text-aw-green">
                <ShieldCheck size={14} /> Sealed
              </span>
            )}
          </div>

          {/* Error banners */}
          {prevErr && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={15} className="shrink-0" /> {prevErr}
            </div>
          )}
          {sealErr && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Sealing failed</p>
                <p>{sealErr}</p>
                {sealErr.includes("pendentes") && (
                  <Link href="/dashboard/review" className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-red-700 hover:underline">
                    Go to Review Queue <ChevronRight size={12} />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Preview totals */}
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-aw-gray/40 border border-aw-gray-border p-5 space-y-4"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-aw-slate-mid">Preview Totals (NGA Factors 2025)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Scope 1 · Direct", val: preview.scope1Tonnes, color: "text-blue-700" },
                  { label: "Scope 2 · Electricity", val: preview.scope2Tonnes, color: "text-emerald-700" },
                  { label: "Scope 3 · Value Chain", val: preview.scope3Tonnes, color: "text-aw-slate" },
                  { label: "Total", val: preview.totalCo2eTonnes, color: "text-aw-green" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-white rounded-xl p-4 border border-aw-gray-border text-center">
                    <p className={`text-xl font-black ${color}`}>{val.toFixed(4)}</p>
                    <p className="text-[10px] font-bold text-aw-slate-light mt-1">{label}</p>
                    <p className="text-[10px] text-aw-slate-light">t CO₂e</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-aw-slate-mid pt-1">
                <span>Data quality: <strong className={tierColor(preview.uncertaintyTier)}>{preview.dataQualityScore.toFixed(1)}% ({preview.uncertaintyTier})</strong></span>
                <span>{preview.classifiedCount} classified · {preview.needsReviewCount} unresolved</span>
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!currentSealed && (
              <>
                <button
                  id="preview-btn"
                  onClick={fetchPreview}
                  disabled={prevLoad}
                  className="flex items-center justify-center gap-2 rounded-xl border border-aw-gray-border bg-white px-6 py-3 text-sm font-bold text-aw-slate transition-all hover:border-aw-slate/30 disabled:opacity-60"
                >
                  {prevLoad ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                  Preview Totals
                </button>

                <button
                  id="seal-btn"
                  onClick={() => {
                    if (!preview) { void fetchPreview().then(() => setShowModal(true)); return; }
                    setShowModal(true);
                  }}
                  disabled={sealing}
                  className="flex items-center justify-center gap-2 rounded-xl bg-aw-slate px-6 py-3 text-sm font-bold text-white transition-all hover:bg-aw-slate/90 active:scale-[0.98] disabled:opacity-60 shadow-md"
                >
                  <Lock size={15} />
                  Seal &amp; Generate Official PDF
                </button>
              </>
            )}

            {currentSealed && currentSealed.file_url && (
              <DownloadButton
                reportId={currentSealed.id}
                hasFile
                label="Download Sealed PDF"
                className="!rounded-xl !px-6 !py-3 !text-sm bg-aw-green !text-white !border-0 hover:!bg-aw-green-dark shadow-md shadow-aw-green/20"
              />
            )}

          </div>

          {/* Compliance note */}
          <p className="text-xs text-aw-slate-mid border-t border-aw-gray-border pt-4">
            ⚖️ Reports are generated under <strong>AASB S2</strong> (Climate-related Financial Disclosures) using{" "}
            <strong>NGA Factors 2025</strong> (DCCEEW). Each report is sealed with a SHA-256 hash
            stored immutably in the database. Post-seal amendments require a new supplementary report.
          </p>
        </div>
      </section>

      {/* Seal modal */}
      {showModal && preview && (
        <SealModal
          fy={fy}
          preview={preview}
          onConfirm={handleSeal}
          onClose={() => setShowModal(false)}
          sealing={sealing}
        />
      )}
    </div>
  );
}
