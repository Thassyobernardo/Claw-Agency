import Link from "next/link";
import { Leaf, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — EcoLink Australia",
  description:
    "EcoLink's Privacy Policy. Your Xero data is never used to train AI. Compliant with the Privacy Act 1988 and Australian Privacy Principles.",
};

export default function PrivacyPage() {
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
          <Link href="/legal/terms" className="text-sm font-bold text-aw-green hover:underline">
            Terms of Service →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aw-green-light border border-aw-green/20">
            <ShieldCheck size={22} className="text-aw-green" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-aw-slate">Privacy Policy</h1>
            <p className="mt-1 text-sm text-aw-slate-mid">
              Effective 1 July 2025 · Last updated 29 April 2026 · Version 1.0
            </p>
          </div>
        </div>

        {/* Zero AI training callout */}
        <div className="mb-8 rounded-2xl border-2 border-aw-green/30 bg-aw-green-light p-6">
          <p className="text-sm font-black text-aw-green mb-2">
            🔒 Zero AI Training — Architectural Guarantee
          </p>
          <p className="text-sm text-aw-slate leading-relaxed">
            Your Xero transaction data, financial figures, and emission calculations are{" "}
            <strong>never used to train, fine-tune, or improve any AI or machine learning model</strong> —
            by EcoLink or any third party. Our carbon accounting engine is 100% deterministic
            rule-based code, with no connection to any LLM or AI API.
          </p>
        </div>

        <div className="space-y-8 text-sm text-aw-slate-mid leading-relaxed">
          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">1. Introduction</h2>
            <p>
              EcoLink Australia Pty Ltd (&ldquo;EcoLink&rdquo;) is committed to protecting your privacy.
              This policy complies with the <strong>Privacy Act 1988 (Cth)</strong> and the{" "}
              <strong>Australian Privacy Principles (APPs)</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">2. Xero Data (Read-Only)</h2>
            <div className="overflow-x-auto rounded-xl border border-aw-gray-border">
              <table className="w-full text-xs">
                <thead className="bg-aw-gray/40">
                  <tr>
                    {["Xero Scope", "Data", "Purpose"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-wider text-aw-slate-light">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-aw-gray-border">
                  {[
                    ["accounting.banktransactions.read", "Bank transactions", "Carbon classification"],
                    ["accounting.invoices.read", "Invoices and bills", "Supplier identification"],
                    ["accounting.contacts.read", "Supplier names", "Merchant routing"],
                    ["accounting.settings.read", "Chart of accounts", "Account name resolution"],
                  ].map(([scope, data, purpose]) => (
                    <tr key={scope} className="bg-white">
                      <td className="px-4 py-3 font-mono text-aw-green text-[11px]">{scope}</td>
                      <td className="px-4 py-3 text-aw-slate">{data}</td>
                      <td className="px-4 py-3">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">3. What We Do NOT Do</h2>
            <ul className="space-y-2">
              {[
                "Use your data to train, fine-tune, or evaluate any AI or ML model",
                "Sell, rent, or broker your data to any third party",
                "Use your financial data for advertising or profiling",
                "Share transaction data with other EcoLink customers",
                "Store Xero OAuth tokens in plain text (AES-256-GCM encrypted)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-aw-green font-bold shrink-0">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">4. Security</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["Encryption in transit", "TLS 1.3"],
                ["OAuth tokens", "AES-256-GCM at rest"],
                ["Storage bucket", "Private — signed URLs (5 min TTL)"],
                ["Database", "Row-Level Security on all tables"],
                ["Reports retention", "7 years (ASIC obligations)"],
                ["Xero tokens on disconnect", "Deleted immediately"],
              ].map(([label, val]) => (
                <div key={label} className="rounded-xl bg-aw-gray/40 border border-aw-gray-border px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-aw-slate-light">{label}</p>
                  <p className="text-sm font-bold text-aw-slate mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">5. Your Rights (APPs)</h2>
            <p>
              Under the Privacy Act 1988, you may access, correct, or request deletion of your
              personal information. Contact:{" "}
              <a href="mailto:privacy@ecolink.com.au" className="text-aw-green font-bold hover:underline">
                privacy@ecolink.com.au
              </a>.
              For unresolved complaints:{" "}
              <a href="https://oaic.gov.au" target="_blank" rel="noreferrer" className="text-aw-green hover:underline">
                Office of the Australian Information Commissioner (OAIC)
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-aw-gray-border flex items-center justify-between text-xs text-aw-slate-mid">
          <span>© 2026 EcoLink Australia Pty Ltd</span>
          <Link href="/legal/terms" className="font-bold text-aw-green hover:underline">
            Terms of Service →
          </Link>
        </div>
      </main>
    </div>
  );
}
