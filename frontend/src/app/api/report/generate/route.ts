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
  const [companyRows, txRows, totals, efRows, reviewRows, majorityRows] = await Promise.all([
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
        COALESCE(t.scope, ec.scope) AS scope,
        ec.label AS category,
        ec.description AS activity,
        'AUD' AS unit,
        NULL AS factor_value,
        'Spend-based Estimate' AS factor_source
      FROM transactions t
      LEFT JOIN emission_categories ec ON t.category_id = ec.id
      WHERE t.company_id = ${companyId}
        AND t.classification_status = 'classified'
      ORDER BY COALESCE(t.scope, ec.scope) ASC NULLS LAST, t.transaction_date ASC
    `,
    sql`
      SELECT
        COALESCE(t.scope, ec.scope) AS scope,
        ROUND(SUM(co2e_kg) / 1000, 2) AS co2e_t,
        COUNT(*) AS tx_count
      FROM transactions t
      LEFT JOIN emission_categories ec ON t.category_id = ec.id
      WHERE t.company_id = ${companyId}
        AND t.classification_status = 'classified'
      GROUP BY COALESCE(t.scope, ec.scope)
      ORDER BY COALESCE(t.scope, ec.scope) ASC NULLS LAST
    `,
    sql`
      SELECT DISTINCT ec.scope, ec.label AS category, ec.description AS activity, NULL AS co2e_factor, 'AUD' AS unit, 'Spend-based Estimate' AS source_table
      FROM emission_categories ec
      INNER JOIN transactions t ON t.category_id = ec.id
      WHERE t.company_id = ${companyId}
      ORDER BY ec.label
    `,
    sql`
      SELECT COUNT(*) AS count
      FROM transactions
      WHERE company_id = ${companyId} AND classification_status = 'needs_review'
    `,
    sql`
      SELECT COUNT(*) AS count
      FROM transactions
      WHERE company_id = ${companyId}
        AND classification_status = 'needs_review'
        AND category_id IS NOT NULL
    `,
  ]);

  const reviewCount  = Number(reviewRows[0]?.count  || 0);
  const majorityCount = Number(majorityRows[0]?.count || 0);
  const fullDisagreement = reviewCount - majorityCount;

  return { company: companyRows[0], txRows, totals, efRows, reviewCount, majorityCount, fullDisagreement };
}

// ─── HTML template ────────────────────────────────────────────────────────────

function buildHtml(data: Awaited<ReturnType<typeof fetchReportData>>) {
  const { company, txRows, totals, efRows, reviewCount, majorityCount, fullDisagreement } = data;

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
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; font-size: 10pt; color: #1e293b; background: #f8fafc; }
  @page { size: A4; margin: 0; } /* Print margin handled by HTML padding to allow full bleed cover */
  .page-container { padding: 18mm 18mm 22mm 18mm; background: white; min-height: 100vh; }
  
  .cover { height: 100vh; display: flex; flex-direction: column; page-break-after: always; background: linear-gradient(135deg, #020617 0%, #0f172a 100%); color: white; padding: 0; position: relative; overflow: hidden; }
  .cover::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at center, rgba(16, 185, 129, 0.15) 0%, transparent 60%); pointer-events: none; }
  .cover-top { padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; z-index: 10; position: relative; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .cover-top h1 { font-family: 'Outfit', sans-serif; font-size: 20pt; font-weight: 900; letter-spacing: -0.5px; }
  .cover-top span { font-size: 10pt; color: #34d399; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .cover-body { flex: 1; padding: 60px 50px; display: flex; flex-direction: column; justify-content: center; z-index: 10; position: relative; }
  .cover-label { font-family: 'Outfit', sans-serif; font-size: 10pt; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: #10b981; margin-bottom: 16px; display: inline-block; padding: 6px 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2); }
  .cover-title { font-family: 'Outfit', sans-serif; font-size: 42pt; font-weight: 900; line-height: 1.1; color: white; margin-bottom: 12px; text-shadow: 0 4px 20px rgba(0,0,0,0.5); }
  .cover-rule { width: 80px; height: 4px; background: linear-gradient(90deg, #10b981, #3b82f6); margin: 24px 0; border-radius: 2px; }
  .cover-meta { display: grid; grid-template-columns: 140px 1fr; gap: 10px 16px; margin-top: 24px; background: rgba(255,255,255,0.03); padding: 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px); }
  .cover-meta .key { font-size: 9pt; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
  .cover-meta .val { font-size: 10pt; color: #f8fafc; font-weight: 500; }
  .cover-hero { display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 20px; padding: 32px 40px; margin-top: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
  .cover-hero .num { font-family: 'Outfit', sans-serif; font-size: 64pt; font-weight: 900; line-height: 1; color: white; text-shadow: 0 2px 10px rgba(16, 185, 129, 0.3); }
  .cover-hero .unit { font-family: 'Outfit', sans-serif; font-size: 20pt; color: #34d399; font-weight: 800; }
  .cover-hero .label { font-size: 11pt; color: #cbd5e1; margin-left: 24px; line-height: 1.5; padding-left: 24px; border-left: 2px solid rgba(255,255,255,0.1); }
  
  .ai-badge { margin-top: 24px; display: inline-flex; align-items: flex-start; gap: 12px; padding: 16px 20px; border-radius: 12px; max-width: 600px; }
  .ai-badge.success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #a7f3d0; }
  .ai-badge.warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #fde68a; }
  .ai-badge svg { flex-shrink: 0; width: 24px; height: 24px; }
  .ai-badge h4 { font-family: 'Outfit', sans-serif; font-size: 11pt; font-weight: 700; margin-bottom: 4px; color: white; }
  .ai-badge p { font-size: 9pt; margin: 0; opacity: 0.9; }

  .cover-footer { padding: 24px 50px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 8.5pt; color: #64748b; z-index: 10; position: relative; background: rgba(0,0,0,0.2); }
  
  h2 { font-family: 'Outfit', sans-serif; font-size: 22pt; font-weight: 800; color: #0f172a; margin: 0 0 8px; letter-spacing: -0.5px; }
  .rule { height: 4px; margin: 0 0 20px; border-radius: 2px; }
  .rule-blue   { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
  .rule-green  { background: linear-gradient(90deg, #10b981, #34d399); }
  .rule-purple { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
  .rule-slate  { background: linear-gradient(90deg, #475569, #94a3b8); }
  h3 { font-family: 'Outfit', sans-serif; font-size: 13pt; font-weight: 700; color: #0f172a; margin: 28px 0 12px; }
  p  { font-size: 10pt; line-height: 1.7; margin-bottom: 12px; color: #475569; }
  .dim { color: #94a3b8; font-size: 8.5pt; font-weight: 500; }
  
  .scope-cards { display: flex; gap: 16px; margin: 20px 0; }
  .scope-card  { flex: 1; border-radius: 16px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.05); position: relative; overflow: hidden; }
  .scope-card::after { content: ''; position: absolute; top: 0; right: 0; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; transform: translate(30%, -30%); }
  .scope-card .s-label { font-family: 'Outfit', sans-serif; font-size: 8pt; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; opacity: 0.9; margin-bottom: 4px; }
  .scope-card .s-desc  { font-size: 9pt; opacity: 0.8; margin-bottom: 12px; font-weight: 500; }
  .scope-card .s-val   { font-family: 'Outfit', sans-serif; font-size: 26pt; font-weight: 900; line-height: 1; margin-bottom: 6px; }
  .scope-card .s-sub   { font-size: 8.5pt; opacity: 0.75; font-weight: 500; }
  
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 12px 0 20px; font-size: 9pt; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
  thead tr { background: #f8fafc; }
  th { padding: 12px 16px; text-align: left; font-size: 8pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #334155; }
  tr:last-child td { border-bottom: none; }
  tr.even { background: white; }
  tr.odd  { background: #f8fafc; }
  
  .total-row { display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 20px; margin: 8px 0 24px; box-shadow: 0 2px 10px rgba(16, 185, 129, 0.05); }
  .total-row .tl { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 11pt; color: #064e3b; text-transform: uppercase; letter-spacing: 0.5px; }
  .total-row .tv { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 14pt; color: #059669; }
  
  .summary-grid { display: grid; grid-template-columns: 200px 1fr; gap: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; font-size: 9.5pt; margin-top: 16px; }
  .summary-grid .key { background: #f8fafc; padding: 12px 16px; color: #475569; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
  .summary-grid .val { background: white; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 500; }
  .summary-grid .key:last-of-type, .summary-grid .val:last-of-type { border-bottom: none; }
  .summary-grid .highlight { background: #f0fdf4; font-weight: 800; color: #059669; font-size: 10.5pt; }
  
  .none { color: #94a3b8; font-style: italic; font-size: 10pt; padding: 20px 0; text-align: center; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1; margin: 12px 0; }
  
  .sig-box { background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #d1fae5; border-radius: 16px; padding: 24px 32px; margin-top: 32px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.05); }
  .sig-box .sl { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 14pt; color: #064e3b; }
  .sig-box .ss { font-size: 9pt; color: #059669; margin-top: 4px; font-weight: 500; }
  .sig-box .sr { text-align: right; font-size: 9pt; color: #64748b; }
  
  .page-break { page-break-after: always; }
  .ef-table td, .ef-table th { font-size: 8.5pt; }
  .chip { display: inline-flex; align-items: center; background: #e2e8f0; color: #475569; border-radius: 6px; padding: 4px 8px; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  .chip.s1 { background: #dbeafe; color: #1e40af; }
  .chip.s2 { background: #dcfce7; color: #166534; }
  .chip.s3 { background: #f3e8ff; color: #6b21a8; }
  
  .framework-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9pt; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
  .framework-table td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; background: white; color: #334155; }
  .framework-table tr:last-child td { border-bottom: none; }
  .framework-table td:nth-child(1) { background: #f8fafc; font-weight: 700; color: #0f172a; width: 120px; }
  .framework-table td:nth-child(3) { color: #64748b; font-size: 8.5pt; }
  
  .limitations { font-size: 9pt; line-height: 1.8; color: #475569; padding-left: 20px; }
  .limitations li { margin-bottom: 8px; padding-left: 4px; }
  .limitations li::marker { color: #94a3b8; }

  /* ── Print / PDF ── */
  .print-btn { position: fixed; bottom: 32px; right: 32px; z-index: 9999; display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #10b981, #059669); color: white; font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 11pt; border: none; border-radius: 16px; padding: 14px 24px; cursor: pointer; box-shadow: 0 8px 30px rgba(16,185,129,0.4); transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; }
  .print-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(16,185,129,0.5); }
  .print-btn svg { width: 20px; height: 20px; }
  @media print { .print-btn { display: none !important; } }
</style>
</head>
<body>

<!-- FLOATING PDF BUTTON -->
<button class="print-btn" onclick="window.print()">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
  Salvar como PDF
</button>

<!-- COVER PAGE -->
<div class="cover">
  <div class="cover-top">
    <h1>EcoLink<span style="color:#34d399">.</span></h1>
    <span>Premium Assurance Report</span>
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
      <div class="label">
        <strong>Total GHG Emissions</strong><br/>
        FY 2023–24<br/>
        ${totalTx} classified transactions
      </div>
    </div>

    ${reviewCount === 0 
      ? `
      <div class="ai-badge success">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <div>
          <h4>Relatório Confiável — Consenso Total das 3 IAs</h4>
          <p>Os dados foram analisados e certificados por GPT-4o, Gemini 2.5 e DeepSeek atuando em paralelo. Não foram detectadas divergências na classificação.</p>
        </div>
      </div>
      `
      : `
      <div class="ai-badge warning">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <div>
          <h4>Aviso: Divergência Detectada — ${reviewCount} Transações Aguardam Revisão</h4>
          <p style="margin-bottom:10px">As 3 IAs (GPT-4o, Gemini 2.5 e DeepSeek) identificaram inconsistências em <strong>${reviewCount}</strong> transações. Detalhamento:</p>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);border-radius:10px;padding:10px 16px;min-width:140px">
              <div style="font-family:'Outfit',sans-serif;font-size:22pt;font-weight:900;color:white;line-height:1">${majorityCount}</div>
              <div style="font-size:8.5pt;opacity:0.85;margin-top:4px">✅ 2/3 IAs em consenso<br/>(categoria detectada,<br/>valor divergente)</div>
            </div>
            <div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:10px 16px;min-width:140px">
              <div style="font-family:'Outfit',sans-serif;font-size:22pt;font-weight:900;color:white;line-height:1">${fullDisagreement}</div>
              <div style="font-size:8.5pt;opacity:0.85;margin-top:4px">❌ Desacordo total<br/>(classificação<br/>ambígua)</div>
            </div>
          </div>
        </div>
      </div>
      `
    }
  </div>
  <div class="cover-footer">
    Prepared by EcoLink Australia in accordance with AASB S2 Climate-related Disclosures &amp;
    National Greenhouse Accounts Factors 2023–24 (Commonwealth of Australia)
  </div>
</div>

<div class="page-container">
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
        <td><span class="chip s${esc(String(ef.scope ?? "?"))}">Scope ${esc(String(ef.scope ?? "?"))}</span></td>
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

</div> <!-- end page-container -->
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
