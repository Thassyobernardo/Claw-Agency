import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | EcoLink Australia",
  description: "EcoLink Australia's terms of service — the agreement governing your use of the platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <p className="text-xs font-bold uppercase tracking-widest text-aw-green mb-3">Legal</p>
        <h1 className="text-4xl font-black text-aw-slate mb-3">Terms of Service</h1>
        <p className="text-sm text-aw-slate-mid mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-aw-slate-mid leading-relaxed text-[15px]">

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">1. Acceptance</h2>
            <p>
              By creating an account or using the EcoLink platform, you agree to be bound by these Terms of Service (<strong>"Terms"</strong>). If you are using EcoLink on behalf of a company, you represent that you have authority to bind that company to these Terms. If you do not agree, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">2. The Service</h2>
            <p className="mb-3">
              EcoLink Australia Pty Ltd (<strong>"EcoLink"</strong>) provides a software-as-a-service platform that:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Connects to your accounting software via OAuth 2.0</li>
              <li>Classifies financial transactions into greenhouse gas emission categories</li>
              <li>Calculates emissions using Australian Government NGA factors</li>
              <li>Generates carbon reports in a format aligned with AASB S2</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">3. Accounts and Access</h2>
            <p className="mb-3">
              You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You must notify us immediately of any unauthorised use. EcoLink reserves the right to suspend or terminate accounts that violate these Terms.
            </p>
            <p>
              You must provide accurate information when registering, including your ABN. EcoLink may verify ABN details against the Australian Business Register.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">4. Subscriptions and Billing</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>All plans include a 14-day free trial. No credit card is required to start a trial.</li>
              <li>After the trial, continued access requires a paid subscription billed monthly via Stripe.</li>
              <li>Prices are in Australian dollars (AUD) and exclude GST.</li>
              <li>You may cancel at any time via the billing portal. Access continues until the end of the current billing period. No refunds are issued for partial months.</li>
              <li>EcoLink reserves the right to change pricing with 30 days&apos; notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">5. Your Data</h2>
            <p className="mb-3">
              You retain ownership of all data you import into EcoLink, including transaction data from your accounting software. By using EcoLink, you grant us a limited licence to process that data solely to provide the service.
            </p>
            <p>
              EcoLink may use anonymised, aggregated data to improve the classification AI and publish industry benchmarks. Individual business data is never shared with third parties without your consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">6. Accuracy of Reports</h2>
            <p className="mb-3">
              EcoLink generates emissions estimates based on spend-based calculations using NGA 2023–24 factors. These estimates are suitable for AASB S2 Scope 3 disclosure purposes but are not a substitute for direct measurement where required.
            </p>
            <p className="mb-3">
              EcoLink does not warrant that the reports generated are sufficient for all regulatory or contractual purposes. You are responsible for reviewing classification results, clearing the Review Queue, and verifying report accuracy before submission.
            </p>
            <p>
              EcoLink is not a licensed carbon auditor or sustainability consultant. Reports generated by the platform do not constitute professional advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">7. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the platform for any unlawful purpose</li>
              <li>Attempt to reverse-engineer or extract the NGA factor database or classification models</li>
              <li>Resell or sublicence access to the platform without written consent</li>
              <li>Input false or misleading data to generate inaccurate reports</li>
              <li>Interfere with the security or integrity of the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">8. Intellectual Property</h2>
            <p>
              All software, classification models, UI design, and content on the EcoLink platform are the intellectual property of EcoLink Australia Pty Ltd. These Terms do not transfer any intellectual property rights to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">9. Limitation of Liability</h2>
            <p className="mb-3">
              To the maximum extent permitted by Australian law, EcoLink's total liability for any claim arising from use of the platform is limited to the subscription fees paid by you in the 3 months preceding the claim.
            </p>
            <p>
              EcoLink is not liable for indirect, incidental, or consequential losses, including loss of contracts, revenue, or data resulting from use of the platform or reliance on generated reports.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">10. Termination</h2>
            <p>
              Either party may terminate the agreement at any time. Upon termination, your access to the platform will cease. You may request an export of your data within 30 days of termination. After 30 days, data may be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of New South Wales, Australia. Any disputes will be subject to the exclusive jurisdiction of the courts of New South Wales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">12. Contact</h2>
            <p>
              For legal enquiries:{" "}
              <a href="mailto:legal@ecolink.com.au" className="text-aw-green hover:underline font-semibold">
                legal@ecolink.com.au
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-aw-gray-border">
          <Link href="/legal/privacy" className="text-sm font-bold text-aw-green hover:underline">
            ← Privacy Policy
          </Link>
        </div>

      </div>
    </div>
  );
}
