import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | EcoLink Australia",
  description:
    "Terms of Service for EcoLink Australia — subscription rules, data ownership, limitation of liability, and acceptable use.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-aw-gray/40 pt-28 pb-24 px-6">
      <div className="mx-auto max-w-3xl">

        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-aw-slate-mid hover:text-aw-green transition-colors mb-10">
          <ArrowLeft size={15} /> Back to home
        </Link>

        <p className="text-xs font-bold uppercase tracking-widest text-aw-green mb-3">Legal</p>
        <h1 className="text-4xl font-black text-aw-slate mb-2">Terms of Service</h1>
        <p className="text-sm text-aw-slate-mid mb-10">Last updated: April 2026</p>

        <div className="space-y-10 text-[15px] text-aw-slate-mid leading-relaxed">

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">1. Acceptance</h2>
            <p>
              By creating an account or using the EcoLink platform, you agree to be bound by these
              Terms of Service (<strong>"Terms"</strong>). If you are acting on behalf of a company,
              you represent that you have authority to bind that company. If you do not agree, do
              not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">2. Nature of the Service</h2>
            <p className="mb-4">
              EcoLink Australia Pty Ltd (<strong>"EcoLink"</strong>) provides a software-as-a-service
              platform that:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Connects to your accounting software via OAuth 2.0 and imports transaction data</li>
              <li>Classifies transactions into greenhouse gas emission categories using AI</li>
              <li>Calculates emissions using the <strong>spend-based method</strong> and Australian Government NGA Factors</li>
              <li>Generates carbon reports structured to AASB S2 disclosure requirements</li>
            </ul>
            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm font-semibold text-yellow-800">
                <strong>Important:</strong> EcoLink provides spend-based estimates. The accuracy of
                these estimates depends on the accuracy of the transaction data in your accounting
                software. You are responsible for reviewing classification results and the data
                imported from Xero or MYOB. EcoLink is a calculation tool, not a certified carbon audit.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">3. Accounts and Access</h2>
            <p className="mb-3">
              You are responsible for maintaining the confidentiality of your login credentials and
              for all activity under your account. Notify us immediately of any unauthorised use.
            </p>
            <p>
              You must provide accurate information when registering, including your ABN. Accounts
              found to contain false information may be suspended without notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">4. Subscription &amp; Billing</h2>
            <div className="space-y-3 text-sm">
              {[
                "All plans include a 14-day free trial. No credit card is required to start.",
                "After the trial, continued access requires a paid subscription billed monthly via Stripe.",
                "Prices are in Australian dollars (AUD) and exclude GST.",
                "You may cancel at any time via the billing portal. Access continues until the end of the current billing period. No refunds are issued for unused partial months.",
                "EcoLink reserves the right to change pricing with 30 days' written notice to your registered email.",
                "Accounts with failed payments are suspended after 7 days. Data is retained for 30 days after suspension before deletion.",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 mt-1 h-1.5 w-1.5 rounded-full bg-aw-green" />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">5. Your Data</h2>
            <p className="mb-3">
              You retain ownership of all data you import into EcoLink. By using EcoLink, you grant
              us a limited licence to process that data solely to provide the service.
            </p>
            <p>
              EcoLink may use anonymised, aggregated data (not attributable to your business) to
              improve the classification AI and publish industry benchmarks. Individual business
              data is never shared with third parties without your written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">6. Limitation of Liability</h2>
            <p className="mb-3">
              EcoLink reports are estimates produced by automated AI classification. While we use
              the official Australian Government NGA Factors and follow AASB S2 structure, we do
              not warrant that reports generated are sufficient for all regulatory, contractual, or
              audit purposes.
            </p>
            <p className="mb-3">
              To the maximum extent permitted by Australian law, EcoLink&apos;s total liability for
              any claim is limited to the subscription fees paid in the 3 months preceding the claim.
            </p>
            <p>
              EcoLink is not liable for: loss of contracts, revenue, regulatory fines, audit
              failures, or any other indirect or consequential losses resulting from reliance on
              platform-generated reports.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">7. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Use the platform for any unlawful purpose</li>
              <li>Input false or misleading data to generate inaccurate emissions reports</li>
              <li>Attempt to reverse-engineer the NGA factor database or classification models</li>
              <li>Resell or sublicence platform access without written consent</li>
              <li>Interfere with the security or integrity of the platform</li>
              <li>Exceed API rate limits or attempt to scrape data at scale</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">8. API Fair Use</h2>
            <p>
              Enterprise plan API access is subject to fair use limits. Automated requests must
              include a valid API key and respect rate limits specified in the API documentation.
              Abusive usage patterns may result in temporary suspension of API access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">9. Intellectual Property</h2>
            <p>
              All software, classification models, UI design, and content on the EcoLink platform
              are the intellectual property of EcoLink Australia Pty Ltd. These Terms do not
              transfer any intellectual property rights to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">10. Termination</h2>
            <p>
              Either party may terminate the agreement at any time. Upon termination, access ceases
              at the end of the current billing period. You may request a data export within 30 days
              of termination. After 30 days, data is deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of New South Wales, Australia. Any disputes are
              subject to the exclusive jurisdiction of the courts of New South Wales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-aw-slate mb-3">12. Contact</h2>
            <p>
              Legal enquiries:{" "}
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
