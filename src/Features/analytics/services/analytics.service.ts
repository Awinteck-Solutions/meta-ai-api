import mongoose from "mongoose";
import { buildPaginationMeta, escapeRegex } from "../../../helpers/list-query";
import Message from "../../messages/schema/message.schema";
import Faq from "../../faq/schema/faq.schema";
import CatalogItem from "../../catalog/schema/catalog.schema";
import Order from "../../orders/schema/order.schema";
import Booking from "../../bookings/schema/booking.schema";
import Customer from "../../customers/schema/customer.schema";

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export type ActivityRow = { action: string; detail: string; occurredAt: string };

export class AnalyticsService {
  static async getOverview(businessId: string) {
    const bid = new mongoose.Types.ObjectId(businessId);
    const [orders, bookings, customers, conversations] = await Promise.all([
      Order.countDocuments({ businessId: bid }),
      Booking.countDocuments({ businessId: bid }),
      Customer.countDocuments({ businessId: bid }),
      Message.countDocuments({ businessId: bid }),
    ]);

    const totalOutbound = await Message.countDocuments({
      businessId: bid,
      response: { $nin: [null, ""] },
    });
    const aiResolutionPct =
      conversations > 0 ? Number(((totalOutbound / conversations) * 100).toFixed(1)) : 0;

    return {
      totalConversations: conversations,
      activeUsers: customers,
      conversionRate: orders + bookings > 0 ? Number(((orders / (orders + bookings)) * 100).toFixed(1)) : 0,
      aiResolutions: Math.min(100, aiResolutionPct),
    };
  }

  /** Last 12 calendar months: total messages vs messages that received a reply (proxy for AI/agent resolution). */
  static async conversationsByMonth(businessId: string) {
    const bid = new mongoose.Types.ObjectId(businessId);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);

    const rows = await Message.aggregate([
      { $match: { businessId: bid, createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
          },
          conversations: { $sum: 1 },
          aiResolved: {
            $sum: {
              $cond: [{ $and: [{ $ne: ["$response", null] }, { $ne: ["$response", ""] }] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
    ]);

    const map = new Map<string, { conversations: number; aiResolved: number }>();
    for (const r of rows as { _id: { y: number; m: number }; conversations: number; aiResolved: number }[]) {
      const key = `${r._id.y}-${String(r._id.m).padStart(2, "0")}`;
      map.set(key, { conversations: r.conversations, aiResolved: r.aiResolved });
    }

    const series: { month: string; conversations: number; aiResolved: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const month = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const data = map.get(key) ?? { conversations: 0, aiResolved: 0 };
      series.push({ month, conversations: data.conversations, aiResolved: data.aiResolved });
    }

    return series;
  }

  /** Unified feed from FAQs, catalog, orders, bookings, messages, and customers for this business. */
  static async recentActivity(businessId: string, limit = 12): Promise<ActivityRow[]> {
    const bid = new mongoose.Types.ObjectId(businessId);
    const perSource = 6;

    const [faqs, catalogs, orders, bookings, msgs, customers] = await Promise.all([
      Faq.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .limit(perSource)
        .select("question createdAt")
        .lean(),
      CatalogItem.find({ businessId: bid })
        .sort({ updatedAt: -1 })
        .limit(perSource)
        .select("name type updatedAt createdAt")
        .lean(),
      Order.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .limit(perSource)
        .select("status totalAmount createdAt")
        .lean(),
      Booking.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .limit(perSource)
        .select("status bookingDate createdAt")
        .lean(),
      Message.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .limit(perSource)
        .select("customerPhone message response createdAt")
        .lean(),
      Customer.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .limit(perSource)
        .select("name phone createdAt")
        .lean(),
    ]);

    const items: { action: string; detail: string; at: Date }[] = [];

    for (const f of faqs as { question?: string; createdAt?: Date }[]) {
      if (f.createdAt)
        items.push({
          action: "FAQ added",
          detail: truncate(String(f.question ?? ""), 90),
          at: new Date(f.createdAt),
        });
    }

    for (const c of catalogs as {
      name?: string;
      type?: string;
      updatedAt?: Date;
      createdAt?: Date;
    }[]) {
      const at = c.updatedAt ? new Date(c.updatedAt) : c.createdAt ? new Date(c.createdAt) : null;
      if (!at) continue;
      const label = c.type === "service" ? "Service" : "Product";
      items.push({ action: `${label} updated`, detail: truncate(String(c.name ?? ""), 90), at });
    }

    for (const o of orders as { status?: string; totalAmount?: number; createdAt?: Date }[]) {
      if (!o.createdAt) continue;
      items.push({
        action: "Order activity",
        detail: `Status: ${o.status ?? "—"} · $${Number(o.totalAmount ?? 0).toFixed(2)}`,
        at: new Date(o.createdAt),
      });
    }

    for (const b of bookings as { status?: string; bookingDate?: string; createdAt?: Date }[]) {
      if (!b.createdAt) continue;
      items.push({
        action: "Booking activity",
        detail: `${b.status ?? "—"}${b.bookingDate ? ` · ${b.bookingDate}` : ""}`,
        at: new Date(b.createdAt),
      });
    }

    for (const m of msgs as {
      customerPhone?: string;
      message?: string;
      response?: string | null;
      createdAt?: Date;
    }[]) {
      if (!m.createdAt) continue;
      const hasReply = m.response != null && String(m.response).length > 0;
      items.push({
        action: hasReply ? "Conversation reply" : "Inbound message",
        detail: truncate(`${m.customerPhone ?? ""}: ${m.message ?? ""}`, 90),
        at: new Date(m.createdAt),
      });
    }

    for (const c of customers as { name?: string; phone?: string; createdAt?: Date }[]) {
      if (!c.createdAt) continue;
      items.push({
        action: "Customer added",
        detail: truncate([c.name, c.phone].filter(Boolean).join(" · "), 90),
        at: new Date(c.createdAt),
      });
    }

    items.sort((a, b) => b.at.getTime() - a.at.getTime());
    return items.slice(0, limit).map(({ action, detail, at }) => ({
      action,
      detail,
      occurredAt: at.toISOString(),
    }));
  }

  private static readonly CUSTOMERS_INACTIVE_AFTER_MS = 60 * 86400 * 1000;

  private static customerDashboardCustomerId(ref: unknown): string {
    if (ref == null) return "";
    if (typeof ref === "object" && ref !== null && "_id" in ref) {
      return String((ref as { _id: unknown })._id);
    }
    return String(ref);
  }

  private static async fetchCustomersDashboardCollections(businessId: string) {
    const bid = new mongoose.Types.ObjectId(businessId);
    const [customers, ordersRaw, bookingsRaw] = await Promise.all([
      Customer.find({ businessId: bid }).sort({ createdAt: -1 }).lean(),
      Order.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .populate("customerId", "name phone email")
        .lean(),
      Booking.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .populate("customerId", "name phone email")
        .populate("serviceId", "name")
        .lean(),
    ]);
    return { customers, ordersRaw, bookingsRaw };
  }

  /** Per-customer metrics for customers dashboard (shared with stats-only endpoint). */
  private static buildCustomersDashboardCustomerRows(
    customers: {
      _id: unknown;
      phone: string;
      name?: string | null;
      email?: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[],
    ordersRaw: unknown[],
    bookingsRaw: unknown[]
  ) {
    const INACTIVE_AFTER_MS = AnalyticsService.CUSTOMERS_INACTIVE_AFTER_MS;
    const customerMap = new Map<string, (typeof customers)[number]>();
    for (const c of customers) {
      customerMap.set(String(c._id), c);
    }

    const orderCountByCustomer = new Map<string, number>();
    const bookingCountByCustomer = new Map<string, number>();
    const spentByCustomer = new Map<string, number>();
    const lastActivityByCustomer = new Map<string, Date>();

    const bumpActivity = (cid: string, at: Date) => {
      if (!cid) return;
      const cur = lastActivityByCustomer.get(cid);
      if (!cur || at.getTime() > cur.getTime()) lastActivityByCustomer.set(cid, at);
    };

    for (const c of customers) {
      const cid = String(c._id);
      lastActivityByCustomer.set(cid, new Date(c.updatedAt ?? c.createdAt));
    }

    for (const o of ordersRaw as {
      customerId: unknown;
      totalAmount?: number;
      status?: string;
      createdAt?: Date;
    }[]) {
      const cid = AnalyticsService.customerDashboardCustomerId(o.customerId);
      if (!cid) continue;
      orderCountByCustomer.set(cid, (orderCountByCustomer.get(cid) || 0) + 1);
      if ((o.status === "paid" || o.status === "completed") && typeof o.totalAmount === "number") {
        spentByCustomer.set(cid, (spentByCustomer.get(cid) || 0) + o.totalAmount);
      }
      if (o.createdAt) bumpActivity(cid, new Date(o.createdAt));
    }

    for (const b of bookingsRaw as { customerId: unknown; createdAt?: Date }[]) {
      const cid = AnalyticsService.customerDashboardCustomerId(b.customerId);
      if (!cid) continue;
      bookingCountByCustomer.set(cid, (bookingCountByCustomer.get(cid) || 0) + 1);
      if (b.createdAt) bumpActivity(cid, new Date(b.createdAt));
    }

    const now = Date.now();
    const customerRows = customers.map((c) => {
      const cid = String(c._id);
      const lastAt = lastActivityByCustomer.get(cid) ?? new Date(c.updatedAt ?? c.createdAt);
      const inactive = now - lastAt.getTime() > INACTIVE_AFTER_MS;
      const name = (c.name && String(c.name).trim()) || c.phone;
      return {
        id: cid,
        name,
        phone: c.phone,
        email: c.email ?? "",
        totalOrders: orderCountByCustomer.get(cid) || 0,
        totalBookings: bookingCountByCustomer.get(cid) || 0,
        totalSpent: spentByCustomer.get(cid) || 0,
        lastActivityAt: lastAt.toISOString(),
        joinedAt: new Date(c.createdAt).toISOString(),
        status: inactive ? ("inactive" as const) : ("active" as const),
      };
    });

    return { customerRows, customerMap };
  }

  /** Top-level counts + revenue for dashboard customers (same rules as customers-dashboard list). */
  static async customersTopStats(businessId: string) {
    const { customers, ordersRaw, bookingsRaw } = await AnalyticsService.fetchCustomersDashboardCollections(businessId);
    const { customerRows } = AnalyticsService.buildCustomersDashboardCustomerRows(customers, ordersRaw, bookingsRaw);
    const total = customerRows.length;
    const active = customerRows.filter((c) => c.status === "active").length;
    const inactive = customerRows.filter((c) => c.status === "inactive").length;
    const totalRevenue = customerRows.reduce((s, c) => s + c.totalSpent, 0);
    return { total, active, inactive, totalRevenue };
  }

  /** Bundled customers + orders + bookings for the dashboard customers page (single round-trip). */
  static async customersDashboard(
    businessId: string,
    listOpts?: { page: number; limit: number; q: string; status?: "active" | "inactive" }
  ) {
    const page = listOpts?.page ?? 1;
    const limit = listOpts?.limit ?? 10;
    const skip = (page - 1) * limit;
    const q = (listOpts?.q ?? "").trim();
    const statusOnly = listOpts?.status;

    const { customers, ordersRaw, bookingsRaw } = await AnalyticsService.fetchCustomersDashboardCollections(businessId);
    const { customerRows: allCustomerRows, customerMap } = AnalyticsService.buildCustomersDashboardCustomerRows(
      customers,
      ordersRaw,
      bookingsRaw
    );

    let filteredCustomers = allCustomerRows;
    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      filteredCustomers = filteredCustomers.filter(
        (c) => re.test(c.name) || re.test(c.phone) || re.test(c.email)
      );
    }
    if (statusOnly === "active" || statusOnly === "inactive") {
      filteredCustomers = filteredCustomers.filter((c) => c.status === statusOnly);
    }

    const total = filteredCustomers.length;
    const customersOut = filteredCustomers.slice(skip, skip + limit);
    const pageIds = new Set(customersOut.map((c) => c.id));

    type LeanOrderRow = {
      _id: unknown;
      customerId: unknown;
      items?: { catalogItemId?: unknown; name?: string; price?: number; quantity?: number }[];
      totalAmount?: number;
      status?: string;
      createdAt?: Date;
    };
    const allOrdersOut = (ordersRaw as LeanOrderRow[]).map((o) => {
      const pop = o.customerId;
      const cid = AnalyticsService.customerDashboardCustomerId(pop);
      const cust = customerMap.get(cid) ?? (typeof pop === "object" && pop ? (pop as { name?: string | null; phone?: string }) : null);
      const displayName =
        (cust?.name && String(cust.name).trim()) || cust?.phone || cid;
      const displayPhone = cust?.phone || "-";
      return {
        id: String(o._id),
        customerId: cid,
        customerName: displayName,
        customerPhone: displayPhone,
        totalAmount: Number(o.totalAmount ?? 0),
        status: o.status,
        createdAt: new Date(o.createdAt!).toISOString(),
        items: (o.items ?? []).map((it) => ({
          productId: String(it.catalogItemId),
          productName: String(it.name ?? ""),
          quantity: Number(it.quantity ?? 0),
          unitPrice: Number(it.price ?? 0),
          discountAmount: 0,
        })),
      };
    });

    type LeanBookingRow = {
      _id: unknown;
      customerId: unknown;
      serviceId?: unknown;
      bookingDate?: string;
      bookingTime?: string;
      status?: string;
      createdAt?: Date;
    };
    const allBookingsOut = (bookingsRaw as LeanBookingRow[]).map((b) => {
      const pop = b.customerId;
      const cid = AnalyticsService.customerDashboardCustomerId(pop);
      const cust = customerMap.get(cid) ?? (typeof pop === "object" && pop ? (pop as { name?: string | null; phone?: string }) : null);
      const displayName = (cust?.name && String(cust.name).trim()) || cust?.phone || cid;
      const displayPhone = cust?.phone || "-";
      const svc = b.serviceId && typeof b.serviceId === "object" ? (b.serviceId as { _id?: unknown; name?: string }) : null;
      const serviceId = svc?._id != null ? String(svc._id) : String(b.serviceId ?? "");
      const serviceName = svc?.name ? String(svc.name) : "Service";
      return {
        id: String(b._id),
        customerId: cid,
        customerName: displayName,
        customerPhone: displayPhone,
        services: [
          {
            serviceId,
            serviceName,
            price: 0,
            discountAmount: 0,
          },
        ],
        bookingDateStart: String(b.bookingDate ?? ""),
        bookingDateEnd: String(b.bookingDate ?? ""),
        bookingTime: String(b.bookingTime ?? ""),
        status: b.status,
        createdAt: new Date(b.createdAt!).toISOString(),
      };
    });

    const ordersOut = allOrdersOut.filter((o) => pageIds.has(o.customerId));
    const bookingsOut = allBookingsOut.filter((b) => pageIds.has(b.customerId));

    return {
      customers: customersOut,
      orders: ordersOut,
      bookings: bookingsOut,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /** KPI counts for dashboard orders page (matches list: all orders, counts by status). */
  static async ordersTopStats(businessId: string) {
    const bid = new mongoose.Types.ObjectId(businessId);
    const grouped = await Order.aggregate<{ _id: string | null; count: number }>([
      { $match: { businessId: bid } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = new Map<string, number>();
    for (const g of grouped) {
      const key = g._id == null ? "" : String(g._id);
      byStatus.set(key, g.count);
    }
    const total = grouped.reduce((s, g) => s + g.count, 0);
    return {
      total,
      completed: byStatus.get("completed") ?? 0,
      pending: byStatus.get("pending") ?? 0,
      paid: byStatus.get("paid") ?? 0,
    };
  }

  /** KPI counts for dashboard bookings page. */
  static async bookingsTopStats(businessId: string) {
    const bid = new mongoose.Types.ObjectId(businessId);
    const grouped = await Booking.aggregate<{ _id: string | null; count: number }>([
      { $match: { businessId: bid } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = new Map<string, number>();
    for (const g of grouped) {
      const key = g._id == null ? "" : String(g._id);
      byStatus.set(key, g.count);
    }
    const total = grouped.reduce((s, g) => s + g.count, 0);
    return {
      total,
      completed: byStatus.get("completed") ?? 0,
      pending: byStatus.get("pending") ?? 0,
      paid: byStatus.get("paid") ?? 0,
    };
  }
}
