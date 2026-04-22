import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CatalogService } from "../../catalog/services/catalog.service";
import { CreateBookingDto } from "../../bookings/dto/booking.dto";
import { BookingsService } from "../../bookings/services/bookings.service";
import { CreateOrderDto } from "../../orders/dto/order.dto";
import { OrdersService } from "../../orders/services/orders.service";
import { PaymentsService } from "../../payments/services/payments.service";
import { HttpError } from "../../../helpers/http-error";
import CatalogItem from "../../catalog/schema/catalog.schema";

const validatePayload = async <T extends object>(dtoClass: new () => T, data: unknown) => {
  const dto = plainToInstance(dtoClass, data);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  // console.log('errors', errors)
  if (errors.length > 0) {
    const details = errors.map((error) => ({
      property: error.property,
      constraints: error.constraints,
      children: error.children,
    }));
    throw new HttpError("Tool input validation failed", 400, details);
  }
  return dto;
};

export class AIToolsService {
  static async createOrderTool(businessId: string, payload: unknown) {
    const normalizedPayload = await this.normalizeCreateOrderPayload(businessId, payload);
    const dto = await validatePayload(CreateOrderDto, normalizedPayload);
    const order = await OrdersService.create(businessId, dto);
    return { orderId: order.id, totalAmount: order.totalAmount, status: order.status };
  }

  static async createBookingTool(businessId: string, payload: unknown) {
    const dto = await validatePayload(CreateBookingDto, payload);
    const booking = await BookingsService.create(businessId, dto);
    return { bookingId: booking.id, status: booking.status };
  }

  static async initiatePaymentTool(
    businessId: string,
    payload: { amount: number; email: string; orderId?: string; bookingId?: string }
  ) {
    if (!payload.amount || !payload.email) {
      throw new HttpError("amount and email are required", 400);
    }
    return PaymentsService.createPaymentLink({
      businessId,
      amount: payload.amount,
      email: payload.email,
      orderId: payload.orderId,
      bookingId: payload.bookingId,
    });
  }

  static async getCatalogTool(businessId: string) {
    const catalog = await CatalogService.list(businessId);
    return catalog.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      description: item.description,
      price: item.price,
      discountAmount: item.discountAmount,
      quantity: item.quantity,
      durationMinutes: item.durationMinutes,
      active: item.active,
    }));
  }

  private static async normalizeCreateOrderPayload(
    businessId: string,
    payload: unknown
  ): Promise<Record<string, unknown>> {
    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const input = (payload || {}) as Record<string, unknown>;
    const rawItems = Array.isArray(input.items) ? input.items : [];

    const normalizedItemsRaw = await Promise.all(
      rawItems.map(async (rawItem) => {
        const item = (rawItem || {}) as Record<string, unknown>;
        const explicitId =
          typeof item.catalogItemId === "string"
            ? item.catalogItemId
            : typeof item.catalogId === "string"
              ? item.catalogId
              : typeof item.id === "string"
                ? item.id
                : null;
        const productName =
          typeof item.name === "string"
            ? item.name
            : typeof item.productName === "string"
              ? item.productName
              : typeof item.title === "string"
                ? item.title
              : null;

        let resolvedCatalogItemId = explicitId;
        if (!resolvedCatalogItemId && productName) {
          const catalog = await CatalogItem.findOne({
            businessId,
            name: { $regex: `^${escapeRegex(productName.trim())}$`, $options: "i" },
            active: true,
          }).select("_id");
          if (catalog) {
            resolvedCatalogItemId = String(catalog._id);
          }
        }

        if (!resolvedCatalogItemId) {
          return null;
        }

        const rawQuantity =
          item.quantity !== undefined ? item.quantity : item.qty !== undefined ? item.qty : item.count;
        const quantityValue = Number(rawQuantity);
        return {
          catalogItemId: resolvedCatalogItemId,
          quantity: Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1,
        };
      })
    );
    const normalizedItems = normalizedItemsRaw.filter(Boolean);

    if (normalizedItems.length === 0) {
      throw new HttpError(
        "No valid catalog items found in order request. Ask user to pick an item from the catalog first.",
        400
      );
    }

    return {
      ...input,
      items: normalizedItems,
    };
  }
}

