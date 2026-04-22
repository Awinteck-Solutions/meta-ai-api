import { Request, Response } from "express";
import {
  buildPaginationMeta,
  parseListQuery,
  parseOptionalBoolean,
  parseOptionalString,
} from "../../../helpers/list-query";
import { CatalogService } from "../services/catalog.service";
import { KnowledgeService } from "../../knowledge/services/knowledge.service";
import { SubscriptionUsageService } from "../../billing/services/subscription-usage.service";

export class CatalogController {
  static async create(req: Request, res: Response): Promise<void> {
    await SubscriptionUsageService.assertCanCreateCatalogItem(req.businessId!);
    const item = await CatalogService.create(req.businessId!, req.body);
    await KnowledgeService.ingestCatalogItem(item);
    res.status(201).json({ success: true, message: "Catalog item created", data: item });
  }

  static async list(req: Request, res: Response): Promise<void> {
    const q = parseListQuery(req.query as Record<string, unknown>, { defaultLimit: 20, maxLimit: 100 });
    const typeRaw = parseOptionalString(req.query as Record<string, unknown>, "type");
    const type = typeRaw === "product" || typeRaw === "service" ? typeRaw : undefined;
    const active = parseOptionalBoolean(req.query as Record<string, unknown>, "active");
    const { items, total } = await CatalogService.listPaged(req.businessId!, {
      skip: q.skip,
      limit: q.limit,
      q: q.q,
      type,
      active,
    });
    res.status(200).json({
      success: true,
      message: "Catalog items fetched",
      data: { items, meta: buildPaginationMeta(total, q.page, q.limit) },
    });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const item = await CatalogService.update(req.businessId!, req.params.id, req.body);
    await KnowledgeService.ingestCatalogItem(item);
    res.status(200).json({ success: true, message: "Catalog item updated", data: item });
  }

  static async remove(req: Request, res: Response): Promise<void> {
    await CatalogService.remove(req.businessId!, req.params.id);
    await KnowledgeService.deleteVectorsByCatalogItem(req.params.id);
    res.status(200).json({ success: true, message: "Catalog item deleted" });
  }
}

