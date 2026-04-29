/**
 * EcoLink Australia — AASB S2 PDF Generator
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TECHNOLOGY: PDFKit (Node.js native)
 *   - Zero external APIs — PDF is generated entirely in-process.
 *   - Returns a Buffer, not a file path — the caller (report_sealer.ts)
 *     decides where to store it.
 *   - Uses built-in PDFKit fonts (Helvetica family) — no VFS setup required.
 *   - Deterministic: same AASBReportSnapshot → same PDF structure every time.
 *     (timestamps and generatedAt are passed in from the snapshot, not re-computed.)
 *
 * DOCUMENT STRUCTURE (AASB S2 Compliance):
 *   Page 1: Cover — Company ID, Financial Year, Seal Status
 *   Page 2: Emission Totals — Scope 1, 2, 3, Grand Total
 *   Page 3: Data Quality Disclosure — Score, Tier, Uncertainty Statement
 *   Page 4: Calculation Provenance — Math Engine Version, NGA Edition
 *
 * AASB S2 MANDATORY DISCLOSURE (para. 29):
 *   The phrase "Estimation Uncertainty: X% of records require manual
 *   verification" must appear verbatim in the document. This is enforced
 *   by this module — the sealer cannot bypass it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createRequire } from "module";
import type { AASBReportSnapshot } from "./report_aggregator";

// PDFKit is a CommonJS module — use createRequire for ESM/CJS interop
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PDFDocument = require("pdfkit") as new (opts?: Record<string, unknown>) => PDFKit.PDFDocument;


// ─── Layout constants ─────────────────────────────────────────────────────────

const MARGIN   = 72;          // 1 inch in points
const H1_SIZE  = 22;
const H2_SIZE  = 14;
const H3_SIZE  = 11;
const BODY     = 10;
const SMALL    = 8;
const LINE_GAP = 4;

const BLACK    = "#1A1A1A";
const DARK     = "#2C3E50";
const ACCENT   = "#1A6B3F";   // EcoLink green
const MUTED    = "#7F8C8D";
const RED_WARN = "#C0392B";

// ─── Section helpers ──────────────────────────────────────────────────────────

function rule(doc: PDFKit.PDFDocument): void {
  doc.moveTo(MARGIN, doc.y)
     .lineTo(doc.page.width - MARGIN, doc.y)
     .strokeColor("#DEE2E6")
     .lineWidth(0.5)
     .stroke()
     .moveDown(0.5);
}

function h1(doc: PDFKit.PDFDocument, text: string): void {
  doc.fontSize(H1_SIZE).fillColor(DARK).font("Helvetica-Bold")
     .text(text, MARGIN, doc.y, { lineGap: LINE_GAP })
     .moveDown(0.6);
}

function h2(doc: PDFKit.PDFDocument, text: string, color = DARK): void {
  doc.fontSize(H2_SIZE).fillColor(color).font("Helvetica-Bold")
     .text(text, MARGIN, doc.y, { lineGap: LINE_GAP })
     .moveDown(0.3);
}

function h3(doc: PDFKit.PDFDocument, text: string): void {
  doc.fontSize(H3_SIZE).fillColor(ACCENT).font("Helvetica-Bold")
     .text(text, MARGIN, doc.y, { lineGap: LINE_GAP })
     .moveDown(0.2);
}

function body(doc: PDFKit.PDFDocument, text: string, color = BLACK): void {
  doc.fontSize(BODY).fillColor(color).font("Helvetica")
     .text(text, MARGIN, doc.y, { lineGap: LINE_GAP, width: doc.page.width - MARGIN * 2 })
     .moveDown(0.3);
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string, valueColor = BLACK): void {
  const x     = MARGIN;
  const width  = doc.page.width - MARGIN * 2;
  const labelW = 200;
  const valueX = x + labelW;

  const startY = doc.y;
  doc.fontSize(BODY).font("Helvetica-Bold").fillColor(MUTED)
     .text(label, x, startY, { width: labelW, lineGap: LINE_GAP });
  doc.fontSize(BODY).font("Helvetica").fillColor(valueColor)
     .text(value, valueX, startY, { width: width - labelW, lineGap: LINE_GAP });
  doc.moveDown(0.4);
}

// ─── Main PDF generator ───────────────────────────────────────────────────────

/**
 * Generate an AASB S2 Climate-related Financial Disclosure PDF.
 *
 * @param snapshot  AASBReportSnapshot produced by aggregateFinancialYear().
 * @returns         PDF as a Node.js Buffer — ready for SHA-256 hashing and upload.
 */
export function generateAASBPdf(snapshot: AASBReportSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:          "A4",
      margins:       { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title:    `AASB S2 Climate-related Financial Disclosure — ${snapshot.financialYear}`,
        Author:   "EcoLink Australia",
        Subject:  "Climate-related Financial Disclosure (AASB S2 / NGER Act 2007)",
        Keywords: "AASB S2, NGA 2025, Scope 1, Scope 2, Scope 3, CO2e, ESG",
        Creator:  `EcoLink calculator_v1 — NGA Factors ${snapshot.ngaEditionYear}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — COVER
    // ══════════════════════════════════════════════════════════════════════════

    // Header bar
    doc.rect(0, 0, doc.page.width, 8).fill(ACCENT);

    doc.moveDown(3);
    h1(doc, "AASB S2 Climate-related Financial Disclosure");

    doc.fontSize(H3_SIZE).fillColor(MUTED).font("Helvetica")
       .text("Prepared under AASB S2 / NGER Act 2007 / DCCEEW NGA Factors " + snapshot.ngaEditionYear, MARGIN)
       .moveDown(2);

    rule(doc);

    kv(doc, "Company ID",       snapshot.companyId);
    kv(doc, "Financial Year",   snapshot.financialYear);
    kv(doc, "Period",           `${snapshot.periodStart} to ${snapshot.periodEnd}`);
    kv(doc, "NGA Edition",      `NGA Factors ${snapshot.ngaEditionYear} (DCCEEW)`);
    kv(doc, "Math Engine",      snapshot.mathEngineVersion);
    kv(doc, "Generated At",     snapshot.generatedAt);
    kv(doc, "Transactions",     snapshot.classifiedTransactionIds.length.toString() + " classified");

    rule(doc);
    doc.moveDown(1);

    // Grand total highlight box
    const boxY = doc.y;
    doc.rect(MARGIN, boxY, doc.page.width - MARGIN * 2, 60)
       .fill("#F0F9F4")
       .stroke("#A8D8BE");

    doc.fontSize(H2_SIZE).font("Helvetica-Bold").fillColor(ACCENT)
       .text("Total Greenhouse Gas Emissions", MARGIN + 16, boxY + 12, { align: "center" })
       .fontSize(H1_SIZE)
       .text(`${snapshot.totalCo2eTonnes.toFixed(4)} tCO₂e`, MARGIN + 16, doc.y, { align: "center" });

    doc.y = boxY + 70;
    doc.moveDown(1);

    doc.fontSize(SMALL).fillColor(MUTED).font("Helvetica")
       .text(
         "This document is generated by EcoLink Australia using a deterministic, " +
         "AI-free calculation engine (calculator_v1). All emission factors are sourced from the " +
         `DCCEEW National Greenhouse Accounts Factors ${snapshot.ngaEditionYear}. ` +
         "No spend-based (AUD) estimation has been used.",
         MARGIN, doc.y,
         { width: doc.page.width - MARGIN * 2, lineGap: 3 },
       );

    // Footer bar
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(ACCENT);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — EMISSION TOTALS
    // ══════════════════════════════════════════════════════════════════════════

    doc.addPage();
    doc.rect(0, 0, doc.page.width, 8).fill(ACCENT);
    doc.moveDown(2);

    h2(doc, "Section 1 — Greenhouse Gas Emission Totals");
    rule(doc);
    doc.moveDown(0.5);

    // Scope 1
    h3(doc, "Scope 1 — Direct Emissions (Stationary + Mobile Combustion)");
    kv(doc, "Total tCO₂e",         `${snapshot.scope1.totalTonnes.toFixed(4)} tCO₂e`);
    kv(doc, "Transactions",        snapshot.scope1.transactionCount.toString());

    if (Object.keys(snapshot.scope1.byCategory).length > 0) {
      body(doc, "Breakdown by category:", MUTED);
      for (const [cat, tonnes] of Object.entries(snapshot.scope1.byCategory)) {
        body(doc, `  • ${cat.replace(/_/g, " ")}: ${tonnes.toFixed(4)} tCO₂e`);
      }
    }
    doc.moveDown(0.8);

    // Scope 2
    h3(doc, "Scope 2 — Indirect Emissions (Purchased Electricity, Location-Based)");
    kv(doc, "Total tCO₂e",         `${snapshot.scope2.totalTonnes.toFixed(4)} tCO₂e`);
    kv(doc, "Transactions",        snapshot.scope2.transactionCount.toString());
    kv(doc, "Method",              "Location-based (NGA Factors " + snapshot.ngaEditionYear + ", Table 5)");

    if (Object.keys(snapshot.scope2.byCategory).length > 0) {
      body(doc, "Breakdown by category:", MUTED);
      for (const [cat, tonnes] of Object.entries(snapshot.scope2.byCategory)) {
        body(doc, `  • ${cat.replace(/_/g, " ")}: ${tonnes.toFixed(4)} tCO₂e`);
      }
    }
    doc.moveDown(0.8);

    // Scope 3
    h3(doc, "Scope 3 — Value Chain Emissions (Upstream Lifecycle)");
    kv(doc, "Total tCO₂e",         `${snapshot.scope3.totalTonnes.toFixed(4)} tCO₂e`);
    kv(doc, "Transactions",        snapshot.scope3.transactionCount.toString());

    if (Object.keys(snapshot.scope3.byCategory).length > 0) {
      body(doc, "Breakdown by category:", MUTED);
      for (const [cat, tonnes] of Object.entries(snapshot.scope3.byCategory)) {
        body(doc, `  • ${cat.replace(/_/g, " ")}: ${tonnes.toFixed(4)} tCO₂e`);
      }
    }
    doc.moveDown(0.8);

    rule(doc);

    // Grand total row
    h2(doc, `Grand Total: ${snapshot.totalCo2eTonnes.toFixed(4)} tCO₂e (Scope 1 + 2 + 3)`, ACCENT);

    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(ACCENT);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 3 — DATA QUALITY DISCLOSURE (AASB S2 para. 29 — MANDATORY)
    // ══════════════════════════════════════════════════════════════════════════

    doc.addPage();
    doc.rect(0, 0, doc.page.width, 8).fill(ACCENT);
    doc.moveDown(2);

    h2(doc, "Section 2 — Data Quality Disclosure (AASB S2 para. 29)");
    rule(doc);
    doc.moveDown(0.5);

    const dq        = snapshot.dataQuality;
    const needsManual = dq.needsReviewCount;
    const pctManual   = dq.totalCount > 0
      ? parseFloat(((needsManual / dq.totalCount) * 100).toFixed(1))
      : 0;

    // MANDATORY AASB S2 phrase
    const mandatoryDisclosure =
      `Estimation Uncertainty: ${pctManual}% of records require manual verification.`;

    const disclosureColor = dq.disclosureRequired ? RED_WARN : ACCENT;
    h3(doc, "Mandatory Disclosure Statement (AASB S2 para. 29)");
    doc.fontSize(H3_SIZE).fillColor(disclosureColor).font("Helvetica-Bold")
       .text(mandatoryDisclosure, MARGIN, doc.y, {
         width: doc.page.width - MARGIN * 2,
         lineGap: LINE_GAP,
       })
       .moveDown(0.8);

    rule(doc);
    doc.moveDown(0.3);

    kv(doc, "Data Quality Score",     `${dq.score.toFixed(2)}%`);
    kv(doc, "Uncertainty Tier",       dq.uncertaintyTier);
    kv(doc, "Classified Records",     dq.classifiedCount.toString());
    kv(doc, "Ignored (non-relevant)", dq.ignoredCount.toString());
    kv(doc, "Needs Manual Review",    dq.needsReviewCount.toString(),
       dq.needsReviewCount > 0 ? RED_WARN : BLACK);
    kv(doc, "Total Transactions",     dq.totalCount.toString());

    doc.moveDown(1);

    const tierExplanation: Record<string, string> = {
      "Tier 1": "≥ 95% of emission-relevant transactions were physically measured and classified. " +
                "This represents high-quality data with minimal estimation uncertainty.",
      "Tier 2": "80–94% of emission-relevant transactions were physically measured. " +
                "A minority relied on estimation or manual entry. " +
                "Disclosure of estimation basis is recommended.",
      "Tier 3": "Less than 80% of emission-relevant transactions were physically measured. " +
                "Significant estimation uncertainty exists. " +
                "AASB S2 requires explicit disclosure of this uncertainty and the estimation methods used.",
    };

    body(doc, `Tier Explanation — ${dq.uncertaintyTier}:`, MUTED);
    body(doc, tierExplanation[dq.uncertaintyTier] ?? "", BLACK);

    if (dq.disclosureRequired) {
      doc.moveDown(0.5);
      doc.rect(MARGIN, doc.y, doc.page.width - MARGIN * 2, 40)
         .fill("#FFF5F5")
         .stroke(RED_WARN);
      doc.fontSize(BODY).font("Helvetica-Bold").fillColor(RED_WARN)
         .text(
           "⚠ AASB S2 DISCLOSURE REQUIRED: This report has Tier 3 data quality. " +
           "The Board must explicitly acknowledge estimation uncertainty in the annual report.",
           MARGIN + 8, doc.y + 6,
           { width: doc.page.width - MARGIN * 2 - 16 },
         );
      doc.y += 50;
    }

    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(ACCENT);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 4 — CALCULATION PROVENANCE
    // ══════════════════════════════════════════════════════════════════════════

    doc.addPage();
    doc.rect(0, 0, doc.page.width, 8).fill(ACCENT);
    doc.moveDown(2);

    h2(doc, "Section 3 — Calculation Provenance & Audit Trail");
    rule(doc);
    doc.moveDown(0.5);

    body(doc,
      "All CO₂e calculations in this report were performed exclusively by " +
      "EcoLink's deterministic math engine (calculator_v1). " +
      "No artificial intelligence, large language model, or spend-based estimation " +
      "was used in any calculation. " +
      "Physical quantity extraction from invoices was performed by a deterministic " +
      "regular expression engine (regex_extractor_v1), not an AI model.",
    );

    doc.moveDown(0.5);
    rule(doc);
    doc.moveDown(0.3);

    kv(doc, "Math Engine",        `${snapshot.mathEngineVersion}`);
    kv(doc, "Extraction Engine",  "regex_extractor_v1");
    kv(doc, "Emission Factors",   `NGA Factors ${snapshot.ngaEditionYear} (DCCEEW, Australia)`);
    kv(doc, "Calculation Method", "Method 1 — Physical Activity Quantities (NGA 2025)");
    kv(doc, "Scope 2 Method",     "Location-based (NGA Factors Table 5, State Grid)");
    kv(doc, "Rounding",           ".toFixed(4) at each multiplication step (IEEE-754 guard)");
    kv(doc, "Transaction IDs",    `${snapshot.classifiedTransactionIds.length} records (see audit log)`);

    doc.moveDown(1);
    rule(doc);
    doc.moveDown(0.5);

    body(doc,
      "This document is protected by a SHA-256 cryptographic hash stored in the " +
      "aasb_reports.sha256_hash database column. Any post-seal modification of this " +
      "document will produce a different hash, invalidating regulatory acceptance. " +
      "The hash can be verified with: sha256sum <report.pdf>",
      MUTED,
    );

    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(ACCENT);

    // ── Finalize ──────────────────────────────────────────────────────────────
    doc.end();
  });
}
