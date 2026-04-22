import mongoose from "mongoose";
import { HttpError } from "../../../helpers/http-error";
import { escapeRegex } from "../../../helpers/list-query";
import CatalogItem from "../schema/catalog.schema";
import { CreateCatalogDto, UpdateCatalogDto } from "../dto/catalog.dto";

export class CatalogService {
  static async create(businessId: string, payload: CreateCatalogDto) {
    const item = await CatalogItem.create({
      businessId,
      ...payload,
    });
    return item;
  }

  /** Full catalog for internal consumers (e.g. AI tools). Prefer `listPaged` for HTTP APIs. */
  static async list(businessId: string) {
    return CatalogItem.find({ businessId }).sort({ createdAt: -1 });
  }

  static async listPaged(
    businessId: string,
    opts: {
      skip: number;
      limit: number;
      q: string;
      type?: "product" | "service";
      active?: boolean;
    }
  ): Promise<{ items: unknown[]; total: number }> {
    const bid = new mongoose.Types.ObjectId(businessId);
    const filter: Record<string, unknown> = { businessId: bid };
    if (opts.type) filter.type = opts.type;
    if (opts.active !== undefined) filter.active = opts.active;
    if (opts.q) {
      const re = new RegExp(escapeRegex(opts.q), "i");
      filter.$or = [{ name: re }, { description: re }];
    }
    const [items, total] = await Promise.all([
      CatalogItem.find(filter).sort({ createdAt: -1 }).skip(opts.skip).limit(opts.limit).lean(),
      CatalogItem.countDocuments(filter),
    ]);
    return { items, total };
  }

  static async getById(businessId: string, id: string) {
    const item = await CatalogItem.findOne({ _id: id, businessId });
    if (!item) {
      throw new HttpError("Catalog item not found", 404);
    }
    return item;
  }

  static async update(businessId: string, id: string, payload: UpdateCatalogDto) {
    const item = await CatalogItem.findOneAndUpdate(
      { _id: id, businessId },
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!item) {
      throw new HttpError("Catalog item not found", 404);
    }
    return item;
  }

  static async remove(businessId: string, id: string) {
    const result = await CatalogItem.findOneAndDelete({ _id: id, businessId });
    if (!result) {
      throw new HttpError("Catalog item not found", 404);
    }
    return result;
  }
}

