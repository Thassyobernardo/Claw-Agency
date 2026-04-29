import Link from "next/link";
import { Leaf, Scale, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Terms of Service — EcoLink Australia",
  description:
    "EcoLink Terms of Service. NGA Factors 2025 disclaimer. Reports are management estimates, not Reasonable Assurance under ASRS 2.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-aw-gray/30">
      <header className="border-b border-aw-gray-border bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aw-green shadow-md shadow-aw-green/20">
              <Leaf size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-aw-slate">
              EcoLink<span className="text-aw-green">.</span>
            </span>
          </Link>
          <Link href="/legal/privacy" className="text-sm font-bold text-aw-green hover:underline">
            ← Privacy Policy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
            <Scale size={22} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-aw-slate">Terms of Service</h1>
            <p className="mt-1 text-sm text-aw-slate-mid">
              Effective 1 July 2025 · Last updated 29 April 2026 · Version 1.0
            </p>
          </div>
        </div>

        {/* Primary disclaimer */}
        <div className="mb-8 rounded-2xl border-2 border-red-200 bg-red-50 p-6 space-y-3">
          <p className="text-sm font-black text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} /> Critical Disclaimer
          </p>
          <p className="text-sm text-red-700 leading-relaxed">
            <strong>EcoLink reports are management-prepared estimates, NOT audited outputs.</strong>
            {" "}They do not constitute Reasonable Assurance, Limited Assurance, or any audit under{" "}
            <strong>ASRS 2</strong> or the Corporations Act 2001. EcoLink is not a registered auditing firm.
            Emission calculations use <strong>NGA Factors 2025</strong> (DCCEEW) applied to data entered by you.
          </p>
        </div>

        <div className="space-y-8 text-sm text-aw-slate-mid leading-relaxed">
          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">1. Acceptance</h2>
            <p>By using the EcoLink Platform, you agree to these Terms. If acting on behalf of a company, you warrant you have authority to bind that entity.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">2. Service Description</h2>
            <p>EcoLink is a SaaS carbon accounting platform that imports Xero data, classifies transactions, calculates greenhouse gas emissions using <strong>NGA Factors 2025</strong> (DCCEEW), and generates AASB S2 climate-related financial disclosure documents.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">3. NGA Factors 2025 — Data Accuracy Disclaimer</h2>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-2">
              <p className="font-bold text-amber-800">EcoLink does not warrant that:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>NGA Factors 2025 are free from errors or omissions</li>
                <li>Factors remain current for your specific operations and reporting period</li>
                <li>Platform results are identical to manual NGA workbook calculations</li>
              </ul>
              <p className="font-bold text-amber-800 pt-2">You acknowledge that:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Emission factors change annually — verify the Platform version matches your FY</li>
                <li>The Platform uses <strong>Method 1 (Simplified Calculation)</strong> per NGA Factors 2025</li>
                <li>Physical quantities entered manually are your responsibility to verify</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">4. No Reasonable Assurance</h2>
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 space-y-3">
              <p className="font-black text-red-700">EcoLink reports do NOT constitute:</p>
              <ul className="space-y-1 list-disc list-inside text-red-700 font-semibold">
                <li>Reasonable Assurance under ASRS 2 or the Corporations Act 2001</li>
                <li>Limited Assurance engagement output</li>
                <li>A statutory audit by a Registered Company Auditor (RCA)</li>
              </ul>
              <p className="text-red-700">
                Entities required to obtain assurance under ASRS 2 must engage a qualified assurance
                provider separately. EcoLink expressly disclaims all liability for reliance on
                Platform outputs as a substitute for formal assurance.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">5. User-Provided Data</h2>
            <p>Report accuracy depends entirely on data you provide: Xero transactions, manually entered physical quantities, and selected date ranges. EcoLink applies NGA Factors correctly to inputs received but cannot verify their accuracy or completeness.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">6. Limitation of Liability</h2>
            <p>To the maximum extent permitted by Australian Consumer Law, EcoLink&apos;s total liability is limited to subscription fees paid in the 3 months preceding a claim. EcoLink is not liable for indirect, consequential, or regulatory penalties arising from Platform outputs.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">7. Privacy &amp; Data</h2>
            <p>Your use of the Platform is governed by our{" "}
              <Link href="/legal/privacy" className="text-aw-green font-bold hover:underline">Privacy Policy</Link>,
              including the Zero-AI Training guarantee. Your Xero data is never used to train AI models — enforced architecturally.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">8. Governing Law</h2>
            <p>These Terms are governed by the laws of <strong>New South Wales, Australia</strong>. Disputes are subject to NSW courts.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">9. Contact</h2>
            <p>EcoLink Australia Pty Ltd ·{" "}
              <a href="mailto:legal@ecolink.com.au" className="text-aw-green font-bold hover:underline">legal@ecolink.com.au</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-aw-gray-border flex items-center justify-between text-xs text-aw-slate-mid">
          <span>© 2026 EcoLink Australia Pty Ltd</span>
          <Link href="/legal/privacy" className="font-bold text-aw-green hover:underline">← Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
