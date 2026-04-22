import { instanceToPlain } from "class-transformer";
import { HttpError } from "../../../helpers/http-error";
import Business from "../schema/business.schema";
import { CreateBusinessDto, UpdateBusinessDto } from "../dto/business.dto";

/** DTO instances are not safe to spread into Mongoose `$set`; normalize to a plain object. */
function toPlainWhatsappInput(w: unknown): {
  phoneNumber?: string;
  phoneNumberId?: string;
  accessToken?: string;
} {
  if (w == null || typeof w !== "object") return {};
  const o = JSON.parse(JSON.stringify(w)) as Record<string, unknown>;
  return {
    phoneNumber: typeof o.phoneNumber === "string" ? o.phoneNumber : undefined,
    phoneNumberId: typeof o.phoneNumberId === "string" ? o.phoneNumberId : undefined,
    accessToken: typeof o.accessToken === "string" ? o.accessToken : undefined,
  };
}

function persistableWhatsappSubdoc(
  w: { phoneNumber?: string; phoneNumberId?: string; accessToken?: string; connected?: boolean } | null | undefined
): { phoneNumber?: string; phoneNumberId?: string; accessToken?: string } | undefined {
  if (w == null) return undefined;
  const { phoneNumber, phoneNumberId, accessToken } = toPlainWhatsappInput(w);
  const out: { phoneNumber?: string; phoneNumberId?: string; accessToken?: string } = {};
  if (phoneNumber !== undefined && phoneNumber !== null && phoneNumber !== "") out.phoneNumber = phoneNumber;
  if (phoneNumberId !== undefined && phoneNumberId !== null && phoneNumberId !== "") out.phoneNumberId = phoneNumberId;
  if (accessToken !== undefined && accessToken !== null && accessToken !== "") out.accessToken = accessToken;
  return Object.keys(out).length ? out : undefined;
}

export class BusinessService {
  static async create(ownerId: string, payload: CreateBusinessDto) {
    const existing = await Business.findOne({ ownerId }).lean();
    if (existing) {
      throw new HttpError("Business already exists for this account", 409);
    }

    const plain = instanceToPlain(payload) as Record<string, unknown>;
    const { whatsapp, ...rest } = plain;
    const business = await Business.create({
      ownerId,
      ...rest,
      ...(whatsapp != null ? { whatsapp: persistableWhatsappSubdoc(whatsapp as never) ?? {} } : {}),
    });

    return business;
  }

  static async getByOwner(ownerId: string) {
    const business = await Business.findOne({ ownerId });
    if (!business) {
      throw new HttpError("Business not found", 404);
    }
    return business;
  }

  static async update(ownerId: string, payload: UpdateBusinessDto) {
    const existing = await Business.findOne({ ownerId });
    if (!existing) {
      throw new HttpError("Business not found", 404);
    }

    const plain = instanceToPlain(payload) as Record<string, unknown>;
    const { whatsapp: _wa, ...rest } = plain;
    const $set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue;
      if (k === "paystackSecretKey") {
        const sk = String(v).trim();
        if (sk) $set.paystackSecretKey = sk;
        continue;
      }
      $set[k] = v;
    }

    if (payload.whatsapp != null) {
      const prev = {
        phoneNumber: existing.whatsapp?.phoneNumber ?? undefined,
        phoneNumberId: existing.whatsapp?.phoneNumberId ?? undefined,
        accessToken: existing.whatsapp?.accessToken ?? undefined,
      };
      const next = persistableWhatsappSubdoc(toPlainWhatsappInput(payload.whatsapp));
      if (next && Object.keys(next).length > 0) {
        $set.whatsapp = { ...prev, ...next };
      }
    }

    const business = await Business.findOneAndUpdate({ ownerId }, { $set }, { new: true, runValidators: true });
    return business!;
  }

  static async getByPhoneNumberId(phoneNumberId: string) {
    return Business.findOne({ "whatsapp.phoneNumberId": phoneNumberId });
  }

  /** Clears WhatsApp Cloud API credentials for the owner’s business (disconnect). */
  static async clearWhatsapp(ownerId: string) {
    const existing = await Business.findOne({ ownerId });
    if (!existing) {
      throw new HttpError("Business not found", 404);
    }
    await Business.findOneAndUpdate(
      { ownerId },
      {
        $set: {
          "whatsapp.phoneNumber": "",
          "whatsapp.phoneNumberId": "",
          "whatsapp.accessToken": "",
        },
      },
      { new: true, runValidators: true }
    );
    return this.getByOwner(ownerId);
  }

  static async testWhatsappConnection(ownerId: string) {
    const business = await this.getByOwner(ownerId);
    const hasConfig = Boolean(
      business.whatsapp?.phoneNumber && business.whatsapp?.phoneNumberId && business.whatsapp?.accessToken
    );

    return {
      success: hasConfig,
      message: hasConfig
        ? "Connection verified — test message sent!"
        : "Connection failed — check your credentials.",
    };
  }
}

