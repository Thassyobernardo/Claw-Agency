/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for a given plan.
 * Redirects the user to Stripe's hosted checkout page.
 *
 * Body: { plan: "starter" | "professional" | "enterprise" }
 *
 * Response 200: { url: string }   — Stripe Checkout URL
 * Response 400: { error }
 * Response 401: { error: "unauthenticated" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId || !session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { plan?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const planKey = body.plan as PlanKey;
  if (!planKey || !PLANS[planKey]) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const plan = PLANS[planKey];
  if (!plan.price_id) {
    return NextResponse.json({ error: "price_not_configured" }, { status: 400 });
  }

  try {
    // Fetch or create Stripe customer
    const companies = await sql<Array<{ stripe_customer_id: string | null; name: string }>>`
      SELECT stripe_customer_id, name
      FROM companies WHERE id = ${session.user.companyId}::uuid LIMIT 1
    `;
    if (companies.length === 0) {
      return NextResponse.json({ error: "company_not_found" }, { status: 404 });
    }

    let customerId = companies[0].stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: companies[0].name,
        metadata: { company_id: session.user.companyId },
      });
      customerId = customer.id;
      await sql`
        UPDATE companies SET stripe_customer_id = ${customerId}
        WHERE id = ${session.user.companyId}::uuid
      `;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: plan.price_id, quantity: 1 }],
      mode: "subscription",
      success_url: `${APP_URL}/billing?success=1&plan=${planKey}`,
      cancel_url: `${APP_URL}/billing?cancelled=1`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { company_id: session.user.companyId, plan: planKey },
      },
      metadata: { company_id: session.user.companyId, plan: planKey },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      customer_update: {
        address: "auto",
        name:    "auto",
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("[Stripe Checkout Error]:", err);
    return NextResponse.json({ error: err.message || "Erro desconhecido no Stripe" }, { status: 500 });
  }
}

