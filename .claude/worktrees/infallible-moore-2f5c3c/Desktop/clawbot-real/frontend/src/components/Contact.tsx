"use client";

import { motion } from "framer-motion";
import { Send, CheckCircle2, Leaf } from "lucide-react";
import { useState } from "react";

const businessTypes = ["SME / Small Business", "Accounting Firm", "Consultant / Advisor", "Other"];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [typeError, setTypeError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setTypeError(true);
      return;
    }
    setTypeError(false);
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-32 px-6 bg-white overflow-hidden relative">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-20 items-center">

          {/* Left — copy */}
          <div className="flex-1">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-xs font-bold uppercase tracking-widest text-aw-green mb-5"
            >
              Get Started
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-jakarta text-5xl md:text-7xl font-black leading-[0.95] mb-8 text-aw-slate"
            >
              Ready to Meet Your{" "}
              <span className="text-aw-green">Scope 3 Obligations?</span>
            </motion.h2>
            <p className="text-lg text-aw-slate-mid max-w-lg mb-10 font-medium leading-relaxed">
              Start your free 30-day trial today. No credit card required.
              Our team will help you connect Xero and run your first carbon report within the hour.
            </p>

            <div className="flex flex-col gap-4">
              {[
                "30-day free trial — no credit card needed",
                "Xero connection in under 60 seconds · MYOB coming soon",
                "AASB S1 / S2 compliant reports",
                "Australian support team, AEST hours",
              ].map((point) => (
                <div key={point} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aw-green-light">
                    <CheckCircle2 size={13} className="text-aw-green" strokeWidth={2.5} />
                  </div>
                  <span className="text-sm font-semibold text-aw-slate-mid">{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="flex-1 w-full max-w-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="rounded-3xl border border-aw-gray-border bg-aw-gray/50 p-10 shadow-xl"
            >
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10"
                >
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-aw-green-light">
                    <CheckCircle2 className="text-aw-green" size={40} />
                  </div>
                  <h3 className="text-2xl font-black mb-3 text-aw-slate">You're on the list!</h3>
                  <p className="text-aw-slate-mid font-medium leading-relaxed">
                    Our team will be in touch within one business day to get you set up.
                    Check your inbox for a confirmation email.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-7">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-aw-slate-mid">Full Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Sarah Johnson"
                      className="bg-transparent border-b-2 border-aw-gray-border py-3 text-lg font-semibold outline-none focus:border-aw-green transition-colors placeholder:text-aw-slate-light/50 text-aw-slate"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-aw-slate-mid">Business Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Acme Pty Ltd"
                      className="bg-transparent border-b-2 border-aw-gray-border py-3 text-lg font-semibold outline-none focus:border-aw-green transition-colors placeholder:text-aw-slate-light/50 text-aw-slate"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-aw-slate-mid">Work Email</label>
                    <input
                      required
                      type="email"
                      placeholder="sarah@acme.com.au"
                      className="bg-transparent border-b-2 border-aw-gray-border py-3 text-lg font-semibold outline-none focus:border-aw-green transition-colors placeholder:text-aw-slate-light/50 text-aw-slate"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-aw-slate-mid">I am a...</label>
                    <div className="flex flex-wrap gap-2">
                      {businessTypes.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { setSelected(opt); setTypeError(false); }}
                          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                            selected === opt
                              ? "border-aw-green bg-aw-green-light text-aw-green-dark"
                              : typeError
                              ? "border-red-300 bg-white text-aw-slate-mid hover:border-aw-green/40"
                              : "border-aw-gray-border bg-white text-aw-slate-mid hover:border-aw-green/40"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {typeError && (
                      <p className="text-xs text-red-500 font-semibold">Please select your business type</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="mt-2 flex items-center justify-center gap-3 rounded-2xl bg-aw-green px-8 py-5 text-white font-bold text-lg shadow-lg shadow-aw-green/25 hover:bg-aw-green-dark active:scale-95 group transition-all"
                  >
                    Start My Free Trial
                    <Send size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto mt-32 border-t border-aw-gray-border pt-16 pb-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aw-green">
                <Leaf size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-aw-slate">
                EcoLink<span className="text-aw-green">.</span>
              </span>
            </div>
            <p className="text-aw-slate-mid text-sm font-medium max-w-xs leading-relaxed">
              Automated carbon accounting for Australian SMEs. AASB S1/S2 compliant.
              Built on NGA Factors, published by DCCEEW.
            </p>
            <p className="mt-4 text-xs text-aw-slate-light/60 font-medium">
              © 2026 EcoLink Australia Pty Ltd. All rights reserved. Sydney, Australia. 🇦🇺
            </p>
          </div>

          <div className="flex flex-wrap gap-16">
            <div className="flex flex-col gap-4">
              <span className="text-[11px] font-black uppercase tracking-widest text-aw-green">Product</span>
              <a href="#how-it-works" className="text-sm text-aw-slate-mid hover:text-aw-green font-medium transition-colors">How It Works</a>
              <a href="#pricing"      className="text-sm text-aw-slate-mid hover:text-aw-green font-medium transition-colors">Pricing</a>
              <a href="/dashboard"    className="text-sm text-aw-slate-mid hover:text-aw-green font-medium transition-colors">Dashboard</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-[11px] font-black uppercase tracking-widest text-aw-green">Compliance</span>
              <a href="#" className="text-sm text-aw-slate-mid hover:text-aw-green font-medium transition-colors">AASB S1 / S2</a>
              <a href="#" className="text-sm text-aw-slate-mid hover:text-aw-green font-medium transition-colors">NGA Factors</a>
              <a href="#" className="text-sm text-aw-slate-mid hover:text-aw-green font-medium transition-colors">Scope 3 Guide</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-[11px] font-black uppercase tracking-widest text-aw-green">Legal</span>
              <a href="#" className="text-sm text-aw-slate-mid hover:text-aw-green font-medium transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-aw-slate-mid hover:text-aw-green font-medium transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
