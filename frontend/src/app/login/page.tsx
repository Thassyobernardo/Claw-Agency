"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import {
  Leaf, Mail, Lock, AlertCircle, Loader2, ArrowRight, Sparkles
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// ─── Auth mode type ───────────────────────────────────────────────────────────

type AuthMode = "password" | "magic";

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Only allow relative redirects (prevents open-redirect attacks)
  const rawCallback = searchParams.get("callbackUrl") ?? "/dashboard";
  const callbackUrl = rawCallback.startsWith("/") && !rawCallback.startsWith("//")
    ? rawCallback
    : "/dashboard";

  const errorParam    = searchParams.get("error");
  const verifiedParam = searchParams.get("verified");
  const magicSent     = searchParams.get("magic_sent");

  const [mode,     setMode]     = useState<AuthMode>("password");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [magicOk,  setMagicOk]  = useState(magicSent === "1");
  const [termsOk,  setTermsOk]  = useState(false);

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

  // ── Password login ──────────────────────────────────────────────────────────

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!termsOk) { setError("Please accept the Terms of Service and Privacy Policy."); return; }

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

  // ── Magic Link (OTP via email) ──────────────────────────────────────────────

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!termsOk) { setError("Please accept the Terms of Service and Privacy Policy."); return; }
    if (!email.trim()) { setError("Please enter your email address."); return; }

    setLoading(true);
    setError(null);
    try {
      // Uses NextAuth email provider — sends magic link via Resend
      const res = await signIn("email", {
        email: email.trim().toLowerCase(),
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        setError("Failed to send magic link. Please try again.");
      } else {
        setMagicOk(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
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
          <p className="text-sm text-aw-slate-mid mb-6">
            Sign in to your carbon accounting dashboard
          </p>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-aw-gray/60 mb-6">
            {(["password", "magic"] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setMagicOk(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition-all ${
                  mode === m
                    ? "bg-white text-aw-slate shadow-sm"
                    : "text-aw-slate-mid hover:text-aw-slate"
                }`}
              >
                {m === "password" ? <><Lock size={13} /> Password</> : <><Sparkles size={13} /> Magic Link</>}
              </button>
            ))}
          </div>

          {/* Success banner */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2 rounded-xl bg-aw-green-light border border-aw-green/30 px-4 py-3 text-sm text-aw-green font-semibold"
            >
              ✅ {success}
            </motion.div>
          )}

          {/* Error banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
            >
              <AlertCircle size={15} className="shrink-0" /> {error}
            </motion.div>
          )}

          {/* Magic link sent state */}
          <AnimatePresence mode="wait">
            {magicOk ? (
              <motion.div
                key="magic-sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-3"
              >
                <div className="mx-auto w-14 h-14 rounded-full bg-aw-green-light flex items-center justify-center">
                  <Mail size={24} className="text-aw-green" />
                </div>
                <p className="font-black text-aw-slate text-lg">Check your inbox</p>
                <p className="text-sm text-aw-slate-mid">
                  We've sent a magic link to <strong>{email}</strong>.<br />
                  Click the link to sign in — no password needed.
                </p>
                <button
                  onClick={() => setMagicOk(false)}
                  className="text-xs text-aw-green font-bold hover:underline mt-2"
                >
                  Resend or change email →
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="login-form"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
                className="space-y-4"
              >
                {/* Email field */}
                <div>
                  <label className="block text-xs font-bold text-aw-slate-mid mb-1.5 uppercase tracking-wider">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-aw-slate-light" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com.au"
                      className="w-full rounded-xl border border-aw-gray-border bg-aw-gray/40 pl-10 pr-4 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                    />
                  </div>
                </div>

                {/* Password field — only in password mode */}
                <AnimatePresence>
                  {mode === "password" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: "hidden" }}
                    >
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
                          id="login-password"
                          type="password"
                          required={mode === "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-aw-gray-border bg-aw-gray/40 pl-10 pr-4 py-3 text-sm text-aw-slate placeholder:text-aw-slate-light focus:border-aw-green/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-aw-green/10 transition-all"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Magic link explanation */}
                {mode === "magic" && (
                  <p className="text-xs text-aw-slate-mid bg-aw-gray/60 rounded-xl px-4 py-3">
                    ✨ We&apos;ll email you a secure, one-time link. No password required —
                    and your email is automatically validated.
                  </p>
                )}

                {/* ToS + Privacy checkbox */}
                <div
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                    termsOk
                      ? "border-aw-green/30 bg-aw-green-light"
                      : "border-aw-gray-border bg-aw-gray/40"
                  }`}
                >
                  <div
                    id="terms-checkbox"
                    role="checkbox"
                    aria-checked={termsOk}
                    tabIndex={0}
                    onClick={() => setTermsOk((v) => !v)}
                    onKeyDown={(e) => e.key === " " && setTermsOk((v) => !v)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-2 transition-all ${
                      termsOk
                        ? "border-aw-green bg-aw-green"
                        : "border-aw-gray-border bg-white hover:border-aw-green/50"
                    }`}
                  >
                    {termsOk && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-aw-slate-mid leading-relaxed">
                    I have read and agree to the{" "}
                    <Link
                      href="/legal/terms"
                      target="_blank"
                      className="font-bold text-aw-slate hover:text-aw-green underline"
                    >
                      Terms of Service
                    </Link>
                    {" "}and{" "}
                    <Link
                      href="/legal/privacy"
                      target="_blank"
                      className="font-bold text-aw-slate hover:text-aw-green underline"
                    >
                      Privacy Policy
                    </Link>
                    , including the disclaimer that EcoLink reports are{" "}
                    <strong>not Reasonable Assurance</strong> under ASRS 2.
                  </p>
                </div>

                {/* Submit */}
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading || !termsOk}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-aw-green py-3.5 text-sm font-bold text-white transition-all hover:bg-aw-green-dark active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-aw-green/20"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> {mode === "magic" ? "Sending…" : "Signing in…"}</>
                  ) : mode === "magic" ? (
                    <><Sparkles size={16} /> Send Magic Link <ArrowRight size={16} /></>
                  ) : (
                    <>Sign in <ArrowRight size={16} /></>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-xs text-aw-slate-mid">
            Don&apos;t have an account?{" "}
            <Link href="/onboarding" className="font-bold text-aw-green hover:underline">
              Create account — free
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-aw-slate-mid/60">
          Emissions reported under AASB S2 · NGA Factors 2025 · EcoLink Australia
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
