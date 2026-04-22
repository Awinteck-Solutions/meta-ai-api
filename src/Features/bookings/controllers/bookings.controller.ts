import { Request, Response } from "express";
import { buildPaginationMeta, parseListQuery, parseOptionalStatus } from "../../../helpers/list-query";
import { BookingsService } from "../services/bookings.service";

export class BookingsController {
  static async list(req: Request, res: Response): Promise<void> {
    const q = parseListQuery(req.query as Record<string, unknown>, { defaultLimit: 20, maxLimit: 100 });
    const status = parseOptionalStatus(req.query as Record<string, unknown>, [
      "pending",
      "confirmed",
      "paid",
      "cancelled",
      "completed",
    ]);
    const { items, total } = await BookingsService.listPaged(req.businessId!, {
      skip: q.skip,
      limit: q.limit,
      q: q.q,
      status,
    });
    res.status(200).json({
      success: true,
      message: "Bookings fetched",
      data: { items, meta: buildPaginationMeta(total, q.page, q.limit) },
    });
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    const booking = await BookingsService.updateStatus(req.businessId!, req.params.id, req.body.status);
    res.status(200).json({ success: true, message: "Booking status updated", data: booking });
  }
}

