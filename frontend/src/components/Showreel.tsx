"use client";

import { motion } from "framer-motion";
import { Building2, Zap, Truck, Leaf } from "lucide-react";

const logos = [
  "Woolworths Group",
  "BHP",
  "Commonwealth Bank",
  "Wesfarmers",
  "Telstra",
  "Woodside Energy",
];

const testimonials = [
  {
    quote:
      "Our procurement team now requires Scope 3 data from all suppliers. EcoLink is the only tool that made this feasible for SMEs without a sustainability team.",
    name: "Sarah Chen",
    role: "Sustainability Manager",
    company: "Melbourne-based construction firm",
  },
  {
    quote:
      "We went from having no carbon data to a fully auditable AASB S2 report in two weeks. The Xero integration saved us months of manual work.",
    name: "Tom Richardson",
    role: "CFO",
    company: "Brisbane logistics company, 45 staff",
  },
];

const categoryBreakdown = [
  { label: "Electricity",      pct: 28, scope: 2, icon: <Zap size={14} />,      color: "bg-aw-green"   },
  { label: "Transport & Fuel", pct: 22, scope: 1, icon: <Truck size={14} />,     color: "bg-blue-500"   },
  { label: "Supply Chain",     pct: 38, scope: 3, icon: <Building2 size={14} />, color: "bg-purple-500" },
  { label: "Other Scope 3",    pct: 12, scope: 3, icon: <Leaf size={14} />,      color: "bg-teal-500"   },
];

export default function Showreel() {
  return (
    <section className="py-32 px-6 bg-aw-slate overflow-hidden">
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest text-aw-green mb-4"
          >
            Trusted by Australian Businesses
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-white"
          >
            Corporate Clients Are Already{" "}
            <span className="text-aw-green">Asking for Scope 3 Data.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-5 max-w-xl mx-auto text-lg text-white/60 font-medium leading-relaxed"
          >
            From 2026, large Australian corporates face mandatory AASB S2 disclosure.
            They will cascade these requirements down to every supplier in their chain.
            Don't lose the contract — be ready.
          </motion.p>
        </div>

        {/* Corporate logos */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-16 flex flex-wrap items-center justify-center gap-4"
        >
          {logos.map((logo) => (
            <div
              key={logo}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/40"
            >
              {logo}
            </div>
          ))}
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/30 italic">
            + hundreds more
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

          {/* Emission breakdown chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-white/10 bg-white/5 p-8"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-aw-green mb-6">
              Typical SME Emission Breakdown
            </p>
            <div className="space-y-5">
              {categoryBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-white/80 font-semibold text-sm">
                      <span className="text-white/40">{item.icon}</span>
                      {item.label}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/30 font-bold uppercase">Scope {item.scope}</span>
                      <span className="text-white font-black text-sm">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${item.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-2 rounded-full ${item.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-white/30 font-medium">
              Based on average Australian SME transaction data. Your breakdown will vary by industry.
            </p>
          </motion.div>

          {/* Testimonials */}
          <div className="flex flex-col gap-6">
            {testimonials.map((t, idx) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-8"
              >
                <p className="text-white/80 font-medium text-base leading-relaxed mb-6 italic">
                  "{t.quote}"
                </p>
                <div>
                  <p className="text-white font-bold text-sm">{t.name}</p>
                  <p className="text-aw-green text-xs font-semibold mt-0.5">{t.role}</p>
                  <p className="text-white/30 text-xs mt-0.5">{t.company}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
