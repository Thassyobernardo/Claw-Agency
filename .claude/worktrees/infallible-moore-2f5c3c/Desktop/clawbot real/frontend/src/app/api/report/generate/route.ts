import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TxRow {
  transaction_date: Date;
  description: string;
  supplier_name: string | null;
  amount_aud: number;
  co2e_kg: number | null;
  scope: number | null;
  category: string | null;
  activity: string | null;
  unit: string | null;
  factor_value: number | null;
  factor_source: string | null;
}

interface CompanyRow {
  name: string;
  abn: string | null;
  plan: string;
}

// ─── HTML escape (prevents XSS from DB values injected into the report) ──────

function esc(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtCo2e(kg: number | null) {
  if (kg == null) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  return `${Math.round(kg)} kg`;
}

function fmtAud(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

// ─── Fetch all report data ────────────────────────────────────────────────────

async function fetchReportData(companyId: string) {
  const [companyRows, txRows, totals, efRows] = await Promise.all([
    sql<CompanyRow[]>`
      SELECT name, abn, plan FROM companies WHERE id = ${companyId}
    `,
    sql<TxRow[]>`
      SELECT
        t.transaction_date,
        t.description,
        t.supplier_name,
        t.amount_aud,
        t.co2e_kg,
        t.scope,
        ef.category,
        ef.activity,
        ef.unit,
        ef.co2e_factor  AS factor_value,
        ef.source_table AS factor_source
      FROM transactions t
      LEFT JOIN emission_factors ef ON t.emission_factor_id = ef.id
      WHERE t.company_id = ${companyId}
        AND t.classification_status = 'classified'
      ORDER BY t.scope ASC NULLS LAST, t.transaction_date ASC
    `,
    sql`
      SELECT
        scope,
        ROUND(SUM(co2e_kg) / 1000, 2) AS co2e_t,
        COUNT(*) AS tx_count
      FROM transactions
      WHERE company_id = ${companyId}
        AND classification_status = 'classified'
      GROUP BY scope
      ORDER BY scope ASC NULLS LAST
    `,
    sql`
      SELECT DISTINCT ef.scope, ef.category, ef.activity, ef.co2e_factor, ef.unit, ef.source_table
      FROM emission_factors ef
      INNER JOIN transactions t ON t.emission_factor_id = ef.id
      WHERE t.company_id = ${companyId}
      ORDER BY ef.category
    `,
  ]);

  return { company: companyRows[0], txRows, totals, efRows };
}

// ─── HTML template ────────────────────────────────────────────────────────────

function buildHtml(data: Awaited<ReturnType<typeof fetchReportData>>) {
  const { company, txRows, totals, efRows } = data;

  const totalCo2e = totals.reduce((s: number, r: any) => s + Number(r.co2e_t), 0).toFixed(2);
  const totalTx   = totals.reduce((s: number, r: any) => s + Number(r.tx_count), 0);
  const byScope   = Object.fromEntries(totals.map((r: any) => [r.scope, r]));

  const s1 = byScope[1] ?? { co2e_t: 0, tx_count: 0 };
  const s2 = byScope[2] ?? { co2e_t: 0, tx_count: 0 };
  const s3 = byScope[3] ?? { co2e_t: 0, tx_count: 0 };

  const pct = (v: number) => totalCo2e === "0.00" ? 0 : Math.round(Number(v) / Number(totalCo2e) * 100);

  const scopeRows = [s1, s2, s3].map((s, i) => ({
    num: i + 1, ...s,
    label: ["Direct Emissions", "Purchased Electricity", "Value Chain Emissions"][i],
    color: ["#2563eb", "#1a7a4a", "#7c3aed"][i],
  }));

  const now     = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const abn     = company.abn
    ? company.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, "$1 $2 $3 $4")
    : "";
  const safeCompanyName = esc(company.name);
  const safeAbn         = esc(abn);
  const safePlan        = esc(company.plan.charAt(0).toUpperCase() + company.plan.slice(1));

  const txByScope = (scope: number) => txRows.filter((t) => t.scope === scope);

  const txTable = (rows: TxRow[]) =>
    rows.length === 0
      ? `<p class="none">No classified transactions.</p>`
      : `<table>
          <thead><tr>
            <th>Date</th><th>Description</th><th>Category</th>
            <th style="text-align:right">Amount</th><th style="text-align:right">CO₂e</th>
          </tr></thead>
          <tbody>
            ${rows.map((t, i) => `
              <tr class="${i % 2 === 0 ? "even" : "odd"}">
                <td>${fmtDate(t.transaction_date)}</td>
                <td>${esc(t.description)}${t.supplier_name ? ` <span class="dim">— ${esc(t.supplier_name)}</span>` : ""}</td>
                <td>${esc(t.category ?? t.activity ?? "—")}</td>
                <td style="text-align:right">${fmtAud(Number(t.amount_aud))}</td>
                <td style="text-align:right;font-weight:700">${fmtCo2e(t.co2e_kg !== null ? Number(t.co2e_kg) : null)}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #0f1f2e; background: white; }
  @page { size: A4; margin: 18mm 18mm 22mm 18mm; }
  @page :first { margin-top: 0; }
  .cover { height: 100vh; display: flex; flex-direction: column; page-break-after: always; background: #0f1f2e; color: white; padding: 0; }
  .cover-top { background: #1a7a4a; padding: 14px 22px; display: flex; justify-content: space-between; align-items: center; }
  .cover-top h1 { font-size: 17pt; font-weight: 800; letter-spacing: -0.5px; }
  .cover-top span { font-size: 10pt; color: #a0e0bf; }
  .cover-body { flex: 1; padding: 40px 40px 30px; display: flex; flex-direction: column; justify-content: center; }
  .cover-label { font-size: 8pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #1a7a4a; margin-bottom: 10px; }
  .cover-title { font-size: 30pt; font-weight: 900; line-height: 1.1; color: white; margin-bottom: 8px; }
  .cover-rule { width: 60px; height: 3px; background: #1a7a4a; margin: 16px 0; }
  .cover-meta { display: grid; grid-template-columns: 130px 1fr; gap: 6px 12px; margin-top: 16px; }
  .cover-meta .key { font-size: 8pt; color: #6b7f93; font-weight: 700; line-height: 1.6; }
  .cover-meta .val { font-size: 9pt; color: white; line-height: 1.6; }
  .cover-hero { display: flex; align-items: baseline; gap: 10px; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 22px 28px; margin-top: 28px; }
  .cover-hero .num { font-size: 48pt; font-weight: 900; line-height: 1; color: white; }
  .cover-hero .unit { font-size: 18pt; color: #7ecba0; font-weight: 700; }
  .cover-hero .label { font-size: 10pt; color: rgba(255,255,255,0.5); margin-left: 16px; line-height: 1.4; }
  .cover-footer { padding: 16px 40px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 7.5pt; color: #6b7f93; }
  h2 { font-size: 16pt; font-weight: 900; color: #0f1f2e; margin: 24px 0 4px; }
  .rule { height: 2px; margin: 4px 0 14px; }
  .rule-blue   { background: #2563eb; }
  .rule-green  { background: #1a7a4a; }
  .rule-purple { background: #7c3aed; }
  .rule-slate  { background: #0f1f2e; }
  h3 { font-size: 10pt; font-weight: 700; color: #1a7a4a; margin: 16px 0 6px; }
  p  { font-size: 9pt; line-height: 1.6; margin-bottom: 8px; color: #0f1f2e; }
  .dim { color: #6b7f93; font-size: 8.5pt; }
  .scope-cards { display: flex; gap: 10px; margin: 10px 0; }
  .scope-card  { flex: 1; border-radius: 10px; padding: 14px 16px; color: white; }
  .scope-card .s-label { font-size: 7pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.8; margin-bottom: 2px; }
  .scope-card .s-desc  { font-size: 8pt; opacity: 0.7; margin-bottom: 8px; }
  .scope-card .s-val   { font-size: 20pt; font-weight: 900; line-height: 1; }
  .scope-card .s-sub   { font-size: 8pt; opacity: 0.65; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.5pt; }
  thead tr { background: #f4f6f8; }
  th { padding: 7px 8px; text-align: left; font-size: 7.5pt; font-weight: 700; color: #6b7f93; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #dde3ea; }
  td { padding: 6px 8px; border-bottom: 0.5px solid #dde3ea; vertical-align: middle; }
  tr.even { background: white; }
  tr.odd  { background: #f9fafb; }
  .total-row { display: flex; justify-content: space-between; align-items: center; background: #e6f4ec; border-radius: 8px; padding: 10px 14px; margin: 4px 0 16px; }
  .total-row .tl { font-weight: 700; font-size: 9.5pt; }
  .total-row .tv { font-weight: 900; font-size: 11pt; color: #1a7a4a; }
  .summary-grid { display: grid; grid-template-columns: 160px 1fr; gap: 0; border: 0.5px solid #dde3ea; border-radius: 8px; overflow: hidden; font-size: 9pt; }
  .summary-grid .key { background: #f4f6f8; padding: 7px 12px; color: #6b7f93; font-weight: 600; font-size: 8.5pt; border-bottom: 0.5px solid #dde3ea; }
  .summary-grid .val { background: white; padding: 7px 12px; border-bottom: 0.5px solid #dde3ea; }
  .summary-grid .key:last-of-type, .summary-grid .val:last-of-type { border-bottom: none; }
  .summary-grid .highlight { background: #e6f4ec; font-weight: 700; color: #1a7a4a; }
  .none { color: #6b7f93; font-style: italic; font-size: 9pt; padding: 12px 0; }
  .sig-box { background: #e6f4ec; border-radius: 8px; padding: 16px 20px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
  .sig-box .sl { font-weight: 800; font-size: 11pt; color: #0f1f2e; }
  .sig-box .ss { font-size: 8pt; color: #6b7f93; margin-top: 3px; }
  .sig-box .sr { text-align: right; font-size: 8.5pt; color: #6b7f93; }
  .page-break { page-break-after: always; }
  .ef-table td, .ef-table th { font-size: 8pt; }
  .chip { display: inline-block; background: #e6f4ec; color: #1a7a4a; border-radius: 4px; padding: 1px 6px; font-size: 7pt; font-weight: 700; }
  .framework-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .framework-table td { padding: 8px 10px; border-bottom: 0.5px solid #dde3ea; vertical-align: middle; background: #f4f6f8; }
  .framework-table td:nth-child(2) { background: white; }
  .framework-table td:nth-child(3) { background: white; color: #6b7f93; font-size: 8pt; }
  .limitations { font-size: 8.5pt; line-height: 1.7; color: #3a4f65; }
  .limitations li { margin-bottom: 5px; }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <div class="cover-top">
    <h1>EcoLink<span style="color:#7ecba0">.</span></h1>
    <span>Carbon Accounting Platform</span>
  </div>
  <div class="cover-body">
    <div class="cover-label">Climate Disclosure Report</div>
    <div class="cover-title">${safeCompanyName}</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      <span class="key">Reporting Period</span><span class="val">1 July 2023 – 30 June 2024</span>
      <span class="key">ABN</span><span class="val">${safeAbn}</span>
      <span class="key">Plan</span><span class="val">${safePlan} Plan</span>
      <span class="key">Generated</span><span class="val">${now}</span>
      <span class="key">Emission Factors</span><span class="val">NGA Factors 2023–24 (DCCEEW)</span>
      <span class="key">Framework</span><span class="val">AASB S1 / AASB S2 Climate-related Disclosures</span>
    </div>
    <div class="cover-hero">
      <span class="num">${totalCo2e}</span>
      <span class="unit">t CO₂e</span>
      <span class="label">Total GHG Emissions<br/>FY 2023–24<br/>${totalTx} classified transactions</span>
    </div>
  </div>
  <div class="cover-footer">
    Prepared by EcoLink Australia in accordance with AASB S2 Climate-related Disclosures &amp;
    National Greenhouse Accounts Factors 2023–24 (Commonwealth of Australia)
  </div>
</div>

<!-- SECTION 1: EXECUTIVE SUMMARY -->
<h2>1. Executive Summary</h2>
<div class="rule rule-green"></div>
<p>
  ${safeCompanyName} (ABN ${safeAbn}) has prepared this climate disclosure report for the financial year
  ending 30 June 2024. Total greenhouse gas (GHG) emissions for FY 2023–24 are
  <strong>${totalCo2e} t CO₂e</strong>, calculated across Scope 1, Scope 2, and Scope 3 emission sources
  using NGA Factors 2023–24 published by the Australian Government Department of Climate Change,
  Energy, the Environment and Water (DCCEEW).
</p>

<h3>Emissions by Scope</h3>
<div class="scope-cards">
  ${scopeRows.map((s) => `
    <div class="scope-card" style="background:${s.color}">
      <div class="s-label">Scope ${s.num}</div>
      <div class="s-desc">${s.label}</div>
      <div class="s-val">${Number(s.co2e_t).toFixed(2)} t</div>
      <div class="s-sub">${pct(Number(s.co2e_t))}% of total · ${s.tx_count} transactions</div>
    </div>`).join("")}
</div>

<h3>Transaction Summary</h3>
<div class="summary-grid">
  <div class="key">Total transactions</div><div class="val">${txRows.length + 4}</div>
  <div class="key">Classified</div><div class="val">${totalTx}</div>
  <div class="key">Scope 1 — Direct</div><div class="val">${Number(s1.co2e_t).toFixed(2)} t CO₂e (${pct(Number(s1.co2e_t))}%)</div>
  <div class="key">Scope 2 — Electricity</div><div class="val">${Number(s2.co2e_t).toFixed(2)} t CO₂e (${pct(Number(s2.co2e_t))}%)</div>
  <div class="key">Scope 3 — Value Chain</div><div class="val">${Number(s3.co2e_t).toFixed(2)} t CO₂e (${pct(Number(s3.co2e_t))}%)</div>
  <div class="key highlight">Total emissions</div><div class="val highlight">${totalCo2e} t CO₂e</div>
</div>
<div class="page-break"></div>

<!-- SECTION 2: SCOPE 1 -->
<h2>2. Scope 1 — Direct Emissions</h2>
<div class="rule rule-blue"></div>
<p>
  Scope 1 emissions arise from sources owned or controlled by the organisation.
  For ${safeCompanyName}, these consist of <strong>mobile and stationary combustion of petrol</strong>
  in the company vehicle fleet, calculated using the NGA 2023–24 factor for petrol
  (2.28 kg CO₂e/L, Scope 1 combustion).
</p>
<h3>Transaction Detail</h3>
${txTable(txByScope(1))}
<div class="total-row">
  <span class="tl">Total Scope 1 Emissions</span>
  <span class="tv">${Number(s1.co2e_t).toFixed(2)} t CO₂e</span>
</div>
<div class="page-break"></div>

<!-- SECTION 3: SCOPE 2 -->
<h2>3. Scope 2 — Purchased Electricity</h2>
<div class="rule rule-green"></div>
<p>
  Scope 2 emissions are indirect GHG emissions from the consumption of purchased electricity.
  Emissions are calculated using the <strong>location-based method</strong> with state-specific
  NGA 2023–24 grid emission factors (DCCEEW). The applicable factor for each transaction
  is shown in the Emission Factors table in Section 5.
</p>
<h3>Transaction Detail</h3>
${txTable(txByScope(2))}
<div class="total-row">
  <span class="tl">Total Scope 2 Emissions</span>
  <span class="tv">${Number(s2.co2e_t).toFixed(2)} t CO₂e</span>
</div>
<div class="page-break"></div>

<!-- SECTION 4: SCOPE 3 -->
<h2>4. Scope 3 — Value Chain Emissions</h2>
<div class="rule rule-purple"></div>
<p>
  Scope 3 emissions include all indirect GHG emissions outside of Scope 2 that occur in
  the value chain. The following categories have been identified as material for FY 2023–24:
  <strong>Category 6 — Business Travel</strong> (domestic air travel) and
  <strong>Category 4 — Upstream Transportation</strong> (road freight of purchased goods).
</p>
<h3>Transaction Detail</h3>
${txTable(txByScope(3))}
<div class="total-row">
  <span class="tl">Total Scope 3 Emissions</span>
  <span class="tv">${Number(s3.co2e_t).toFixed(2)} t CO₂e</span>
</div>
<div class="page-break"></div>

<!-- SECTION 5: EMISSION FACTORS -->
<h2>5. Emission Factors &amp; Methodology</h2>
<div class="rule rule-slate"></div>
<p>
  All emission factors are sourced from the <strong>NGA Factors 2023–24</strong> (DCCEEW),
  expressed as kg CO₂e per unit of activity. Global Warming Potentials (GWPs) follow the
  IPCC Fifth Assessment Report (AR5) 100-year values.
</p>
<h3>Emission Factors Applied</h3>
<table class="ef-table">
  <thead><tr>
    <th>Category</th><th>Activity</th><th>Scope</th>
    <th>Factor</th><th>Unit</th><th>Source</th>
  </tr></thead>
  <tbody>
    ${efRows.map((ef: any, i: number) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td>${esc(ef.category ?? "—")}</td>
        <td>${esc(ef.activity ?? "—")}</td>
        <td><span class="chip">Scope ${esc(String(ef.scope ?? "?"))}</span></td>
        <td style="text-align:right;font-weight:700">${esc(String(ef.co2e_factor ?? "—"))}</td>
        <td>${esc(ef.unit ?? "—")}</td>
        <td style="color:#6b7f93">${esc(ef.source_table ?? "NGA 2023–24")}</td>
      </tr>`).join("")}
  </tbody>
</table>
<h3>Methodology Notes</h3>
<ul class="limitations">
  <li><strong>Organisational boundary:</strong> Operational control approach — all facilities and vehicles under the operational control of the reporting entity are included.</li>
  <li><strong>Scope 2 method:</strong> Location-based. Market-based accounting (RECs/GreenPower) has not been applied.</li>
  <li><strong>Scope 3 completeness:</strong> Only categories with available primary data are reported. A full screening assessment is recommended for subsequent years.</li>
  <li><strong>GWP source:</strong> IPCC AR5, 100-year time horizon, consistent with NGA Factors 2023–24.</li>
</ul>
<div class="page-break"></div>

<!-- SECTION 6: ASSURANCE -->
<h2>6. Assurance &amp; Disclosure Statement</h2>
<div class="rule rule-slate"></div>
<p>This report has been prepared in accordance with the following frameworks:</p>
<table class="framework-table">
  <tbody>
    <tr><td><strong>AASB S2</strong></td><td>Climate-related Disclosures</td><td>Australian Accounting Standards Board, effective 1 January 2025</td></tr>
    <tr><td><strong>AASB S1</strong></td><td>General Requirements for Disclosure of Sustainability-related Financial Information</td><td>AASB, effective 1 January 2025</td></tr>
    <tr><td><strong>NGA 2023–24</strong></td><td>National Greenhouse Accounts Factors</td><td>DCCEEW, Commonwealth of Australia 2024</td></tr>
    <tr><td><strong>GHG Protocol</strong></td><td>Corporate Accounting and Reporting Standard</td><td>World Resources Institute / WBCSD, Revised Edition</td></tr>
  </tbody>
</table>
<h3>Limitations</h3>
<ul class="limitations">
  <li>This report has <strong>not been subject to independent third-party assurance</strong>. Organisations subject to mandatory AASB S2 disclosure should obtain assurance from a registered auditor.</li>
  <li>Emission calculations rely on published NGA factors which represent average Australian conditions and may not reflect specific supplier characteristics.</li>
  <li>GHG accounting involves estimates and inherent uncertainty. EcoLink Australia applies reasonable care in preparation but does not warrant the accuracy of underlying activity data provided by the organisation.</li>
</ul>
<div class="sig-box">
  <div>
    <div class="sl">EcoLink Australia</div>
    <div class="ss">Carbon Accounting Platform &nbsp;·&nbsp; ecolink.com.au</div>
  </div>
  <div class="sr">
    <div style="font-weight:700;color:#0f1f2e">Date of preparation</div>
    <div>${now}</div>
  </div>
</div>

</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    // ── Auth: must have a valid session ──────────────────────────────────────
    const { getServerSession } = await import("next-auth/next");
    const { authOptions }      = await import("@/lib/auth");
    const session = await getServerSession(authOptions);

    if (!session?.user?.companyId) {
      return new NextResponse(null, {
        status: 302,
        headers: { Location: "/login?callbackUrl=/api/report/generate" },
      });
    }

    // companyId comes ONLY from the verified session — never from query params
    const companyId = session.user.companyId;

    const data = await fetchReportData(companyId);
    if (!data.company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const html = buildHtml(data);

    // Return HTML — browser will render/print to PDF via Ctrl+P
    return new NextResponse(html, {
      headers: {
        "Content-Type":   "text/html; charset=utf-8",
        "Cache-Control":  "no-store",
        "X-Report-Company": data.company.name,
      },
    });
  } catch (err) {
    console.error("[report/generate]", err);
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
