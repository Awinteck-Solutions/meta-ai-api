import { Request, Response } from "express";
import { buildPaginationMeta, parseListQuery } from "../../../helpers/list-query";
import { CustomersService } from "../services/customers.service";

export class CustomersController {
  static async list(req: Request, res: Response): Promise<void> {
    const q = parseListQuery(req.query as Record<string, unknown>, { defaultLimit: 20, maxLimit: 100 });
    const { items, total } = await CustomersService.listPaged(req.businessId!, {
      skip: q.skip,
      limit: q.limit,
      q: q.q,
    });
    res.status(200).json({
      success: true,
      message: "Customers fetched",
      data: { items, meta: buildPaginationMeta(total, q.page, q.limit) },
    });
  }
}

