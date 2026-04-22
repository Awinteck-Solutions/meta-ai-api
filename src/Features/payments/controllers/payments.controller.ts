import { Request, Response } from "express";
import { PaymentsService } from "../services/payments.service";
import { HttpError } from "../../../helpers/http-error";

export class PaymentsController {
  static async webhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers["x-paystack-signature"];
    const valid = await PaymentsService.verifyPaymentWebhook(
      String(signature || ""),
      req.rawBody || JSON.stringify(req.body || {})
    );

    if (!valid) {
      throw new HttpError("Invalid webhook signature", 401);
    }

    const event = req.body;
    if (event?.event === "charge.success") {
      const meta = event?.data?.metadata;
      const handledSub = await PaymentsService.tryApplySubscriptionFromWebhookMetadata(meta);
      if (handledSub) {
        res.status(200).json({ success: true });
        return;
      }

      const reference = event?.data?.reference;
      if (reference) {
        try {
          await PaymentsService.handleSuccessfulPayment(String(reference));
        } catch (e) {
          if (e instanceof HttpError && e.statusCode === 404) {
            /* not an order/booking reference — ignore */
          } else {
            throw e;
          }
        }
      }
    }

    res.status(200).json({ success: true });
  }
}

