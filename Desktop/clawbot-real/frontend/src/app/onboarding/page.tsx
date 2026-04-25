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
  Leaf, ArrowRight, ArrowLeft, Eye, EyeOff,
  Loader2, Building2, User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { isValidAbn } from "@/lib/validators";

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

// Pós-registro o usuário é redirecionado p/ /login para verificar email,
// e o WelcomeGuide modal cobre a parte de "Connect Xero" no dashboard.
const STEP_LABELS = ["Account", "Business"];

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
    if (form.password.length < 10)
      errs.password = "At least 10 characters";
    else if (!/[A-Z]/.test(form.password))
      errs.password = "Must contain an uppercase letter";
    else if (!/[a-z]/.test(form.password))
      errs.password = "Must contain a lowercase letter";
    else if (!/[0-9]/.test(form.password))
      errs.password = "Must contain a number";
    else if (!/[^A-Za-z0-9]/.test(form.password))
      errs.password = "Must contain a special character (e.g. !@#$)";
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
    const cleanAbn = form.abn.replace(/[\s-]/g, "");
    if (!cleanAbn)
      errs.abn = "ABN is required";
    else if (!/^\d{11}$/.test(cleanAbn))
      errs.abn = "ABN must be 11 digits (e.g. 51 824 753 556)";
    else if (!isValidAbn(cleanAbn))
      errs.abn = "ABN checksum is invalid — please double-check the number";
    if (!form.state)
      errs.state = "Select your state";
    if (!form.industry)
      errs.industry = "Select your industry";
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
          setErrors({ global: data.error || "Something went wrong. Please try again." });
        }
        return;
      }

      // Registration successful — redirect to login with email-check notice
      router.push("/login?check_email=1");

    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Network error";
      setErrors({ global: `Could not reach server: ${m}` });
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
        <StepDots current={step} total={2} />

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
                  Start your free 14-day trial. Cancel any time before it ends and you won&apos;t be charged.
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

                <Field label="Password" hint="Min 10 chars · uppercase · lowercase · number · symbol" error={errors.password}>
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

                <Field label="ABN *" hint="11-digit Australian Business Number"
                  error={errors.abn}>
                  <Input placeholder="51 824 753 556" value={form.abn}
                    onChange={(e) => set("abn", e.target.value.replace(/[^\d\s]/g, ""))}
                    error={!!errors.abn} maxLength={14} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="State *" error={errors.state}>
                    <select value={form.state} onChange={(e) => set("state", e.target.value)}
                      className={`w-full rounded-xl border ${errors.state ? "border-red-400 bg-red-50" : "border-aw-gray-border bg-white"} px-4 py-3 text-sm text-aw-slate outline-none focus:border-aw-green focus:ring-2 focus:ring-aw-green/20 transition`}>
                      <option value="">Select…</option>
                      {AU_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Industry *" error={errors.industry}>
                    <select value={form.industry} onChange={(e) => set("industry", e.target.value)}
                      className={`w-full rounded-xl border ${errors.industry ? "border-red-400 bg-red-50" : "border-aw-gray-border bg-white"} px-4 py-3 text-sm text-aw-slate outline-none focus:border-aw-green focus:ring-2 focus:ring-aw-green/20 transition`}>
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
