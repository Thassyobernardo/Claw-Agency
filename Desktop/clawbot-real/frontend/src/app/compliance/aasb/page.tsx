import Link from "next/link";
import { ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "AASB S1 & S2 Compliance | EcoLink Australia",
  description:
    "Understand Australia's AASB S1 and S2 climate disclosure standards and how EcoLink helps SMEs meet their obligations.",
};

export default function AASBPage() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aw-green-light">
            <ShieldCheck size={20} className="text-aw-green" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-aw-green">Compliance Guide</span>
        </div>
        <h1 className="text-4xl font-black text-aw-slate mb-4">AASB S1 &amp; S2 — What You Need to Know</h1>
        <p className="text-lg text-aw-slate-mid font-medium leading-relaxed mb-12">
          Australia's climate disclosure standards came into force in 2025. Here's what they mean for your business and how EcoLink helps you comply.
        </p>

        {/* What are they */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">What Are AASB S1 and S2?</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-4">
            The Australian Accounting Standards Board (AASB) adopted two new sustainability disclosure standards, aligned with the global IFRS Sustainability Disclosure Standards:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-aw-gray-border bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-aw-green mb-2">AASB S1</p>
              <h3 className="font-black text-aw-slate mb-2">General Sustainability Disclosures</h3>
              <p className="text-sm text-aw-slate-mid leading-relaxed">
                Requires large entities to disclose material sustainability-related risks and opportunities that could affect their financial position, performance, and cash flows.
              </p>
            </div>
            <div className="rounded-2xl border border-aw-green/30 bg-aw-green-light/30 p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-aw-green mb-2">AASB S2</p>
              <h3 className="font-black text-aw-slate mb-2">Climate-Related Disclosures</h3>
              <p className="text-sm text-aw-slate-mid leading-relaxed">
                Requires disclosure of greenhouse gas emissions across Scope 1 (direct), Scope 2 (electricity), and Scope 3 (supply chain). This is the standard most relevant to SME suppliers.
              </p>
            </div>
          </div>
        </section>

        {/* Who must comply */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">Who Must Comply?</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-4">
            The mandatory reporting obligation applies to large listed entities, large unlisted public companies, and large APRA-regulated entities. The phased rollout means:
          </p>
          <div className="rounded-2xl border border-aw-gray-border bg-white p-6 mb-4">
            <div className="space-y-3">
              {[
                { period: "FY 2025–26", who: "Group 1 — Large entities (assets &gt; $5B or revenue &gt; $500M)" },
                { period: "FY 2026–27", who: "Group 2 — Mid-size entities (assets &gt; $1B or revenue &gt; $200M)" },
                { period: "FY 2027–28", who: "Group 3 — Smaller large entities" },
              ].map((row) => (
                <div key={row.period} className="flex items-start gap-3">
                  <span className="shrink-0 rounded-lg bg-aw-green-light px-3 py-1 text-xs font-bold text-aw-green">{row.period}</span>
                  <span className="text-sm text-aw-slate-mid font-medium" dangerouslySetInnerHTML={{ __html: row.who }} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
            <p className="text-sm font-semibold text-yellow-800">
              <strong>Why does this affect your SME?</strong> Large corporations subject to AASB S2 must report their Scope 3 emissions — which includes emissions from their suppliers. If you supply to a large company, they will ask you for your emissions data. Without it, you risk losing the contract.
            </p>
          </div>
        </section>

        {/* What to report */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">What Does an AASB S2 Report Contain?</h2>
          <ul className="space-y-3">
            {[
              "Scope 1 emissions — direct emissions from owned or controlled sources",
              "Scope 2 emissions — indirect emissions from purchased electricity",
              "Scope 3 emissions — all other indirect value chain emissions (15 categories)",
              "Emission intensity ratio (CO₂e per unit of revenue or activity)",
              "Transition plan toward net zero (for Group 1 entities)",
              "Climate-related risks and opportunities affecting financial performance",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-aw-slate-mid font-medium">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-aw-green" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* How EcoLink helps */}
        <section className="mb-10">
          <h2 className="text-xl font-black text-aw-slate mb-4">How EcoLink Automates Your Compliance</h2>
          <p className="text-aw-slate-mid leading-relaxed mb-5">
            EcoLink reads your Xero transactions, classifies each line item to the correct NGA emission category, and generates an AASB S2-formatted report — ready to send to your corporate client within minutes.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-aw-green px-8 py-3.5 text-sm font-bold text-white hover:bg-aw-green-dark transition-all active:scale-95 shadow-lg shadow-aw-green/20"
          >
            Start your free trial →
          </Link>
        </section>

        {/* Further reading */}
        <section className="rounded-2xl border border-aw-gray-border bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-aw-slate-mid mb-4">Further Reading</p>
          <ul className="space-y-2 text-sm text-aw-slate-mid">
            <li>AASB — <em>AASB S2 Climate-related Disclosures</em> (aasb.gov.au)</li>
            <li>ASIC — Climate-related financial disclosure guidance</li>
            <li>Treasury — Mandatory Climate Disclosure Consultation Paper</li>
            <li><Link href="/compliance/nga-factors" className="text-aw-green hover:underline font-semibold">NGA Emission Factors — how CO₂e is calculated →</Link></li>
            <li><Link href="/compliance/scope-3" className="text-aw-green hover:underline font-semibold">Scope 3 Guide — what it covers and how to report it →</Link></li>
          </ul>
        </section>

      </div>
    </div>
  );
}
