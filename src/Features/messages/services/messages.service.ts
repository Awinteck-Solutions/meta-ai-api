import mongoose from "mongoose";
import Message from "../schema/message.schema";
import { escapeRegex } from "../../../helpers/list-query";

export class MessagesService {
  static async list(businessId: string) {
    return Message.find({ businessId }).sort({ createdAt: -1 });
  }

  static async create(payload: {
    businessId: string;
    customerPhone: string;
    message: string;
    response?: string;
  }) {
    return Message.create(payload);
  }

  static async updateResponse(id: string, response: string) {
    return Message.findByIdAndUpdate(
      id,
      { $set: { response } },
      { new: true, runValidators: true }
    );
  }

  static async getRecentConversation(businessId: string, customerPhone: string, limit = 8) {
    return Message.find({
      businessId,
      customerPhone,
      response: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  static async getThread(businessId: string, customerPhone: string) {
    return Message.find({ businessId, customerPhone }).sort({ createdAt: 1 });
  }

  private static mapConversationRow(row: {
    customerPhone: string;
    lastActivityAt: Date;
    messages: { id: string; direction: string; text: string; timestamp: Date }[];
    lastInbound?: string;
    lastOutbound?: string | null;
  }) {
    const lastMessage = row.lastOutbound || row.lastInbound || "";
    return {
      customerPhone: row.customerPhone,
      customerId: row.customerPhone,
      customerName: row.customerPhone,
      lastMessage,
      lastMessageDirection: row.lastOutbound ? "outbound" : "inbound",
      lastActivityAt: row.lastActivityAt,
      unreadCount: 0,
      messages: row.messages,
    };
  }

  static async getConversations(businessId: string) {
    const bid = new mongoose.Types.ObjectId(businessId);
    const rows = await Message.aggregate([
      { $match: { businessId: bid } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$customerPhone",
          customerPhone: { $first: "$customerPhone" },
          lastActivityAt: { $last: "$createdAt" },
          messages: {
            $push: {
              id: { $toString: "$_id" },
              direction: {
                $cond: [{ $ifNull: ["$response", false] }, "outbound", "inbound"],
              },
              text: { $ifNull: ["$response", "$message"] },
              timestamp: "$createdAt",
            },
          },
          lastInbound: { $last: "$message" },
          lastOutbound: { $last: "$response" },
        },
      },
      { $sort: { lastActivityAt: -1 } },
    ]);

    return rows.map((row: any) => MessagesService.mapConversationRow(row));
  }

  static async getConversationsPaged(
    businessId: string,
    opts: { skip: number; limit: number; q: string }
  ): Promise<{ items: ReturnType<typeof MessagesService.mapConversationRow>[]; total: number }> {
    const bid = new mongoose.Types.ObjectId(businessId);
    const match: Record<string, unknown> = { businessId: bid };
    if (opts.q) {
      match.customerPhone = new RegExp(escapeRegex(opts.q), "i");
    }

    const pipeline: mongoose.PipelineStage[] = [
      { $match: match },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$customerPhone",
          customerPhone: { $first: "$customerPhone" },
          lastActivityAt: { $last: "$createdAt" },
          messages: {
            $push: {
              id: { $toString: "$_id" },
              direction: {
                $cond: [{ $ifNull: ["$response", false] }, "outbound", "inbound"],
              },
              text: { $ifNull: ["$response", "$message"] },
              timestamp: "$createdAt",
            },
          },
          lastInbound: { $last: "$message" },
          lastOutbound: { $last: "$response" },
        },
      },
      { $sort: { lastActivityAt: -1 } },
      {
        $facet: {
          meta: [{ $count: "total" }],
          rows: [{ $skip: opts.skip }, { $limit: opts.limit }],
        },
      },
    ];

    const [facet] = (await Message.aggregate(pipeline)) as {
      meta: { total: number }[];
      rows: any[];
    }[];

    const total = facet?.meta?.[0]?.total ?? 0;
    const rows = facet?.rows ?? [];
    const items = rows.map((row: any) => MessagesService.mapConversationRow(row));
    return { items, total };
  }
}

