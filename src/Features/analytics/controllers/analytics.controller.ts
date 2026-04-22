import { Request, Response } from "express";
import { parseListQuery, parseOptionalString } from "../../../helpers/list-query";
import { AnalyticsService } from "../services/analytics.service";

export class AnalyticsController {
  static async overview(req: Request, res: Response): Promise<void> {
    const data = await AnalyticsService.getOverview(req.businessId!);
    res.status(200).json({ success: true, message: "Analytics overview fetched", data });
  }

  // NEW: monthly message counts for analytics chart
  static async conversationsSeries(req: Request, res: Response): Promise<void> {
    const series = await AnalyticsService.conversationsByMonth(req.businessId!);
    res.status(200).json({ success: true, message: "Conversations series fetched", data: { series } });
  }

  // NEW: recent activity derived from business data
  static async activity(req: Request, res: Response): Promise<void> {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const items = await AnalyticsService.recentActivity(req.businessId!, limit);
    res.status(200).json({ success: true, message: "Recent activity fetched", data: { items } });
  }

  // NEW: customers dashboard bundle (list + per-customer stats + orders/bookings for detail)
  static async customersDashboard(req: Request, res: Response): Promise<void> {
    const q = parseListQuery(req.query as Record<string, unknown>, { defaultLimit: 10, maxLimit: 100 });
    const statusRaw = parseOptionalString(req.query as Record<string, unknown>, "status");
    const status =
      statusRaw === "active" || statusRaw === "inactive" ? (statusRaw as "active" | "inactive") : undefined;
    const data = await AnalyticsService.customersDashboard(req.businessId!, {
      page: q.page,
      limit: q.limit,
      q: q.q,
      status,
    });
    res.status(200).json({ success: true, message: "Customers dashboard fetched", data });
  }

  // NEW: top-level stats only for dashboard customers (counts + revenue; same rules as customers-dashboard)
  static async customersTopStats(req: Request, res: Response): Promise<void> {
    const data = await AnalyticsService.customersTopStats(req.businessId!);
    res.status(200).json({ success: true, message: "Customers top stats fetched", data });
  }

  // NEW: top-level order status counts for dashboard orders
  static async ordersTopStats(req: Request, res: Response): Promise<void> {
    const data = await AnalyticsService.ordersTopStats(req.businessId!);
    res.status(200).json({ success: true, message: "Orders top stats fetched", data });
  }

  // NEW: top-level booking status counts for dashboard bookings
  static async bookingsTopStats(req: Request, res: Response): Promise<void> {
    const data = await AnalyticsService.bookingsTopStats(req.businessId!);
    res.status(200).json({ success: true, message: "Bookings top stats fetched", data });
  }
}
