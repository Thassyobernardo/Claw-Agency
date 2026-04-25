"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";

// NOTE: These plans must stay in sync with PLANS in `frontend/src/lib/stripe.ts`,
// which is the single source of truth used by the Stripe checkout.
const plans = [
  {
    name: "Starter",
    price: "$49",
    per: "/mo",
    description: "Perfect for sole traders and micro businesses.",
    features: [
      "1 company / 1 user",
      "Up to 500 transactions / month",
      "Xero sync (MYOB coming soon)",
      "AI auto-classification (Scope 1, 2 & 3)",
      "AASB S2 PDF report",
      "Sector benchmarking",
      "Email support",
    ],
    excluded: ["AASB S1 disclosure fields", "Multi-user access", "API access"],
    cta: "Start Free Trial",
    href: "/signup",
    popular: false,
  },
  {
    name: "Professional",
    price: "$99",
    per: "/mo",
    description: "For growing SMEs with compliance obligations.",
    features: [
      "1 company / up to 5 users",
      "Unlimited transactions",
      "Xero + MYOB sync",
      "AI auto-classification + manual review queue",
      "AASB S1 + S2 reports",
      "Sector benchmarking",
      "Custom emission factors",
      "Priority email support",
    ],
    excluded: ["White-label reports", "API access"],
    cta: "Start Free Trial",
    href: "/signup",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$149",
    per: "/mo",
    description: "For multi-entity businesses and accounting firms.",
    features: [
      "Up to 5 companies",
      "Unlimited users",
      "All Professional features",
      "Partner portal for accountants",
      "White-label reports",
      "REST API access",
      "Dedicated onboarding call",
      "Phone + email support",
    ],
    excluded: [],
    cta: "Start Free Trial",
    href: "/signup",
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-32 px-6 bg-slate-950 border-t border-slate-900">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest text-aw-green mb-4"
          >
            Pricing & Audit
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-white"
          >
            High Performance, <br />
            <span className="text-aw-green">Low Impact Cost.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-slate-400 font-medium max-w-xl mx-auto"
          >
            All plans start with a 14-day free full-compliance audit. 
            No credit card required to start. AUD pricing + GST.
          </motion.p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`relative flex flex-col rounded-3xl border p-8 transition-all ${
                plan.popular
                  ? "border-aw-green bg-slate-900 text-white shadow-2xl shadow-aw-green/5 scale-[1.02]"
                  : "border-slate-800 bg-slate-900/40 text-white shadow-sm hover:border-aw-green/30"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-aw-green px-4 py-1 text-white font-bold text-[11px] uppercase tracking-widest whitespace-nowrap">
                  Most Popular
                </div>
              )}

              {/* Plan name + price */}
              <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${plan.popular ? "text-aw-green" : "text-slate-500"}`}>
                {plan.name}
              </p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-5xl font-black text-white">
                  {plan.price}
                </span>
                {plan.per && (
                  <span className="text-lg font-bold text-slate-500">
                    {plan.per}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium mb-8 leading-relaxed text-slate-400">
                {plan.description}
              </p>

              {/* Features */}
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm font-medium">
                    <Check
                      size={16}
                      strokeWidth={3}
                      className="shrink-0 mt-0.5 text-aw-green"
                    />
                    <span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className={`flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all active:scale-95 group ${
                  plan.popular
                    ? "bg-aw-green text-white hover:bg-aw-green-dark shadow-lg shadow-aw-green/30"
                    : "bg-slate-800 border border-slate-700 text-white hover:border-aw-green/40 hover:text-aw-green"
                }`}
              >
                {plan.cta}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-500 font-medium">
          Secure checkout via Stripe. 256-bit AES encryption for all data syncs.
        </p>
      </div>
    </section>
  );
}
