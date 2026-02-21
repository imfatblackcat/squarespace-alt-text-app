import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import db from "@/lib/db";
import { PLANS, getPlanCredits } from "@/lib/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const storeId = session.metadata?.storeId;
    const planCode = session.metadata?.planCode;

    if (storeId && planCode && PLANS[planCode]) {
      const credits = getPlanCredits(planCode);
      await db.store.update({
        where: { id: storeId },
        data: {
          plan: planCode,
          stripeSubscriptionId: session.subscription as string,
          creditsRemaining: credits,
          billingCycleStart: new Date(),
        },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const store = await db.store.findFirst({
      where: { stripeSubscriptionId: sub.id },
    });
    if (store) {
      await db.store.update({
        where: { id: store.id },
        data: { plan: "FREE", stripeSubscriptionId: null, creditsRemaining: 100 },
      });
    }
  }

  if (event.type === "invoice.paid") {
    // Renew credits on monthly billing cycle
    const invoice = event.data.object as Stripe.Invoice;
    const store = await db.store.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });
    if (store && store.plan !== "FREE") {
      await db.store.update({
        where: { id: store.id },
        data: {
          creditsRemaining: getPlanCredits(store.plan),
          creditsUsed: 0,
          billingCycleStart: new Date(),
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
