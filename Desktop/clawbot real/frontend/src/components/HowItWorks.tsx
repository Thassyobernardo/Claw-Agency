"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Link2, Cpu, FileDown, ArrowRight, Play, X } from "lucide-react";
import { useState } from "react";

// ─── Replace VIDEO_ID with your Loom or YouTube ID when ready ────────────────
const VIDEO_ID = "YOUR_YOUTUBE_OR_LOOM_ID";
const VIDEO_PLATFORM: "youtube" | "loom" = "youtube"; // change to "loom" if using Loom

const steps = [
  {
    id: 1,
    icon: <Link2 size={28} strokeWidth={2} className="text-aw-green" />,
    title: "Connect Your Accounting Software",
    sub: "Xero or MYOB — 60 seconds",
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

// ─── Video embed URL builder ──────────────────────────────────────────────────
function getEmbedUrl(id: string, platform: "youtube" | "loom"): string {
  if (platform === "loom") return `https://www.loom.com/embed/${id}?autoplay=1`;
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
}

export default function HowItWorks() {
  const [videoOpen, setVideoOpen] = useState(false);
  const isPlaceholder = VIDEO_ID === "YOUR_YOUTUBE_OR_LOOM_ID";

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

        {/* ── Video Section ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-24"
        >
          <p className="text-center text-sm font-semibold text-aw-slate-mid mb-6 uppercase tracking-widest">
            See it in action
          </p>

          {/* Video thumbnail / placeholder */}
          <div
            className={`relative overflow-hidden rounded-3xl bg-aw-slate group ${isPlaceholder ? "cursor-default" : "cursor-pointer"}`}
            style={{ aspectRatio: "16 / 9" }}
            onClick={() => !isPlaceholder && setVideoOpen(true)}
            onKeyDown={(e) => { if (!isPlaceholder && (e.key === "Enter" || e.key === " ")) setVideoOpen(true); }}
            role={isPlaceholder ? "img" : "button"}
            tabIndex={isPlaceholder ? undefined : 0}
            aria-label={isPlaceholder ? "Explainer video coming soon" : "Play EcoLink explainer video"}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-aw-slate via-aw-slate/90 to-aw-green/40" />

            {/* Placeholder content (hidden once video is set) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-white px-8">
              {/* Play button */}
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 border-2 border-white/30 backdrop-blur-sm transition-all group-hover:bg-aw-green group-hover:border-aw-green group-hover:scale-110">
                <Play size={32} className="text-white ml-1" fill="white" />
              </div>

              <div className="text-center">
                <p className="text-2xl font-black mb-2">
                  How EcoLink turns your Xero invoices into a carbon report in under 60 seconds
                </p>
                {isPlaceholder ? (
                  <p className="text-sm text-white/50 font-medium">
                    Explainer video coming soon
                  </p>
                ) : (
                  <p className="text-sm text-white/70 font-medium">Click to watch · 60 seconds</p>
                )}
              </div>

              {/* Decorative emission bars */}
              <div className="flex items-end gap-2 opacity-20">
                {[40, 65, 55, 80, 45, 70, 60].map((h, i) => (
                  <div
                    key={i}
                    className="w-5 rounded-t bg-aw-green-mid"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-aw-slate-mid font-medium">
            No credit card required · Free 30-day trial · Cancel any time
          </p>
        </motion.div>
      </div>

      {/* ── Video Modal ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {videoOpen && !isPlaceholder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
              style={{ aspectRatio: "16 / 9" }}
            >
              <button
                onClick={() => setVideoOpen(false)}
                className="absolute -top-10 right-0 flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-semibold"
              >
                <X size={16} /> Close
              </button>
              <iframe
                src={getEmbedUrl(VIDEO_ID, VIDEO_PLATFORM)}
                className="w-full h-full rounded-2xl"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
