"use client";

/**
 * /onboarding
 *
 * 4-step guided onboarding for new EcoLink customers.
 * Steps:
 *   1. Account  — email, password, full name
 *   2. Business — company name, ABN, state, industry
 *   3. Connect  — Xero OAuth (optional, skippable)
 *   4. Done     — confirmation + link to dashboard
 *
 * Registration happens at the end of Step 2 (before Xero connect).
 * After registration the user is auto-signed-in via NextAuth signIn().
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf, CheckCircle2, ArrowRight, ArrowLeft, Eye, EyeOff,
  Link2, Loader2, Building2, User, Zap, Lock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";

// ─── Constants ────────────────────────────────────────────────────────────────

const AU_STATES = ["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"];

const INDUSTRIES = [
  { value: "E", label: "Construction & Building Trades" },
  { value: "I", label: "Transport & Logistics" },
  { value: "C", label: "Manufacturing" },
  { value: "G", label: "Retail Trade" },
  { value: "F", label: "Wholesale Trade" },
  { value: "H", label: "Accommodation & Food Services" },
  { value: "Q", label: "Health Care & Social Assistance" },
  { value: "M", label: "Professional & Technical Services" },
  { value: "J", label: "Information & Technology" },
  { value: "K", label: "Financial & Insurance Services" },
  { value: "A", label: "Agriculture, Forestry & Fishing" },
  { value: "B", label: "Mining" },
  { value: "D", label: "Electricity, Gas, Water & Waste" },
  { value: "L", label: "Real Estate & Rental" },
  { value: "N", label: "Administrative & Support Services" },
  { value: "P", label: "Education & Training" },
  { value: "R", label: "Arts & Recreation" },
  { value: "S", label: "Other Services" },
];

const STEP_LABELS = ["Account", "Business", "Connect Xero", "All Done"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  email:        string;
  password:     string;
  name:         string;
  // Step 2
  company_name: string;
  abn:          string;
  state:        string;
  industry:     string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <motion.div
            animate={{
              width:  i <= current ? 28 : 8,
              backgroundColor: i < current ? "#22c55e" : i === current ? "#1a2e44" : "#e5e7eb",
            }}
            className="h-2 rounded-full"
          />
          {i < total - 1 && <div className="h-px w-3 bg-aw-gray-border" />}
        </div>
      ))}
      <span className="ml-2 text-xs font-semibold text-aw-slate-mid">
        {STEP_LABELS[current]}
      </span>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label, hint, error, children,
}: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-aw-slate">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-aw-slate-mid">{hint}</p>}
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const { error, className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`w-full rounded-xl border ${
        error ? "border-red-400 bg-red-50" : "border-aw-gray-border bg-white"
      } px-4 py-3 text-sm text-aw-slate placeholder-aw-slate-mid/60 outline-none transition
        focus:border-aw-green focus:ring-2 focus:ring-aw-green/20 ${className}`}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [errors,  setErrors]  = useState<Partial<Record<keyof FormData | "global", string>>>({});

  const [form, setForm] = useState<FormData>({
    email: "", password: "", name: "",
    company_name: "", abn: "", state: "", industry: "",
  });

  const set = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // ── Step 1 validation ──────────────────────────────────────────────────
  function validateStep1(): boolean {
    const errs: typeof errors = {};
    if (!form.email.trim() || !form.email.includes("@"))
      errs.email = "Enter a valid email address";
    if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters";
    if (!form.name.trim())
      errs.name = "Enter your full name";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Step 2 validation ──────────────────────────────────────────────────
  function validateStep2(): boolean {
    const errs: typeof errors = {};
    if (!form.company_name.trim())
      errs.company_name = "Enter your company name";
    if (form.abn && !/^\d{11}$/.test(form.abn.replace(/\s+/g, "")))
      errs.abn = "ABN must be 11 digits (e.g. 51824753556)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Register & sign-in after Step 2 ────────────────────────────────────
  const register = useCallback(async () => {
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:        form.email.trim().toLowerCase(),
          password:     form.password,
          name:         form.name.trim(),
          company_name: form.company_name.trim(),
          abn:          form.abn.replace(/\s+/g, "") || undefined,
          industry:     form.industry || undefined,
          state:        form.state || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "email_taken") {
          setErrors({ email: "This email is already registered. Try logging in." });
          setStep(0);
        } else if (data.field) {
          setErrors({ [data.field]: data.error.replace(/_/g, " ") });
        } else {
          setErrors({ global: "Something went wrong. Please try again." });
        }
        return;
      }

      // Auto sign-in
      const signInResult = await signIn("credentials", {
        redirect: false,
        email:    form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (signInResult?.error) {
        setErrors({ global: "Account created but sign-in failed. Please log in manually." });
        router.push("/login");
        return;
      }

      // Proceed to Xero connect step
      setStep(2);

    } finally {
      setLoading(false);
    }
  }, [form, router]);

  const handleNext = useCallback(async () => {
    if (step === 0) {
      if (validateStep1()) setStep(1);
    } else if (step === 1) {
      if (validateStep2()) await register();
    }
  }, [step, register]); // eslint-disable-line react-hooks/exhaustive-deps

  const skipXero = useCallback(() => setStep(3), []);

  const goToDashboard = useCallback(() => router.push("/dashboard"), [router]);

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-aw-gray/60 to-white flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-aw-green shadow-lg shadow-aw-green/30">
          <Leaf size={18} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="font-extrabold text-2xl tracking-tight text-aw-slate">
          EcoLink<span className="text-aw-green">.</span>
        </span>
      </Link>

      {/* Card */}
      <motion.div
        layout
        className="w-full max-w-md rounded-3xl border border-aw-gray-border bg-white p-8 shadow-xl"
      >
        <StepDots current={step} total={4} />

        <AnimatePresence mode="wait">

          {/* ── Step 0: Account ───────────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="step0"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-aw-green-light mb-3">
                  <User size={22} className="text-aw-green" />
                </div>
                <h1 className="text-2xl font-black text-aw-slate">Create your account</h1>
                <p className="text-sm text-aw-slate-mid mt-1 font-medium">
                  Start your free 14-day trial. No credit card required.
                </p>
              </div>

              <div className="space-y-4">
                <Field label="Full name" error={errors.name}>
                  <Input placeholder="Alex Smith" value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    error={!!errors.name} autoFocus />
                </Field>

                <Field label="Work email" error={errors.email}>
                  <Input type="email" placeholder="alex@acmebuild.com.au"
                    value={form.email} onChange={(e) => set("email", e.target.value)}
                    error={!!errors.email} />
                </Field>

                <Field label="Password" hint="At least 8 characters" error={errors.password}>
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} placeholder="••••••••"
                      value={form.password} onChange={(e) => set("password", e.target.value)}
                      error={!!errors.password} className="pr-12" />
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-aw-slate-mid hover:text-aw-slate transition-colors">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>
              </div>

              {errors.global && (
                <p className="mt-3 text-xs font-semibold text-red-500">{errors.global}</p>
              )}

              <button onClick={handleNext}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-aw-green py-3.5 text-sm font-bold text-white transition hover:bg-aw-green-dark active:scale-95">
                Continue <ArrowRight size={16} />
              </button>

              <p className="mt-4 text-center text-xs text-aw-slate-mid">
                Already have an account?{" "}
                <Link href="/login" className="font-bold text-aw-green hover:underline">Sign in</Link>
              </p>
            </motion.div>
          )}

          {/* ── Step 1: Business ─────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 mb-3">
                  <Building2 size={22} className="text-blue-600" />
                </div>
                <h1 className="text-2xl font-black text-aw-slate">About your business</h1>
                <p className="text-sm text-aw-slate-mid mt-1 font-medium">
                  This helps us match you to the right sector benchmarks.
                </p>
              </div>

              <div className="space-y-4">
                <Field label="Company name" error={errors.company_name}>
                  <Input placeholder="Acme Building Supplies Pty Ltd"
                    value={form.company_name} onChange={(e) => set("company_name", e.target.value)}
                    error={!!errors.company_name} autoFocus />
                </Field>

                <Field label="ABN" hint="11-digit Australian Business Number (optional)"
                  error={errors.abn}>
                  <Input placeholder="51 824 753 556" value={form.abn}
                    onChange={(e) => set("abn", e.target.value.replace(/[^\d\s]/g, ""))}
                    error={!!errors.abn} maxLength={14} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="State">
                    <select value={form.state} onChange={(e) => set("state", e.target.value)}
                      className="w-full rounded-xl border border-aw-gray-border bg-white px-4 py-3 text-sm text-aw-slate outline-none focus:border-aw-green focus:ring-2 focus:ring-aw-green/20 transition">
                      <option value="">Select…</option>
                      {AU_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Industry">
                    <select value={form.industry} onChange={(e) => set("industry", e.target.value)}
                      className="w-full rounded-xl border border-aw-gray-border bg-white px-4 py-3 text-sm text-aw-slate outline-none focus:border-aw-green focus:ring-2 focus:ring-aw-green/20 transition">
                      <option value="">Select…</option>
                      {INDUSTRIES.map((ind) => (
                        <option key={ind.value} value={ind.value}>{ind.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              {errors.global && (
                <p className="mt-3 text-xs font-semibold text-red-500">{errors.global}</p>
              )}

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(0)}
                  className="flex items-center gap-1.5 rounded-xl border border-aw-gray-border bg-white px-4 py-3 text-sm font-bold text-aw-slate transition hover:border-aw-slate/40 active:scale-95">
                  <ArrowLeft size={15} />
                </button>
                <button onClick={handleNext} disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-aw-green py-3 text-sm font-bold text-white transition hover:bg-aw-green-dark active:scale-95 disabled:opacity-70">
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Creating account…</>
                    : <>Create Account <ArrowRight size={16} /></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Connect Xero ─────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-aw-green-light mb-3">
                  <Link2 size={22} className="text-aw-green" />
                </div>
                <h1 className="text-2xl font-black text-aw-slate">Connect your accounting</h1>
                <p className="text-sm text-aw-slate-mid mt-1 font-medium">
                  Link Xero and we&apos;ll import your transactions automatically. Takes 30 seconds.
                </p>
              </div>

              {/* Xero benefits */}
              <div className="space-y-3 mb-6">
                {[
                  { icon: <Zap size={14} className="text-aw-green" />, text: "Auto-import every SPEND transaction" },
                  { icon: <CheckCircle2 size={14} className="text-aw-green" />, text: "AI classifies them instantly" },
                  { icon: <Lock size={14} className="text-aw-green" />, text: "Read-only access — we never modify your data" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-aw-green-light/60 px-4 py-3">
                    {item.icon}
                    <span className="text-sm font-semibold text-aw-slate">{item.text}</span>
                  </div>
                ))}
              </div>

              <a href="/api/auth/xero"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-aw-green py-3.5 text-sm font-bold text-white transition hover:bg-aw-green-dark active:scale-95 shadow-lg shadow-aw-green/20">
                <Link2 size={16} /> Connect Xero
              </a>

              <button onClick={skipXero}
                className="mt-3 w-full rounded-xl border border-aw-gray-border py-3 text-sm font-semibold text-aw-slate-mid transition hover:text-aw-slate hover:border-aw-slate/40 active:scale-95">
                Skip for now — I&apos;ll connect later
              </button>
            </motion.div>
          )}

          {/* ── Step 3: Done ─────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="step3"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-aw-green shadow-xl shadow-aw-green/30"
                >
                  <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
                </motion.div>

                <h1 className="text-2xl font-black text-aw-slate mb-2">
                  You&apos;re all set! 🎉
                </h1>
                <p className="text-sm text-aw-slate-mid font-medium max-w-xs mx-auto">
                  Your EcoLink account is ready. Head to your dashboard to start tracking your carbon footprint.
                </p>

                <div className="mt-6 space-y-3 text-left rounded-2xl bg-aw-gray/60 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-aw-slate-mid mb-3">
                    What to do next
                  </p>
                  {[
                    "Connect Xero or upload a CSV to import transactions",
                    "Run the AI classifier to auto-categorise spend",
                    "Generate your first AASB S2 carbon report",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aw-green text-[10px] font-black text-white mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-aw-slate font-medium">{item}</span>
                    </div>
                  ))}
                </div>

                <button onClick={goToDashboard}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-aw-green py-3.5 text-sm font-bold text-white transition hover:bg-aw-green-dark active:scale-95 shadow-lg shadow-aw-green/20">
                  Go to Dashboard <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <p className="mt-6 text-xs text-aw-slate-mid text-center">
        By signing up you agree to our{" "}
        <span className="font-semibold text-aw-slate">Terms of Service</span> and{" "}
        <span className="font-semibold text-aw-slate">Privacy Policy</span>.
        <br />Protected under the Australian Privacy Act 1988.
      </p>
    </div>
  );
}
