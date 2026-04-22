import { Request, Response } from "express";
import { buildPaginationMeta, parseListQuery, parseOptionalString } from "../../../helpers/list-query";
import { FaqService } from "../services/faq.service";
import { SubscriptionUsageService } from "../../billing/services/subscription-usage.service";

export class FaqController {
  static async list(req: Request, res: Response): Promise<void> {
    const q = parseListQuery(req.query as Record<string, unknown>, { defaultLimit: 20, maxLimit: 100 });
    const category = parseOptionalString(req.query as Record<string, unknown>, "category");
    const { items, total } = await FaqService.listPaged(req.businessId!, {
      skip: q.skip,
      limit: q.limit,
      q: q.q,
      category,
    });
    res.status(200).json({
      success: true,
      message: "FAQs fetched",
      data: { items, meta: buildPaginationMeta(total, q.page, q.limit) },
    });
  }

  static async create(req: Request, res: Response): Promise<void> {
    await SubscriptionUsageService.assertCanCreateFaq(req.businessId!);
    const faq = await FaqService.create(req.businessId!, req.body);
    res.status(201).json({ success: true, message: "FAQ created", data: faq });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const faq = await FaqService.update(req.businessId!, req.params.id, req.body);
    res.status(200).json({ success: true, message: "FAQ updated", data: faq });
  }

  static async remove(req: Request, res: Response): Promise<void> {
    await FaqService.remove(req.businessId!, req.params.id);
    res.status(200).json({ success: true, message: "FAQ deleted" });
  }
}
