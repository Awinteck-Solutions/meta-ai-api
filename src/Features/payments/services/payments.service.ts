import axios from "axios";
import * as crypto from "crypto";
import { env } from "../../../config/env";
import Booking from "../../bookings/schema/booking.schema";
import Order from "../../orders/schema/order.schema";
import Business from "../../businesses/schema/business.schema";
import { HttpError } from "../../../helpers/http-error";
import { logger } from "../../../helpers/logger";
import type { PaidSubscriptionPlanId } from "../../billing/config/subscription-plans";

export class PaymentsService {
  /** Paystack secret for this business when “own payments” is enabled; otherwise null. */
  static async resolvePaystackSecretForBusiness(businessId: string): Promise<string | null> {
    if (!businessId) return null;
    try {
      const b = await Business.findById(businessId).select("paystackOwnPaymentsEnabled paystackSecretKey").lean();
      if (!b) return null;
      if (b.paystackOwnPaymentsEnabled && b.paystackSecretKey && String(b.paystackSecretKey).trim()) {
        return String(b.paystackSecretKey).trim();
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  static async createPaymentLink(payload: {
    businessId: string;
    amount: number;
    email: string;
    orderId?: string;
    bookingId?: string;
  }) {
    const attachReference = async (reference: string) => {
      if (payload.orderId) {
        await Order.findOneAndUpdate(
          { _id: payload.orderId, businessId: payload.businessId },
          { $set: { paymentReference: reference } }
        );
      }

      if (payload.bookingId) {
        await Booking.findOneAndUpdate(
          { _id: payload.bookingId, businessId: payload.businessId },
          { $set: { paymentReference: reference } }
        );
      }
    };

    const ownSecret = await this.resolvePaystackSecretForBusiness(payload.businessId);
    const effectiveSecret = (ownSecret || (env.paystackSecret || "").trim()) || "";

    if (!effectiveSecret) {
      const paymentReference = `offline_${crypto.randomUUID()}`;
      await attachReference(paymentReference);
      return {
        paymentReference,
        authorizationUrl: "",
        status: "pending",
      };
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: payload.email,
        amount: Math.round(payload.amount * 100),
        currency: "GHS",
        metadata: {
          businessId: payload.businessId,
          orderId: payload.orderId || null,
          bookingId: payload.bookingId || null,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${effectiveSecret}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentReference = response.data.data.reference;
    await attachReference(paymentReference);

    logger.info("Payment link created", {
      paymentReference,
      authorizationUrl: response.data.data.authorization_url,
      usedOwnPaystack: Boolean(ownSecret),
    });
    return {
      paymentReference,
      authorizationUrl: response.data.data.authorization_url,
      status: "pending",
    };
  }

  /**
   * Verifies Paystack HMAC: tries the business key from `metadata.businessId` first (own payments),
   * then falls back to `PAYSTACK_SECRET`. If no env secret is set, accepts any webhook (legacy dev behavior).
   */
  static async verifyPaymentWebhook(signature: string, rawBody: string): Promise<boolean> {
    const sig = String(signature || "").trim();
    if (!sig) return false;

    const match = (secret: string) =>
      crypto.createHmac("sha512", secret).update(rawBody, "utf8").digest("hex") === sig;

    let event: { data?: { metadata?: { businessId?: unknown } } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return false;
    }

    const bid = event?.data?.metadata?.businessId;
    if (typeof bid === "string" && bid) {
      const own = await PaymentsService.resolvePaystackSecretForBusiness(bid);
      if (own && match(own)) return true;
    }

    const envSecret = (env.paystackSecret || "").trim();
    if (envSecret) return match(envSecret);

    return true;
  }

  static async handleSuccessfulPayment(reference: string): Promise<void> {
    const order = await Order.findOneAndUpdate(
      { paymentReference: reference },
      { $set: { status: "paid" } },
      { new: true }
    );

    if (order) {
      return;
    }

    const booking = await Booking.findOneAndUpdate(
      { paymentReference: reference },
      { $set: { status: "paid" } },
      { new: true }
    );

    if (!booking) {
      throw new HttpError("No order or booking found for payment reference", 404);
    }
  }

  /**
   * SaaS subscription checkout — always uses `PAYSTACK_SECRET` from env (platform account),
   * not the business’s own Paystack key.
   */
  static async initializePlatformSubscription(payload: {
    email: string;
    amountPesewas: number;
    businessId: string;
    plan: PaidSubscriptionPlanId;
  }): Promise<{ authorizationUrl: string; reference: string }> {
    const secret = (env.paystackSecret || "").trim();
    if (!secret) {
      throw new HttpError("Paystack is not configured (set PAYSTACK_SECRET in .env)", 503);
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: payload.email,
        amount: payload.amountPesewas,
        currency: "GHS",
        callback_url: `${env.frontendUrl}/dashboard/billing?subscription=success`,
        metadata: {
          type: "subscription",
          businessId: payload.businessId,
          plan: payload.plan,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      }
    );

    const d = response.data?.data;
    const authorizationUrl = String(d?.authorization_url || "");
    const reference = String(d?.reference || "");
    if (!authorizationUrl || !reference) {
      throw new HttpError("Paystack did not return a checkout URL", 502);
    }

    logger.info("Subscription checkout initialized", {
      businessId: payload.businessId,
      plan: payload.plan,
      reference,
    });

    return { authorizationUrl, reference };
  }

  /** Returns true when metadata matched a subscription payment and the business plan was updated. */
  static async tryApplySubscriptionFromWebhookMetadata(meta: unknown): Promise<boolean> {
    if (!meta || typeof meta !== "object") return false;
    const m = meta as Record<string, unknown>;
    if (String(m.type) !== "subscription") return false;

    const bid = String(m.businessId ?? "").trim();
    const plan = String(m.plan ?? "").trim() as PaidSubscriptionPlanId;
    if (!bid || !["starter", "growth", "business"].includes(plan)) {
      logger.warn("Subscription webhook metadata incomplete", { bid, plan });
      return true;
    }

    const updated = await Business.findByIdAndUpdate(
      bid,
      { $set: { subscriptionPlan: plan } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      logger.warn("Subscription payment: business not found", { bid });
    } else {
      logger.info("Subscription upgraded via Paystack", { businessId: bid, plan });
    }
    return true;
  }
}
