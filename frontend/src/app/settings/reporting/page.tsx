"use client";

/**
 * /settings/reporting — Reporting period configuration
 *
 * The CEO/CFO of the company picks:
 *  1. Which NGA edition applies to their report
 *  2. The reporting period (FY date range)
 *  3. How often they want to review emissions internally
 *  4. Who gets emailed period-end digests
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, Loader2, CheckCircle2, AlertCircle, Calendar, Bell, BookOpen } from "lucide-react";

type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "biannual" | "annual";

interface State {
  nga_edition_year:       number;
  reporting_frequency:    Frequency;
  reporting_period_start: string;
  reporting_period_end:   string;
  digest_enabled:         boolean;
  digest_recipients:      string;     // comma-separated for input
}

const NGA_EDITIONS = [
  { year: 2024, applies_to: "FY 2023-24 (1 Jul 2023 → 30 Jun 2024)", note: "Most common today" },
  { year: 2025, applies_to: "FY 2024-25 (1 Jul 2024 → 30 Jun 2025)", note: "Latest published" },
  { year: 2026, applies_to: "FY 2025-26 (1 Jul 2025 → 30 Jun 2026)", note: "Use when 2026 workbook is loaded" },
];

const FREQUENCIES: Array<{ value: Frequency; label: string; desc: string }> = [
  { value: "daily",     label: "Daily",     desc: "For data-heavy operations (logistics, manufacturing)" },
  { value: "weekly",    label: "Weekly",    desc: "Active monitoring with weekly digest" },
  { value: "monthly",   label: "Monthly",   desc: "Recommended for most SMEs" },
  { value: "quarterly", label: "Quarterly", desc: "Aligns with BAS quarter" },
  { value: "biannual",  label: "Biannual",  desc: "Two reviews per year" },
  { value: "annual",    label: "Annual",    desc: "Once per FY (minimum for AASB S2)" },
];

export default function ReportingSettingsPage() {
  const [data, setData]       = useState<State>({
    nga_edition_year:       2024,
    reporting_frequency:    "monthly",
    reporting_period_start: "2023-07-01",
    reporting_period_end:   "2024-06-30",
    digest_enabled:         true,
    digest_recipients:      "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/reporting")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.reporting) return;
        const r = d.reporting;
        setData({
          nga_edition_year:       r.nga_edition_year ?? 2024,
          reporting_frequency:    (r.reporting_frequency ?? "monthly") as Frequency,
          reporting_period_start: r.reporting_period_start ?? "2023-07-01",
          reporting_period_end:   r.reporting_period_end ?? "2024-06-30",
          digest_enabled:         r.digest_enabled !== false,
          digest_recipients:      (r.digest_recipients ?? []).join(", "),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const recipients = data.digest_recipients
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/settings/reporting", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nga_edition_year:       data.nga_edition_year,
          reporting_frequency:    data.reporting_frequency,
          reporting_period_start: data.reporting_period_start || null,
          reporting_period_end:   data.reporting_period_end   || null,
          digest_enabled:         data.digest_enabled,
          digest_recipients:      recipients,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Save failed");
      setSavedAt(new Date().toLocaleTimeString("en-AU"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof State>(k: K, v: State[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-aw-green" size={32} />
      </div>
    );
  }

  const inputCls = "w-full rounded-xl border border-aw-gray-border bg-white px-3 py-2 text-sm text-aw-slate focus:border-aw-green focus:outline-none focus:ring-1 focus:ring-aw-green";

  return (
    <main className="min-h-screen bg-aw-gray/40 py-10">
      <div className="mx-auto max-w-3xl px-6 space-y-6">

        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-aw-slate-mid hover:underline">← Dashboard</Link>
            <h1 className="text-2xl font-black text-aw-slate mt-1">Reporting Configuration</h1>
            <p className="text-sm text-aw-slate-mid">NGA edition · Reporting period · Review frequency · Digest</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-aw-green px-5 py-2.5 text-white font-bold text-sm hover:bg-aw-green-dark active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {savedAt && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 size={16} /> Saved at {savedAt}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-sm text-red-800">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── 1. NGA Edition ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-aw-green" />
            <h2 className="text-lg font-black text-aw-slate">NGA Factors Edition</h2>
          </div>
          <p className="text-sm text-aw-slate-mid">
            DCCEEW publishes a new NGA Workbook each August. Pick the edition matching your reporting period.
          </p>

          <div className="space-y-2">
            {NGA_EDITIONS.map((ed) => (
              <label
                key={ed.year}
                className={`block rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  data.nga_edition_year === ed.year
                    ? "border-aw-green bg-aw-green-light/30"
                    : "border-aw-gray-border hover:border-aw-gray-mid"
                }`}
              >
                <input
                  type="radio"
                  name="nga"
                  value={ed.year}
                  checked={data.nga_edition_year === ed.year}
                  onChange={() => update("nga_edition_year", ed.year)}
                  className="mr-2"
                />
                <span className="font-bold text-sm text-aw-slate">NGA {ed.year} Workbook</span>
                <span className="text-xs text-aw-slate-mid ml-2">— {ed.applies_to}</span>
                <span className="block text-[11px] text-aw-slate-mid italic mt-0.5">{ed.note}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── 2. Reporting Period ────────────────────────────────────── */}
        <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-aw-green" />
            <h2 className="text-lg font-black text-aw-slate">Reporting Period</h2>
          </div>
          <p className="text-sm text-aw-slate-mid">
            Australian Financial Year = 1 July → 30 June. Transactions outside this range are excluded from the report.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-bold text-aw-slate mb-1">Period start</span>
              <input type="date" className={inputCls}
                value={data.reporting_period_start}
                onChange={(e) => update("reporting_period_start", e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-aw-slate mb-1">Period end</span>
              <input type="date" className={inputCls}
                value={data.reporting_period_end}
                onChange={(e) => update("reporting_period_end", e.target.value)} />
            </label>
          </div>
        </div>

        {/* ── 3. Review Frequency ────────────────────────────────────── */}
        <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-aw-green" />
            <h2 className="text-lg font-black text-aw-slate">Review Frequency</h2>
          </div>
          <p className="text-sm text-aw-slate-mid">
            Track emissions continuously. Don&apos;t wait until ASIC submission — catch anomalies as they happen.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {FREQUENCIES.map((f) => (
              <label
                key={f.value}
                className={`block rounded-xl border-2 p-3 cursor-pointer transition-all ${
                  data.reporting_frequency === f.value
                    ? "border-aw-green bg-aw-green-light/30"
                    : "border-aw-gray-border hover:border-aw-gray-mid"
                }`}
              >
                <input
                  type="radio"
                  name="freq"
                  value={f.value}
                  checked={data.reporting_frequency === f.value}
                  onChange={() => update("reporting_frequency", f.value)}
                  className="mr-2"
                />
                <span className="font-bold text-sm text-aw-slate">{f.label}</span>
                <span className="block text-[11px] text-aw-slate-mid mt-0.5">{f.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── 4. Email Digest ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-aw-green" />
            <h2 className="text-lg font-black text-aw-slate">Email Digest</h2>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={data.digest_enabled}
              onChange={(e) => update("digest_enabled", e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-aw-slate">
              Send a digest at the end of each <strong>{data.reporting_frequency}</strong> period
              with totals, top sources, and flagged transactions.
            </span>
          </label>

          {data.digest_enabled && (
            <label className="block">
              <span className="block text-xs font-bold text-aw-slate mb-1">Recipients (comma-separated)</span>
              <input className={inputCls}
                value={data.digest_recipients}
                onChange={(e) => update("digest_recipients", e.target.value)}
                placeholder="cfo@example.com, sustainability@example.com" />
            </label>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-aw-green px-6 py-3 text-white font-bold text-sm hover:bg-aw-green-dark active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save Reporting Settings"}
          </button>
        </div>
      </div>
    </main>
  );
}
