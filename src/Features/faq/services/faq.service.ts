import mongoose from "mongoose";
import { HttpError } from "../../../helpers/http-error";
import { escapeRegex } from "../../../helpers/list-query";
import { CreateFaqDto, UpdateFaqDto } from "../dto/faq.dto";
import Faq from "../schema/faq.schema";

export class FaqService {
  static async listPaged(
    businessId: string,
    opts: { skip: number; limit: number; q: string; category?: string }
  ): Promise<{ items: unknown[]; total: number }> {
    const bid = new mongoose.Types.ObjectId(businessId);
    const filter: Record<string, unknown> = { businessId: bid };
    if (opts.category) {
      filter.category = new RegExp(escapeRegex(opts.category), "i");
    }
    if (opts.q) {
      const re = new RegExp(escapeRegex(opts.q), "i");
      filter.$or = [{ question: re }, { answer: re }];
    }
    const [items, total] = await Promise.all([
      Faq.find(filter).sort({ createdAt: -1 }).skip(opts.skip).limit(opts.limit).lean(),
      Faq.countDocuments(filter),
    ]);
    return { items, total };
  }

  static async create(businessId: string, payload: CreateFaqDto) {
    return Faq.create({ businessId, ...payload });
  }

  static async update(businessId: string, id: string, payload: UpdateFaqDto) {
    const faq = await Faq.findOneAndUpdate({ _id: id, businessId }, { $set: payload }, { new: true, runValidators: true });
    if (!faq) {
      throw new HttpError("FAQ not found", 404);
    }
    return faq;
  }

  static async remove(businessId: string, id: string) {
    const faq = await Faq.findOneAndDelete({ _id: id, businessId });
    if (!faq) {
      throw new HttpError("FAQ not found", 404);
    }
  }
}
