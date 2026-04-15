import Link from "next/link";
import { Truck, ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Scope 3 Emissions Guide | EcoLink Australia",
  description:
    "A practical guide to Scope 3 emissions for Australian SMEs — what they are, why they matter, and how to report them.",
};

const categories = [
  { id: "1",  name: "Purchased goods & services",        dir: "upstream",   relevant: true },
  { id: "2",  name: "Capital goods",                     dir: "upstream",   relevant: false },
  { id: "3",  name: "Fuel & energy-related activities",  dir: "upstream",   relevant: true },
  { id: "4",  name: "Upstream transportation & freight", dir: "upstream",   relevant: true },
  { id: "5",  name: "Waste generated in operations",     dir: "upstream",   relevant: true },
  { id: "6",  name: "Business travel",                   dir: "upstream",   relevant: true },
  { id: "7",  name: "Employee commuting",                dir: "upstream",   relevant: false },
  { id: "11", name: "Use of sold products",              dir: "downstream", relevant: false },
  { id: "12", name: "End-of-life treatment of products", dir: "downstream", relevant: false },
];

export default function Scope3Page() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aw-green-light">
            <Truck size={20} className="text-aw-green" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-aw-green">Compliance Guide</span>
        </div>
        <h1 className="text-4xl font-black text-aw-slate mb-4">Scope 3 Emissions — The SME Guide</h1>
        <p className="text-lg text-aw-slate-mid font-medium leading-relaxed mb-12">
          Scope 3 is often the largest and least understood part of a business&apos;s carbon footprint. It&apos;s also the part that most directly affects Australian SMEs under AASB S2.
        </p>

        {/* The three scopes */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-5">The Three Scopes of Emissions</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Scope 1</p>
              <p className="font-black text-aw-slate mb-2">Direct Emissions</p>
              <p className="text-sm text-aw-slate-mid">From sources you own or control. Fuel in your vehicles, gas boilers, refrigerant leaks.</p>
            </div>
            <div className="rounded-2xl border border-aw-green/30 bg-aw-green-light/30 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-aw-green mb-2">Scope 2</p>
              <p className="font-black text-aw-slate mb-2">Purchased Energy</p>
              <p className="text-sm text-aw-slate-mid">Electricity you buy from the grid. Calculated using state-based NGA factors.</p>
            </div>
            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-2">Scope 3</p>
              <p className="font-black text-aw-slate mb-2">Value Chain</p>
              <p className="text-sm text-aw-slate-mid">Everything else — what you buy, how you travel, what your suppliers emit, what happens to your products.</p>
            </div>
          </div>
          <p className="text-aw-slate-mid leading-relaxed">
            For most Australian SMEs, Scope 3 accounts for <strong>60–80% of total emissions</strong>. It is the most important scope for supply chain reporting under AASB S2.
          </p>
        </section>

        {/* Why it matters */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Why Scope 3 Matters for Your SME</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-4">
            Under AASB S2, large Australian corporations must disclose their Scope 3 emissions — which includes the emissions of their entire supply chain. This means they will request emissions data from their suppliers (you).
          </p>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 mb-4">
            <p className="text-sm font-semibold text-yellow-800">
              A construction company supplying to Lendlease or BHP will need to provide Scope 1, 2, and 3 emissions data or risk being dropped from the approved supplier list.
            </p>
          </div>
          <p className="text-aw-slate-mid leading-relaxed">
            EcoLink captures your Scope 3 automatically by reading your accounts payable transactions — every purchase you make from a supplier generates an upstream Scope 3 emission.
          </p>
        </section>

        {/* GHG Protocol categories */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Scope 3 Categories — Which Ones Apply to SMEs?</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-5">
            The GHG Protocol defines 15 Scope 3 categories. For most Australian SMEs, the following are most relevant:
          </p>
          <div className="rounded-2xl border border-aw-gray-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aw-gray-border bg-aw-gray/60">
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid w-10">#</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid">SME Relevant?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aw-gray-border">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-aw-gray/30 transition-colors">
                    <td className="px-5 py-3 text-aw-slate-light font-mono text-xs">{cat.id}</td>
                    <td className="px-5 py-3 font-semibold text-aw-slate">{cat.name}</td>
                    <td className="px-5 py-3">
                      {cat.relevant ? (
                        <span className="flex items-center gap-1.5 text-aw-green font-semibold text-xs">
                          <CheckCircle2 size={13} /> Yes — captured by EcoLink
                        </span>
                      ) : (
                        <span className="text-aw-slate-light text-xs">Less common for SMEs</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* How to report */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">How to Report Scope 3 with EcoLink</h2>
          <ol className="space-y-4">
            {[
              { step: "1", title: "Connect Xero", desc: "Authorise EcoLink to read your accounts payable and expense transactions via OAuth." },
              { step: "2", title: "Run AI Classification", desc: "EcoLink's engine reads each transaction and maps it to the correct Scope 3 category using NGA 2023–24 factors." },
              { step: "3", title: "Review flagged items", desc: "Low-confidence transactions appear in your Review Queue. Approve or reassign in one click." },
              { step: "4", title: "Export AASB S2 Report", desc: "Download a PDF with your Scope 1, 2, and 3 breakdown — ready to send to your corporate client." },
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

        <div className="flex flex-wrap gap-4">
          <Link href="/compliance/aasb" className="text-sm font-bold text-aw-green hover:underline">
            ← AASB S1/S2 Overview
          </Link>
          <Link href="/compliance/nga-factors" className="text-sm font-bold text-aw-green hover:underline">
            ← NGA Factors
          </Link>
          <Link
            href="/signup"
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-aw-green px-6 py-3 text-sm font-bold text-white hover:bg-aw-green-dark transition-all active:scale-95"
          >
            Start free trial →
          </Link>
        </div>

      </div>
    </div>
  );
}
