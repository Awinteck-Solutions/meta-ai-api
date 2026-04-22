import { Request, Response } from "express";
import { buildPaginationMeta, parseListQuery, parseOptionalStatus } from "../../../helpers/list-query";
import { OrdersService } from "../services/orders.service";

export class OrdersController {
  static async list(req: Request, res: Response): Promise<void> {
    const q = parseListQuery(req.query as Record<string, unknown>, { defaultLimit: 20, maxLimit: 100 });
    const status = parseOptionalStatus(req.query as Record<string, unknown>, [
      "pending",
      "paid",
      "cancelled",
      "completed",
    ]);
    const { items, total } = await OrdersService.listPaged(req.businessId!, {
      skip: q.skip,
      limit: q.limit,
      q: q.q,
      status,
    });
    res.status(200).json({
      success: true,
      message: "Orders fetched",
      data: { items, meta: buildPaginationMeta(total, q.page, q.limit) },
    });
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    const order = await OrdersService.updateStatus(req.businessId!, req.params.id, req.body.status);
    res.status(200).json({ success: true, message: "Order status updated", data: order });
  }
}

