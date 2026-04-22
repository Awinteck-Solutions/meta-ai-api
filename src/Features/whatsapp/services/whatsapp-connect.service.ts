/**
 * WhatsApp Embedded Signup — exchanges OAuth `code` server-side and persists Cloud API credentials.
 * Tokens are not returned from status endpoints; consider encrypting `whatsapp.accessToken` at rest (see TOKEN_ENCRYPTION_KEY) for production hardening.
 */
import axios from "axios";
import * as jwt from "jsonwebtoken";
import { env } from "../../../config/env";
import { HttpError } from "../../../helpers/http-error";
import { BusinessService } from "../../businesses/services/business.service";

const STATE_TYP = "wa_embed" as const;
const STATE_TTL = "10m";

type WaConnectJwt = {
  typ: typeof STATE_TYP;
  uid: string;
  bid: string;
};

function graphBase(): string {
  const v = env.metaGraphApiVersion.startsWith("v") ? env.metaGraphApiVersion : `v${env.metaGraphApiVersion}`;
  return `https://graph.facebook.com/${v}`;
}

function assertEmbeddedSignupConfigured(): void {
  if (!env.metaAppId || !env.metaAppSecret || !env.metaEmbeddedSignupConfigId) {
    throw new HttpError(
      "WhatsApp Embedded Signup is not configured. Set META_APP_ID, META_APP_SECRET, and META_EMBEDDED_SIGNUP_CONFIG_ID.",
      503
    );
  }
}

/** Same-origin dashboard URLs only (prevents open redirects on code exchange). */
function assertRedirectAllowed(redirectUri: string): void {
  let url: URL;
  try {
    url = new URL(redirectUri.trim());
  } catch {
    throw new HttpError("Invalid redirect_uri", 400);
  }
  let base: URL;
  try {
    base = new URL(env.frontendUrl);
  } catch {
    throw new HttpError("Server FRONTEND_URL is invalid", 500);
  }
  if (url.origin !== base.origin) {
    throw new HttpError("redirect_uri must use the same origin as FRONTEND_URL", 400);
  }
  if (!url.pathname.startsWith("/dashboard")) {
    throw new HttpError("redirect_uri must be a dashboard path (e.g. /dashboard/settings)", 400);
  }
}

export class WhatsappConnectService {
  static createStateToken(ownerId: string, businessId: string): string {
    assertEmbeddedSignupConfigured();
    const payload: WaConnectJwt = { typ: STATE_TYP, uid: ownerId, bid: businessId };
    return jwt.sign(payload, env.jwtSecret, { expiresIn: STATE_TTL });
  }

  static verifyStateToken(state: string, ownerId: string, businessId: string): void {
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(state, env.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new HttpError("Invalid or expired connect session. Start again from Connect.", 400);
    }
    if (decoded.typ !== STATE_TYP || decoded.uid !== ownerId || decoded.bid !== businessId) {
      throw new HttpError("Connect session does not match this account.", 403);
    }
  }

  static async exchangeCodeForUserAccessToken(code: string, redirectUri: string): Promise<string> {
    assertEmbeddedSignupConfigured();
    const url = `${graphBase()}/oauth/access_token`;
    try {
      const res = await axios.get<{ access_token?: string }>(url, {
        params: {
          client_id: env.metaAppId,
          client_secret: env.metaAppSecret,
          redirect_uri: redirectUri.trim(),
          code: code.trim(),
        },
        timeout: 20000,
      });
      const t = res.data?.access_token;
      if (!t) {
        throw new HttpError("Meta did not return an access token", 502);
      }
      return t;
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const msg =
          (e.response?.data as { error?: { message?: string } })?.error?.message ||
          (typeof e.response?.data === "string" ? e.response.data : e.message);
        throw new HttpError(`Meta token exchange failed: ${msg}`, 400);
      }
      throw e;
    }
  }

  /** Prefer long-lived user token when Meta allows exchange. */
  static async exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
    assertEmbeddedSignupConfigured();
    const url = `${graphBase()}/oauth/access_token`;
    try {
      const res = await axios.get<{ access_token?: string }>(url, {
        params: {
          grant_type: "fb_exchange_token",
          client_id: env.metaAppId,
          client_secret: env.metaAppSecret,
          fb_exchange_token: shortLivedToken,
        },
        timeout: 20000,
      });
      return res.data?.access_token || shortLivedToken;
    } catch {
      return shortLivedToken;
    }
  }

  static async fetchPhoneNumberProfile(accessToken: string, phoneNumberId: string): Promise<{ displayPhone: string }> {
    const id = encodeURIComponent(phoneNumberId.trim());
    try {
      const res = await axios.get<{ display_phone_number?: string; verified_name?: string }>(
        `${graphBase()}/${id}`,
        {
          params: { fields: "display_phone_number,verified_name" },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
      const display =
        (typeof res.data?.display_phone_number === "string" && res.data.display_phone_number) ||
        (typeof res.data?.verified_name === "string" && res.data.verified_name) ||
        "";
      return { displayPhone: display };
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const msg =
          (e.response?.data as { error?: { message?: string } })?.error?.message || e.message;
        throw new HttpError(`Could not read WhatsApp phone number from Meta: ${msg}`, 400);
      }
      throw e;
    }
  }

  static async finalizeAndPersist(
    ownerId: string,
    businessId: string,
    body: { state: string; code: string; redirectUri: string; phoneNumberId: string }
  ) {
    this.verifyStateToken(body.state, ownerId, businessId);
    assertRedirectAllowed(body.redirectUri);

    const shortToken = await this.exchangeCodeForUserAccessToken(body.code, body.redirectUri);
    const accessToken = await this.exchangeForLongLivedToken(shortToken);
    const { displayPhone } = await this.fetchPhoneNumberProfile(accessToken, body.phoneNumberId);

    await BusinessService.update(ownerId, {
      whatsapp: {
        phoneNumber: displayPhone || undefined,
        phoneNumberId: body.phoneNumberId.trim(),
        accessToken: accessToken.trim(),
      },
    } as never);

    return {
      connected: true,
      phoneNumber: displayPhone || "",
      phoneNumberId: body.phoneNumberId.trim(),
    };
  }
}
