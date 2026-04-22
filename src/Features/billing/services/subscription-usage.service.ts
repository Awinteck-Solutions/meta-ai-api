import mongoose from "mongoose";
import Business from "../../businesses/schema/business.schema";
import Message from "../../messages/schema/message.schema";
import Customer from "../../customers/schema/customer.schema";
import Catalog from "../../catalog/schema/catalog.schema";
import Faq from "../../faq/schema/faq.schema";
import { HttpError } from "../../../helpers/http-error";
import {
  normalizePlanId,
  planRank,
  type PaidSubscriptionPlanId,
  type PlanLimits,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from "../config/subscription-plans";

export type UsageCounts = {
  messagesThisMonth: number;
  customers: number;
  catalogItems: number;
  faqs: number;
};

export type UsageMetricKey = keyof PlanLimits;

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

export class SubscriptionUsageService {
  static async getPlanForBusiness(businessId: string): Promise<SubscriptionPlanId> {
    const b = await Business.findById(businessId).select("subscriptionPlan").lean();
    return normalizePlanId(b?.subscriptionPlan as string | undefined);
  }

  static async countUsage(businessId: string): Promise<UsageCounts> {
    const bid = new mongoose.Types.ObjectId(businessId);
    const monthStart = startOfUtcMonth();
    const [messagesThisMonth, customers, catalogItems, faqs] = await Promise.all([
      Message.countDocuments({ businessId: bid, createdAt: { $gte: monthStart } }),
      Customer.countDocuments({ businessId: bid }),
      Catalog.countDocuments({ businessId: bid }),
      Faq.countDocuments({ businessId: bid }),
    ]);
    return { messagesThisMonth, customers, catalogItems, faqs };
  }

  static buildWarnings(
    plan: SubscriptionPlanId,
    usage: UsageCounts,
    limits: PlanLimits
  ): { warnings: string[]; overages: UsageMetricKey[]; nearLimit: UsageMetricKey[] } {
    const warnings: string[] = [];
    const overages: UsageMetricKey[] = [];
    const nearLimit: UsageMetricKey[] = [];
    const pct = (u: number, cap: number) => (cap <= 0 ? 0 : Math.min(100, Math.round((u / cap) * 100)));

    const check = (key: UsageMetricKey, label: string, used: number, cap: number) => {
      if (used >= cap) {
        overages.push(key);
        warnings.push(`${label}: ${used}/${cap} — plan limit reached. Upgrade your subscription to continue growing.`);
      } else if (cap > 0 && used / cap >= 0.9) {
        nearLimit.push(key);
        warnings.push(`${label}: ${used}/${cap} (${pct(used, cap)}%) — approaching your ${SUBSCRIPTION_PLANS[plan].label} plan limit.`);
      }
    };

    check("messagesPerMonth", "AI messages this month", usage.messagesThisMonth, limits.messagesPerMonth);
    check("customers", "Customers", usage.customers, limits.customers);
    check("catalogItems", "Catalog items", usage.catalogItems, limits.catalogItems);
    check("faqs", "FAQ entries", usage.faqs, limits.faqs);

    return { warnings, overages, nearLimit };
  }

  static async getSnapshot(businessId: string) {
    const plan = await this.getPlanForBusiness(businessId);
    const limits = SUBSCRIPTION_PLANS[plan].limits;
    const usage = await this.countUsage(businessId);
    const { warnings, overages, nearLimit } = this.buildWarnings(plan, usage, limits);

    return {
      plan,
      planLabel: SUBSCRIPTION_PLANS[plan].label,
      priceGhs: SUBSCRIPTION_PLANS[plan].priceGhs,
      limits,
      usage,
      warnings,
      overages,
      nearLimit,
    };
  }

  static async assertCanAddCustomer(businessId: string): Promise<void> {
    const { limits } = SUBSCRIPTION_PLANS[await this.getPlanForBusiness(businessId)];
    const n = await Customer.countDocuments({ businessId: new mongoose.Types.ObjectId(businessId) });
    if (n >= limits.customers) {
      throw new HttpError(
        `Customer limit reached (${limits.customers}) for your plan. Upgrade to add more customers.`,
        403
      );
    }
  }

  static async assertCanCreateCatalogItem(businessId: string): Promise<void> {
    const { limits } = SUBSCRIPTION_PLANS[await this.getPlanForBusiness(businessId)];
    const n = await Catalog.countDocuments({ businessId: new mongoose.Types.ObjectId(businessId) });
    if (n >= limits.catalogItems) {
      throw new HttpError(
        `Catalog limit reached (${limits.catalogItems}) for your plan. Upgrade to add more products or services.`,
        403
      );
    }
  }

  static async assertCanCreateFaq(businessId: string): Promise<void> {
    const { limits } = SUBSCRIPTION_PLANS[await this.getPlanForBusiness(businessId)];
    const n = await Faq.countDocuments({ businessId: new mongoose.Types.ObjectId(businessId) });
    if (n >= limits.faqs) {
      throw new HttpError(`FAQ limit reached (${limits.faqs}) for your plan. Upgrade to add more FAQs.`, 403);
    }
  }

  static async assertCanCreateMessage(businessId: string): Promise<void> {
    const { limits } = SUBSCRIPTION_PLANS[await this.getPlanForBusiness(businessId)];
    const monthStart = startOfUtcMonth();
    const n = await Message.countDocuments({
      businessId: new mongoose.Types.ObjectId(businessId),
      createdAt: { $gte: monthStart },
    });
    if (n >= limits.messagesPerMonth) {
      throw new HttpError(
        `Monthly AI message limit reached (${limits.messagesPerMonth}) for your plan. Upgrade for a higher allowance.`,
        403
      );
    }
  }

  /** Returns false when inbound AI traffic should be blocked for this month. */
  static async canAcceptInboundAiMessage(businessId: string): Promise<boolean> {
    try {
      await this.assertCanCreateMessage(businessId);
      return true;
    } catch {
      return false;
    }
  }

  static assertUpgradeAllowed(currentPlan: SubscriptionPlanId, target: PaidSubscriptionPlanId): void {
    if (planRank(currentPlan) >= planRank(target)) {
      throw new HttpError("You are already on this plan or a higher tier.", 400);
    }
  }
}
