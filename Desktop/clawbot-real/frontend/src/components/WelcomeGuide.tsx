
"use client";

import { motion } from "framer-motion";
import { Link2, ShieldCheck, BarChart3, ArrowRight, X } from "lucide-react";

export default function WelcomeGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-2xl w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition"
        >
          <X size={24} />
        </button>

        <div className="p-12">
          <div className="mb-10 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-aw-green/10 text-aw-green mb-6">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-3xl font-black text-slate-900">Welcome to EcoLink Australia</h2>
            <p className="text-slate-500 mt-2 font-medium">Your path to AASB S2 compliance starts here.</p>
          </div>

          <div className="space-y-6 mb-10">
            <div className="flex gap-5 p-5 rounded-3xl border border-slate-100 bg-slate-50/50 hover:border-aw-green/30 transition">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-white shadow-sm flex items-center justify-center text-aw-green">
                <Link2 size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">1. Connect Xero</h4>
                <p className="text-sm text-slate-500">Sync your transactions in 60 seconds. Our AI handles the classification.</p>
              </div>
            </div>

            <div className="flex gap-5 p-5 rounded-3xl border border-slate-100 bg-slate-50/50 hover:border-aw-green/30 transition">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-white shadow-sm flex items-center justify-center text-aw-green">
                <BarChart3 size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">2. Review Carbon Data</h4>
                <p className="text-sm text-slate-500">Check your Scope 1, 2, and 3 emissions breakdown by industry category.</p>
              </div>
            </div>

            <div className="flex gap-5 p-5 rounded-3xl border border-slate-100 bg-slate-50/50 hover:border-aw-green/30 transition">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-white shadow-sm flex items-center justify-center text-aw-green">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">3. Generate Audit Report</h4>
                <p className="text-sm text-slate-500">Export a compliant PDF ready for corporate disclosure and bank tenders.</p>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full bg-slate-950 py-5 rounded-2xl text-white font-bold hover:bg-aw-green transition shadow-xl shadow-slate-950/20 flex items-center justify-center gap-2"
          >
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
