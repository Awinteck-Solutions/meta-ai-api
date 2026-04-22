/** Paid plans only — checkout rejects `free`. */
export type PaidSubscriptionPlanId = "starter" | "growth" | "business";

/** Includes default `free` for every business until upgraded. */
export type SubscriptionPlanId = "free" | PaidSubscriptionPlanId;

export type PlanLimits = {
  /** Count of Message documents in the current calendar month (UTC). */
  messagesPerMonth: number;
  customers: number;
  catalogItems: number;
  faqs: number;
};

export type PlanDefinition = {
  id: SubscriptionPlanId;
  label: string;
  /** Monthly price in major GHS units (e.g. 149 = GHS 149.00). Zero for free. */
  priceGhs: number;
  limits: PlanLimits;
};

const free: PlanDefinition = {
  id: "free",
  label: "Free",
  priceGhs: 0,
  limits: {
    messagesPerMonth: 75,
    customers: 25,
    catalogItems: 8,
    faqs: 5,
  },
};

const starter: PlanDefinition = {
  id: "starter",
  label: "Starter",
  priceGhs: 149,
  limits: {
    messagesPerMonth: 400,
    customers: 120,
    catalogItems: 40,
    faqs: 20,
  },
};

const growth: PlanDefinition = {
  id: "growth",
  label: "Growth",
  priceGhs: 449,
  limits: {
    messagesPerMonth: 2000,
    customers: 500,
    catalogItems: 150,
    faqs: 75,
  },
};

const business: PlanDefinition = {
  id: "business",
  label: "Business",
  priceGhs: 999,
  limits: {
    messagesPerMonth: 12000,
    customers: 4000,
    catalogItems: 600,
    faqs: 300,
  },
};

export const SUBSCRIPTION_PLAN_ORDER: SubscriptionPlanId[] = ["free", "starter", "growth", "business"];

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, PlanDefinition> = {
  free,
  starter,
  growth,
  business,
};

export function planRank(plan: string | undefined | null): number {
  const p = (plan || "free") as SubscriptionPlanId;
  const i = SUBSCRIPTION_PLAN_ORDER.indexOf(p);
  return i >= 0 ? i : 0;
}

export function normalizePlanId(raw: string | undefined | null): SubscriptionPlanId {
  if (raw === "starter" || raw === "growth" || raw === "business" || raw === "free") {
    return raw;
  }
  return "free";
}

/** Paystack amount in pesewas (GHS × 100). */
export function planPricePesewas(plan: PaidSubscriptionPlanId): number {
  const def = SUBSCRIPTION_PLANS[plan];
  return Math.round(def.priceGhs * 100);
}
