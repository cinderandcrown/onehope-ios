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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = env.ONEHOPE_ENV === "production" ? "production" : "demo";
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
