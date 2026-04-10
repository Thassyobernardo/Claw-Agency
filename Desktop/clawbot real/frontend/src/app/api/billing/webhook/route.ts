/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler. Verifies the signature then updates the company's
 * plan and subscription status in PostgreSQL.
 *
 * Events handled:
 *   checkout.session.completed        → activate subscription
 *   customer.subscription.updated     → plan change / renewal
 *   customer.subscription.deleted     → downgrade to 'starter' (free tier)
 *   invoice.payment_failed            → log warning (don't downgrade immediately)
 *
 * IMPORTANT: This route must NOT use getServerSession (no cookies).
 * It must read the raw body to verify the Stripe signature.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { sql } from "@/lib/db";

const PLAN_MAP: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER       ?? "price_starter"]:       "starter",
  [process.env.STRIPE_PRICE_PROFESSIONAL  ?? "price_professional"]:  "professional",
  [process.env.STRIPE_PRICE_ENTERPRISE    ?? "price_enterprise"]:     "enterprise",
};

async function setPlan(companyId: string, plan: string, expiresAt: Date | null) {
  await sql`
    UPDATE companies
    SET plan = ${plan}, plan_expires_at = ${expiresAt}, updated_at = NOW()
    WHERE id = ${companyId}::uuid
  `;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body       = await request.text();
  const signature  = request.headers.get("stripe-signature") ?? "";
  const secret     = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("[webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  console.log("[webhook] Event:", event.type);

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object as {
          metadata?: Record<string, string>;
          subscription?: string;
        };
        const companyId = session.metadata?.company_id;
        const plan      = session.metadata?.plan ?? "starter";
        if (!companyId) break;

        // Get subscription end date
        let expiresAt: Date | null = null;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          expiresAt = new Date((sub as { current_period_end: number }).current_period_end * 1000);
        }
        await setPlan(companyId, plan, expiresAt);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as {
          metadata?: Record<string, string>;
          items: { data: Array<{ price: { id: string } }> };
          current_period_end: number;
          status: string;
        };
        const companyId = sub.metadata?.company_id;
        if (!companyId) break;

        const priceId = sub.items.data[0]?.price?.id;
        const plan    = PLAN_MAP[priceId] ?? "starter";
        const expires = sub.status === "active"
          ? new Date(sub.current_period_end * 1000)
          : null;
        await setPlan(companyId, plan, expires);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as { metadata?: Record<string, string> };
        const companyId = sub.metadata?.company_id;
        if (!companyId) break;
        // Downgrade to free starter, clear expiry
        await setPlan(companyId, "starter", null);
        break;
      }

      case "invoice.payment_failed": {
        // Log only — don't downgrade immediately, Stripe will retry
        const invoice = event.data.object as { customer?: string };
        console.warn("[webhook] Payment failed for customer:", invoice.customer);
        break;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook] Handler error:", msg);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
