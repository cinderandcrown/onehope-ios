import { scryptSync } from "node:crypto";

import { churchMedia, mediaTenant, type ChurchImages, type ChurchMedia } from "./media";
import { publicBaseUrl } from "./public-url";

export type AppConfig = {
  env: "demo" | "production";
  masterAdminPrimaryName: string;
  masterAdminPrimaryEmail: string;
  masterAdminSecondaryName: string;
  masterAdminSecondaryEmail: string;
  fieldEncryptionKey: Buffer;
  fieldEncryptionMode: "demo" | "configured";
  stripeSecretKey: string;
  stripePublishableKey: string;
  givingLive: boolean;
  applePayNonprofitApproved: boolean;
  sessionIdleStaffMs: number;
  sessionIdleMemberMs: number;
  stepUpMs: number;
  youtubeChannelId: string;
  facebookPageId: string;
  facebookPageToken: string;
  resendApiKey: string;
  twilioAccountSid: string;
  planningCenterClientId: string;
  planningCenterClientSecret: string;
  publicBaseUrl: string;
  coffeeOrderingLive: boolean;
  squareAccessToken: string;
  squareLocationId: string;
  squareApplicationId: string;
  squareEnvironment: string;
  squareWebhookSignatureKey: string;
  squareWebhookNotificationUrl: string;
  images: ChurchImages;
  media: ChurchMedia;
  mediaTenant: string;
};

export { churchImages } from "./media";
export type { ChurchImages, ChurchMedia } from "./media";

/** Only for reading snapshots written before a configured key. New writes use FIELD_ENCRYPTION_KEY. */
export function demoFieldKey(): Buffer {
  return scryptSync("onehope-demo-not-for-production", "onehope-demo-salt", 32);
}

/**
 * ONEHOPE_ENV must be "production" or "demo". Unset means demo, except on Vercel
 * production, where it means production. Any other value is refused: a typo must
 * never fall back to demo mode with sample data and published sample logins.
 */
export function resolveEnvMode(env: NodeJS.ProcessEnv = process.env): "demo" | "production" {
  const raw = env.ONEHOPE_ENV;
  const requested = (raw ?? "").trim().toLowerCase();
  if (requested === "production" || requested === "demo") return requested;
  if (requested === "") return env.VERCEL_ENV === "production" ? "production" : "demo";
  if (env.VERCEL_ENV === "production") {
    // Vercel production already resolves to production, the safe side. Log loudly and keep serving.
    console.error(
      `[onehope] ONEHOPE_ENV="${raw}" is not recognized. Treating this Vercel production deployment as production. Set ONEHOPE_ENV=production.`,
    );
    return "production";
  }
  const message = `ONEHOPE_ENV="${raw}" is not recognized. Use "production" or "demo". Refusing to start rather than fall back to demo mode with sample data.`;
  console.error(`[onehope] ${message}`);
  throw new Error(message);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = resolveEnvMode(env);
  const rawKey = env.FIELD_ENCRYPTION_KEY ?? "";
  if (mode === "production" && rawKey.length === 0) {
    throw new Error("FIELD_ENCRYPTION_KEY is required when ONEHOPE_ENV=production.");
  }
  let fieldEncryptionKey: Buffer;
  let fieldEncryptionMode: "demo" | "configured";
  if (rawKey.length > 0) {
    fieldEncryptionKey = Buffer.from(rawKey, "base64");
    if (fieldEncryptionKey.length !== 32) {
      throw new Error("FIELD_ENCRYPTION_KEY must decode to 32 bytes.");
    }
    fieldEncryptionMode = "configured";
  } else {
    fieldEncryptionKey = demoFieldKey();
    fieldEncryptionMode = "demo";
  }
  return {
    env: mode,
    masterAdminPrimaryName: env.MASTER_ADMIN_PRIMARY_NAME || "Nicholas Will",
    masterAdminPrimaryEmail: env.MASTER_ADMIN_PRIMARY_EMAIL || "nicholas.will@cinderandcrown.com",
    masterAdminSecondaryName: env.MASTER_ADMIN_SECONDARY_NAME || "Lead Pastor",
    masterAdminSecondaryEmail: env.MASTER_ADMIN_SECONDARY_EMAIL || "",
    fieldEncryptionKey,
    fieldEncryptionMode,
    stripeSecretKey: env.STRIPE_SECRET_KEY || "",
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || "",
    givingLive: env.GIVING_LIVE === "true",
    applePayNonprofitApproved: env.APPLE_PAY_NONPROFIT_APPROVED === "true",
    sessionIdleStaffMs: 15 * 60 * 1000,
    sessionIdleMemberMs: 12 * 60 * 60 * 1000,
    stepUpMs: 5 * 60 * 1000,
    youtubeChannelId: env.YOUTUBE_CHANNEL_ID || "UCq2WteT5jNlWmXNofRMvQfw",
    facebookPageId: env.FACEBOOK_PAGE_ID || "",
    facebookPageToken: env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
    resendApiKey: env.RESEND_API_KEY || "",
    twilioAccountSid: env.TWILIO_ACCOUNT_SID || "",
    planningCenterClientId: env.PLANNING_CENTER_CLIENT_ID || "",
    planningCenterClientSecret: env.PLANNING_CENTER_CLIENT_SECRET || "",
    publicBaseUrl: publicBaseUrl(env),
    coffeeOrderingLive: env.COFFEE_ORDERING_LIVE === "true",
    squareAccessToken: env.SQUARE_ACCESS_TOKEN || "",
    squareLocationId: env.SQUARE_LOCATION_ID || "",
    squareApplicationId: env.SQUARE_APPLICATION_ID || "",
    squareEnvironment: env.SQUARE_ENVIRONMENT || "sandbox",
    squareWebhookSignatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY || "",
    squareWebhookNotificationUrl: env.SQUARE_WEBHOOK_NOTIFICATION_URL || "",
    ...mediaConfig(env),
  };
}

function mediaConfig(env: NodeJS.ProcessEnv) {
  const { images, media } = churchMedia(env);
  return { images, media, mediaTenant: mediaTenant(env) };
}
