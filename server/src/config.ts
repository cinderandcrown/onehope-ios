import { scryptSync } from "node:crypto";

export type AppConfig = {
  env: "demo" | "production";
  masterAdminPrimaryName: string;
  masterAdminPrimaryEmail: string;
  masterAdminSecondaryName: string;
  masterAdminSecondaryEmail: string;
  fieldEncryptionKey: Buffer;
  fieldEncryptionMode: "demo" | "configured";
  stripeSecretKey: string;
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
};

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
    fieldEncryptionKey = scryptSync("onehope-demo-not-for-production", "onehope-demo-salt", 32);
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
  };
}
