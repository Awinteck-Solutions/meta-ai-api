import OpenAI from "openai";
import { env } from "../../../config/env";
import { AIToolsService } from "./ai-tools.service";
import { QdrantService } from "../../qdrant/services/qdrant.service";
import { logger } from "../../../helpers/logger";
import { CustomersService } from "../../customers/services/customers.service";
import { MessagesService } from "../../messages/services/messages.service";

interface AiActionResponse {
  action: "respond" | "tool";
  message: string;
  toolName?: "createOrderTool" | "createBookingTool" | "initiatePaymentTool" | "getCatalogTool";
  toolInput?: Record<string, unknown>;
}

export class AIService {
  private static openai = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;
  private static readonly supportedTools = [
    "createOrderTool",
    "createBookingTool",
    "initiatePaymentTool",
    "getCatalogTool",
  ] as const;

  private static readonly toolAliases: Record<string, (typeof AIService.supportedTools)[number]> = {
    purchase: "createOrderTool",
    buy: "createOrderTool",
    order: "createOrderTool",
    createorder: "createOrderTool",
    book: "createBookingTool",
    booking: "createBookingTool",
    createbooking: "createBookingTool",
    payment: "initiatePaymentTool",
    pay: "initiatePaymentTool",
    initiatepayment: "initiatePaymentTool",
    catalog: "getCatalogTool",
    getcatalog: "getCatalogTool",
    products: "getCatalogTool",
  };

  static async generateEmbedding(content: string): Promise<number[]> {
    if (!this.openai) {
      return Array.from({ length: 1536 }, () => 0);
    }
    const embedding = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    return embedding.data[0].embedding;
  }

  static async answerQuestion(params: {
    businessId: string;
    customerPhone: string;
    message: string;
  }): Promise<AiActionResponse> {
    const embedding = await this.generateEmbedding(params.message);
    const conversation = await MessagesService.getRecentConversation(
      params.businessId,
      params.customerPhone
    );

    const historyMessages: Array<{ role: "user" | "assistant"; content: string }> = conversation
      .reverse()
      .flatMap((entry: any) => {
        const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
        if (entry.message) {
          messages.push({ role: "user", content: entry.message });
        }
        if (entry.response) {
          messages.push({ role: "assistant", content: entry.response });
        }
        return messages;
      });

    const contextMatches = await QdrantService.searchVector({
      businessId: params.businessId,
      vector: embedding,
      limit: 5,
    });
 
    const context = contextMatches
      .map((match: any) => match.payload?.content)
      .filter(Boolean)
      .join("\n");
    
    logger.info("Context matches", { context });

    if (!this.openai) {
      return this.fallbackResponse(params.message);
    }

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            [
              "You are a WhatsApp commerce assistant.",
              "Return JSON only with keys: action, message, toolName, toolInput.",
              "action must be respond or tool.",
              "If action is tool, toolName must be one of: createOrderTool, createBookingTool, initiatePaymentTool, getCatalogTool.",
              "Never invent new tool names.",
              "Required toolInput formats:",
              "- createOrderTool: { items: [{ catalogItemId: string, quantity: number }] }",
              "- createBookingTool: { serviceId: string, bookingDate: string, bookingTime: string }",
              "- initiatePaymentTool: { amount: number, email?: string, orderId?: string, bookingId?: string }",
              "- getCatalogTool: {}",
              "If required fields are missing, set action to respond and ask user for missing fields.",
              "Always confirm the order or booking with the user before executing the tool by sharing the details of the order or booking.",
              `In the case where you need booking date, know that today's date is ${new Date().toISOString().split('T')[0]} and the time is ${new Date().toISOString().split('T')[1]}.`,
              "If you need to get the email of the user, ask for it in a friendly manner like 'What is your email address?' or 'What is your email?'.",
              // "After tool execution, return list of items in the order or booking in a human readable format like 'You have ordered 2 items: Item 1 and Item 2.' and show the total amount of the order or booking.",
            ].join(" "),
        },
        ...historyMessages,
        {
          role: "user",
          content: `Customer message: ${params.message}\nKnowledge context:\n${context || "No context found"}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "{}";
   logger.info("Completion content", { content });
    let parsed: AiActionResponse;
    try {
      parsed = JSON.parse(content);
    } catch (_error) {
      
      parsed = { action: "respond", message: "Sorry, I could not process that request." };
    }

    // if (!parsed.action || !parsed.message) {
    //   return { action: "respond", message: "Sorry, I could not process that request." };
    // }

    const withCustomerContext = await this.attachCustomerToToolInput(
      parsed,
      params.businessId,
      params.customerPhone
    );

    logger.info("With customer context", { withCustomerContext });

    // return this.normalizeAiResponse(withCustomerContext);
    return withCustomerContext;
  }

  static async createOrder(businessId: string, payload: unknown) {
    return AIToolsService.createOrderTool(businessId, payload);
  }

  static async createBooking(businessId: string, payload: unknown) {
    return AIToolsService.createBookingTool(businessId, payload);
  }

  static async initiatePayment(
    businessId: string,
    payload: { amount: number; email: string; orderId?: string; bookingId?: string }
  ) {
    return AIToolsService.initiatePaymentTool(businessId, payload);
  }

  static async executeTool(businessId: string, toolName?: string, toolInput?: Record<string, unknown>) {
    switch (toolName) {
      case "createOrderTool":
        return this.createOrder(businessId, toolInput || {});
      case "createBookingTool":
        return this.createBooking(businessId, toolInput || {});
      case "initiatePaymentTool":
        return this.initiatePayment(businessId, (toolInput || {}) as any);
      case "getCatalogTool":
        return AIToolsService.getCatalogTool(businessId);
      default:
        return null;
    }
  }

  private static normalizeAiResponse(parsed: AiActionResponse): AiActionResponse {
    if (parsed.action !== "tool") {
      return parsed;
    }

    const normalizedName = this.normalizeToolName(parsed.toolName);
    if (!normalizedName) {
      return {
        action: "respond",
        message:
          "I can help with catalog, order, booking, or payment. Tell me what you want to do and I will guide you.",
      };
    }

    const toolInput = (parsed.toolInput || {}) as Record<string, unknown>;
    const validationError = this.validateToolInput(normalizedName, toolInput);
    if (validationError) {
      return {
        action: "respond",
        message: validationError,
      };
    }

    return {
      ...parsed,
      toolName: normalizedName,
      toolInput,
    };
  }

  private static async attachCustomerToToolInput(
    parsed: AiActionResponse,
    businessId: string,
    customerPhone: string
  ): Promise<AiActionResponse> {
    if (parsed.action !== "tool") {
      return parsed;
    }

    const normalizedName = this.normalizeToolName(parsed.toolName);
    if (!normalizedName) {
      return parsed;
    }

    if (normalizedName !== "createOrderTool" && normalizedName !== "createBookingTool") {
      return {
        ...parsed,
        toolName: normalizedName,
      };
    }

    const customer = await CustomersService.findByPhone(businessId, customerPhone);
    if (!customer) {
      return {
        ...parsed,
        toolName: normalizedName,
      };
    }

    return {
      ...parsed,
      toolName: normalizedName,
      toolInput: {
        ...(parsed.toolInput || {}),
        customerId: String(customer._id),
      },
    };
  }

  private static normalizeToolName(
    toolName?: string
  ): "createOrderTool" | "createBookingTool" | "initiatePaymentTool" | "getCatalogTool" | null {
    if (!toolName) {
      return null;
    }

    if ((this.supportedTools as readonly string[]).includes(toolName)) {
      return toolName as any;
    }

    const compact = toolName.toLowerCase().replace(/[^a-z]/g, "");
    return this.toolAliases[compact] || null;
  }

  private static validateToolInput(toolName: string, toolInput: Record<string, unknown>): string | null {
    if (toolName === "getCatalogTool") {
      return null;
    }

    if (toolName === "createOrderTool") {
      const customerId = toolInput.customerId;
      const items = toolInput.items;
      const hasValidItems =
        Array.isArray(items) &&
        items.length > 0 &&
        items.every((item: any) => {
          const hasCatalogItemId =
            typeof item?.catalogItemId === "string" && item.catalogItemId.trim().length > 0;
          const quantity = Number(item?.quantity);
          return hasCatalogItemId && Number.isFinite(quantity) && quantity > 0;
        });

      if (!customerId || !hasValidItems) {
        return "To create your order, please provide customerId and at least one item with catalogItemId and quantity.";
      }
      return null;
    }

    if (toolName === "createBookingTool") {
      if (!toolInput.customerId || !toolInput.serviceId || !toolInput.bookingDate || !toolInput.bookingTime) {
        return "To create a booking, please provide customerId, serviceId, bookingDate, and bookingTime.";
      }
      return null;
    }

    if (toolName === "initiatePaymentTool") {
      if (!toolInput.amount || !toolInput.email) {
        return "To initiate payment, please provide amount and email.";
      }
      return null;
    }

    return null;
  }

  private static fallbackResponse(message: string): AiActionResponse {
    const lower = message.toLowerCase();
    if (lower.includes("catalog") || lower.includes("price") || lower.includes("product")) {
      return {
        action: "tool",
        message: "Let me fetch the latest catalog for you.",
        toolName: "getCatalogTool",
      };
    }

    return {
      action: "respond",
      message: "Thanks for your message. How can I help with your order or booking today?",
    };
  }
}

