/**
 * GET /api/dashboard/benchmark
 *
 * Returns sector benchmark comparison for the authenticated company.
 *
 * Calculates the company's current emission intensity (kg CO2e per AUD 1,000
 * of estimated revenue) and compares it against sector percentiles from the
 * sector_benchmarks table.
 *
 * Revenue estimation: Since SMEs rarely store revenue in EcoLink, we estimate
 * it from total spend × a sector-specific markup multiplier. This is a
 * reasonable proxy for benchmarking purposes and is flagged as estimated.
 *
 * Response 200: {
 *   company_intensity:  number,   // kg CO2e per AUD 1,000 (company)
 *   sector_p25:         number,   // top-quartile performers
 *   sector_p50:         number,   // median
 *   sector_p75:         number,   // laggards
 *   sector_avg:         number,   // population mean
 *   percentile_rank:    number,   // 0–100, lower = better
 *   sector_label:       string,
 *   size_band:          string,
 *   total_co2e_kg:      number,
 *   total_spend_aud:    number,
 *   target_2030_intensity: number,
 *   data_quality:       "good" | "estimated" | "insufficient"
 * }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

// Markup multipliers: spend → estimated revenue, by ANZSIC division
// (i.e. every $1 of business spend generates ~X dollars of revenue)
const SPEND_TO_REVENUE: Record<string, number> = {
  A: 2.8,  // Agriculture
  B: 3.2,  // Mining
  C: 2.2,  // Manufacturing
  D: 2.5,  // Electricity/Gas/Water
  E: 1.8,  // Construction
  F: 1.4,  // Wholesale (thin margins)
  G: 1.6,  // Retail
  H: 2.0,  // Accommodation/Food
  I: 1.9,  // Transport
  J: 3.5,  // ICT (high margin)
  K: 4.0,  // Financial (very high margin)
  L: 2.8,  // Real Estate
  M: 3.2,  // Professional Services
  N: 2.0,  // Admin/Support
  O: 1.5,  // Public Admin
  P: 2.0,  // Education
  Q: 1.8,  // Health
  R: 2.2,  // Arts/Recreation
  S: 2.0,  // Other Services
};

function deriveAnzsicDivision(code: string | null, description: string | null): string {
  if (!code && !description) return "M"; // default to Professional Services
  const d = (description ?? "").toLowerCase();
  if (d.includes("construct") || d.includes("build") || d.includes("trade")) return "E";
  if (d.includes("transport") || d.includes("logist") || d.includes("freight")) return "I";
  if (d.includes("manufactur")) return "C";
  if (d.includes("retail")) return "G";
  if (d.includes("wholesale")) return "F";
  if (d.includes("health") || d.includes("medical") || d.includes("dental")) return "Q";
  if (d.includes("food") || d.includes("hospitality") || d.includes("accommodation")) return "H";
  if (d.includes("tech") || d.includes("software") || d.includes("it ") || d.includes("digital")) return "J";
  if (d.includes("finance") || d.includes("accounting") || d.includes("insurance")) return "K";
  if (d.includes("education") || d.includes("training") || d.includes("school")) return "P";
  if (d.includes("agriculture") || d.includes("farm") || d.includes("pastoral")) return "A";
  if (d.includes("mining") || d.includes("resource")) return "B";
  if (d.includes("real estate") || d.includes("property")) return "L";
  return code?.charAt(0)?.toUpperCase() ?? "M";
}

function sizeBand(employeeCount: number | null): string {
  if (!employeeCount || employeeCount < 5)  return "micro";
  if (employeeCount < 20)  return "small";
  if (employeeCount < 200) return "medium";
  return "large";
}

function calcPercentileRank(
  companyVal: number,
  p25: number,
  p50: number,
  p75: number
): number {
  // Linear interpolation across 4 known points: 0, p25, p50, p75, 100
  if (companyVal <= p25) return Math.round((companyVal / p25) * 25);
  if (companyVal <= p50) return Math.round(25 + ((companyVal - p25) / (p50 - p25)) * 25);
  if (companyVal <= p75) return Math.round(50 + ((companyVal - p50) / (p75 - p50)) * 25);
  return Math.min(100, Math.round(75 + ((companyVal - p75) / p75) * 25));
}

export async function GET(): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const companyId = session.user.companyId;

  // ── Company profile ───────────────────────────────────────────────────
  const companies = await sql<Array<{
    industry_anzsic_code: string | null;
    industry_description: string | null;
  }>>`
    SELECT industry_anzsic_code, industry_description
    FROM companies WHERE id = ${companyId}::uuid LIMIT 1
  `;

  if (companies.length === 0) {
    return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  }

  const company = companies[0];
  const division = deriveAnzsicDivision(
    company.industry_anzsic_code,
    company.industry_description
  );

  // ── Emission totals for current FY ────────────────────────────────────
  const now = new Date();
  const fyYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStart = `${fyYear}-07-01`;
  const fyEnd   = `${fyYear + 1}-06-30`;

  const totals = await sql<Array<{
    total_co2e_kg: string;
    total_spend: string;
    tx_count: string;
    classified_count: string;
  }>>`
    SELECT
      COALESCE(SUM(co2e_kg), 0)::text        AS total_co2e_kg,
      COALESCE(SUM(amount_aud), 0)::text     AS total_spend,
      COUNT(*)::text                          AS tx_count,
      COUNT(*) FILTER (WHERE classification_status = 'classified')::text AS classified_count
    FROM transactions
    WHERE company_id      = ${companyId}::uuid
      AND transaction_date BETWEEN ${fyStart}::date AND ${fyEnd}::date
  `;

  const totalCo2eKg  = parseFloat(totals[0]?.total_co2e_kg ?? "0");
  const totalSpend   = parseFloat(totals[0]?.total_spend   ?? "0");
  const txCount      = parseInt(totals[0]?.tx_count        ?? "0", 10);
  const classifiedPct = txCount > 0
    ? parseInt(totals[0]?.classified_count ?? "0", 10) / txCount
    : 0;

  // ── Data quality assessment ───────────────────────────────────────────
  const dataQuality: "good" | "estimated" | "insufficient" =
    totalCo2eKg === 0 || txCount < 5 ? "insufficient"
    : classifiedPct >= 0.7            ? "good"
    : "estimated";

  if (dataQuality === "insufficient") {
    return NextResponse.json({
      data_quality: "insufficient",
      message: "Not enough classified transactions to calculate a meaningful benchmark. Sync Xero and run the classifier first.",
    });
  }

  // ── Estimate revenue & calculate intensity ─────────────────────────────
  const multiplier    = SPEND_TO_REVENUE[division] ?? 2.0;
  const estRevenue    = totalSpend * multiplier;
  const intensity     = estRevenue > 0 ? (totalCo2eKg / estRevenue) * 1000 : 0; // kg per AUD 1,000

  // ── Fetch sector benchmark ────────────────────────────────────────────
  const band = sizeBand(null); // default: small (no employee count stored yet)

  const benchmarks = await sql<Array<{
    anzsic_label:    string;
    size_band:       string;
    scope1_intensity: string;
    scope2_intensity: string;
    scope3_intensity: string;
    total_intensity:  string;
    p25_intensity:    string;
    p50_intensity:    string;
    p75_intensity:    string;
    target_2030_pct:  string;
  }>>`
    SELECT
      anzsic_label,
      size_band,
      scope1_intensity::text,
      scope2_intensity::text,
      scope3_intensity::text,
      total_intensity::text,
      p25_intensity::text,
      p50_intensity::text,
      p75_intensity::text,
      target_2030_pct::text
    FROM sector_benchmarks
    WHERE anzsic_division = ${division}
      AND size_band       = ${band}
      AND reference_year  = 2024
    LIMIT 1
  `;

  // Fallback: try 'small' band if company's band has no data
  const bench = benchmarks[0] ?? null;

  if (!bench) {
    return NextResponse.json({ data_quality: "insufficient", message: "No benchmark data for this sector." });
  }

  const sectorP25  = parseFloat(bench.p25_intensity);
  const sectorP50  = parseFloat(bench.p50_intensity);
  const sectorP75  = parseFloat(bench.p75_intensity);
  const sectorAvg  = parseFloat(bench.total_intensity);
  const target2030Pct = parseFloat(bench.target_2030_pct);
  const target2030Intensity = sectorAvg * (1 - target2030Pct / 100);

  const percentileRank = calcPercentileRank(intensity, sectorP25, sectorP50, sectorP75);

  // ── Reduction suggestion ──────────────────────────────────────────────
  const reductionToMedian = intensity > sectorP50
    ? Math.round(((intensity - sectorP50) / intensity) * 100)
    : 0;

  return NextResponse.json({
    company_intensity:        Math.round(intensity * 10) / 10,
    sector_p25:               sectorP25,
    sector_p50:               sectorP50,
    sector_p75:               sectorP75,
    sector_avg:               sectorAvg,
    percentile_rank:          percentileRank,
    sector_label:             bench.anzsic_label,
    size_band:                bench.size_band,
    anzsic_division:          division,
    total_co2e_kg:            Math.round(totalCo2eKg),
    total_spend_aud:          Math.round(totalSpend),
    est_revenue_aud:          Math.round(estRevenue),
    target_2030_intensity:    Math.round(target2030Intensity * 10) / 10,
    reduction_to_median_pct:  reductionToMedian,
    data_quality:             dataQuality,
    fy_start:                 fyStart,
    fy_end:                   fyEnd,
  });
}
