"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Leaf, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  if (!token) {
    return (
      <div className="min-h-screen bg-aw-gray/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-aw-gray-border shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-black text-aw-slate mb-2">Invalid link</h1>
          <p className="text-sm text-aw-slate-mid mb-6">This reset link is missing or invalid.</p>
          <Link href="/forgot-password" className="text-sm font-bold text-aw-green hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const res  = await fetch("/api/auth/reset-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (data.error === "token_expired") {
        setError("This link has expired. Request a new one.");
      } else if (data.error === "invalid_token") {
        setError("Invalid reset link. Request a new one.");
      } else {
        setError(data.error ?? "Something went wrong. Try again.");
      }
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login?reset=1"), 2500);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-aw-gray/50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl border border-aw-gray-border shadow-xl p-8 max-w-md w-full text-center"
        >
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aw-green-light">
              <CheckCircle2 size={32} className="text-aw-green" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-aw-slate mb-2">Password updated!</h1>
          <p className="text-sm text-aw-slate-mid">Redirecting to login…</p>
        </motion.div>
      </div>
    );
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
          <h1 className="text-2xl font-black text-aw-slate mb-1">Set new password</h1>
          <p className="text-sm text-aw-slate-mid mb-7">
            Min 10 chars · uppercase · lowercase · number · symbol
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
            >
              <AlertCircle size={15} className="shrink-0" /> {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div>
              <label className="block text-xs font-bold text-aw-slate-mid uppercase tracking-wider mb-1.5">
                New password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-aw-slate-light" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-xl border border-aw-gray-border bg-aw-gray/40 pl-10 pr-12 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-aw-slate-mid hover:text-aw-slate transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-bold text-aw-slate-mid uppercase tracking-wider mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-aw-slate-light" />
                <input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-xl border border-aw-gray-border bg-aw-gray/40 pl-10 pr-4 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-aw-green py-3 text-sm font-bold text-white transition hover:bg-aw-green-dark active:scale-95 disabled:opacity-60"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Updating…</> : "Update Password"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
