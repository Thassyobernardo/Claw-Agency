import Link from "next/link";
import { ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "AASB S1 & S2 Compliance | EcoLink Australia",
  description:
    "From 2026, large Australian entities must disclose climate-related financial information under AASB S1 and S2. EcoLink automates this for their SME suppliers.",
};

export default function AASBPage() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aw-green-light">
            <ShieldCheck size={20} className="text-aw-green" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-aw-green">Compliance Guide</span>
        </div>

        <h1 className="text-4xl font-black text-aw-slate mb-4">
          Meeting AASB S1 &amp; S2 Requirements with EcoLink
        </h1>
        <p className="text-lg text-aw-slate-mid font-medium leading-relaxed mb-12">
          From 2026, large Australian entities are mandated to disclose climate-related financial
          information under the new AASB S1 and S2 standards. While SMEs are not directly mandated,
          your large corporate clients are — and they will require this data from their supply chain.
        </p>

        {/* The gap */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">The Supply Chain Gap</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-5">
            EcoLink bridges this gap. Our automated reports extract the exact data points your
            corporate partners need for their AASB S2 disclosures — specifically targeting
            <strong> Scope 3 supply chain emissions</strong>. We structure your transaction data
            into a compliant, audit-ready format, ensuring you remain a preferred vendor for
            Australia&apos;s largest companies without needing to hire a sustainability consultant.
          </p>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
            <p className="text-sm font-semibold text-yellow-800">
              If you supply to Lendlease, BHP, Woolworths, or any large ASX-listed company, they
              will request your emissions data as part of their own AASB S2 submission. SMEs without
              a carbon report risk removal from approved supplier lists.
            </p>
          </div>
        </section>

        {/* S1 vs S2 */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-5">AASB S1 vs AASB S2</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-aw-gray-border bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-aw-slate-mid mb-2">AASB S1</p>
              <h3 className="font-black text-aw-slate mb-3">General Sustainability Disclosures</h3>
              <p className="text-sm text-aw-slate-mid leading-relaxed mb-4">
                Requires large entities to disclose material sustainability-related risks and
                opportunities that could affect their financial position, performance, and cash flows.
              </p>
              <p className="text-xs font-semibold text-aw-slate-mid">Available on Professional &amp; Enterprise plans.</p>
            </div>
            <div className="rounded-2xl border border-aw-green/30 bg-aw-green-light/30 p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-aw-green mb-2">AASB S2</p>
              <h3 className="font-black text-aw-slate mb-3">Climate-Related Disclosures</h3>
              <p className="text-sm text-aw-slate-mid leading-relaxed mb-4">
                Requires disclosure of greenhouse gas emissions across Scope 1 (direct), Scope 2
                (electricity), and Scope 3 (supply chain). This is the standard most relevant to
                SME suppliers — and what EcoLink generates automatically.
              </p>
              <p className="text-xs font-semibold text-aw-green">Included on all plans.</p>
            </div>
          </div>
        </section>

        {/* Rollout timeline */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Mandatory Reporting Timeline</h2>
          <div className="rounded-2xl border border-aw-gray-border bg-white p-6 space-y-3">
            {[
              { period: "FY 2025–26", group: "Group 1", who: "Large entities — assets > $5B or revenue > $500M" },
              { period: "FY 2026–27", group: "Group 2", who: "Mid-size entities — assets > $1B or revenue > $200M" },
              { period: "FY 2027–28", group: "Group 3", who: "Smaller large entities" },
            ].map((row) => (
              <div key={row.period} className="flex flex-wrap items-start gap-3">
                <span className="shrink-0 rounded-lg bg-aw-green-light px-3 py-1 text-xs font-bold text-aw-green">{row.period}</span>
                <span className="shrink-0 rounded-lg bg-aw-slate/10 px-3 py-1 text-xs font-bold text-aw-slate">{row.group}</span>
                <span className="text-sm text-aw-slate-mid font-medium">{row.who}</span>
              </div>
            ))}
          </div>
        </section>

        {/* What EcoLink delivers */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">What EcoLink Delivers</h2>
          <ul className="space-y-3">
            {[
              "Scope 1, 2 & 3 emissions breakdown from your Xero transactions",
              "Calculated using official NGA 2023–24 factors (DCCEEW)",
              "Report structured to AASB S2 disclosure requirements",
              "PDF export ready to share with corporate procurement teams",
              "Review queue for human sign-off on uncertain classifications",
              "Sector benchmarking — see how your intensity compares to peers",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-aw-slate-mid font-medium">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-aw-green" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-xl bg-aw-green px-8 py-3.5 text-sm font-bold text-white hover:bg-aw-green-dark transition-all active:scale-95 shadow-lg shadow-aw-green/20"
        >
          Generate your first report free →
        </Link>

        {/* Cross-links */}
        <div className="mt-10 flex flex-wrap gap-5 border-t border-aw-gray-border pt-8">
          <Link href="/compliance/nga-factors" className="text-sm font-bold text-aw-green hover:underline">NGA Factors — how CO₂e is calculated →</Link>
          <Link href="/compliance/scope-3"     className="text-sm font-bold text-aw-green hover:underline">Scope 3 Guide →</Link>
        </div>

      </div>
    </div>
  );
}
