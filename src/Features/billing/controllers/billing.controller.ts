import { Request, Response } from "express";
import User from "../../auth/schema/user.schema";
import { HttpError } from "../../../helpers/http-error";
import { PaymentsService } from "../../payments/services/payments.service";
import { SubscriptionUsageService } from "../services/subscription-usage.service";
import {
  normalizePlanId,
  planPricePesewas,
  SUBSCRIPTION_PLANS,
  type PaidSubscriptionPlanId,
} from "../config/subscription-plans";

export class BillingController {
  static async summary(req: Request, res: Response): Promise<void> {
    const businessId = req.businessId;
    if (!businessId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const snap = await SubscriptionUsageService.getSnapshot(businessId);
    const planDef = SUBSCRIPTION_PLANS[snap.plan];

    res.status(200).json({
      success: true,
      message: "Billing summary fetched",
      data: {
        currency: "GHS",
        currentPlan: snap.plan,
        currentPlanLabel: snap.planLabel,
        monthlyPriceGhs: planDef.priceGhs,
        limits: snap.limits,
        usage: snap.usage,
        warnings: snap.warnings,
        overages: snap.overages,
        nearLimit: snap.nearLimit,
        invoices: [] as { date: string; amountLabel: string; status: string; note?: string }[],
      },
    });
  }

  static async initializeSubscription(req: Request, res: Response): Promise<void> {
    const businessId = req.businessId;
    const ownerId = req.currentUser?.id;
    if (!businessId || !ownerId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const plan = (req.body as { plan: PaidSubscriptionPlanId }).plan;
    const current = normalizePlanId(await SubscriptionUsageService.getPlanForBusiness(businessId));
    SubscriptionUsageService.assertUpgradeAllowed(current, plan);

    const user = await User.findById(ownerId).select("email").lean();
    const email = typeof user?.email === "string" ? user.email.trim() : "";
    if (!email) {
      throw new HttpError("Account email is required for checkout", 400);
    }

    const amountPesewas = planPricePesewas(plan);
    const checkout = await PaymentsService.initializePlatformSubscription({
      email,
      amountPesewas,
      businessId,
      plan,
    });

    res.status(200).json({
      success: true,
      message: "Checkout initialized",
      data: {
        authorizationUrl: checkout.authorizationUrl,
        reference: checkout.reference,
        currency: "GHS",
        amountPesewas,
        plan,
      },
    });
  }
}
