"use client";

import { motion } from "framer-motion";
import { Link2, Cpu, FileDown, ArrowRight } from "lucide-react";

const steps = [
  {
    id: 1,
    icon: <Link2 size={28} strokeWidth={2} className="text-aw-green" />,
    title: "Connect Your Accounting Software",
    sub: "Xero — 60 seconds · MYOB coming soon",
    description:
      "Authorise EcoLink to read your transaction data via secure OAuth 2.0. No spreadsheet exports, no manual uploads. Your data stays encrypted.",
  },
  {
    id: 2,
    icon: <Cpu size={28} strokeWidth={2} className="text-aw-green" />,
    title: "AI Classifies Every Transaction",
    sub: "NGA Emission Factors 2023–24",
    description:
      "Our Spend-to-Carbon engine reads each transaction — \"BP Station Sydney $150\" — and matches it to the correct National Greenhouse Accounts category to calculate kg CO₂e.",
  },
  {
    id: 3,
    icon: <FileDown size={28} strokeWidth={2} className="text-aw-green" />,
    title: "Download Your Compliant Report",
    sub: "AASB S1 / S2 Standard",
    description:
      "Export a PDF report ready to share with your corporate clients, auditors, or procurement teams. Structured to meet AASB S2 climate disclosure requirements.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 px-6 bg-aw-gray/40">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-20">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest text-aw-green mb-4"
          >
            How It Works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-aw-slate leading-tight"
          >
            From Invoice to{" "}
            <span className="text-aw-green">Carbon Report</span>{" "}
            in Three Steps.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-5 max-w-xl mx-auto text-lg text-aw-slate-mid font-medium leading-relaxed"
          >
            No consultants. No spreadsheets. No guesswork.
            EcoLink automates the entire carbon accounting workflow for Australian SMEs.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="relative flex flex-col md:flex-row items-start justify-between gap-8">
          {/* Connecting line (desktop) */}
          <div className="absolute top-10 left-0 w-full h-[1px] bg-aw-gray-border hidden md:block -z-0" />

          {steps.map((step, idx) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="relative flex flex-col bg-white border border-aw-gray-border rounded-3xl p-8 w-full shadow-sm hover:border-aw-green/30 transition-colors"
            >
              {/* Step pill */}
              <div className="absolute -top-3.5 left-8 rounded-full bg-aw-slate px-3 py-1 text-white font-bold text-[11px] uppercase tracking-widest">
                Step {step.id}
              </div>

              {/* Icon */}
              <div className="mb-5 mt-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-aw-green-light">
                {step.icon}
              </div>

              <h3 className="text-xl font-black text-aw-slate mb-1">{step.title}</h3>
              <p className="text-xs font-bold uppercase tracking-wider text-aw-green mb-4">{step.sub}</p>
              <p className="text-aw-slate-mid font-medium text-[15px] leading-relaxed">{step.description}</p>

              {/* Arrow between steps (desktop) */}
              {idx < steps.length - 1 && (
                <div className="absolute -right-5 top-10 z-10 hidden md:block">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-aw-gray-border shadow-sm">
                    <ArrowRight size={16} className="text-aw-slate-light" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
