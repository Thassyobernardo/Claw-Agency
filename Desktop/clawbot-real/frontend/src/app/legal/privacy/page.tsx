import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | EcoLink Australia",
  description: "EcoLink Australia's privacy policy — how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <p className="text-xs font-bold uppercase tracking-widest text-aw-green mb-3">Legal</p>
        <h1 className="text-4xl font-black text-aw-slate mb-3">Privacy Policy</h1>
        <p className="text-sm text-aw-slate-mid mb-10">Last updated: April 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-aw-slate-mid leading-relaxed text-[15px]">

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">1. Who We Are</h2>
            <p>
              EcoLink Australia Pty Ltd (<strong>"EcoLink", "we", "us"</strong>) operates the EcoLink carbon accounting platform available at this website. We are committed to protecting your personal information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following categories of information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account information:</strong> name, email address, company name, ABN, state, industry, and password (stored as a bcrypt hash).</li>
              <li><strong>Financial transaction data:</strong> transaction descriptions, dates, amounts, and supplier names imported from your Xero account via OAuth. We do not collect banking credentials.</li>
              <li><strong>Usage data:</strong> pages visited, features used, browser type, and IP address, collected via server logs and analytics.</li>
              <li><strong>Billing information:</strong> payment method details are processed and stored by Stripe. EcoLink does not store card numbers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide the EcoLink service — classifying transactions, calculating emissions, and generating reports.</li>
              <li>To send transactional emails (email verification, password reset, subscription receipts).</li>
              <li>To improve the classification AI using anonymised, aggregated transaction patterns.</li>
              <li>To comply with legal obligations under Australian law.</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">4. Third-Party Services</h2>
            <p className="mb-3">EcoLink integrates with the following third-party services. Each has its own privacy policy:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Xero</strong> — accounting software integration (OAuth 2.0 read-only)</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
              <li><strong>Groq / Google Gemini</strong> — AI transaction classification (anonymised descriptions only)</li>
              <li><strong>Railway</strong> — cloud hosting (servers located in the United States)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">5. Data Retention</h2>
            <p>
              We retain your account data and transaction records for as long as your account is active or as required by law. You may request deletion of your account and associated data at any time by contacting us. Transaction data imported from Xero is not deleted from Xero when removed from EcoLink.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">6. Security</h2>
            <p>
              EcoLink uses industry-standard security measures including TLS encryption in transit, bcrypt password hashing, and access controls. We conduct periodic security reviews. No system is completely secure and we cannot guarantee the absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">7. Your Rights</h2>
            <p className="mb-3">Under the Australian Privacy Principles you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your information</li>
              <li>Lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">8. Cookies</h2>
            <p>
              EcoLink uses session cookies for authentication and preference cookies for UI state. We do not use third-party advertising cookies. You can disable cookies in your browser settings, though this may affect platform functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">9. Contact Us</h2>
            <p>
              For privacy enquiries or to exercise your rights, contact us at:{" "}
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
