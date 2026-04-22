import { Request, Response } from "express";
import { env } from "../../../config/env";
import { HttpError } from "../../../helpers/http-error";
import { BusinessService } from "../../businesses/services/business.service";
import type { FinalizeWhatsappConnectDto } from "../dto/finalize-whatsapp-connect.dto";
import { WhatsappConnectService } from "../services/whatsapp-connect.service";

function maskPhoneNumberId(id: string | null | undefined): string {
  if (!id) return "";
  const s = String(id);
  if (s.length <= 8) return "…" + s.slice(-2);
  return `…${s.slice(-4)}`;
}

export class WhatsappConnectController {
  static async init(req: Request, res: Response): Promise<void> {
    const ownerId = req.currentUser?.id;
    const businessId = req.businessId;
    if (!ownerId || !businessId) {
      throw new HttpError("Unauthorized", 401);
    }

    const state = WhatsappConnectService.createStateToken(ownerId, businessId);
    res.status(200).json({
      success: true,
      message: "Embedded Signup session started",
      data: {
        appId: env.metaAppId,
        configId: env.metaEmbeddedSignupConfigId,
        state,
        graphApiVersion: env.metaGraphApiVersion,
      },
    });
  }

  static async finalize(req: Request, res: Response): Promise<void> {
    const ownerId = req.currentUser?.id;
    const businessId = req.businessId;
    if (!ownerId || !businessId) {
      throw new HttpError("Unauthorized", 401);
    }

    const body = req.body as FinalizeWhatsappConnectDto;
    const data = await WhatsappConnectService.finalizeAndPersist(ownerId, businessId, {
      state: body.state,
      code: body.code,
      redirectUri: body.redirectUri,
      phoneNumberId: body.phoneNumberId,
    });

    res.status(200).json({
      success: true,
      message: "WhatsApp connected",
      data,
    });
  }

  static async status(req: Request, res: Response): Promise<void> {
    const ownerId = req.currentUser?.id;
    if (!ownerId) {
      throw new HttpError("Unauthorized", 401);
    }

    const business = await BusinessService.getByOwner(ownerId);
    const w = business.whatsapp;
    const phoneNumberId = w?.phoneNumberId ? String(w.phoneNumberId) : "";
    const hasToken = Boolean(w?.accessToken && String(w.accessToken).trim());
    const connected = Boolean(phoneNumberId && hasToken);

    res.status(200).json({
      success: true,
      data: {
        connected,
        phoneNumber: typeof w?.phoneNumber === "string" ? w.phoneNumber : "",
        phoneNumberIdMasked: maskPhoneNumberId(phoneNumberId),
      },
    });
  }

  static async disconnect(req: Request, res: Response): Promise<void> {
    const ownerId = req.currentUser?.id;
    if (!ownerId) {
      throw new HttpError("Unauthorized", 401);
    }

    await BusinessService.clearWhatsapp(ownerId);
    res.status(200).json({
      success: true,
      message: "WhatsApp disconnected",
      data: { connected: false, phoneNumber: "", phoneNumberIdMasked: "" },
    });
  }
}
