/**
 * GET /api/report/generate
 *
 * AASB S2 Climate-related Disclosure Report generator.
 *
 * The output is print-friendly HTML — the user clicks "Save as PDF" or uses
 * Cmd+P to print to PDF. Designed to satisfy AASB S2 mandatory disclosures:
 *
 *   §6-9    Governance
 *   §10-22  Strategy (incl. scenario analysis)
 *   §23-25  Risk Management
 *   §26-42  Metrics & Targets
 *   §B17    Connectivity to Financial Statements
 *
 * Plus AUASB GS 100 assurance disclaimer + NGA Factors 2023-24 emission
 * factor traceability + GHG Protocol category attribution.
 *
 * Data sources:
 *   - companies                  → entity name, ABN, state, plan, period, assurance
 *   - company_governance         → AASB S2 §6-25 narrative answers
 *   - transactions + emission_factors → metrics
 *
 * For sections where the customer has NOT yet completed the questionnaire,
 * we render a clearly-marked "[NOT PROVIDED — complete in Settings]" block
 * rather than fabricating narrative.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanyRow {
  name:                     string;
  abn:                      string | null;
  state:                    string | null;
  plan:                     string;
  reporting_period_start:   string | null;
  reporting_period_end:     string | null;
  assurance_status:         "none" | "limited" | "reasonable";
  assurance_provider:       string | null;
  assurance_asic_reg:       string | null;
  assurance_standard:       string | null;
  assurance_obtained_at:    string | null;
}

interface GovernanceRow {
  board_oversight_body:         string | null;
  accountable_person_role:      string | null;
  review_frequency:             string | null;
  governance_notes:             string | null;
  physical_risks_identified:    string[] | null;
  physical_risks_narrative:     string | null;
  transition_risks_identified:  string[] | null;
  transition_risks_narrative:   string | null;
  opportunities_identified:     string[] | null;
  opportunities_narrative:      string | null;
  scenario_15c_completed:       boolean;
  scenario_15c_narrative:       string | null;
  scenario_2c_completed:        boolean;
  scenario_2c_narrative:        string | null;
  scenario_3c_completed:        boolean;
  scenario_3c_narrative:        string | null;
  financial_impact_current:     string | null;
  financial_impact_anticipated: string | null;
  business_model_resilience:    string | null;
  risk_identification_process:  string | null;
  risk_integration_process:     string | null;
  risk_priority_method:         string | null;
  target_base_year:             number | null;
  target_target_year:           number | null;
  target_reduction_pct:         string | null;
  target_scope_coverage:        string[] | null;
  target_methodology:           string | null;
  target_narrative:             string | null;
  energy_total_mwh:             string | null;
  energy_renewable_pct:         string | null;
  internal_carbon_price_aud:    string | null;
  exec_remuneration_climate_pct: string | null;
  fs_consistency_confirmed:     boolean;
  fs_inconsistencies_narrative: string | null;
}

interface TxRow {
  transaction_date:  Date;
  description:       string;
  supplier_name:     string | null;
  amount_aud:        number;
  co2e_kg:           number | null;
  scope:             number | null;
  category_label:    string | null;
  ghg_cat_num:       number | null;
  activity_value:    string | null;
  activity_unit:     string | null;
  electricity_state: string | null;
  factor_value:      string | null;
  factor_source:     string | null;
}

interface ScopeTotalRow {
  scope:    number | null;
  co2e_t:   string;
  tx_count: number;
}

interface FactorUsedRow {
  scope:        number;
  activity:     string;
  unit:         string;
  co2e_factor:  string;
  state:        string | null;
  source_table: string | null;
  tx_count:     number;
}

// ─── HTML escape ─────────────────────────────────────────────────────────────

function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "1 July 2023 – 30 June 2024";
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function fmtCo2e(kg: number | null): string {
  if (kg == null) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  return `${Math.round(kg)} kg`;
}

function fmtAud(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

function fmtAbn(abn: string | null): string {
  if (!abn) return "—";
  return abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, "$1 $2 $3 $4");
}

/** Render a narrative field — use [NOT PROVIDED] sentinel if blank. */
function narr(s: string | null | undefined): string {
  if (!s || !s.trim()) {
    return `<span class="not-provided">[NOT PROVIDED — complete in Settings → Climate Governance]</span>`;
  }
  return esc(s);
}

function listOrEmpty(arr: string[] | null): string {
  if (!arr || arr.length === 0) return narr(null);
  return `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

// ─── Fetch all report data ───────────────────────────────────────────────────

async function fetchReportData(companyId: string) {
  const [companyRows, governanceRows, txRows, scopeTotals, factorRows, reviewRow, excludedRow] = await Promise.all([
    sql<CompanyRow[]>`
      SELECT name, abn, state, plan,
             reporting_period_start::text, reporting_period_end::text,
             assurance_status, assurance_provider, assurance_asic_reg,
             assurance_standard, assurance_obtained_at::text
      FROM   companies
      WHERE  id = ${companyId}::uuid
      LIMIT  1
    `,
    sql<GovernanceRow[]>`
      SELECT *
      FROM   company_governance
      WHERE  company_id = ${companyId}::uuid
      LIMIT  1
    `.catch(() => [] as GovernanceRow[]),
    sql<TxRow[]>`
      SELECT
        t.transaction_date,
        t.description,
        t.supplier_name,
        t.amount_aud,
        t.co2e_kg,
        t.scope,
        ec.label              AS category_label,
        NULL                  AS ghg_cat_num,
        t.quantity_value::text AS activity_value,
        t.quantity_unit       AS activity_unit,
        t.electricity_state,
        ef.co2e_factor::text  AS factor_value,
        ef.source_table       AS factor_source
      FROM transactions t
      LEFT JOIN emission_categories ec ON t.category_id = ec.id
      LEFT JOIN emission_factors    ef ON t.emission_factor_id = ef.id
      WHERE t.company_id = ${companyId}::uuid
        AND t.classification_status = 'classified'
        AND t.excluded = FALSE
      ORDER BY t.scope ASC NULLS LAST, t.transaction_date ASC
    `,
    sql<ScopeTotalRow[]>`
      SELECT
        t.scope,
        ROUND(SUM(t.co2e_kg) / 1000, 3)::text AS co2e_t,
        COUNT(*)::int AS tx_count
      FROM transactions t
      WHERE t.company_id = ${companyId}::uuid
        AND t.classification_status = 'classified'
        AND t.excluded = FALSE
      GROUP BY t.scope
      ORDER BY t.scope ASC NULLS LAST
    `,
    sql<FactorUsedRow[]>`
      SELECT
        ef.scope,
        ef.activity,
        ef.unit,
        ef.co2e_factor::text,
        ef.state,
        ef.source_table,
        COUNT(t.id)::int AS tx_count
      FROM emission_factors ef
      INNER JOIN transactions t ON t.emission_factor_id = ef.id
      WHERE t.company_id = ${companyId}::uuid
        AND t.classification_status = 'classified'
        AND t.excluded = FALSE
      GROUP BY ef.scope, ef.activity, ef.unit, ef.co2e_factor, ef.state, ef.source_table
      ORDER BY ef.scope, ef.activity
    `,
    sql<{ count: string }[]>`
      SELECT COUNT(*)::text FROM transactions
      WHERE company_id = ${companyId}::uuid AND classification_status = 'needs_review'
    `,
    sql<{ count: string; reason: string | null }[]>`
      SELECT COUNT(*)::text, exclusion_reason AS reason
      FROM transactions
      WHERE company_id = ${companyId}::uuid AND excluded = TRUE
      GROUP BY exclusion_reason
    `,
  ]);

  return {
    company:     companyRows[0],
    governance:  governanceRows[0] ?? null,
    txRows,
    scopeTotals,
    factorRows,
    reviewCount: Number(reviewRow[0]?.count ?? 0),
    excluded:    excludedRow,
  };
}

// ─── HTML template ───────────────────────────────────────────────────────────

function buildHtml(data: Awaited<ReturnType<typeof fetchReportData>>) {
  const { company, governance, txRows, scopeTotals, factorRows, reviewCount, excluded } = data;

  const totalCo2eT = scopeTotals.reduce((s, r) => s + Number(r.co2e_t), 0);
  const totalTx    = scopeTotals.reduce((s, r) => s + Number(r.tx_count), 0);

  const byScope = Object.fromEntries(scopeTotals.map((r) => [r.scope ?? 0, r]));
  const s1 = byScope[1] ?? { co2e_t: "0", tx_count: 0 };
  const s2 = byScope[2] ?? { co2e_t: "0", tx_count: 0 };
  const s3 = byScope[3] ?? { co2e_t: "0", tx_count: 0 };

  const txByScope = (n: number) => txRows.filter((t) => t.scope === n);

  // ── Cover meta values ──────────────────────────────────────────────────
  const safeName   = esc(company.name);
  const safeAbn    = esc(fmtAbn(company.abn));
  const safePlan   = esc(company.plan);
  const period     = fmtPeriod(company.reporting_period_start, company.reporting_period_end);
  const generated  = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  // ── Assurance disclaimer ──────────────────────────────────────────────
  const assuranceBlock = (() => {
    if (company.assurance_status === "none" || !company.assurance_provider) {
      return `
        <div class="callout callout-warn">
          <h4>⚠ Independent Assurance — NOT OBTAINED</h4>
          <p>This report has <strong>NOT been subject to independent assurance</strong>.
          Entities subject to mandatory AASB S2 disclosure (Group 1: revenue ≥ AUD 500m
          or ≥ 500 employees, FY beginning on/after 1 January 2025) <strong>must</strong>
          obtain limited assurance from a registered company auditor under
          <strong>AUASB GS 100 — Assurance Engagements on Sustainability Information</strong>
          before submission to ASIC.</p>
          <p style="margin-top:8px;font-size:9pt;color:#92400e">This report is suitable for
          internal review and benchmarking only.</p>
        </div>`;
    }
    return `
      <div class="callout callout-ok">
        <h4>✓ Independent Assurance — ${esc(company.assurance_status === "limited" ? "Limited" : "Reasonable")} Assurance Obtained</h4>
        <p><strong>Auditor:</strong> ${esc(company.assurance_provider)}<br/>
        <strong>ASIC Registration:</strong> ${esc(company.assurance_asic_reg ?? "—")}<br/>
        <strong>Standard:</strong> ${esc(company.assurance_standard ?? "AUASB GS 100")}<br/>
        <strong>Date Obtained:</strong> ${company.assurance_obtained_at ? fmtDate(company.assurance_obtained_at) : "—"}</p>
      </div>`;
  })();

  // ── Transaction table per scope ───────────────────────────────────────
  const txTable = (rows: TxRow[]) =>
    rows.length === 0
      ? `<p class="none">No classified transactions in this scope.</p>`
      : `<table>
          <thead><tr>
            <th>Date</th><th>Description</th><th>Category</th>
            <th style="text-align:center">Activity</th>
            <th style="text-align:center">Factor</th>
            <th style="text-align:right">Amount</th>
            <th style="text-align:right">CO₂e</th>
          </tr></thead>
          <tbody>
            ${rows.map((t, i) => `
              <tr class="${i % 2 === 0 ? "even" : "odd"}">
                <td>${fmtDate(t.transaction_date)}</td>
                <td>${esc(t.description)}${t.supplier_name ? `<br/><span class="dim">${esc(t.supplier_name)}</span>` : ""}</td>
                <td>${esc(t.category_label ?? "—")}${t.electricity_state ? `<br/><span class="dim">${esc(t.electricity_state)}</span>` : ""}</td>
                <td style="text-align:center">${t.activity_value != null ? `${Number(t.activity_value).toLocaleString("en-AU")} ${esc(t.activity_unit ?? "")}` : "—"}</td>
                <td style="text-align:center;font-size:8pt;color:#64748b">${t.factor_value != null ? `${Number(t.factor_value).toFixed(3)}<br/>${esc(t.factor_source ?? "")}` : "—"}</td>
                <td style="text-align:right">${fmtAud(Number(t.amount_aud))}</td>
                <td style="text-align:right;font-weight:700">${fmtCo2e(t.co2e_kg != null ? Number(t.co2e_kg) : null)}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;

  // ── Emission Factors table — ALL factors actually used in this report ───
  const efTable = factorRows.length === 0
    ? `<p class="none">No emission factors applied.</p>`
    : `<table class="ef-table">
        <thead><tr>
          <th>Scope</th><th>Activity</th><th>Unit</th><th>State</th>
          <th style="text-align:right">kg CO₂e/unit</th>
          <th>Source</th><th style="text-align:right">Used in</th>
        </tr></thead>
        <tbody>
          ${factorRows.map((f, i) => `
            <tr class="${i % 2 === 0 ? "even" : "odd"}">
              <td><span class="chip s${f.scope}">Scope ${f.scope}</span></td>
              <td>${esc(f.activity)}</td>
              <td>${esc(f.unit)}</td>
              <td>${esc(f.state ?? "—")}</td>
              <td style="text-align:right;font-weight:700">${Number(f.co2e_factor).toFixed(4)}</td>
              <td>NGA 2023-24 ${esc(f.source_table ?? "")}</td>
              <td style="text-align:right">${f.tx_count} tx</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

  // ── Excluded transactions summary ─────────────────────────────────────
  const excludedSummary = excluded.length === 0
    ? `<p>No transactions excluded.</p>`
    : `<ul>${excluded.map((e) => `<li><strong>${e.count}</strong> transaction(s) excluded — reason: <code>${esc(e.reason ?? "unspecified")}</code></li>`).join("")}</ul>`;

  // ── Governance helpers (handle null governance row) ───────────────────
  const g = governance;
  const has = (v: string | null | undefined): boolean => !!v && v.trim().length > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${safeName} — AASB S2 Climate Disclosure Report</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; font-size: 10pt; color: #1e293b; background: #f8fafc; }
  @page { size: A4; margin: 0; }

  .page-container { padding: 18mm 18mm 22mm 18mm; background: white; min-height: 100vh; }

  /* ── COVER ───────────────────────────────────────────────────────── */
  .cover { height: 100vh; display: flex; flex-direction: column; page-break-after: always;
           background: linear-gradient(135deg, #020617 0%, #0f172a 100%); color: white; padding: 0; position: relative; overflow: hidden; }
  .cover::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                   background: radial-gradient(circle at center, rgba(16, 185, 129, 0.15) 0%, transparent 60%); pointer-events: none; }
  .cover-top { padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; z-index: 10; position: relative;
               border-bottom: 1px solid rgba(255,255,255,0.05); }
  .cover-top h1 { font-family: 'Outfit', sans-serif; font-size: 20pt; font-weight: 900; letter-spacing: -0.5px; }
  .cover-top span { font-size: 10pt; color: #34d399; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .cover-body { flex: 1; padding: 50px 50px 30px; display: flex; flex-direction: column; justify-content: center; z-index: 10; position: relative; }
  .cover-label { font-size: 10pt; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: #10b981;
                 margin-bottom: 16px; padding: 6px 12px; background: rgba(16,185,129,0.1); border-radius: 8px;
                 border: 1px solid rgba(16,185,129,0.2); display: inline-block; align-self: flex-start; }
  .cover-title { font-family: 'Outfit', sans-serif; font-size: 38pt; font-weight: 900; line-height: 1.1; color: white; margin-bottom: 8px; }
  .cover-rule { width: 80px; height: 4px; background: linear-gradient(90deg, #10b981, #3b82f6); margin: 16px 0; border-radius: 2px; }
  .cover-meta { display: grid; grid-template-columns: 160px 1fr; gap: 8px 16px; margin-top: 16px;
                background: rgba(255,255,255,0.03); padding: 20px; border-radius: 16px;
                border: 1px solid rgba(255,255,255,0.05); }
  .cover-meta .key { font-size: 9pt; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
  .cover-meta .val { font-size: 10pt; color: #f8fafc; font-weight: 500; }
  .cover-hero { display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
                border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 20px; padding: 24px 32px; margin-top: 20px; }
  .cover-hero .num { font-family: 'Outfit', sans-serif; font-size: 56pt; font-weight: 900; line-height: 1; color: white; }
  .cover-hero .unit { font-family: 'Outfit', sans-serif; font-size: 18pt; color: #34d399; font-weight: 800; }
  .cover-hero .label { font-size: 10pt; color: #cbd5e1; margin-left: 16px; line-height: 1.5; padding-left: 16px; border-left: 2px solid rgba(255,255,255,0.1); }
  .cover-footer { padding: 16px 40px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 8pt; color: #64748b; background: rgba(0,0,0,0.2); }

  /* ── SECTION HEADERS ─────────────────────────────────────────────── */
  h2 { font-family: 'Outfit', sans-serif; font-size: 22pt; font-weight: 800; color: #0f172a; margin: 0 0 8px; letter-spacing: -0.5px; }
  h3 { font-family: 'Outfit', sans-serif; font-size: 14pt; font-weight: 700; color: #0f172a; margin: 24px 0 10px; }
  h4 { font-family: 'Outfit', sans-serif; font-size: 11pt; font-weight: 700; color: #1e293b; margin: 16px 0 6px; }
  p  { font-size: 10pt; line-height: 1.7; margin-bottom: 10px; color: #334155; }
  ul, ol { padding-left: 22px; margin-bottom: 10px; font-size: 10pt; line-height: 1.7; color: #334155; }
  li { margin-bottom: 4px; }
  .rule { height: 4px; margin: 0 0 16px; border-radius: 2px; }
  .rule-blue { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
  .rule-green { background: linear-gradient(90deg, #10b981, #34d399); }
  .rule-purple { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
  .rule-amber { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
  .rule-slate { background: linear-gradient(90deg, #475569, #94a3b8); }
  .rule-red { background: linear-gradient(90deg, #ef4444, #f87171); }
  .dim { color: #94a3b8; font-size: 9pt; }
  .not-provided { color: #b45309; font-style: italic; background: #fef3c7; padding: 2px 8px; border-radius: 4px; font-size: 9.5pt; font-weight: 600; }

  /* ── SCOPE CARDS ─────────────────────────────────────────────────── */
  .scope-cards { display: flex; gap: 14px; margin: 16px 0; }
  .scope-card  { flex: 1; border-radius: 16px; padding: 18px; color: white; position: relative; overflow: hidden; }
  .scope-card .s-label { font-size: 8pt; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; opacity: 0.9; margin-bottom: 4px; }
  .scope-card .s-desc { font-size: 9pt; opacity: 0.8; margin-bottom: 10px; }
  .scope-card .s-val { font-family: 'Outfit', sans-serif; font-size: 24pt; font-weight: 900; line-height: 1; }
  .scope-card .s-sub { font-size: 8pt; opacity: 0.75; margin-top: 4px; }

  /* ── TABLES ──────────────────────────────────────────────────────── */
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 8px 0 16px; font-size: 9pt;
          border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
  thead tr { background: #f8fafc; }
  th { padding: 10px 12px; text-align: left; font-size: 8pt; font-weight: 700; color: #64748b;
       text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #334155; }
  tr:last-child td { border-bottom: none; }
  tr.odd { background: #f8fafc; }

  .none { color: #94a3b8; font-style: italic; padding: 16px; text-align: center; background: #f8fafc;
          border-radius: 10px; border: 1px dashed #cbd5e1; }

  /* ── CHIPS / BADGES ──────────────────────────────────────────────── */
  .chip { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 7.5pt; font-weight: 700;
          letter-spacing: 0.5px; text-transform: uppercase; }
  .chip.s1 { background: #dbeafe; color: #1e40af; }
  .chip.s2 { background: #dcfce7; color: #166534; }
  .chip.s3 { background: #f3e8ff; color: #6b21a8; }

  /* ── CALLOUTS ────────────────────────────────────────────────────── */
  .callout { padding: 16px 20px; border-radius: 12px; margin: 16px 0; }
  .callout h4 { margin-top: 0; }
  .callout-ok   { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
  .callout-warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .callout-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
  .callout-red  { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

  /* ── DEFINITION LIST (governance) ────────────────────────────────── */
  .dl { display: grid; grid-template-columns: 200px 1fr; gap: 8px 16px; margin: 12px 0;
        border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  .dl .key { background: #f8fafc; padding: 10px 14px; color: #475569; font-weight: 600;
             border-bottom: 1px solid #e2e8f0; font-size: 9.5pt; }
  .dl .val { background: white; padding: 10px 14px; border-bottom: 1px solid #e2e8f0;
             color: #1e293b; font-size: 9.5pt; line-height: 1.6; }
  .dl > .key:last-of-type, .dl > .val:last-of-type { border-bottom: none; }

  /* ── PRINT BUTTON ────────────────────────────────────────────────── */
  .print-btn { position: fixed; bottom: 32px; right: 32px; z-index: 9999; background: linear-gradient(135deg, #10b981, #059669);
               color: white; font-weight: 800; font-size: 11pt; border: none; border-radius: 16px; padding: 14px 24px;
               cursor: pointer; box-shadow: 0 8px 30px rgba(16,185,129,0.4); }
  @media print { .print-btn { display: none !important; } }

  .page-break { page-break-after: always; }
  code { font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #334155; }
</style>
</head>
<body>

<button class="print-btn" onclick="window.print()">📄 Save as PDF</button>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- COVER                                                                 -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-top">
    <h1>EcoLink<span style="color:#34d399">.</span></h1>
    <span>AASB S2 Compliant</span>
  </div>
  <div class="cover-body">
    <div class="cover-label">Climate-related Financial Disclosure</div>
    <div class="cover-title">${safeName}</div>
    <div class="cover-rule"></div>

    <div class="cover-meta">
      <span class="key">Reporting Period</span><span class="val">${esc(period)}</span>
      <span class="key">ABN</span><span class="val">${safeAbn}</span>
      <span class="key">Operating State</span><span class="val">${esc(company.state ?? "—")}</span>
      <span class="key">Frameworks</span><span class="val">AASB S2 · NGA Factors 2023–24 · GHG Protocol Corporate</span>
      <span class="key">Methodology</span><span class="val">Activity-based · Operational control boundary · Location-based Scope 2</span>
      <span class="key">GWP Source</span><span class="val">IPCC AR5 · 100-year</span>
      <span class="key">Generated</span><span class="val">${esc(generated)}</span>
      <span class="key">EcoLink Plan</span><span class="val">${esc(safePlan)}</span>
    </div>

    <div class="cover-hero">
      <span class="num">${totalCo2eT.toFixed(2)}</span>
      <span class="unit">t CO₂e</span>
      <div class="label">
        <strong>Total GHG Emissions</strong><br/>
        Scopes 1, 2 &amp; 3 combined<br/>
        ${totalTx} classified transactions
      </div>
    </div>
  </div>
  <div class="cover-footer">
    Prepared with EcoLink Australia · This is a draft until limited assurance is obtained under AUASB GS 100.
  </div>
</div>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 1 — EXECUTIVE SUMMARY + ASSURANCE                             -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-break">
  <h2>1. Executive Summary</h2>
  <div class="rule rule-green"></div>

  <p>This Climate-related Financial Disclosure has been prepared by <strong>${safeName}</strong>
  in accordance with <strong>AASB S2</strong> (Climate-related Disclosures) and the
  <strong>National Greenhouse Accounts (NGA) Factors 2023-24</strong> published by the
  Department of Climate Change, Energy, the Environment and Water (DCCEEW). Calculations
  follow the <strong>GHG Protocol Corporate Standard</strong>, location-based Scope 2 method,
  and IPCC AR5 100-year Global Warming Potentials.</p>

  ${assuranceBlock}

  <h3>Total Emissions by Scope</h3>
  <div class="scope-cards">
    <div class="scope-card" style="background:linear-gradient(135deg,#1d4ed8,#3b82f6)">
      <div class="s-label">Scope 1</div>
      <div class="s-desc">Direct combustion</div>
      <div class="s-val">${Number(s1.co2e_t).toFixed(2)}</div>
      <div class="s-sub">tonnes CO₂e · ${s1.tx_count} transactions</div>
    </div>
    <div class="scope-card" style="background:linear-gradient(135deg,#047857,#10b981)">
      <div class="s-label">Scope 2</div>
      <div class="s-desc">Purchased electricity</div>
      <div class="s-val">${Number(s2.co2e_t).toFixed(2)}</div>
      <div class="s-sub">tonnes CO₂e · ${s2.tx_count} transactions</div>
    </div>
    <div class="scope-card" style="background:linear-gradient(135deg,#6d28d9,#8b5cf6)">
      <div class="s-label">Scope 3</div>
      <div class="s-desc">Value chain</div>
      <div class="s-val">${Number(s3.co2e_t).toFixed(2)}</div>
      <div class="s-sub">tonnes CO₂e · ${s3.tx_count} transactions</div>
    </div>
  </div>

  <h3>Data Quality &amp; Coverage</h3>
  <div class="dl">
    <span class="key">Classified transactions</span><span class="val">${totalTx}</span>
    <span class="key">Awaiting human review</span><span class="val">${reviewCount} ${reviewCount > 0 ? `<span class="not-provided">— review before submission</span>` : ""}</span>
    <span class="key">Excluded</span><span class="val">${excludedSummary}</span>
    <span class="key">AI ensemble</span><span class="val">3-model majority vote (GPT-4o-mini · Gemini 2.5 Flash · DeepSeek-V3) via OpenRouter</span>
  </div>
</div>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 2 — GOVERNANCE (AASB S2 §6-9)                                 -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-break">
  <h2>2. Governance</h2>
  <div class="rule rule-blue"></div>
  <p class="dim">AASB S2 §6-9 — Governance over climate-related risks and opportunities.</p>

  <h3>2.1 Board Oversight</h3>
  <div class="dl">
    <span class="key">Body responsible</span><span class="val">${narr(g?.board_oversight_body ?? null)}</span>
    <span class="key">Accountable role</span><span class="val">${narr(g?.accountable_person_role ?? null)}</span>
    <span class="key">Review frequency</span><span class="val">${narr(g?.review_frequency ?? null)}</span>
  </div>

  <h3>2.2 Governance Narrative</h3>
  <p>${narr(g?.governance_notes ?? null)}</p>
</div>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 3 — STRATEGY (AASB S2 §10-22)                                 -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-break">
  <h2>3. Strategy</h2>
  <div class="rule rule-purple"></div>
  <p class="dim">AASB S2 §10-22 — Climate-related risks, opportunities, and scenario analysis.</p>

  <h3>3.1 Physical Risks Identified</h3>
  ${listOrEmpty(g?.physical_risks_identified ?? null)}
  <p>${narr(g?.physical_risks_narrative ?? null)}</p>

  <h3>3.2 Transition Risks Identified</h3>
  ${listOrEmpty(g?.transition_risks_identified ?? null)}
  <p>${narr(g?.transition_risks_narrative ?? null)}</p>

  <h3>3.3 Climate-related Opportunities</h3>
  ${listOrEmpty(g?.opportunities_identified ?? null)}
  <p>${narr(g?.opportunities_narrative ?? null)}</p>

  <h3>3.4 Scenario Analysis (AASB S2 §22)</h3>
  <div class="dl">
    <span class="key">1.5 °C scenario</span>
    <span class="val">${g?.scenario_15c_completed ? "✓ Completed" : "<span class='not-provided'>Required — not completed</span>"}<br/>${narr(g?.scenario_15c_narrative ?? null)}</span>

    <span class="key">2 °C scenario</span>
    <span class="val">${g?.scenario_2c_completed ? "✓ Completed" : "<span class='not-provided'>Required — not completed</span>"}<br/>${narr(g?.scenario_2c_narrative ?? null)}</span>

    <span class="key">3 °C disorderly</span>
    <span class="val">${g?.scenario_3c_completed ? "✓ Completed (optional)" : "<span class='dim'>Optional — not provided</span>"}<br/>${narr(g?.scenario_3c_narrative ?? null)}</span>
  </div>

  <h3>3.5 Financial Impact</h3>
  <div class="dl">
    <span class="key">Current period</span><span class="val">${narr(g?.financial_impact_current ?? null)}</span>
    <span class="key">Anticipated</span><span class="val">${narr(g?.financial_impact_anticipated ?? null)}</span>
    <span class="key">Business model resilience</span><span class="val">${narr(g?.business_model_resilience ?? null)}</span>
  </div>
</div>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 4 — RISK MANAGEMENT (AASB S2 §23-25)                          -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-break">
  <h2>4. Risk Management</h2>
  <div class="rule rule-amber"></div>
  <p class="dim">AASB S2 §23-25 — Identification, assessment and integration of climate-related risks.</p>

  <h3>4.1 Identification Process</h3>
  <p>${narr(g?.risk_identification_process ?? null)}</p>

  <h3>4.2 Integration Into Overall Risk Management</h3>
  <p>${narr(g?.risk_integration_process ?? null)}</p>

  <h3>4.3 Prioritisation Method</h3>
  <p>${narr(g?.risk_priority_method ?? null)}</p>
</div>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 5 — METRICS & TARGETS (AASB S2 §26-42)                        -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-break">
  <h2>5. Metrics &amp; Targets</h2>
  <div class="rule rule-green"></div>
  <p class="dim">AASB S2 §26-42 — Greenhouse gas emissions, cross-industry metrics, and targets.</p>

  <h3>5.1 Scope 1 — Direct Emissions</h3>
  ${txTable(txByScope(1))}

  <h3>5.2 Scope 2 — Purchased Electricity (Location-based)</h3>
  ${txTable(txByScope(2))}

  <h3>5.3 Scope 3 — Value Chain Emissions</h3>
  ${txTable(txByScope(3))}

  <h3>5.4 Cross-industry Metrics (AASB S2 §29)</h3>
  <div class="dl">
    <span class="key">Energy consumption</span><span class="val">${g?.energy_total_mwh ? `${Number(g.energy_total_mwh).toLocaleString("en-AU")} MWh` : narr(null)}</span>
    <span class="key">Renewable energy %</span><span class="val">${g?.energy_renewable_pct != null ? `${Number(g.energy_renewable_pct).toFixed(1)} %` : narr(null)}</span>
    <span class="key">Internal carbon price</span><span class="val">${g?.internal_carbon_price_aud != null ? `AUD ${Number(g.internal_carbon_price_aud).toFixed(2)} / t CO₂e` : narr(null)}</span>
    <span class="key">Exec remuneration linked</span><span class="val">${g?.exec_remuneration_climate_pct != null ? `${Number(g.exec_remuneration_climate_pct).toFixed(1)} %` : narr(null)}</span>
  </div>

  <h3>5.5 Targets</h3>
  <div class="dl">
    <span class="key">Base year</span><span class="val">${g?.target_base_year ?? narr(null)}</span>
    <span class="key">Target year</span><span class="val">${g?.target_target_year ?? narr(null)}</span>
    <span class="key">Reduction</span><span class="val">${g?.target_reduction_pct != null ? `${Number(g.target_reduction_pct).toFixed(1)} %` : narr(null)}</span>
    <span class="key">Scopes covered</span><span class="val">${g?.target_scope_coverage?.join(", ") ?? narr(null)}</span>
    <span class="key">Methodology</span><span class="val">${narr(g?.target_methodology ?? null)}</span>
    <span class="key">Narrative</span><span class="val">${narr(g?.target_narrative ?? null)}</span>
  </div>
</div>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 6 — EMISSION FACTORS USED                                     -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-break">
  <h2>6. Emission Factors Applied</h2>
  <div class="rule rule-slate"></div>
  <p class="dim">All factors traceable to NGA Factors 2023-24 (DCCEEW). State-specific factors used for Scope 2 (Table 6).</p>
  ${efTable}

  <h3>6.1 Methodology Notes</h3>
  <ul>
    <li><strong>Activity-based calculation:</strong> co₂e = activity_value × emission_factor. No spend-based estimates were used as primary methodology.</li>
    <li><strong>Scope 2 method:</strong> Location-based, applying state-specific NGA factors to grid electricity consumption (kWh).</li>
    <li><strong>Organisational boundary:</strong> Operational control approach (GHG Protocol).</li>
    <li><strong>GWP source:</strong> IPCC AR5 100-year. Consistent with NGA 2023-24 methodology.</li>
    <li><strong>Reporting period:</strong> ${esc(period)}.</li>
  </ul>
</div>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 7 — CONNECTIVITY TO FINANCIAL STATEMENTS (AASB S2 §B17)      -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-break">
  <h2>7. Connectivity to Financial Statements</h2>
  <div class="rule rule-blue"></div>
  <p class="dim">AASB S2 §B17 — Connection between climate-related disclosures and the Financial Statements.</p>

  <p>${g?.fs_consistency_confirmed
    ? `<strong>✓ Confirmed.</strong> The data, assumptions, and reporting period in this disclosure are consistent with those used in the entity's Financial Statements for the same reporting period.`
    : `<span class="not-provided">Consistency with Financial Statements has not yet been confirmed by management — required before submission.</span>`}</p>

  ${g?.fs_inconsistencies_narrative
    ? `<h3>7.1 Disclosed Inconsistencies</h3><p>${esc(g.fs_inconsistencies_narrative)}</p>`
    : ""}
</div>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 8 — LIMITATIONS, FLAGS & ASSUMPTIONS                          -->
<!-- ═════════════════════════════════════════════════════════════════════ -->
<div class="page-container page-break">
  <h2>8. Limitations &amp; Assumptions</h2>
  <div class="rule rule-red"></div>

  <ul>
    <li><strong>${reviewCount}</strong> transaction(s) currently flagged for human review and excluded from totals above. They must be resolved before final submission to ASIC.</li>
    <li>Excluded transactions: ${excludedSummary}</li>
    <li>Where activity data (litres, kWh, passenger-km) was not present in the source system, the transaction was flagged <code>no_activity_data</code> and routed to manual review — no spend-based fallback was applied.</li>
    <li>Scope 3 categories are reported on a <strong>best-available-data</strong> basis. Categories not yet assessed (Cat 11 Use of Sold Products, Cat 12 End-of-life) are listed as out-of-scope in the next reporting cycle.</li>
    <li>This report uses the most recent NGA Factors workbook available at generation time (NGA 2023-24, August 2024 publication). Annual factor updates may restate prior-period emissions.</li>
  </ul>

  <h3>8.1 AUASB GS 100 Disclaimer</h3>
  <div class="callout callout-warn">
    <p>${company.assurance_status === "none"
      ? `This report has <strong>not</strong> been subject to limited or reasonable assurance under AUASB GS 100 — Assurance Engagements on Sustainability Information. Until assurance is obtained, this disclosure is suitable for internal review only and must not be filed under AASB S2 mandatory disclosure rules.`
      : `Limited assurance was obtained on ${company.assurance_obtained_at ? fmtDate(company.assurance_obtained_at) : "—"} under AUASB GS 100, performed by ${esc(company.assurance_provider ?? "—")} (ASIC reg. ${esc(company.assurance_asic_reg ?? "—")}).`}</p>
  </div>

  <h3>8.2 Data Provenance</h3>
  <p class="dim">Source data ingested from Xero / MYOB / CSV imports / manual entry. Each transaction
  in Sections 5.1-5.3 carries the emission factor reference (NGA Table number) and, for Scope 2,
  the Australian state whose grid factor was applied. The full source trail is preserved in the
  EcoLink platform and is available to assurance providers on request.</p>
</div>

</body>
</html>`;
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const data = await fetchReportData(session.user.companyId);
    if (!data.company) {
      return NextResponse.json({ error: "company_not_found" }, { status: 404 });
    }
    const html = buildHtml(data);
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[report/generate] failed:", msg);
    return NextResponse.json({ error: "report_failed", message: msg }, { status: 500 });
  }
}
