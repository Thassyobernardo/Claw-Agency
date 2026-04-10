/**
 * EcoLink Australia — Stripe singleton
 *
 * Run `npm install stripe @stripe/stripe-js` before using.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require("stripe");

declare global {
  // eslint-disable-next-line no-var
  var __ecolink_stripe: InstanceType<typeof Stripe> | undefined;
}

function createStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in .env.local");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export const stripe: InstanceType<typeof Stripe> =
  globalThis.__ecolink_stripe ?? (globalThis.__ecolink_stripe = createStripe());

// ── Plan definitions ──────────────────────────────────────────────────────────

export const PLANS = {
  starter: {
    name: "Starter",
    price_aud: 49,
    price_id: process.env.STRIPE_PRICE_STARTER ?? "",
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
  },
  professional: {
    name: "Professional",
    price_aud: 99,
    price_id: process.env.STRIPE_PRICE_PROFESSIONAL ?? "",
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
  },
  enterprise: {
    name: "Enterprise",
    price_aud: 149,
    price_id: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
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
  },
} as const;

export type PlanKey = keyof typeof PLANS;
