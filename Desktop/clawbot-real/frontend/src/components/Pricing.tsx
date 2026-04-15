"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "$49",
    per: "/mo",
    description: "For small businesses getting started with carbon reporting.",
    features: [
      "Up to 500 transactions / month",
      "Xero connection (MYOB coming soon)",
      "Scope 1, 2 & 3 classification",
      "Annual carbon report (PDF)",
      "NGA Factors — latest edition",
      "Email support",
    ],
    excluded: ["AASB S2 disclosure fields", "Multi-user access", "API access"],
    cta: "Start Free Trial",
    href: "/signup",
    popular: false,
  },
  {
    name: "Professional",
    price: "$149",
    per: "/mo",
    description: "For growing businesses with compliance obligations.",
    features: [
      "Unlimited transactions",
      "Xero connection (MYOB coming soon)",
      "Scope 1, 2 & 3 classification",
      "Monthly & annual reports (PDF)",
      "AASB S1 / S2 disclosure fields",
      "Up to 5 team members",
      "Manual review queue",
      "Priority email support",
    ],
    excluded: ["White-label reports", "API access"],
    cta: "Start Free Trial",
    href: "/signup",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    description: "For accounting firms and large supply-chain networks.",
    features: [
      "Unlimited transactions & companies",
      "All accounting integrations",
      "White-label branded reports",
      "Full AASB S1 / S2 audit pack",
      "REST API access",
      "Unlimited team members",
      "Dedicated account manager",
      "SLA + onboarding support",
    ],
    excluded: [],
    cta: "Contact Us",
    href: "#contact",
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest text-aw-green mb-4"
          >
            Pricing
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-aw-slate"
          >
            Simple, Transparent Pricing.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-aw-slate-mid font-medium max-w-xl mx-auto"
          >
            No lock-in contracts. Cancel any time. All prices in AUD, exclusive of GST.
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
                  ? "border-aw-green bg-aw-slate text-white shadow-2xl shadow-aw-slate/20 scale-[1.02]"
                  : "border-aw-gray-border bg-white shadow-sm hover:border-aw-green/30"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-aw-green px-4 py-1 text-white font-bold text-[11px] uppercase tracking-widest whitespace-nowrap">
                  Most Popular
                </div>
              )}

              {/* Plan name + price */}
              <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${plan.popular ? "text-aw-green-mid" : "text-aw-slate-mid"}`}>
                {plan.name}
              </p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className={`text-5xl font-black ${plan.popular ? "text-white" : "text-aw-slate"}`}>
                  {plan.price}
                </span>
                {plan.per && (
                  <span className={`text-lg font-bold ${plan.popular ? "text-white/50" : "text-aw-slate-mid"}`}>
                    {plan.per}
                  </span>
                )}
              </div>
              <p className={`text-sm font-medium mb-8 leading-relaxed ${plan.popular ? "text-white/70" : "text-aw-slate-mid"}`}>
                {plan.description}
              </p>

              {/* Features */}
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm font-medium">
                    <Check
                      size={16}
                      strokeWidth={3}
                      className={`shrink-0 mt-0.5 ${plan.popular ? "text-aw-green-mid" : "text-aw-green"}`}
                    />
                    <span className={plan.popular ? "text-white/85" : "text-aw-slate-mid"}>{f}</span>
                  </li>
                ))}
                {plan.excluded.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm font-medium opacity-30">
                    <div className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className={`line-through ${plan.popular ? "text-white" : "text-aw-slate-mid"}`}>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className={`flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all active:scale-95 group ${
                  plan.popular
                    ? "bg-aw-green text-white hover:bg-aw-green-dark shadow-lg shadow-aw-green/30"
                    : "bg-aw-gray border border-aw-gray-border text-aw-slate hover:border-aw-green/40 hover:text-aw-green"
                }`}
              >
                {plan.cta}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-aw-slate-mid font-medium">
          All plans include a 30-day free trial. No credit card required to start.
        </p>
      </div>
    </section>
  );
}
