import axios from "axios";
import { env } from "../../../config/env";
import { HttpError } from "../../../helpers/http-error";
import { BusinessService } from "../../businesses/services/business.service";
import { MessagesService } from "../../messages/services/messages.service";
import { AIService } from "../../ai/services/ai.service";
import { logger } from "../../../helpers/logger";
import { CustomersService } from "../../customers/services/customers.service";
import { SubscriptionUsageService } from "../../billing/services/subscription-usage.service";

export class WhatsAppService {
  private static formatCustomerToolMessage(
    toolName: string,
    aiMessage: string,
    toolResult: any
  ): string {
    if (toolName === "initiatePaymentTool") {
      const reference = toolResult?.paymentReference;
      const paymentLink = toolResult?.authorizationUrl;
      const status = toolResult?.status;

      const lines = [
        "Great news — your payment request is ready.",
        aiMessage || "Please complete your payment using the link below.",
      ];

      if (paymentLink) {
        lines.push(`Payment link: ${paymentLink}`);
      }
      if (reference) {
        lines.push(`Reference: ${reference}`);
      }
      if (status) {
        lines.push(`Status: ${status}`);
      }

      return lines.join("\n");
    }

    return aiMessage || "Your request has been processed successfully.";
  }

  private static shouldPromptForPayment(toolName: string, toolResult: any): boolean {
    const isOrderOrBookingTool =
      toolName === "createOrderTool" || toolName === "createBookingTool";
    if (!isOrderOrBookingTool) {
      return false;
    }

    const hasCreatedEntity = Boolean(toolResult?.orderId || toolResult?.bookingId);
    return hasCreatedEntity;
  }

  private static formatToolContext(toolName: string, toolResult: any): string {
    const summary: Record<string, unknown> = {
      toolName,
      orderId: toolResult?.orderId,
      bookingId: toolResult?.bookingId,
      paymentReference: toolResult?.paymentReference,
      totalAmount: toolResult?.totalAmount,
      status: toolResult?.status,
    };

    return `CONTEXT_TOOL_RESULT ${JSON.stringify(summary)}`;
  }

  static async sendMessage(
    phoneNumberId: string,
    to: string,
    message: string,
    accessToken?: string
  ): Promise<void> {
    const token = accessToken || env.whatsappToken;
    if (!token) {
      logger.warn("WhatsApp token is missing; skipping outbound message", { phoneNumberId, to });
      return;
    }

    // logger.info("Sending WhatsApp outbound message", { phoneNumberId, to, message });
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    // logger.info("WhatsApp outbound message accepted", {
    //   phoneNumberId,
    //   to,
    //   messageId: response?.data?.messages?.[0]?.id,
    //   response: response?.data,
    // });
  }

  static async processWebhook(payload: any): Promise<void> {
    const change = payload?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    const statusUpdate = value?.statuses?.[0];
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (statusUpdate) {
      logger.info("WhatsApp status update", {
        phoneNumberId,
        status: statusUpdate?.status,
        recipientId: statusUpdate?.recipient_id,
        messageId: statusUpdate?.id,
        errors: statusUpdate?.errors,
        pricing: statusUpdate?.pricing,
      });
      return;
    }

    if (!message || !phoneNumberId) {
      return;
    }

    const business = await BusinessService.getByPhoneNumberId(phoneNumberId);
    if (!business) {
      logger.error("Business not found", { phoneNumberId });
      return;
    }

    // logger.info("Business found", { business });

    const inboundText = message?.text?.body || "";
    const customerPhone = message?.from;
    const customerName = value?.contacts?.[0]?.profile?.name;
    const businessIdStr = String(business._id);

    const canReply = await SubscriptionUsageService.canAcceptInboundAiMessage(businessIdStr);
    if (!canReply) {
      logger.warn("Inbound WhatsApp blocked: monthly AI message limit reached", { businessId: businessIdStr });
      if (customerPhone) {
        await this.sendMessage(
          phoneNumberId,
          customerPhone,
          "Sorry — this business has reached its monthly AI message limit on the current plan. Please try again later or contact the business directly.",
          business?.whatsapp?.accessToken || undefined
        );
      }
      return;
    }

    if (customerPhone) {
      try {
        await CustomersService.upsert(businessIdStr, {
          phone: customerPhone,
          name: customerName,
        });
      } catch (e) {
        if (e instanceof HttpError && e.statusCode === 403) {
          await this.sendMessage(
            phoneNumberId,
            customerPhone,
            "Sorry — this business has reached its customer limit on the current plan. Please contact them directly.",
            business?.whatsapp?.accessToken || undefined
          );
          return;
        }
        throw e;
      }
    }

    await SubscriptionUsageService.assertCanCreateMessage(businessIdStr);

    const inbound = await MessagesService.create({
      businessId: businessIdStr,
      customerPhone,
      message: inboundText,
    });

    // logger.info("Inbound message created", { inbound });

    const aiResult = await AIService.answerQuestion({
      businessId: businessIdStr,
      customerPhone,
      message: inboundText,
    });

    logger.info("AI result", { aiResult });

    let outgoing = aiResult.message;
    let responseForStorage = outgoing;
    if (aiResult.action === "tool" && aiResult.toolName) {
      const politeNotice =
        "Certainly — I can help with that. Please hold on while I process your request.";
      try {
        const toolResult = await AIService.executeTool(
          businessIdStr,
          aiResult.toolName,
          aiResult.toolInput
        );
        const contextLine = this.formatToolContext(aiResult.toolName, toolResult);
        const toolMessage = this.formatCustomerToolMessage(
          aiResult.toolName,
          aiResult.message || "Processing your request now.",
          toolResult
        );
        outgoing = aiResult.toolName === "initiatePaymentTool" ? toolMessage : `${politeNotice}\n${toolMessage}`;
        if (this.shouldPromptForPayment(aiResult.toolName, toolResult)) {
          outgoing = `${outgoing}\nWould you like to pay now or pay later?`;
        }
        responseForStorage = `${outgoing}\n${contextLine}`;
      } catch (error) {
        logger.warn("Tool execution failed; responding with guidance", {
          toolName: aiResult.toolName,
          toolInput: aiResult.toolInput,
          error,
        });
        outgoing =
          "Thank you for your request. I need a bit more information before I can complete that action. Please select an item/service from the catalog and provide the required details.";
        responseForStorage = outgoing;
      }
    }

    await MessagesService.updateResponse(String(inbound._id), responseForStorage);
    try {
      await this.sendMessage(
        phoneNumberId,
        customerPhone,
        outgoing || "Sorry, I could not process that request.",
        business?.whatsapp?.accessToken || undefined
      );
    } catch (error) {
      const axiosError = error as any;
      logger.error("Failed to send WhatsApp outbound message", {
        status: axiosError?.response?.status,
        responseData: axiosError?.response?.data,
        phoneNumberId,
        customerPhone,
      });
    }
  }
}

