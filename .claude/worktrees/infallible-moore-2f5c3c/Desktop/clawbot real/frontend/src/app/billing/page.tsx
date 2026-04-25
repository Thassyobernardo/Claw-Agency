"use client";

/**
 * /billing — Pricing & Subscription Management
 *
 * Shows the 3 plans (Starter / Professional / Enterprise).
 * - If the company has no active subscription → "Start free trial" → /api/billing/checkout
 * - If they have an active subscription → "Manage billing" → /api/billing/portal
 * Reads the company's current plan from the dashboard summary API so we can
 * highlight the active card and disable the matching CTA.
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Zap, Building2, Rocket, Loader2,
  CreditCard, ArrowLeft, AlertCircle, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  key: "starter" | "professional" | "enterprise";
  name: string;
  price_aud: number;
  description: string;
  features: string[];
  cta: string;
  highlight: boolean;
  icon: React.ReactNode;
}

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    price_aud: 49,
    description: "Perfect for sole traders and micro businesses",
    features: [
      "1 company / 1 user",
      "Up to 500 transactions/month",
      "Xero sync",
      "AI auto-classification",
      "AASB S2 PDF report",
      "Sector benchmarking",
    ],
    cta: "Start free trial",
    highlight: false,
    icon: <Zap className="w-6 h-6" />,
  },
  {
    key: "professional",
    name: "Professional",
    price_aud: 99,
    description: "For growing SMEs that need more power",
    features: [
      "1 company / up to 5 users",
      "Unlimited transactions",
      "Xero + MYOB sync",
      "AI auto-classification + review queue",
      "AASB S1 + S2 reports",
      "Sector benchmarking",
      "Priority email support",
      "Custom emission factors",
    ],
    cta: "Start free trial",
    highlight: true,
    icon: <Rocket className="w-6 h-6" />,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price_aud: 149,
    description: "For multi-entity businesses and accounting firms",
    features: [
      "Up to 5 companies",
      "Unlimited users",
      "All Professional features",
      "Partner portal for accountants",
      "White-label reports",
      "Dedicated onboarding call",
      "Phone + email support",
      "API access",
    ],
    cta: "Start free trial",
    highlight: false,
    icon: <Building2 className="w-6 h-6" />,
  },
];

// ─── Inner page (needs useSearchParams — must be inside Suspense) ─────────────

function BillingContent() {
  const searchParams = useSearchParams();
  const success   = searchParams.get("success") === "1";
  const cancelled = searchParams.get("cancelled") === "1";
  const newPlan   = searchParams.get("plan") ?? "";

  const [currentPlan, setCurrentPlan] = useState<string>("starter");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionPlan, setActionPlan] = useState<string | null>(null); // which button is spinning
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current plan from dashboard summary
  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) return;
      const data = await res.json();
      const plan = data?.company?.plan ?? "starter";
      setCurrentPlan(plan);
      // Consider them subscribed if plan is not starter or if explicitly set after checkout
      setHasSubscription(plan !== "starter" || success);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [success]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCheckout = async (planKey: string) => {
    setError(null);
    setActionPlan(planKey);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "checkout_failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setActionPlan(null);
    }
  };

  const handlePortal = async () => {
    setError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "portal_failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
      {/* ── Header ── */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">EcoLink Billing</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">

        {/* ── Toast notifications ── */}
        <AnimatePresence>
          {success && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mb-8 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-emerald-300">Subscription activated!</p>
                <p className="text-sm text-emerald-400/80">
                  {newPlan
                    ? `You're now on the ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)} plan. Your 14-day trial has started.`
                    : "Your 14-day free trial has started. Welcome to EcoLink!"}
                </p>
              </div>
            </motion.div>
          )}

          {cancelled && (
            <motion.div
              key="cancelled"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mb-8 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4"
            >
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">
                Checkout was cancelled. No charge was made. Choose a plan below whenever you&apos;re ready.
              </p>
            </motion.div>
          )}

          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mb-8 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Hero text ── */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-slate-400 text-lg">
            All plans include a <span className="text-emerald-400 font-medium">14-day free trial</span>.
            No credit card required to start.
          </p>

          {/* Current plan badge */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-sm"
            >
              <span className="text-slate-400">Current plan:</span>
              <span className="font-semibold text-emerald-400 capitalize">{currentPlan}</span>
            </motion.div>
          )}
        </div>

        {/* ── Pricing cards ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {PLANS.map((plan, i) => {
              const isActive    = plan.key === currentPlan;
              const isHighlight = plan.highlight;

              return (
                <motion.div
                  key={plan.key}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`
                    relative rounded-2xl border p-6 flex flex-col
                    ${isHighlight
                      ? "border-emerald-500/60 bg-gradient-to-b from-emerald-900/30 to-slate-900/60 shadow-lg shadow-emerald-900/30"
                      : "border-slate-700/60 bg-slate-900/50"}
                    ${isActive ? "ring-2 ring-emerald-500/50" : ""}
                  `}
                >
                  {/* Most popular badge */}
                  {isHighlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Active badge */}
                  {isActive && (
                    <div className="absolute -top-3 right-4">
                      <span className="bg-slate-700 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500/40">
                        ✓ Your plan
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${isHighlight ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                      {plan.icon}
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">{plan.name}</h2>
                      <p className="text-slate-400 text-xs">{plan.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold">${plan.price_aud}</span>
                      <span className="text-slate-400 text-sm">AUD/month</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Billed monthly · cancel anytime</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isHighlight ? "text-emerald-400" : "text-slate-500"}`} />
                        <span className="text-slate-300">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isActive ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-medium text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Current plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan.key)}
                      disabled={actionPlan !== null}
                      className={`
                        flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all
                        ${isHighlight
                          ? "bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50"
                          : "bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50"}
                        ${actionPlan !== null ? "cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      {actionPlan === plan.key ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        plan.cta
                      )}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Manage subscription section ── */}
        {hasSubscription && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-slate-400" />
                  Manage your subscription
                </h3>
                <p className="text-slate-400 text-sm">
                  Update your payment method, download invoices, or cancel your subscription
                  through the Stripe Customer Portal.
                </p>
              </div>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex-shrink-0 flex items-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 text-sm font-semibold transition-all cursor-pointer"
              >
                {portalLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening portal…
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Open billing portal
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Trial info ── */}
        <div className="mt-10 text-center text-sm text-slate-500 space-y-1">
          <p>
            All plans start with a <strong className="text-slate-400">14-day free trial</strong> — no credit card required.
          </p>
          <p>
            Prices are in Australian dollars (AUD) and exclude GST.
            By subscribing you agree to our{" "}
            <a href="#" className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2">
              Terms of Service
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
