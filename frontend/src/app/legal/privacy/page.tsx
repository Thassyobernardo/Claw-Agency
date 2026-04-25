import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | EcoLink Australia",
  description:
    "How EcoLink Australia collects, uses, and protects your data. Compliant with the Privacy Act 1988 (Cth) and Australian Privacy Principles.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <p className="text-xs font-bold uppercase tracking-widest text-aw-green mb-3">Legal</p>
        <h1 className="text-4xl font-black text-aw-slate mb-2">Privacy Policy</h1>
        <p className="text-sm text-aw-slate-mid mb-10">Last updated: April 2026</p>

        {/* Security callout */}
        <div className="rounded-2xl border border-aw-green/30 bg-aw-green-light/30 p-5 mb-10 flex gap-4">
          <ShieldCheck size={20} className="text-aw-green shrink-0 mt-0.5" />
          <p className="text-sm text-aw-green-dark font-medium leading-relaxed">
            EcoLink connects to your accounting software via OAuth 2.0 — the same protocol used by
            banks. We never store your Xero or MYOB login credentials. OAuth access tokens are
            encrypted at rest using AES-256-GCM before being saved to our database.
          </p>
        </div>

        <div className="space-y-10 text-[15px] text-aw-slate-mid leading-relaxed">

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">1. Who We Are</h2>
            <p>
              EcoLink Australia Pty Ltd (<strong>"EcoLink"</strong>, <strong>"we"</strong>,
              <strong>"us"</strong>) operates the EcoLink carbon accounting platform. We are
              committed to protecting your personal information in accordance with the{" "}
              <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">2. Data Collection</h2>
            <p className="mb-4">We collect the following categories of information:</p>
            <div className="space-y-3">
              {[
                {
                  title: "Account information",
                  desc: "Name, email address, company name, ABN, state, industry, and password (stored as a bcrypt hash — never in plain text).",
                },
                {
                  title: "Financial transaction data",
                  desc: "Transaction descriptions, dates, amounts, and supplier names imported from your Xero account via OAuth 2.0 read-only access. We import this data to calculate your carbon emissions. We do not collect banking credentials or card numbers.",
                },
                {
                  title: "Usage data",
                  desc: "Pages visited, features used, browser type, and IP address, collected via server logs for platform improvement and security monitoring.",
                },
                {
                  title: "Billing information",
                  desc: "Payment processing is handled entirely by Stripe. EcoLink does not receive or store card numbers. We receive only a customer reference ID and subscription status from Stripe.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-aw-gray-border bg-white p-4">
                  <p className="font-bold text-aw-slate text-sm mb-1">{item.title}</p>
                  <p className="text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">3. AI Processing</h2>
            <p className="mb-3">
              EcoLink&apos;s AI engine processes transaction <strong>descriptions and amounts</strong>{" "}
              solely to classify them into carbon emission categories. Specifically:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Transaction descriptions are sent to Groq (llama-3.3-70b) and Google Gemini for semantic classification. Only the transaction text is transmitted — no company name, ABN, or user identifiers are included in these API calls.</li>
              <li>Your financial data is <strong>not used to train</strong> any publicly available AI model.</li>
              <li>Anonymised, aggregated patterns (e.g. "fuel purchases represent 23% of construction sector spend") may be used to improve EcoLink&apos;s classification accuracy and publish industry benchmarks.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">4. Data Security</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li><strong>OAuth tokens encrypted at rest:</strong> Xero access and refresh tokens are encrypted using AES-256-GCM before being saved to our database. A database breach does not expose live API credentials.</li>
              <li><strong>TLS in transit:</strong> All data between your browser, our servers, and third-party APIs is encrypted using TLS 1.2+.</li>
              <li><strong>Password hashing:</strong> Passwords are hashed with bcrypt (12 rounds) and never stored in recoverable form.</li>
              <li><strong>No banking credentials stored:</strong> EcoLink uses revocable OAuth access tokens. Your Xero login password is never transmitted to or stored by EcoLink.</li>
              <li><strong>Access controls:</strong> Database access is restricted to the application server. No public database endpoint is exposed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">5. Third-Party Services</h2>
            <p className="mb-4">EcoLink uses the following third-party services:</p>
            <div className="rounded-2xl border border-aw-gray-border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-aw-gray-border bg-aw-gray/60">
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid">Service</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aw-gray-border">
                  {[
                    ["Xero", "Accounting data import via OAuth 2.0 (read-only)"],
                    ["Stripe", "Payment processing — card data handled by Stripe, not EcoLink"],
                    ["Resend", "Transactional emails (verification, password reset, receipts)"],
                    ["Groq / Google Gemini", "AI transaction classification — anonymised descriptions only"],
                    ["Railway", "Cloud hosting — servers in the United States"],
                  ].map(([svc, purpose]) => (
                    <tr key={svc} className="hover:bg-aw-gray/30">
                      <td className="px-4 py-3 font-semibold text-aw-slate">{svc}</td>
                      <td className="px-4 py-3 text-aw-slate-mid">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">6. Data Retention</h2>
            <p>
              We retain your account data and transaction records for as long as your account is
              active. If you cancel your subscription, your data is retained for 30 days to allow
              export, then deleted. You may request deletion at any time by contacting us. Transaction
              data is not deleted from your Xero account when removed from EcoLink.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">7. Your Rights</h2>
            <p className="mb-3">Under the Australian Privacy Principles you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your account and associated data</li>
              <li>Lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">8. Cookies</h2>
            <p>
              EcoLink uses session cookies for authentication and small preference cookies for UI
              state. We do not use third-party advertising or tracking cookies. Disabling cookies
              will prevent login from functioning.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">9. Contact</h2>
            <p>
              For privacy enquiries or to exercise your rights:{" "}
              <a href="mailto:privacy@ecolink.com.au" className="text-aw-green hover:underline font-semibold">
                privacy@ecolink.com.au
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-aw-gray-border">
          <Link href="/legal/terms" className="text-sm font-bold text-aw-green hover:underline">
            Terms of Service →
          </Link>
        </div>

      </div>
    </div>
  );
}
