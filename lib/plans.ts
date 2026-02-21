export interface PlanDefinition {
  code: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
  recommended?: boolean;
  stripePriceId?: string;
}

export const PLANS: Record<string, PlanDefinition> = {
  FREE: {
    code: "FREE",
    name: "Free Trial",
    price: 0,
    credits: 100,
    features: ["100 One-time Credits", "Bulk Generation", "Email Support"],
  },
  STARTER: {
    code: "STARTER",
    name: "Starter",
    price: 5,
    credits: 250,
    features: ["250 Credits/mo", "Bulk Generation", "Email Support"],
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
  },
  GROWTH: {
    code: "GROWTH",
    name: "Growth",
    price: 29,
    credits: 1000,
    features: ["1,000 Credits/mo", "Bulk Generation", "Email Support"],
    recommended: true,
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID,
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    price: 79,
    credits: 5000,
    features: [
      "5,000 Credits/mo",
      "Bulk Generation",
      "Auto-Processing",
      "Priority Support",
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
};

export const PLAN_ORDER = ["FREE", "STARTER", "GROWTH", "PRO"];

export function getPlanCredits(plan: string): number {
  return PLANS[plan]?.credits ?? 100;
}

export function getPlanName(plan: string): string {
  return PLANS[plan]?.name ?? "Free Trial";
}

export function isUpgrade(currentPlan: string, targetPlan: string): boolean {
  return PLAN_ORDER.indexOf(targetPlan) > PLAN_ORDER.indexOf(currentPlan);
}
