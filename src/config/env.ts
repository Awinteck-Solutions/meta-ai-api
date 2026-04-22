import * as dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const defaultFrontend = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

export const env = {
  port: Number(process.env.PORT || 3000),
  mongodbUri: process.env.MONGODB_URI || process.env.DB_URL || "",
  jwtSecret: getEnv("JWT_SECRET"),
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  whatsappToken: process.env.WHATSAPP_TOKEN || "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  paystackSecret: process.env.PAYSTACK_SECRET || "",
  /** Used for Paystack `callback_url` after subscription checkout. */
  frontendUrl: defaultFrontend,
  /** Graph API version for WhatsApp / OAuth calls (e.g. v22.0). */
  metaGraphApiVersion: (process.env.META_GRAPH_API_VERSION || "v22.0").replace(/^\//, ""),
  /** Meta app ID for Embedded Signup + FB JS SDK. */
  metaAppId: (process.env.META_APP_ID || "").trim(),
  /** Meta app secret — server-side code exchange only; never expose to client. */
  metaAppSecret: (process.env.META_APP_SECRET || "").trim(),
  /** Embedded Signup configuration ID from Meta Developer Console (Facebook Login for Business). */
  metaEmbeddedSignupConfigId: (process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || "").trim(),
  /**
   * Default OAuth redirect URI for exchanging the Embedded Signup `code`.
   * Must be listed in Meta app “Valid OAuth Redirect URIs” (typically your dashboard settings URL).
   */
  whatsappOAuthRedirectUri: (process.env.WHATSAPP_OAUTH_REDIRECT_URI || "").trim() || `${defaultFrontend}/dashboard/settings`,
  qdrantUrl: process.env.QDRANT_URL || "",
  qdrantApiKey: process.env.QDRANT_API_KEY || "",
};

