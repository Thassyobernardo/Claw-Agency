"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Leaf, Mail, Lock, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

function LoginForm() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  // Only allow relative redirects (prevents open-redirect attacks)
  const rawCallback = searchParams.get("callbackUrl") ?? "/dashboard";
  const callbackUrl = rawCallback.startsWith("/") && !rawCallback.startsWith("//")
    ? rawCallback
    : "/dashboard";
  const errorParam    = searchParams.get("error");
  const verifiedParam   = searchParams.get("verified");

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(
    errorParam === "CredentialsSignin"   ? "Invalid email or password."
    : errorParam === "TooManyRequests"   ? "Too many attempts. Try again in 15 minutes."
    : errorParam === "EmailNotVerified"  ? "Please verify your email before logging in. Check your inbox."
    : errorParam === "invalid_token"     ? "Verification link is invalid or expired. Please register again."
    : null
  );
  const checkEmailParam = searchParams.get("check_email");
  const resetParam      = searchParams.get("reset");
  const [success] = useState<string | null>(
    verifiedParam === "1"     ? "Email confirmed! You can now log in."
    : checkEmailParam === "1" ? "Account created! Check your inbox and confirm your email before logging in."
    : resetParam === "1"      ? "Password updated successfully! You can now log in."
    : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(
        res.error === "TooManyRequests"
          ? "Too many login attempts. Please wait 15 minutes."
          : "Invalid email or password."
      );
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
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

        {/* Card */}
        <div className="bg-white rounded-3xl border border-aw-gray-border shadow-xl shadow-black/5 p-8">
          <h1 className="text-2xl font-black text-aw-slate mb-1">Welcome back</h1>
          <p className="text-sm text-aw-slate-mid mb-7">
            Sign in to your carbon accounting dashboard
          </p>


          {/* Success */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2 rounded-xl bg-aw-green-light border border-aw-green/30 px-4 py-3 text-sm text-aw-green font-semibold"
            >
              ✅ {success}
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
            >
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-aw-slate-mid mb-1.5 uppercase tracking-wider">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-aw-slate-light" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com.au"
                  className="w-full rounded-xl border border-aw-gray-border bg-aw-gray/40 pl-10 pr-4 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-aw-slate-mid uppercase tracking-wider">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-aw-green hover:underline font-semibold">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-aw-slate-light" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-aw-gray-border bg-aw-gray/40 pl-10 pr-4 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-aw-green py-3.5 text-sm font-bold text-white transition-all hover:bg-aw-green-dark active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-aw-green/20"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-aw-slate-mid">
            Don&apos;t have an account?{" "}
            <Link href="/onboarding" className="font-bold text-aw-green hover:underline">
              Create account — free
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-aw-slate-mid/60">
          Emissions reported under AASB S2 · NGA Factors 2023–24 · EcoLink Australia
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-aw-gray/50 flex items-center justify-center">
        <Loader2 className="animate-spin text-aw-green" size={28} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
