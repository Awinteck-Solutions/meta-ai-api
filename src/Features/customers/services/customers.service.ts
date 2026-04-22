import mongoose from "mongoose";
import Customer from "../schema/customer.schema";
import { UpsertCustomerDto } from "../dto/customer.dto";
import { escapeRegex } from "../../../helpers/list-query";
import { SubscriptionUsageService } from "../../billing/services/subscription-usage.service";

export class CustomersService {
  static async listPaged(
    businessId: string,
    opts: { skip: number; limit: number; q: string }
  ): Promise<{ items: unknown[]; total: number }> {
    const bid = new mongoose.Types.ObjectId(businessId);
    const filter: Record<string, unknown> = { businessId: bid };
    if (opts.q) {
      const re = new RegExp(escapeRegex(opts.q), "i");
      filter.$or = [{ phone: re }, { name: re }, { email: re }];
    }
    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(opts.skip).limit(opts.limit).lean(),
      Customer.countDocuments(filter),
    ]);
    return { items, total };
  }

  static async upsert(businessId: string, payload: UpsertCustomerDto) {
    const existing = await Customer.findOne({ businessId, phone: payload.phone }).lean();
    if (!existing) {
      await SubscriptionUsageService.assertCanAddCustomer(businessId);
    }
    return Customer.findOneAndUpdate(
      { businessId, phone: payload.phone },
      { $set: payload },
      { upsert: true, new: true, runValidators: true }
    );
  }

  static async findByPhone(businessId: string, phone: string) {
    return Customer.findOne({ businessId, phone });
  }
}

