"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, TrendingDown, FileCheck2 } from "lucide-react";
import Link from "next/link";

const stats = [
  { value: "2026", label: "AASB S2 mandatory deadline" },
  { value: "~30min", label: "to generate your first report" },
  { value: "Scope 1–3", label: "full emissions coverage" },
];

export default function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-6 pb-20 pt-36">

      {/* Subtle background grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#1E293B 1px, transparent 1px), linear-gradient(90deg, #1E293B 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Green glow blobs */}
      <div className="absolute top-1/3 left-0 -translate-x-1/2 w-72 h-72 rounded-full bg-aw-green/8 blur-[120px] -z-10" />
      <div className="absolute top-1/2 right-0  translate-x-1/2  w-96 h-96 rounded-full bg-aw-green/6 blur-[140px] -z-10" />

      <div className="z-10 w-full max-w-5xl text-center">

        {/* Compliance badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-aw-green/25 bg-aw-green-light px-4 py-2 text-aw-green-dark"
        >
          <ShieldCheck size={15} strokeWidth={2.5} />
          <span className="text-[13px] font-bold tracking-wide">
            AASB S1 &amp; S2 Compliant — Australian NGA Factors 2023–24
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 font-jakarta text-5xl font-black leading-[1.05] tracking-tight text-aw-slate md:text-7xl lg:text-[5.5rem]"
        >
          Your Carbon Report,{" "}
          <span className="text-aw-green">Generated Automatically.</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mx-auto mt-7 max-w-2xl text-xl font-medium leading-relaxed text-aw-slate-mid"
        >
          EcoLink connects to your Xero or MYOB account, reads every transaction,
          and uses AI to calculate your Scope 1, 2 &amp; 3 emissions — producing
          a compliant carbon report your corporate clients can rely on.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/signup"
            className="flex h-14 items-center gap-2.5 rounded-xl bg-aw-green px-8 text-lg font-bold text-white shadow-lg shadow-aw-green/25 transition-all hover:bg-aw-green-dark active:scale-95 group"
          >
            Start Free Trial
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="#how-it-works"
            className="flex h-14 items-center gap-2.5 rounded-xl border border-aw-gray-border bg-white px-8 text-lg font-bold text-aw-slate transition-all hover:border-aw-green/40 hover:text-aw-green active:scale-95"
          >
            See How It Works
          </Link>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-6"
        >
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-aw-green md:text-3xl">{s.value}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-aw-slate-mid">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Dashboard preview card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.7 }}
        className="relative mt-20 w-full max-w-4xl"
      >
        <div className="rounded-3xl border border-aw-gray-border bg-white p-6 shadow-2xl shadow-aw-slate/8">
          {/* Fake browser chrome */}
          <div className="mb-5 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-400/60" />
            <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
            <div className="h-3 w-3 rounded-full bg-green-400/60" />
            <div className="ml-4 flex-1 rounded-lg bg-aw-gray px-4 py-1.5 text-xs text-aw-slate-light">
              app.ecolink.com.au/dashboard
            </div>
          </div>

          {/* Dashboard mockup body — desktop */}
          <div className="hidden md:grid grid-cols-3 gap-4">
            {/* Scope cards */}
            {[
              { label: "Scope 1 — Direct",    value: "12.4 t",  pct: "18%",  color: "bg-blue-500"  },
              { label: "Scope 2 — Electricity", value: "8.1 t", pct: "12%",  color: "bg-aw-green"  },
              { label: "Scope 3 — Supply Chain", value: "47.3 t", pct: "70%", color: "bg-purple-500" },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-aw-gray-border bg-aw-gray p-5">
                <p className="text-xs font-semibold text-aw-slate-mid">{card.label}</p>
                <p className="mt-2 text-2xl font-black text-aw-slate">{card.value} CO₂e</p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-aw-gray-border">
                  <div className={`h-1.5 rounded-full ${card.color}`} style={{ width: card.pct }} />
                </div>
                <p className="mt-1 text-right text-[11px] font-bold text-aw-slate-mid">{card.pct} of total</p>
              </div>
            ))}
          </div>

          {/* Mobile simplified view */}
          <div className="md:hidden grid grid-cols-3 gap-3">
            {[
              { label: "Scope 1", value: "12.4 t", color: "bg-blue-500" },
              { label: "Scope 2", value: "8.1 t",  color: "bg-aw-green" },
              { label: "Scope 3", value: "47.3 t", color: "bg-purple-500" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl bg-aw-gray p-3 text-center">
                <div className={`h-1 w-full rounded-full ${c.color} mb-2`} />
                <p className="text-[10px] font-bold text-aw-slate-mid uppercase tracking-wider">{c.label}</p>
                <p className="text-base font-black text-aw-slate">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Fake transaction table */}
          <div className="mt-4 rounded-2xl border border-aw-gray-border bg-aw-gray p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-aw-slate-mid">Recent Classifications</p>
            <div className="space-y-2">
              {[
                { desc: "BP Station Sydney",         cat: "Combustion — Petrol",      co2: "143.1 kg",  status: "Classified",    dot: "bg-aw-green" },
                { desc: "Ausgrid — July Invoice",    cat: "Electricity — NSW Grid",   co2: "306.6 kg",  status: "Classified",    dot: "bg-aw-green" },
                { desc: "Qantas BNE-SYD",            cat: "Air Travel — Domestic",    co2: "52.8 kg",   status: "Classified",    dot: "bg-aw-green" },
                { desc: "Office Supplies — unclear", cat: "—",                        co2: "—",         status: "Needs Review",  dot: "bg-yellow-400" },
              ].map((row) => (
                <div key={row.desc} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${row.dot} shrink-0`} />
                    <div>
                      <p className="text-sm font-semibold text-aw-slate">{row.desc}</p>
                      <p className="text-xs text-aw-slate-mid">{row.cat}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-aw-slate">{row.co2}</p>
                    <p className="text-[11px] text-aw-slate-mid">{row.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating badges — hidden on mobile to avoid overflow */}
        <div className="hidden md:flex absolute -bottom-4 -right-8 items-center gap-2 rounded-xl border border-aw-green/20 bg-white px-5 py-3 shadow-xl">
          <FileCheck2 size={18} className="text-aw-green" />
          <div>
            <p className="text-xs font-black text-aw-slate">AASB S2 Ready</p>
            <p className="text-[11px] text-aw-slate-mid">Report generated</p>
          </div>
        </div>
        <div className="hidden md:flex absolute -bottom-4 -left-8 items-center gap-2 rounded-xl border border-aw-gray-border bg-white px-5 py-3 shadow-xl">
          <TrendingDown size={18} className="text-aw-green" />
          <div>
            <p className="text-xs font-black text-aw-slate">67.8 t CO₂e</p>
            <p className="text-[11px] text-aw-slate-mid">FY 2023–24 total</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
