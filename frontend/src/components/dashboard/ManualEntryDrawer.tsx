"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, CheckCircle2, AlertCircle, FlaskConical,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const UNITS = ["L", "kWh", "GJ", "m3", "tonne", "kg"] as const;
type Unit = typeof UNITS[number];

const EVIDENCE_TYPES = [
  { value: "invoice_receipt", label: "Invoice / Receipt" },
  { value: "direct_entry",    label: "Direct Entry"      },
  { value: "estimate",        label: "Estimate"          },
] as const;

interface Props {
  txId:          string;
  txDescription: string;
  userId:        string;
  onResolved:    (txId: string, co2eTonnes: number) => void;
  onClose:       () => void;
}

// ─── ManualEntryDrawer ────────────────────────────────────────────────────────

export default function ManualEntryDrawer({
  txId, txDescription, userId, onResolved, onClose,
}: Props) {
  const [quantity, setQuantity]     = useState("");
  const [unit, setUnit]             = useState<Unit>("L");
  const [evidence, setEvidence]     = useState<"invoice_receipt" | "direct_entry" | "estimate">("invoice_receipt");
  const [note, setNote]             = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [result, setResult]         = useState<{ co2eTonnes: number; auditTrail: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      setError("Physical quantity must be a positive number. AUD values are not accepted.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/transactions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId:    txId,
          physicalQuantity: qty,
          unit,
          userOverrideId:   userId,
          evidenceType:     evidence,
          note:             note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Calculation failed.");
        return;
      }
      setResult({ co2eTonnes: data.co2eTonnes, auditTrail: data.auditTrail });
      // Notify parent after short delay so user sees the result
      setTimeout(() => onResolved(txId, data.co2eTonnes), 1400);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.aside
        key="drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white border-l border-aw-gray-border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-aw-gray-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aw-green-light">
              <FlaskConical size={16} className="text-aw-green" />
            </div>
            <div>
              <p className="text-sm font-black text-aw-slate">Classify Transaction</p>
              <p className="text-[11px] text-aw-slate-light truncate max-w-[240px]">
                {txDescription}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-aw-slate-light hover:text-aw-slate hover:bg-aw-gray transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Success state */}
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-aw-green-light">
                <CheckCircle2 size={28} className="text-aw-green" />
              </div>
              <div>
                <p className="text-lg font-black text-aw-slate">Classified!</p>
                <p className="text-3xl font-black text-aw-green mt-1">
                  {result.co2eTonnes.toFixed(4)} t CO₂e
                </p>
              </div>
              <p className="text-xs text-aw-slate-mid bg-aw-gray/60 rounded-xl px-4 py-3 font-mono break-all">
                {result.auditTrail}
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col overflow-y-auto"
            >
              <div className="flex-1 px-6 py-5 space-y-5">

                {/* NGA disclaimer */}
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 font-medium">
                  ⚖️ <strong>NGA Factors 2025 — Method 1</strong><br />
                  Enter the physical quantity from the invoice.
                  AUD amounts are not accepted (AASB S2 / GHG Protocol).
                </div>

                {/* Quantity + Unit row */}
                <div>
                  <label className="block text-xs font-bold text-aw-slate-mid uppercase tracking-wider mb-1.5">
                    Physical Quantity
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="manual-quantity"
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="e.g. 350"
                      className="flex-1 rounded-xl border border-aw-gray-border bg-aw-gray/40 px-4 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                    />
                    <select
                      id="manual-unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value as Unit)}
                      className="rounded-xl border border-aw-gray-border bg-aw-gray/40 px-3 py-3 text-sm font-bold text-aw-slate focus:border-aw-green/50 focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Evidence type */}
                <div>
                  <label className="block text-xs font-bold text-aw-slate-mid uppercase tracking-wider mb-1.5">
                    Evidence Type
                  </label>
                  <div className="flex gap-2">
                    {EVIDENCE_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEvidence(value)}
                        className={`flex-1 rounded-xl py-2.5 text-xs font-bold border transition-all ${
                          evidence === value
                            ? "border-aw-green bg-aw-green-light text-aw-green"
                            : "border-aw-gray-border bg-white text-aw-slate-mid hover:border-aw-slate/30"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-bold text-aw-slate-mid uppercase tracking-wider mb-1.5">
                    Note <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    id="manual-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Fuel receipt #1234 — Ampol Sydney depot"
                    rows={2}
                    className="w-full rounded-xl border border-aw-gray-border bg-aw-gray/40 px-4 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    {error}
                  </motion.div>
                )}
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 border-t border-aw-gray-border flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-aw-gray-border bg-white py-3 text-sm font-bold text-aw-slate-mid transition-all hover:border-aw-slate/30 hover:text-aw-slate"
                >
                  Cancel
                </button>
                <button
                  id="manual-submit"
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-aw-green py-3 text-sm font-bold text-white transition-all hover:bg-aw-green-dark active:scale-[0.98] disabled:opacity-60 shadow-md shadow-aw-green/20"
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" /> Calculating…</>
                  ) : (
                    <>Calculate & Classify</>
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.aside>
    </AnimatePresence>
  );
}
