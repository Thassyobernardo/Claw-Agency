"use client";

/**
 * /onboarding
 *
 * 4-step guided onboarding for new EcoLink customers.
 *
 * Step 0 — Account   : name, email, password
 * Step 1 — Business  : company name, ABN, state, industry
 * Step 2 — Connect   : Xero OAuth (skippable — can connect later in dashboard)
 * Step 3 — Done      : summary + link to dashboard
 *
 * Registration occurs at end of Step 1. After that the user has a session
 * and the "Connect Xero" step is active.
 *
 * Xero callback returns to /onboarding?step=2&xero=connected so the page
 * can advance automatically to Step 3.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf, ArrowRight, ArrowLeft, Eye, EyeOff, Loader2,
  Building2, User, Link2, CheckCircle2, Zap, FileBarChart2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect, Suspense } from "react";
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

const STEP_LABELS = ["Account", "Business", "Connect Xero", "Ready"];
const TOTAL_STEPS = 4;

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  email:        string;
  password:     string;
  name:         string;
  company_name: string;
  abn:          string;
  state:        string;
  industry:     string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <motion.div
            animate={{
              width:           i <= current ? 28 : 8,
              backgroundColor: i < current ? "#16a34a" : i === current ? "#1a2e44" : "#e5e7eb",
            }}
            className="h-2 rounded-full"
          />
          {i < total - 1 && <div className="h-px w-3 bg-slate-200" />}
        </div>
      ))}
      <span className="ml-2 text-xs font-semibold text-slate-500">
        Step {current + 1} of {total} — {STEP_LABELS[current]}
      </span>
    </div>
  );
}

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
      } px-4 py-3 text-sm text-aw-slate placeholder-slate-400 outline-none transition
        focus:border-aw-green focus:ring-2 focus:ring-aw-green/20 ${className}`}
    />
  );
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────

function OnboardingInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [xeroOrg, setXeroOrg] = useState<string | null>(null);
  const [errors,  setErrors]  = useState<Partial<Record<keyof FormData | "global", string>>>({});

  const [form, setForm] = useState<FormData>({
    email: "", password: "", name: "",
    company_name: "", abn: "", state: "", industry: "",
  });

  const set = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // Detect return from Xero OAuth
  useEffect(() => {
    const xeroParam = searchParams.get("xero");
    const stepParam = searchParams.get("step");
    const orgParam  = searchParams.get("org");

    if (xeroParam === "connected" && stepParam === "2") {
      setXeroOrg(orgParam ?? "your Xero organisation");
      setStep(3);
      // Clean URL
      window.history.replaceState({}, "", "/onboarding");
    }
  }, [searchParams]);

  // ── Validation ─────────────────────────────────────────────────────────
  function validateStep0(): boolean {
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
      errs.password = "Must contain a special character (!@#$…)";
    if (!form.name.trim())
      errs.name = "Enter your full name";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep1(): boolean {
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

  // ── Register (after Step 1) ─────────────────────────────────────────────
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
          state:        form.state    || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "email_taken") {
          setErrors({ email: "This email is already registered. Try logging in." });
          setStep(0);
        } else if (data.field) {
          setErrors({ [data.field]: data.error.replace(/_/g, " ") });
          if (["company_name","abn","state","industry"].includes(data.field)) setStep(1);
          else setStep(0);
        } else {
          setErrors({ global: data.error || "Something went wrong. Please try again." });
        }
        return;
      }
      // Success — move to Xero connect step
      setStep(2);
    } catch (e: unknown) {
      setErrors({ global: `Could not reach server: ${e instanceof Error ? e.message : "network error"}` });
    } finally {
      setLoading(false);
    }
  }, [form]);

  const handleNext = useCallback(async () => {
    if (step === 0 && validateStep0()) setStep(1);
    else if (step === 1 && validateStep1()) await register();
  }, [step, register]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex flex-col items-center justify-center px-4 py-12">

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
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"
      >
        <StepDots current={step} total={TOTAL_STEPS} />

        <AnimatePresence mode="wait">

          {/* ── Step 0: Account ──────────────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="step0"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-aw-green-light mb-3">
                  <User size={22} className="text-aw-green" />
                </div>
                <h1 className="text-2xl font-black text-aw-slate">Create your account</h1>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  Start your 14-day free trial. Cancel before it ends — no charge.
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
                <Field label="Password"
                  hint="Min 10 chars · upper · lower · number · symbol"
                  error={errors.password}>
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} placeholder="••••••••"
                      value={form.password} onChange={(e) => set("password", e.target.value)}
                      error={!!errors.password} className="pr-12" />
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
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

              <p className="mt-4 text-center text-xs text-slate-500">
                Already have an account?{" "}
                <Link href="/login" className="font-bold text-aw-green hover:underline">Sign in</Link>
              </p>
            </motion.div>
          )}

          {/* ── Step 1: Business ─────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 mb-3">
                  <Building2 size={22} className="text-blue-600" />
                </div>
                <h1 className="text-2xl font-black text-aw-slate">About your business</h1>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  We use this to match NGA emission factors to your industry and state.
                </p>
              </div>

              <div className="space-y-4">
                <Field label="Company name" error={errors.company_name}>
                  <Input placeholder="Acme Building Supplies Pty Ltd"
                    value={form.company_name} onChange={(e) => set("company_name", e.target.value)}
                    error={!!errors.company_name} autoFocus />
                </Field>
                <Field label="ABN" hint="11-digit Australian Business Number" error={errors.abn}>
                  <Input placeholder="51 824 753 556" value={form.abn}
                    onChange={(e) => set("abn", e.target.value.replace(/[^\d\s]/g, ""))}
                    error={!!errors.abn} maxLength={14} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="State" error={errors.state}>
                    <select value={form.state} onChange={(e) => set("state", e.target.value)}
                      className={`w-full rounded-xl border ${errors.state ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"} px-4 py-3 text-sm text-aw-slate outline-none focus:border-aw-green focus:ring-2 focus:ring-aw-green/20 transition`}>
                      <option value="">Select…</option>
                      {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Industry" error={errors.industry}>
                    <select value={form.industry} onChange={(e) => set("industry", e.target.value)}
                      className={`w-full rounded-xl border ${errors.industry ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"} px-4 py-3 text-sm text-aw-slate outline-none focus:border-aw-green focus:ring-2 focus:ring-aw-green/20 transition`}>
                      <option value="">Select…</option>
                      {INDUSTRIES.map((ind) => <option key={ind.value} value={ind.value}>{ind.label}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {errors.global && (
                <p className="mt-3 text-xs font-semibold text-red-500">{errors.global}</p>
              )}

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(0)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-aw-slate transition hover:border-slate-400 active:scale-95">
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

          {/* ── Step 2: Connect Xero ─────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#13B5EA]/10 mb-3">
                  <Link2 size={22} className="text-[#13B5EA]" />
                </div>
                <h1 className="text-2xl font-black text-aw-slate">Connect Xero</h1>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  We read your transactions to calculate your carbon footprint. Read-only access — we never modify your data.
                </p>
              </div>

              {/* What Xero connect enables */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-5 space-y-2">
                {[
                  { icon: Zap,            text: "Auto-import last 12 months of transactions" },
                  { icon: FileBarChart2,  text: "AI classifies each line item to a GHG category" },
                  { icon: CheckCircle2,   text: "Draft AASB S2 report ready in under 10 minutes" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                    <Icon size={15} className="shrink-0 text-aw-green" />
                    {text}
                  </div>
                ))}
              </div>

              <a
                href="/api/integrations/xero?returnTo=/onboarding?step=2"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#13B5EA] py-3.5 text-sm font-bold text-white transition hover:bg-[#0ea5d8] active:scale-95"
              >
                <svg width="18" height="18" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <path d="M20 0C9 0 0 9 0 20s9 20 20 20 20-9 20-20S31 0 20 0z" fill="white" fillOpacity=".15"/>
                  <path d="M28.4 16.1c-.5 0-.9.4-.9.9s.4.9.9.9.9-.4.9-.9-.4-.9-.9-.9zm-8.8-4.5c-4.6 0-8.4 3.7-8.4 8.4s3.7 8.4 8.4 8.4 8.4-3.7 8.4-8.4-3.8-8.4-8.4-8.4zm0 13.9c-3.1 0-5.6-2.5-5.6-5.6s2.5-5.6 5.6-5.6 5.6 2.5 5.6 5.6-2.5 5.6-5.6 5.6z" fill="white"/>
                </svg>
                Connect with Xero
              </a>

              <button
                onClick={() => setStep(3)}
                className="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 active:scale-95"
              >
                Skip for now — I&apos;ll connect later
              </button>

              <p className="mt-4 text-center text-xs text-slate-400">
                You can connect Xero at any time from your dashboard settings.
              </p>
            </motion.div>
          )}

          {/* ── Step 3: Done ─────────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="step3"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-center mb-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aw-green-light mx-auto mb-4">
                  <CheckCircle2 size={30} className="text-aw-green" />
                </div>
                <h1 className="text-2xl font-black text-aw-slate">
                  {xeroOrg ? "Xero connected!" : "Account created!"}
                </h1>
                <p className="text-sm text-slate-500 mt-2 font-medium">
                  {xeroOrg
                    ? `${xeroOrg} is connected. Your first report will be ready in minutes.`
                    : "Check your email to verify your account, then go to your dashboard."}
                </p>
              </div>

              {/* Next steps */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">What happens next</p>
                {[
                  xeroOrg ? "✅ Xero connected — transactions importing now" : "📧 Verify your email to activate your account",
                  "🤖 AI classifies each transaction to Scope 1, 2 or 3",
                  "📄 Review & approve — then generate your AASB S2 report PDF",
                ].map((item) => (
                  <p key={item} className="text-sm text-slate-600 font-medium">{item}</p>
                ))}
              </div>

              <button
                onClick={() => router.push("/dashboard")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-aw-green py-3.5 text-sm font-bold text-white transition hover:bg-aw-green-dark active:scale-95"
              >
                Go to Dashboard <ArrowRight size={16} />
              </button>

              {!xeroOrg && (
                <p className="mt-3 text-center text-xs text-slate-400">
                  Didn&apos;t receive the email?{" "}
                  <Link href="/login" className="font-bold text-aw-green hover:underline">Resend from login page</Link>
                </p>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <p className="mt-6 text-xs text-slate-400 text-center">
        By signing up you agree to our Terms of Service and Privacy Policy.
        <br />Protected under the Australian Privacy Act 1988.
      </p>
    </div>
  );
}

// ─── Wrapper with Suspense (required for useSearchParams) ─────────────────────

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}
