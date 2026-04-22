import mongoose from "mongoose";
import CatalogItem from "../../catalog/schema/catalog.schema";
import Customer from "../../customers/schema/customer.schema";
import { HttpError } from "../../../helpers/http-error";
import { escapeRegex } from "../../../helpers/list-query";
import Booking from "../schema/booking.schema";
import { CreateBookingDto } from "../dto/booking.dto";

const BOOKING_STATUSES = ["pending", "confirmed", "paid", "cancelled", "completed"] as const;

export class BookingsService {
  static async listPaged(
    businessId: string,
    opts: { skip: number; limit: number; q: string; status?: string }
  ): Promise<{ items: unknown[]; total: number }> {
    const bid = new mongoose.Types.ObjectId(businessId);
    const clauses: Record<string, unknown>[] = [{ businessId: bid }];

    if (opts.status && (BOOKING_STATUSES as readonly string[]).includes(opts.status)) {
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
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .populate("customerId", "name phone email")
        .populate("serviceId", "name")
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return { items, total };
  }

  static async create(businessId: string, payload: CreateBookingDto) {
    const customer = await Customer.findOne({ _id: payload.customerId, businessId });
    if (!customer) {
      throw new HttpError("Customer not found", 404);
    }

    const service = await CatalogItem.findOne({
      _id: payload.serviceId,
      businessId,
      type: "service",
      active: true,
    });
    if (!service) {
      throw new HttpError("Service not found", 404);
    }

    return Booking.create({
      businessId,
      customerId: payload.customerId,
      serviceId: payload.serviceId,
      bookingDate: payload.bookingDate,
      bookingTime: payload.bookingTime,
      durationMinutes: payload.durationMinutes || service.durationMinutes || 30,
      paymentReference: payload.paymentReference || null,
      status: payload.paymentReference ? "paid" : "pending",
    });
  }

  static async updateStatus(
    businessId: string,
    id: string,
    status: "pending" | "confirmed" | "paid" | "cancelled" | "completed"
  ) {
    const booking = await Booking.findOneAndUpdate(
      { _id: id, businessId },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!booking) {
      throw new HttpError("Booking not found", 404);
    }
    return booking;
  }
}

