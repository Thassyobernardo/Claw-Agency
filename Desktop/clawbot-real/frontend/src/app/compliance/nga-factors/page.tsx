import Link from "next/link";
import { BarChart3, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "NGA Emission Factors | EcoLink Australia",
  description:
    "Understand Australia's National Greenhouse Accounts emission factors and how EcoLink uses them to calculate your CO₂e.",
};

const categories = [
  { scope: 1, name: "Stationary Energy", examples: "Natural gas, diesel generators, LPG" },
  { scope: 1, name: "Transport — Fuel Combustion", examples: "Petrol, diesel in company vehicles" },
  { scope: 1, name: "Fugitive Emissions", examples: "Refrigerants, leaked gases" },
  { scope: 1, name: "Industrial Processes", examples: "Cement, chemicals, metals" },
  { scope: 2, name: "Purchased Electricity", examples: "Electricity bills (grid, state-based factor)" },
  { scope: 3, name: "Business Travel", examples: "Flights, taxis, hire cars" },
  { scope: 3, name: "Freight & Logistics", examples: "Courier, road freight, sea freight" },
  { scope: 3, name: "Purchased Goods & Services", examples: "Office supplies, subcontractors" },
  { scope: 3, name: "Waste", examples: "Landfill, recycling" },
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

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aw-green-light">
            <BarChart3 size={20} className="text-aw-green" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-aw-green">Compliance Guide</span>
        </div>
        <h1 className="text-4xl font-black text-aw-slate mb-4">NGA Emission Factors 2023–24</h1>
        <p className="text-lg text-aw-slate-mid font-medium leading-relaxed mb-12">
          Australia's National Greenhouse Accounts (NGA) factors are the official emission conversion rates published by the government. EcoLink uses these to turn every dollar you spend into kilograms of CO₂ equivalent.
        </p>

        {/* What are NGA factors */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">What Are NGA Factors?</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-4">
            NGA factors are published annually by the Department of Climate Change, Energy, the Environment and Water (DCCEEW). They convert units of energy, fuel, or activity into greenhouse gas emissions, expressed in kilograms of CO₂ equivalent (kg CO₂e).
          </p>
          <p className="text-aw-slate-mid leading-relaxed mb-4">
            They are the authoritative source for carbon accounting in Australia. Any emissions report submitted under AASB S2 or the National Greenhouse and Energy Reporting (NGER) framework must use these factors.
          </p>
          <div className="rounded-2xl border border-aw-green/30 bg-aw-green-light/30 p-5">
            <p className="text-sm font-semibold text-aw-green-dark">
              EcoLink uses the NGA 2023–24 edition — the most current factors available. When the 2024–25 edition is published, EcoLink will update all calculations automatically.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">How Spend-Based Calculation Works</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-6">
            For SMEs without direct meter readings, the most practical method is <strong>spend-based estimation</strong>: multiply the dollar amount of a purchase by an emission intensity factor for that category.
          </p>
          <div className="rounded-2xl border border-aw-gray-border bg-white p-6 font-mono text-sm space-y-3 mb-4">
            <p className="text-aw-slate-mid">Transaction: <span className="text-aw-slate font-bold">"BP Station Sydney · $150"</span></p>
            <p className="text-aw-slate-mid">Category: <span className="text-aw-slate font-bold">Transport Fuel — Petrol (Scope 1)</span></p>
            <p className="text-aw-slate-mid">NGA Factor: <span className="text-aw-slate font-bold">1.087 kg CO₂e per $1 AUD</span></p>
            <div className="border-t border-aw-gray-border pt-3">
              <p className="text-aw-green font-bold">$150 × 1.087 = 163 kg CO₂e</p>
            </div>
          </div>
          <p className="text-sm text-aw-slate-mid font-medium">
            EcoLink&apos;s AI reads the transaction description, identifies the correct NGA category, and applies the factor automatically. No manual lookup required.
          </p>
        </section>

        {/* Category table */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Common Categories EcoLink Classifies</h2>
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

        {/* Limitations */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Limitations of Spend-Based Estimates</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-3">
            Spend-based estimates are accepted under AASB S2 for Scope 3 categories where activity data is unavailable. They are considered Tier 3 data quality — less precise than direct measurement but widely used and accepted for SME reporting.
          </p>
          <p className="text-aw-slate-mid leading-relaxed">
            For Scope 1 and Scope 2 (direct fuel use and electricity), EcoLink uses activity-based factors where transaction descriptions clearly identify the fuel type or utility provider.
          </p>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link href="/compliance/aasb" className="text-sm font-bold text-aw-green hover:underline">
            ← AASB S1/S2 Overview
          </Link>
          <Link href="/compliance/scope-3" className="text-sm font-bold text-aw-green hover:underline">
            Scope 3 Guide →
          </Link>
        </div>

      </div>
    </div>
  );
}
