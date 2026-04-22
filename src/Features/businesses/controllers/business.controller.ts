import { Request, Response } from "express";
import { BusinessService } from "../services/business.service";

/** Never expose raw Paystack secret in API responses. */
function sanitizeBusinessForClient(business: unknown): Record<string, unknown> {
  if (business == null || typeof business !== "object") {
    return {};
  }
  const doc = business as { toObject?: (opts?: unknown) => Record<string, unknown> };
  const o = typeof doc.toObject === "function" ? { ...doc.toObject() } : { ...(business as Record<string, unknown>) };
  const raw = o.paystackSecretKey;
  const configured = Boolean(raw != null && String(raw).trim().length > 0);
  delete o.paystackSecretKey;
  o.paystackSecretKeyConfigured = configured;

  if (o.whatsapp != null && typeof o.whatsapp === "object") {
    const wa = { ...(o.whatsapp as Record<string, unknown>) };
    const tok = wa.accessToken;
    wa.accessTokenConfigured = Boolean(tok != null && String(tok).trim().length > 0);
    delete wa.accessToken;
    o.whatsapp = wa;
  }

  return o;
}

export class BusinessController {
  static async create(req: Request, res: Response): Promise<void> {
    const ownerId = req["currentUser"]?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const business = await BusinessService.create(ownerId, req.body);
    res.status(201).json({
      success: true,
      message: "Business created",
      data: sanitizeBusinessForClient(business),
    });
  }

  static async getOne(req: Request, res: Response): Promise<void> {
    const ownerId = req["currentUser"]?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const business = await BusinessService.getByOwner(ownerId);
    res.status(200).json({
      success: true,
      message: "Business fetched",
      data: sanitizeBusinessForClient(business),
    });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const ownerId = req["currentUser"]?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const business = await BusinessService.update(ownerId, req.body);
    res.status(200).json({
      success: true,
      message: "Business updated",
      data: sanitizeBusinessForClient(business),
    });
  }

  static async testWhatsapp(req: Request, res: Response): Promise<void> {
    const ownerId = req["currentUser"]?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const result = await BusinessService.testWhatsappConnection(ownerId);
    res.status(200).json({ success: true, message: result.message, data: result });
  }

  /** Returns the stored secret for the authenticated owner only (dashboard edit). Not included in generic GET /business. */
  static async getPaystackSecret(req: Request, res: Response): Promise<void> {
    const ownerId = req["currentUser"]?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const business = await BusinessService.getByOwner(ownerId);
    const o = business.toObject() as {
      paystackOwnPaymentsEnabled?: boolean;
      paystackSecretKey?: string | null;
    };
    const enabled = Boolean(o.paystackOwnPaymentsEnabled);
    const raw = o.paystackSecretKey;
    const key =
      enabled && raw != null && String(raw).trim() ? String(raw).trim() : null;

    res.status(200).json({
      success: true,
      data: { paystackSecretKey: key },
    });
  }
}
