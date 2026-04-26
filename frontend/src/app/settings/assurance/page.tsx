"use client";

/**
 * /settings/assurance — Independent assurance metadata
 *
 * Records auditor info needed to remove the AUASB GS 100 warning from the
 * AASB S2 PDF cover page. Required for entities filing mandatory disclosures
 * under AASB S2 (Group 1 entities: rev ≥ AUD 500m or ≥ 500 employees).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, ShieldCheck, AlertTriangle, Info, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Status = "none" | "limited" | "reasonable";

interface AssuranceState {
  status:        Status;
  provider:      string;
  asic_reg:      string;
  standard:      string;
  obtained_at:   string;   // ISO YYYY-MM-DD
}

const EMPTY: AssuranceState = {
  status:      "none",
  provider:    "",
  asic_reg:    "",
  standard:    "AUASB GS 100",
  obtained_at: "",
};

export default function AssuranceSettingsPage() {
  const [data, setData]       = useState<AssuranceState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/assurance")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.assurance) {
          setData({
            status:      (d.assurance.assurance_status ?? "none") as Status,
            provider:    d.assurance.assurance_provider ?? "",
            asic_reg:    d.assurance.assurance_asic_reg ?? "",
            standard:    d.assurance.assurance_standard ?? "AUASB GS 100",
            obtained_at: d.assurance.assurance_obtained_at ?? "",
          });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        assurance_status:       data.status,
        assurance_provider:     data.provider || null,
        assurance_asic_reg:     data.asic_reg || null,
        assurance_standard:     data.standard || "AUASB GS 100",
        assurance_obtained_at:  data.obtained_at || null,
      };
      const res = await fetch("/api/settings/assurance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
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

  function update<K extends keyof AssuranceState>(k: K, v: AssuranceState[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-aw-green" size={32} />
      </div>
    );
  }

  const requiresProvider = data.status !== "none";
  const inputCls = "w-full rounded-xl border border-aw-gray-border bg-white px-3 py-2 text-sm text-aw-slate focus:border-aw-green focus:outline-none focus:ring-1 focus:ring-aw-green";

  return (
    <main className="min-h-screen bg-aw-gray/40 py-10">
      <div className="mx-auto max-w-3xl px-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-aw-slate-mid hover:underline">← Dashboard</Link>
            <h1 className="text-2xl font-black text-aw-slate mt-1">Independent Assurance</h1>
            <p className="text-sm text-aw-slate-mid">Auditor information for AUASB GS 100 disclosure on the report cover</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-aw-green px-5 py-2.5 text-white font-bold text-sm transition-all hover:bg-aw-green-dark active:scale-95 disabled:opacity-50"
          >
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

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-2 text-sm text-blue-900">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <p>
            Independent assurance is <strong>mandatory</strong> for Group 1 reporting entities under AASB S2
            (revenue ≥ AUD 500m or ≥ 500 employees, FY beginning on/after 1 January 2025).
            Smaller entities may produce reports without assurance for internal review.
          </p>
        </div>

        {/* Status selector */}
        <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-4">
          <h2 className="text-lg font-black text-aw-slate">Assurance Status</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatusCard
              icon={<AlertTriangle size={20} className="text-amber-600" />}
              title="None"
              desc="No independent assurance obtained."
              selected={data.status === "none"}
              onClick={() => update("status", "none")}
              warning
            />
            <StatusCard
              icon={<ShieldCheck size={20} className="text-blue-600" />}
              title="Limited Assurance"
              desc="Auditor performed limited procedures, expressed in negative form."
              selected={data.status === "limited"}
              onClick={() => update("status", "limited")}
            />
            <StatusCard
              icon={<ShieldCheck size={20} className="text-emerald-600" />}
              title="Reasonable Assurance"
              desc="Auditor performed comprehensive procedures, expressed in positive form."
              selected={data.status === "reasonable"}
              onClick={() => update("status", "reasonable")}
            />
          </div>

          {requiresProvider && (
            <div className="space-y-3 pt-4 border-t border-aw-gray-border">
              <label className="block">
                <span className="block text-xs font-bold text-aw-slate mb-1">Auditor / Audit firm name *</span>
                <input
                  className={inputCls}
                  value={data.provider}
                  onChange={(e) => update("provider", e.target.value)}
                  placeholder="e.g. KPMG Australia, Deloitte, EY, PwC, BDO Audit Pty Ltd"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-bold text-aw-slate mb-1">ASIC Company Auditor Registration Number *</span>
                <span className="block text-[11px] text-aw-slate-mid mb-1">
                  Verify the auditor is registered with ASIC at:&nbsp;
                  <a href="https://connectonline.asic.gov.au/RegistrySearch/" target="_blank" rel="noreferrer" className="text-aw-green underline">
                    connectonline.asic.gov.au
                  </a>
                </span>
                <input
                  className={inputCls}
                  value={data.asic_reg}
                  onChange={(e) => update("asic_reg", e.target.value)}
                  placeholder="e.g. 12345 or REG-12345"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-bold text-aw-slate mb-1">Assurance standard</span>
                <input
                  className={inputCls}
                  value={data.standard}
                  onChange={(e) => update("standard", e.target.value)}
                  placeholder="AUASB GS 100"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-bold text-aw-slate mb-1">Date assurance obtained</span>
                <input
                  type="date"
                  className={inputCls}
                  value={data.obtained_at}
                  onChange={(e) => update("obtained_at", e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        {/* Reference info card */}
        <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-3">
          <h3 className="text-sm font-bold text-aw-slate">About AUASB GS 100</h3>
          <p className="text-sm text-aw-slate-mid leading-relaxed">
            <strong>AUASB GS 100 — Assurance Engagements on Sustainability Information</strong> is the
            standard issued by the Auditing and Assurance Standards Board (AUASB) governing how auditors
            provide assurance over climate-related and other sustainability disclosures in Australia.
            It is the assurance counterpart to AASB S2.
          </p>
          <p className="text-sm text-aw-slate-mid leading-relaxed">
            Australia&apos;s Climate-related Financial Disclosure regime requires limited assurance over
            Scope 1 and 2 emissions for the first 3 years, then reasonable assurance thereafter, with
            Scope 3 assurance phased in over time.
          </p>
          <p className="text-xs text-aw-slate-mid">
            Reference:&nbsp;
            <a href="https://www.auasb.gov.au/" target="_blank" rel="noreferrer" className="text-aw-green underline">
              auasb.gov.au
            </a>
            &nbsp;·&nbsp;
            <a href="https://www.aasb.gov.au/" target="_blank" rel="noreferrer" className="text-aw-green underline">
              aasb.gov.au
            </a>
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-aw-green px-6 py-3 text-white font-bold text-sm transition-all hover:bg-aw-green-dark active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save Assurance Info"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── StatusCard ──────────────────────────────────────────────────────────────

function StatusCard({ icon, title, desc, selected, onClick, warning }: {
  icon: React.ReactNode; title: string; desc: string;
  selected: boolean; onClick: () => void; warning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border-2 p-4 transition-all ${
        selected
          ? warning
            ? "border-amber-500 bg-amber-50"
            : "border-aw-green bg-aw-green-light/30"
          : "border-aw-gray-border bg-white hover:border-aw-gray-mid"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-bold text-sm text-aw-slate">{title}</span>
      </div>
      <p className="text-xs text-aw-slate-mid leading-relaxed">{desc}</p>
    </button>
  );
}
