import Link from "next/link";
import { BarChart3, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "NGA Emission Factors | EcoLink Australia",
  description:
    "EcoLink's Spend-to-Carbon AI engine matches every transaction to the latest National Greenhouse Accounts factors published by DCCEEW — not generic global averages.",
};

const categories = [
  { scope: 1, name: "Stationary Energy",             examples: "Natural gas, LPG, diesel generators" },
  { scope: 1, name: "Transport — Fuel Combustion",    examples: "Petrol, diesel in company vehicles" },
  { scope: 1, name: "Fugitive Emissions",             examples: "Refrigerants, compressed gases" },
  { scope: 2, name: "Purchased Electricity",          examples: "Grid electricity (state-specific factor)" },
  { scope: 3, name: "Business Travel",                examples: "Domestic & international flights, taxis" },
  { scope: 3, name: "Freight & Logistics",            examples: "Courier, road freight, sea freight" },
  { scope: 3, name: "Purchased Goods & Services",     examples: "Subcontractors, materials, office supplies" },
  { scope: 3, name: "Waste Generated in Operations",  examples: "Landfill, recycling, wastewater" },
];

const scopeColor: Record<number, string> = {
  1: "bg-blue-100 text-blue-700",
  2: "bg-aw-green-light text-aw-green-dark",
  3: "bg-purple-100 text-purple-700",
};

export default function NGAFactorsPage() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aw-green-light">
            <BarChart3 size={20} className="text-aw-green" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-aw-green">Compliance Guide</span>
        </div>

        <h1 className="text-4xl font-black text-aw-slate mb-4">
          Powered by the Latest NGA Factors
        </h1>
        <p className="text-lg text-aw-slate-mid font-medium leading-relaxed mb-12">
          Accuracy is non-negotiable in carbon accounting. EcoLink&apos;s Spend-to-Carbon AI engine
          does not rely on generic global averages. Instead, every Xero transaction is automatically
          classified and matched against the latest <strong>National Greenhouse Accounts (NGA) Factors</strong>,
          published annually by the Australian Department of Climate Change, Energy, the Environment
          and Water (DCCEEW).
        </p>

        {/* What are NGA factors */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Why Localised Factors Matter</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-5">
            This localised approach guarantees that the kg CO₂e generated for electricity, transport,
            and procurement accurately reflects the <strong>Australian market context</strong> —
            providing a highly defensible and accurate carbon baseline. A unit of electricity consumed
            in Queensland has a different emission intensity than in Tasmania, and our engine accounts
            for this automatically.
          </p>
          <div className="rounded-2xl border border-aw-green/30 bg-aw-green-light/30 p-5">
            <p className="text-sm font-semibold text-aw-green-dark">
              EcoLink uses the NGA 2023–24 edition — the most current factors available from DCCEEW.
              When the 2024–25 edition is published, all calculations update automatically. Historical
              reports retain the factors that were current when they were generated.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">How Spend-Based Calculation Works</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-6">
            For SMEs without direct meter readings, the most practical — and AASB S2-accepted —
            method is <strong>spend-based estimation</strong>: multiply the dollar amount of a
            purchase by an emission intensity factor for that category.
          </p>
          <div className="rounded-2xl border border-aw-gray-border bg-white p-6 font-mono text-sm space-y-3 mb-5">
            <p className="text-aw-slate-mid">Transaction: <span className="text-aw-slate font-bold">"BP Station Sydney · $150"</span></p>
            <p className="text-aw-slate-mid">AI classifies to: <span className="text-aw-slate font-bold">Transport — Petrol (Scope 1)</span></p>
            <p className="text-aw-slate-mid">NGA Factor applied: <span className="text-aw-slate font-bold">1.087 kg CO₂e per AUD $1</span></p>
            <div className="border-t border-aw-gray-border pt-3">
              <p className="text-aw-green font-bold">$150 × 1.087 = 163 kg CO₂e</p>
            </div>
          </div>
          <p className="text-sm text-aw-slate-mid font-medium">
            EcoLink&apos;s AI reads the transaction description, identifies the correct NGA category
            using keyword matching and large language model classification, then applies the factor
            automatically. No spreadsheets, no manual lookups.
          </p>
        </section>

        {/* Classification pipeline */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">The Classification Pipeline</h2>
          <div className="space-y-3">
            {[
              { step: "1", title: "Keyword matching", desc: "Fast rule-based matching against known supplier names and transaction patterns (e.g. \"BP\", \"Toll\", \"Origin Energy\")." },
              { step: "2", title: "Groq llama-3.3-70b", desc: "If keyword matching is inconclusive, the transaction is passed to a large language model for semantic understanding." },
              { step: "3", title: "Gemini fallback", desc: "A second AI model is used as a fallback for further disambiguation." },
              { step: "4", title: "Confidence threshold", desc: "≥ 60% confidence → auto-classified. 40–59% → flagged for human review. Below 40% → escalated as unmatched." },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4 rounded-xl border border-aw-gray-border bg-white p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aw-slate text-white text-xs font-black">
                  {item.step}
                </div>
                <div>
                  <p className="font-bold text-aw-slate text-sm">{item.title}</p>
                  <p className="text-sm text-aw-slate-mid mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Categories EcoLink Classifies</h2>
          <div className="rounded-2xl border border-aw-gray-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aw-gray-border bg-aw-gray/60">
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid">Scope</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid hidden md:table-cell">Examples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aw-gray-border">
                {categories.map((cat) => (
                  <tr key={cat.name} className="hover:bg-aw-gray/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${scopeColor[cat.scope]}`}>
                        Scope {cat.scope}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-aw-slate">{cat.name}</td>
                    <td className="px-5 py-3 text-aw-slate-mid hidden md:table-cell">{cat.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Audit trail */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Audit-Ready Data Quality</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Classified", desc: "AI confidence ≥ 60%. Auto-approved.", color: "border-aw-green/30 bg-aw-green-light/30 text-aw-green" },
              { label: "Needs Review", desc: "40–59% confidence. Human review queue.", color: "border-yellow-200 bg-yellow-50 text-yellow-700" },
              { label: "No Factor", desc: "No NGA match. Manual assignment needed.", color: "border-red-200 bg-red-50 text-red-600" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.color.split(" ").slice(0,2).join(" ")} bg-opacity-30`}>
                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${s.color.split(" ")[2]}`}>{s.label}</p>
                <p className="text-sm text-aw-slate-mid">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link href="/compliance/aasb"   className="text-sm font-bold text-aw-green hover:underline">← AASB S1/S2 Overview</Link>
          <Link href="/compliance/scope-3" className="text-sm font-bold text-aw-green hover:underline">Scope 3 Guide →</Link>
        </div>

      </div>
    </div>
  );
}
