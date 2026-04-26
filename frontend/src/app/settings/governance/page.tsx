"use client";

/**
 * /settings/governance — AASB S2 §6-25 questionnaire
 *
 * Climate Governance, Strategy, Risk Management questionnaire required for
 * the AASB S2 PDF report. Without this filled in, the PDF shows
 * "[NOT PROVIDED]" placeholders in Sections 2-5.
 *
 * Fields map 1:1 to company_governance table (migration 012).
 */

import { useEffect, useState } from "react";
import { Save, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import Link from "next/link";

type Frequency = "monthly" | "quarterly" | "biannual" | "annual";

interface GovernanceState {
  // §6-9 Governance
  board_oversight_body:         string;
  accountable_person_role:      string;
  review_frequency:             Frequency | "";
  governance_notes:             string;

  // §10-22 Strategy
  physical_risks_identified:    string;   // CSV from textarea
  physical_risks_narrative:     string;
  transition_risks_identified:  string;
  transition_risks_narrative:   string;
  opportunities_identified:     string;
  opportunities_narrative:      string;
  scenario_15c_completed:       boolean;
  scenario_15c_narrative:       string;
  scenario_2c_completed:        boolean;
  scenario_2c_narrative:        string;
  scenario_3c_completed:        boolean;
  scenario_3c_narrative:        string;
  financial_impact_current:     string;
  financial_impact_anticipated: string;
  business_model_resilience:    string;

  // §23-25 Risk Management
  risk_identification_process:  string;
  risk_integration_process:     string;
  risk_priority_method:         string;

  // §26-42 Targets
  target_base_year:             string;   // string for input
  target_target_year:           string;
  target_reduction_pct:         string;
  target_scope_coverage:        { s1: boolean; s2: boolean; s3: boolean };
  target_methodology:           string;
  target_narrative:             string;

  // §29 Cross-industry metrics
  energy_total_mwh:             string;
  energy_renewable_pct:         string;
  internal_carbon_price_aud:    string;
  exec_remuneration_climate_pct: string;

  // §B17 Connectivity
  fs_consistency_confirmed:     boolean;
  fs_inconsistencies_narrative: string;
}

const EMPTY: GovernanceState = {
  board_oversight_body: "", accountable_person_role: "", review_frequency: "", governance_notes: "",
  physical_risks_identified: "", physical_risks_narrative: "",
  transition_risks_identified: "", transition_risks_narrative: "",
  opportunities_identified: "", opportunities_narrative: "",
  scenario_15c_completed: false, scenario_15c_narrative: "",
  scenario_2c_completed:  false, scenario_2c_narrative: "",
  scenario_3c_completed:  false, scenario_3c_narrative: "",
  financial_impact_current: "", financial_impact_anticipated: "", business_model_resilience: "",
  risk_identification_process: "", risk_integration_process: "", risk_priority_method: "",
  target_base_year: "", target_target_year: "", target_reduction_pct: "",
  target_scope_coverage: { s1: false, s2: false, s3: false },
  target_methodology: "", target_narrative: "",
  energy_total_mwh: "", energy_renewable_pct: "",
  internal_carbon_price_aud: "", exec_remuneration_climate_pct: "",
  fs_consistency_confirmed: false, fs_inconsistencies_narrative: "",
};

const PHYSICAL_RISK_OPTIONS = [
  "Extreme heat",
  "Bushfire",
  "Flood",
  "Drought",
  "Cyclone",
  "Sea-level rise",
  "Coastal erosion",
  "Hailstorm",
];

const TRANSITION_RISK_OPTIONS = [
  "Carbon pricing / safeguard mechanism",
  "Customer demand shift",
  "Technology obsolescence",
  "Reputational risk",
  "Regulatory change (NGER / AASB S2 / Climate-related Financial Disclosure)",
  "Supply chain emissions cost pass-through",
  "Investor disclosure requirements",
];

const OPPORTUNITY_OPTIONS = [
  "Energy efficiency upgrades",
  "Solar PV / on-site renewables",
  "Electric fleet conversion",
  "Low-carbon products / services",
  "Access to green finance",
  "New low-emission markets",
  "Government grants / incentives",
];

export default function GovernanceSettingsPage() {
  const [data, setData]         = useState<GovernanceState>(EMPTY);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savedAt, setSavedAt]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // Load existing answers
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/governance")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.governance) {
          const g = d.governance;
          setData({
            board_oversight_body:    g.board_oversight_body ?? "",
            accountable_person_role: g.accountable_person_role ?? "",
            review_frequency:        g.review_frequency ?? "",
            governance_notes:        g.governance_notes ?? "",
            physical_risks_identified:   (g.physical_risks_identified ?? []).join(", "),
            physical_risks_narrative:    g.physical_risks_narrative ?? "",
            transition_risks_identified: (g.transition_risks_identified ?? []).join(", "),
            transition_risks_narrative:  g.transition_risks_narrative ?? "",
            opportunities_identified:    (g.opportunities_identified ?? []).join(", "),
            opportunities_narrative:     g.opportunities_narrative ?? "",
            scenario_15c_completed:  !!g.scenario_15c_completed,
            scenario_15c_narrative:  g.scenario_15c_narrative ?? "",
            scenario_2c_completed:   !!g.scenario_2c_completed,
            scenario_2c_narrative:   g.scenario_2c_narrative ?? "",
            scenario_3c_completed:   !!g.scenario_3c_completed,
            scenario_3c_narrative:   g.scenario_3c_narrative ?? "",
            financial_impact_current:     g.financial_impact_current ?? "",
            financial_impact_anticipated: g.financial_impact_anticipated ?? "",
            business_model_resilience:    g.business_model_resilience ?? "",
            risk_identification_process:  g.risk_identification_process ?? "",
            risk_integration_process:     g.risk_integration_process ?? "",
            risk_priority_method:         g.risk_priority_method ?? "",
            target_base_year:    g.target_base_year != null ? String(g.target_base_year) : "",
            target_target_year:  g.target_target_year != null ? String(g.target_target_year) : "",
            target_reduction_pct:g.target_reduction_pct != null ? String(g.target_reduction_pct) : "",
            target_scope_coverage: {
              s1: (g.target_scope_coverage ?? []).includes("scope_1"),
              s2: (g.target_scope_coverage ?? []).includes("scope_2"),
              s3: (g.target_scope_coverage ?? []).includes("scope_3"),
            },
            target_methodology: g.target_methodology ?? "",
            target_narrative:   g.target_narrative ?? "",
            energy_total_mwh:    g.energy_total_mwh != null ? String(g.energy_total_mwh) : "",
            energy_renewable_pct:g.energy_renewable_pct != null ? String(g.energy_renewable_pct) : "",
            internal_carbon_price_aud:   g.internal_carbon_price_aud != null ? String(g.internal_carbon_price_aud) : "",
            exec_remuneration_climate_pct: g.exec_remuneration_climate_pct != null ? String(g.exec_remuneration_climate_pct) : "",
            fs_consistency_confirmed:     !!g.fs_consistency_confirmed,
            fs_inconsistencies_narrative: g.fs_inconsistencies_narrative ?? "",
          });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Save
  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const csvToArr = (s: string): string[] =>
        s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

      const scopeCoverage: string[] = [];
      if (data.target_scope_coverage.s1) scopeCoverage.push("scope_1");
      if (data.target_scope_coverage.s2) scopeCoverage.push("scope_2");
      if (data.target_scope_coverage.s3) scopeCoverage.push("scope_3");

      const payload = {
        board_oversight_body:    data.board_oversight_body || null,
        accountable_person_role: data.accountable_person_role || null,
        review_frequency:        data.review_frequency || null,
        governance_notes:        data.governance_notes || null,
        physical_risks_identified:   csvToArr(data.physical_risks_identified),
        physical_risks_narrative:    data.physical_risks_narrative || null,
        transition_risks_identified: csvToArr(data.transition_risks_identified),
        transition_risks_narrative:  data.transition_risks_narrative || null,
        opportunities_identified:    csvToArr(data.opportunities_identified),
        opportunities_narrative:     data.opportunities_narrative || null,
        scenario_15c_completed: data.scenario_15c_completed,
        scenario_15c_narrative: data.scenario_15c_narrative || null,
        scenario_2c_completed:  data.scenario_2c_completed,
        scenario_2c_narrative:  data.scenario_2c_narrative || null,
        scenario_3c_completed:  data.scenario_3c_completed,
        scenario_3c_narrative:  data.scenario_3c_narrative || null,
        financial_impact_current:     data.financial_impact_current || null,
        financial_impact_anticipated: data.financial_impact_anticipated || null,
        business_model_resilience:    data.business_model_resilience || null,
        risk_identification_process:  data.risk_identification_process || null,
        risk_integration_process:     data.risk_integration_process || null,
        risk_priority_method:         data.risk_priority_method || null,
        target_base_year:    data.target_base_year ? parseInt(data.target_base_year) : null,
        target_target_year:  data.target_target_year ? parseInt(data.target_target_year) : null,
        target_reduction_pct:data.target_reduction_pct ? parseFloat(data.target_reduction_pct) : null,
        target_scope_coverage: scopeCoverage,
        target_methodology:  data.target_methodology || null,
        target_narrative:    data.target_narrative || null,
        energy_total_mwh:    data.energy_total_mwh ? parseFloat(data.energy_total_mwh) : null,
        energy_renewable_pct:data.energy_renewable_pct ? parseFloat(data.energy_renewable_pct) : null,
        internal_carbon_price_aud:   data.internal_carbon_price_aud ? parseFloat(data.internal_carbon_price_aud) : null,
        exec_remuneration_climate_pct: data.exec_remuneration_climate_pct ? parseFloat(data.exec_remuneration_climate_pct) : null,
        fs_consistency_confirmed:     data.fs_consistency_confirmed,
        fs_inconsistencies_narrative: data.fs_inconsistencies_narrative || null,
      };

      const res = await fetch("/api/settings/governance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Save failed");
      setSavedAt(new Date().toLocaleTimeString("en-AU"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof GovernanceState>(k: K, v: GovernanceState[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  const togglePhysical = (item: string) => {
    const cur = data.physical_risks_identified.split(",").map((x) => x.trim()).filter(Boolean);
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    update("physical_risks_identified", next.join(", "));
  };
  const toggleTransition = (item: string) => {
    const cur = data.transition_risks_identified.split(",").map((x) => x.trim()).filter(Boolean);
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    update("transition_risks_identified", next.join(", "));
  };
  const toggleOpportunity = (item: string) => {
    const cur = data.opportunities_identified.split(",").map((x) => x.trim()).filter(Boolean);
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    update("opportunities_identified", next.join(", "));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-aw-green" size={32} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-aw-gray/40 py-10">
      <div className="mx-auto max-w-4xl px-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-aw-slate-mid hover:underline">← Dashboard</Link>
            <h1 className="text-2xl font-black text-aw-slate mt-1">Climate Governance Questionnaire</h1>
            <p className="text-sm text-aw-slate-mid">AASB S2 §6-25 — required for the Climate Disclosure Report</p>
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
          <p>Answers here populate the AASB S2 sections of your PDF report. Empty fields render as <em>[NOT PROVIDED]</em> in the report.</p>
        </div>

        {/* ── §6-9 Governance ───────────────────────────────────────── */}
        <Section title="1. Governance (AASB S2 §6-9)" desc="Board oversight of climate-related risks and opportunities.">
          <Field label="Body responsible for oversight" hint="e.g. Board of Directors, Climate Sub-Committee, Audit & Risk Committee">
            <input className={inputCls} value={data.board_oversight_body} onChange={(e) => update("board_oversight_body", e.target.value)} placeholder="Board of Directors" />
          </Field>
          <Field label="Accountable individual" hint="e.g. CEO, CFO, Head of Sustainability">
            <input className={inputCls} value={data.accountable_person_role} onChange={(e) => update("accountable_person_role", e.target.value)} placeholder="Chief Executive Officer" />
          </Field>
          <Field label="Review frequency">
            <select className={inputCls} value={data.review_frequency} onChange={(e) => update("review_frequency", e.target.value as Frequency | "")}>
              <option value="">Select frequency…</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biannual">Biannual (twice per year)</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <Field label="Additional governance narrative">
            <textarea rows={4} className={inputCls} value={data.governance_notes} onChange={(e) => update("governance_notes", e.target.value)} placeholder="Describe how climate risk is escalated, who reports to whom, frequency of board updates, etc." />
          </Field>
        </Section>

        {/* ── §10-22 Strategy ───────────────────────────────────────── */}
        <Section title="2. Strategy (AASB S2 §10-22)" desc="Climate-related risks, opportunities, and scenario analysis.">

          <h4 className="text-sm font-bold text-aw-slate mt-4">Physical Risks</h4>
          <CheckGroup options={PHYSICAL_RISK_OPTIONS} selected={data.physical_risks_identified} toggle={togglePhysical} />
          <Field label="Physical risks narrative">
            <textarea rows={3} className={inputCls} value={data.physical_risks_narrative} onChange={(e) => update("physical_risks_narrative", e.target.value)} placeholder="How climate-related physical events could impact your operations, sites, supply chain." />
          </Field>

          <h4 className="text-sm font-bold text-aw-slate mt-6">Transition Risks</h4>
          <CheckGroup options={TRANSITION_RISK_OPTIONS} selected={data.transition_risks_identified} toggle={toggleTransition} />
          <Field label="Transition risks narrative">
            <textarea rows={3} className={inputCls} value={data.transition_risks_narrative} onChange={(e) => update("transition_risks_narrative", e.target.value)} placeholder="Policy, technology, market, reputation risks of moving to a low-carbon economy." />
          </Field>

          <h4 className="text-sm font-bold text-aw-slate mt-6">Climate-related Opportunities</h4>
          <CheckGroup options={OPPORTUNITY_OPTIONS} selected={data.opportunities_identified} toggle={toggleOpportunity} />
          <Field label="Opportunities narrative">
            <textarea rows={3} className={inputCls} value={data.opportunities_narrative} onChange={(e) => update("opportunities_narrative", e.target.value)} placeholder="Cost reduction, new markets, products, capital access, resilience." />
          </Field>

          <h4 className="text-sm font-bold text-aw-slate mt-6">Scenario Analysis (§22 — minimum 1.5°C and 2°C)</h4>

          <ScenarioBlock
            label="1.5 °C Scenario (mandatory)"
            checked={data.scenario_15c_completed}
            onCheck={(v) => update("scenario_15c_completed", v)}
            narrative={data.scenario_15c_narrative}
            onNarrative={(v) => update("scenario_15c_narrative", v)}
            placeholder="Describe how your business performs under a 1.5°C scenario aligned with the Paris Agreement."
          />
          <ScenarioBlock
            label="2 °C Scenario (mandatory)"
            checked={data.scenario_2c_completed}
            onCheck={(v) => update("scenario_2c_completed", v)}
            narrative={data.scenario_2c_narrative}
            onNarrative={(v) => update("scenario_2c_narrative", v)}
            placeholder="Describe how your business performs under a 2°C scenario."
          />
          <ScenarioBlock
            label="3 °C Disorderly Scenario (optional)"
            checked={data.scenario_3c_completed}
            onCheck={(v) => update("scenario_3c_completed", v)}
            narrative={data.scenario_3c_narrative}
            onNarrative={(v) => update("scenario_3c_narrative", v)}
            placeholder="Optional — disorderly transition stress test."
          />

          <h4 className="text-sm font-bold text-aw-slate mt-6">Financial Impact</h4>
          <Field label="Current period financial impact">
            <textarea rows={2} className={inputCls} value={data.financial_impact_current} onChange={(e) => update("financial_impact_current", e.target.value)} placeholder="e.g. AUD X carbon-related cost exposure, X% revenue from low-emission products." />
          </Field>
          <Field label="Anticipated financial impact">
            <textarea rows={2} className={inputCls} value={data.financial_impact_anticipated} onChange={(e) => update("financial_impact_anticipated", e.target.value)} placeholder="e.g. AUD X capex required for fleet electrification by 2030." />
          </Field>
          <Field label="Business model resilience">
            <textarea rows={3} className={inputCls} value={data.business_model_resilience} onChange={(e) => update("business_model_resilience", e.target.value)} placeholder="How your business model can adapt to the scenarios above." />
          </Field>
        </Section>

        {/* ── §23-25 Risk Management ─────────────────────────────── */}
        <Section title="3. Risk Management (AASB S2 §23-25)" desc="How climate risks are identified, assessed, and integrated.">
          <Field label="Risk identification process">
            <textarea rows={3} className={inputCls} value={data.risk_identification_process} onChange={(e) => update("risk_identification_process", e.target.value)} placeholder="Process for identifying climate-related risks (workshops, climate scenarios, expert input)." />
          </Field>
          <Field label="Integration into overall risk management">
            <textarea rows={3} className={inputCls} value={data.risk_integration_process} onChange={(e) => update("risk_integration_process", e.target.value)} placeholder="How climate risk fits into the wider Enterprise Risk Management framework." />
          </Field>
          <Field label="Prioritisation method">
            <input className={inputCls} value={data.risk_priority_method} onChange={(e) => update("risk_priority_method", e.target.value)} placeholder="e.g. Likelihood × Impact matrix" />
          </Field>
        </Section>

        {/* ── §26-42 Targets ───────────────────────────────────── */}
        <Section title="4. Targets (AASB S2 §26-42)" desc="Greenhouse gas reduction targets and progress.">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Base year">
              <input type="number" className={inputCls} value={data.target_base_year} onChange={(e) => update("target_base_year", e.target.value)} placeholder="2023" />
            </Field>
            <Field label="Target year">
              <input type="number" className={inputCls} value={data.target_target_year} onChange={(e) => update("target_target_year", e.target.value)} placeholder="2030" />
            </Field>
            <Field label="Reduction (%)">
              <input type="number" className={inputCls} value={data.target_reduction_pct} onChange={(e) => update("target_reduction_pct", e.target.value)} placeholder="42" />
            </Field>
          </div>
          <Field label="Scopes covered">
            <div className="flex gap-4 mt-1">
              {(["s1","s2","s3"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.target_scope_coverage[k]}
                    onChange={(e) => update("target_scope_coverage", { ...data.target_scope_coverage, [k]: e.target.checked })}
                  />
                  Scope {k.slice(1)}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Methodology">
            <input className={inputCls} value={data.target_methodology} onChange={(e) => update("target_methodology", e.target.value)} placeholder="e.g. SBTi 1.5°C aligned" />
          </Field>
          <Field label="Target narrative">
            <textarea rows={3} className={inputCls} value={data.target_narrative} onChange={(e) => update("target_narrative", e.target.value)} placeholder="Describe the target and progress year-on-year." />
          </Field>
        </Section>

        {/* ── §29 Cross-industry metrics ──────────────────────── */}
        <Section title="5. Cross-industry Metrics (AASB S2 §29)" desc="Mandatory metrics required for all reporting entities.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total energy consumption (MWh)">
              <input type="number" className={inputCls} value={data.energy_total_mwh} onChange={(e) => update("energy_total_mwh", e.target.value)} placeholder="1500" />
            </Field>
            <Field label="Renewable energy %">
              <input type="number" className={inputCls} value={data.energy_renewable_pct} onChange={(e) => update("energy_renewable_pct", e.target.value)} placeholder="35" />
            </Field>
            <Field label="Internal carbon price (AUD/tCO₂e)">
              <input type="number" className={inputCls} value={data.internal_carbon_price_aud} onChange={(e) => update("internal_carbon_price_aud", e.target.value)} placeholder="80.00" />
            </Field>
            <Field label="Exec remuneration linked to climate (%)">
              <input type="number" className={inputCls} value={data.exec_remuneration_climate_pct} onChange={(e) => update("exec_remuneration_climate_pct", e.target.value)} placeholder="10" />
            </Field>
          </div>
        </Section>

        {/* ── §B17 FS Connectivity ──────────────────────────────── */}
        <Section title="6. Connectivity to Financial Statements (AASB S2 §B17)">
          <label className="flex items-start gap-3 mt-2">
            <input
              type="checkbox"
              checked={data.fs_consistency_confirmed}
              onChange={(e) => update("fs_consistency_confirmed", e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-aw-slate">
              <strong>I confirm</strong> that the data, assumptions, and reporting period in this climate disclosure
              are <strong>consistent</strong> with those used in the entity&apos;s Financial Statements for the same
              reporting period.
            </span>
          </label>
          <Field label="Disclosed inconsistencies (if any)">
            <textarea rows={3} className={inputCls} value={data.fs_inconsistencies_narrative} onChange={(e) => update("fs_inconsistencies_narrative", e.target.value)} placeholder="Explain any divergence between climate disclosure and FS data." />
          </Field>
        </Section>

        {/* Save again at bottom */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-aw-green px-6 py-3 text-white font-bold text-sm transition-all hover:bg-aw-green-dark active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save Questionnaire"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── Helpers / sub-components ───────────────────────────────────────────────

const inputCls = "w-full rounded-xl border border-aw-gray-border bg-white px-3 py-2 text-sm text-aw-slate focus:border-aw-green focus:outline-none focus:ring-1 focus:ring-aw-green";

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-4">
      <div>
        <h2 className="text-lg font-black text-aw-slate">{title}</h2>
        {desc && <p className="text-xs text-aw-slate-mid mt-0.5">{desc}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-aw-slate mb-1">{label}</span>
      {hint && <span className="block text-[11px] text-aw-slate-mid mb-1">{hint}</span>}
      {children}
    </label>
  );
}

function CheckGroup({ options, selected, toggle }: { options: string[]; selected: string; toggle: (s: string) => void }) {
  const selectedSet = new Set(selected.split(",").map((x) => x.trim()));
  return (
    <div className="grid grid-cols-2 gap-2 mt-1">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm text-aw-slate">
          <input type="checkbox" checked={selectedSet.has(opt)} onChange={() => toggle(opt)} />
          {opt}
        </label>
      ))}
    </div>
  );
}

function ScenarioBlock({ label, checked, onCheck, narrative, onNarrative, placeholder }: {
  label: string; checked: boolean; onCheck: (v: boolean) => void;
  narrative: string; onNarrative: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="rounded-xl border border-aw-gray-border p-3 space-y-2 mt-2">
      <label className="flex items-center gap-2 text-sm font-bold text-aw-slate">
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
        {label}
      </label>
      <textarea
        rows={2}
        className={inputCls}
        value={narrative}
        onChange={(e) => onNarrative(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
