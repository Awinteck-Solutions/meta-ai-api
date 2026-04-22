import { Request, Response } from "express";
import { buildPaginationMeta, parseListQuery } from "../../../helpers/list-query";
import { MessagesService } from "../services/messages.service";
import { SubscriptionUsageService } from "../../billing/services/subscription-usage.service";

export class MessagesController {
  static async list(req: Request, res: Response): Promise<void> {
    const q = parseListQuery(req.query as Record<string, unknown>, { defaultLimit: 20, maxLimit: 100 });
    const { items, total } = await MessagesService.getConversationsPaged(req.businessId!, {
      skip: q.skip,
      limit: q.limit,
      q: q.q,
    });
    res.status(200).json({
      success: true,
      message: "Messages fetched",
      data: { items, meta: buildPaginationMeta(total, q.page, q.limit) },
    });
  }

  static async thread(req: Request, res: Response): Promise<void> {
    const messages = await MessagesService.getThread(req.businessId!, req.params.customerPhone);
    res.status(200).json({ success: true, message: "Thread fetched", data: messages });
  }

  static async send(req: Request, res: Response): Promise<void> {
    await SubscriptionUsageService.assertCanCreateMessage(req.businessId!);
    const created = await MessagesService.create({
      businessId: req.businessId!,
      customerPhone: req.body.customerPhone,
      message: req.body.text,
      response: req.body.text,
    });
    res.status(201).json({ success: true, message: "Message sent", data: created });
  }
}

