/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session so users can manage
 * their subscription, update payment methods, and download invoices.
 *
 * Response 200: { url: string }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const companies = await sql<Array<{ stripe_customer_id: string | null }>>`
    SELECT stripe_customer_id FROM companies
    WHERE id = ${session.user.companyId}::uuid LIMIT 1
  `;

  const customerId = companies[0]?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "no_subscription" }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
