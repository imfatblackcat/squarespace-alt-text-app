import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession } from "@/lib/session";
import db from "@/lib/db";
import { PLANS } from "@/lib/plans";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await db.store.findUnique({ where: { id: session.storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const body = await request.json();
  const planCode = body.plan as string;
  const plan = PLANS[planCode];
  if (!plan || !plan.stripePriceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Create or retrieve Stripe customer
  let customerId = store.stripeCustomerId;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      metadata: { storeId: store.id, siteId: store.siteId },
    });
    customerId = customer.id;
    await db.store.update({ where: { id: store.id }, data: { stripeCustomerId: customerId } });
  }

  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/pricing?success=true`,
    cancel_url: `${appUrl}/pricing?cancelled=true`,
    metadata: { storeId: store.id, planCode },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
