import { Request, Response } from "express";
import { env } from "../../../config/env";
import { WhatsAppService } from "../services/whatsapp.service";
import { HttpError } from "../../../helpers/http-error";

export class WhatsAppController {
  static async webhook(req: Request, res: Response): Promise<void> {
    await WhatsAppService.processWebhook(req.body);
    res.status(200).json({ success: true });
  }

  static async verify(req: Request, res: Response): Promise<void> {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === env.whatsappVerifyToken) {
      res.status(200).send(challenge);
      return;
    }

    throw new HttpError("Webhook verification failed", 403);
  }
}

