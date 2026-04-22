import mongoose from "mongoose";
import CatalogItem from "../../catalog/schema/catalog.schema";
import Customer from "../../customers/schema/customer.schema";
import { HttpError } from "../../../helpers/http-error";
import { escapeRegex } from "../../../helpers/list-query";
import { CreateOrderDto } from "../dto/order.dto";
import Order from "../schema/order.schema";

const ORDER_STATUSES = ["pending", "paid", "cancelled", "completed"] as const;

export class OrdersService {
  static async listPaged(
    businessId: string,
    opts: { skip: number; limit: number; q: string; status?: string }
  ): Promise<{ items: unknown[]; total: number }> {
    const bid = new mongoose.Types.ObjectId(businessId);
    const clauses: Record<string, unknown>[] = [{ businessId: bid }];

    if (opts.status && (ORDER_STATUSES as readonly string[]).includes(opts.status)) {
      clauses.push({ status: opts.status });
    }

    if (opts.q) {
      const re = new RegExp(escapeRegex(opts.q), "i");
      const orConds: Record<string, unknown>[] = [];
      if (mongoose.Types.ObjectId.isValid(opts.q)) {
        const oid = new mongoose.Types.ObjectId(opts.q);
        if (String(oid) === opts.q) {
          orConds.push({ _id: oid });
        }
      }
      const custIds = await Customer.find({
        businessId: bid,
        $or: [{ phone: re }, { name: re }, { email: re }],
      })
        .select("_id")
        .lean();
      if (custIds.length) orConds.push({ customerId: { $in: custIds.map((c) => c._id) } });
      if (orConds.length === 0) {
        return { items: [], total: 0 };
      }
      clauses.push({ $or: orConds });
    }

    const filter: Record<string, unknown> = clauses.length === 1 ? clauses[0] : { $and: clauses };

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .populate("customerId", "name phone email")
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { items, total };
  }

  static async create(businessId: string, payload: CreateOrderDto) {
    const customer = await Customer.findOne({ _id: payload.customerId, businessId });
    if (!customer) {
      throw new HttpError("Customer not found", 404);
    }

    const resolvedItems = await Promise.all(
      payload.items.map(async (item) => {
        const catalog = await CatalogItem.findOne({
          _id: item.catalogItemId,
          businessId,
          active: true,
        });
        if (!catalog) {
          throw new HttpError(`Catalog item ${item.catalogItemId} not found`, 404);
        }

        return {
          catalogItemId: catalog._id,
          name: catalog.name,
          price: Number(catalog.price) - Number(catalog.discountAmount || 0),
          quantity: item.quantity,
        };
      })
    );

    const totalAmount = resolvedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    return Order.create({
      businessId,
      customerId: payload.customerId,
      items: resolvedItems,
      totalAmount,
      paymentReference: payload.paymentReference || null,
      status: payload.paymentReference ? "paid" : "pending",
    });
  }

  static async updateStatus(businessId: string, id: string, status: "pending" | "paid" | "cancelled" | "completed") {
    const order = await Order.findOneAndUpdate(
      { _id: id, businessId },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!order) {
      throw new HttpError("Order not found", 404);
    }
    return order;
  }
}

