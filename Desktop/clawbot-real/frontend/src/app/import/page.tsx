
"use client";

import { useState } from "react";
import { Link2, Upload, Type, ArrowRight, ShieldCheck } from "lucide-react";
import ManualTransactionEntry from "@/components/ManualTransactionEntry";
import FileUploadImporter from "@/components/FileUploadImporter";

export default function ImportPage() {
  const [method, setMethod] = useState("auto"); // auto | file | manual

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-black text-slate-900">Import Data</h1>
          <p className="text-slate-500 mt-2 font-medium">Select how you want to bring your transactions into EcoLink.</p>
        </div>

        {/* Method Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            { id: "auto", label: "Auto Connect", icon: <Link2 />, desc: "Xero / MYOB sync" },
            { id: "file", label: "File Upload", icon: <Upload />, desc: "CSV, Excel files" },
            { id: "manual", label: "Quick Manual", icon: <Type />, desc: "Type transactions" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMethod(item.id)}
              className={`p-6 rounded-3xl border-2 text-left transition-all ${
                method === item.id 
                ? "border-aw-green bg-white shadow-xl shadow-aw-green/5" 
                : "border-transparent bg-white hover:border-slate-200"
              }`}
            >
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-4 ${
                method === item.id ? "bg-aw-green text-white" : "bg-slate-100 text-slate-400"
              }`}>
                {item.icon}
              </div>
              <h3 className="font-bold text-slate-900">{item.label}</h3>
              <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {method === "auto" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <div className="flex justify-center gap-6 mb-8">
                <img src="https://upload.wikimedia.org/wikipedia/en/9/9f/Xero_software_logo.svg" className="h-16 grayscale opacity-50" alt="Xero" />
                <div className="h-16 w-px bg-slate-100" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/e/e0/MYOB_logo.png" className="h-12 mt-2 grayscale opacity-30" alt="MYOB" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Connect your accounting software</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto">
                Securely link your account. We only read spend transactions to calculate your carbon footprint.
              </p>
              
              <a 
                href="/api/auth/xero"
                className="inline-flex items-center gap-3 bg-aw-green px-10 py-4 rounded-xl text-white font-bold shadow-lg shadow-aw-green/20 hover:bg-aw-green-dark transition"
              >
                Connect to Xero <ArrowRight size={18} />
              </a>

              <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
                <ShieldCheck size={16} />
                <span className="text-xs font-medium">Bank-level 256-bit encryption</span>
              </div>
            </div>
          )}

          {method === "file" && <FileUploadImporter />}
          {method === "manual" && <ManualTransactionEntry />}
        </div>
      </div>
    </div>
  );
}
