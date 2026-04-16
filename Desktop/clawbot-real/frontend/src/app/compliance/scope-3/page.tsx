import Link from "next/link";
import { Truck, ArrowLeft, CheckCircle2, Zap, Flame } from "lucide-react";

export const metadata = {
  title: "Scope 3 Emissions Guide | EcoLink Australia",
  description:
    "Understanding Scope 1, 2, and 3 emissions — what they mean for your SME and how EcoLink automates Scope 3 from your existing financial data.",
};

export default function Scope3Page() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aw-green-light">
            <Truck size={20} className="text-aw-green" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-aw-green">Compliance Guide</span>
        </div>

        <h1 className="text-4xl font-black text-aw-slate mb-4">
          Understanding Scope 1, 2, and 3 Emissions
        </h1>
        <p className="text-lg text-aw-slate-mid font-medium leading-relaxed mb-12">
          Carbon reporting is divided into three scopes. Here is what they mean for your SME —
          and why Scope 3 is both the most important and the hardest to calculate without automation.
        </p>

        {/* Three scopes */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-5">The Three Scopes</h2>
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                <Flame size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">Scope 1 — Direct Emissions</p>
                <p className="font-black text-aw-slate mb-2">Emissions from sources you own or control</p>
                <p className="text-sm text-aw-slate-mid leading-relaxed">
                  Fuel burned in company vehicles, gas boilers, diesel generators, and refrigerant
                  leaks from your own equipment. You have direct control over these emissions.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-aw-green/30 bg-aw-green-light/30 p-6 flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aw-green-light">
                <Zap size={20} className="text-aw-green" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-aw-green mb-1">Scope 2 — Purchased Energy</p>
                <p className="font-black text-aw-slate mb-2">Indirect emissions from the electricity you buy</p>
                <p className="text-sm text-aw-slate-mid leading-relaxed">
                  Electricity bills. The emission factor depends on your state grid mix — Queensland
                  has a higher intensity than Tasmania due to the different energy generation sources.
                  EcoLink applies state-specific NGA factors automatically.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100">
                <Truck size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">Scope 3 — Value Chain</p>
                <p className="font-black text-aw-slate mb-2">All other indirect emissions across your value chain</p>
                <p className="text-sm text-aw-slate-mid leading-relaxed">
                  Business travel, freight, purchased goods and services, waste. For most businesses,
                  Scope 3 accounts for <strong>over 70% of total emissions</strong>. It is the most
                  difficult scope to calculate — but EcoLink automates it from your existing financial
                  spend data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Scope 3 matters */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Why Scope 3 Matters for Your SME</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-5">
            Under AASB S2, large Australian corporations must disclose their Scope 3 emissions —
            which includes the emissions of their entire supply chain. This means they will request
            emissions data from their suppliers. If you cannot provide it, you risk being removed
            from their approved supplier list.
          </p>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 mb-5">
            <p className="text-sm font-semibold text-yellow-800">
              Historically, calculating Scope 3 required complex spreadsheets, supplier surveys, and
              months of consultant engagement. EcoLink&apos;s AI automates this by analysing your
              existing financial spend data — instantly categorising expenses into carbon impact
              without manual data entry.
            </p>
          </div>
        </section>

        {/* GHG protocol categories */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Scope 3 Categories EcoLink Captures</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-5">
            The GHG Protocol defines 15 Scope 3 categories. EcoLink automatically captures the
            upstream categories most relevant to Australian SMEs from your Xero transactions:
          </p>
          <div className="space-y-2">
            {[
              { cat: "Category 1", name: "Purchased goods & services",        note: "Every supplier invoice" },
              { cat: "Category 3", name: "Fuel & energy-related activities",  note: "Upstream extraction of fuels you use" },
              { cat: "Category 4", name: "Upstream transportation & freight", note: "Courier, road freight, shipping" },
              { cat: "Category 5", name: "Waste generated in operations",     note: "Landfill, skip bins, recycling" },
              { cat: "Category 6", name: "Business travel",                   note: "Flights, accommodation, taxis" },
            ].map((item) => (
              <div key={item.cat} className="flex items-start gap-3 rounded-xl border border-aw-gray-border bg-white px-4 py-3">
                <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-aw-green" />
                <div>
                  <p className="text-sm font-bold text-aw-slate">{item.cat} — {item.name}</p>
                  <p className="text-xs text-aw-slate-mid">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How EcoLink automates it */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">How EcoLink Automates Scope 3</h2>
          <ol className="space-y-4">
            {[
              { step: "1", title: "Connect Xero", desc: "Authorise EcoLink to read your accounts payable and expense transactions via secure OAuth 2.0. No credentials stored — only revocable access tokens." },
              { step: "2", title: "AI classifies every transaction", desc: "Each line item is matched to the correct NGA emission category. \"Toll Group invoice $3,200\" becomes Scope 3 Category 4 — Freight." },
              { step: "3", title: "Review flagged items", desc: "Low-confidence transactions appear in your Review Queue. Approve or reassign in one click — full audit trail maintained." },
              { step: "4", title: "Export your AASB S2 report", desc: "A PDF with your Scope 1, 2, and 3 breakdown — ready to send to your corporate client, formatted to AASB S2 requirements." },
            ].map((item) => (
              <li key={item.step} className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aw-slate text-white text-sm font-black">
                  {item.step}
                </div>
                <div>
                  <p className="font-bold text-aw-slate">{item.title}</p>
                  <p className="text-sm text-aw-slate-mid mt-0.5">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-xl bg-aw-green px-8 py-3.5 text-sm font-bold text-white hover:bg-aw-green-dark transition-all active:scale-95 shadow-lg shadow-aw-green/20"
        >
          Start free — get your Scope 3 report →
        </Link>

        <div className="mt-10 flex flex-wrap gap-5 border-t border-aw-gray-border pt-8">
          <Link href="/compliance/aasb"        className="text-sm font-bold text-aw-green hover:underline">← AASB S1/S2 Overview</Link>
          <Link href="/compliance/nga-factors"  className="text-sm font-bold text-aw-green hover:underline">← NGA Factors</Link>
        </div>

      </div>
    </div>
  );
}
