"use client";

import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import { Leaf, Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function ForgotPasswordForm() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    setLoading(true);
    setError(null);

    await fetch("/api/auth/forgot-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    // Always show success — prevents email enumeration
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-aw-gray/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aw-green shadow-lg shadow-aw-green/20">
              <Leaf size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-aw-slate">
              EcoLink<span className="text-aw-green">.</span>
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-aw-gray-border shadow-xl shadow-black/5 p-8">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aw-green-light">
                  <CheckCircle2 size={32} className="text-aw-green" />
                </div>
              </div>
              <h1 className="text-2xl font-black text-aw-slate mb-2">Check your inbox</h1>
              <p className="text-sm text-aw-slate-mid mb-6">
                If <strong>{email}</strong> is registered, you'll receive a reset link within a few minutes.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-bold text-aw-green hover:underline"
              >
                <ArrowLeft size={15} /> Back to login
              </Link>
            </motion.div>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-aw-slate-mid hover:text-aw-slate mb-6 transition-colors"
              >
                <ArrowLeft size={14} /> Back to login
              </Link>

              <h1 className="text-2xl font-black text-aw-slate mb-1">Forgot password?</h1>
              <p className="text-sm text-aw-slate-mid mb-7">
                Enter your email and we'll send you a reset link.
              </p>

              {error && (
                <p className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-aw-slate-mid uppercase tracking-wider mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-aw-slate-light" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com.au"
                      className="w-full rounded-xl border border-aw-gray-border bg-aw-gray/40 pl-10 pr-4 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-aw-green py-3 text-sm font-bold text-white transition hover:bg-aw-green-dark active:scale-95 disabled:opacity-60"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
