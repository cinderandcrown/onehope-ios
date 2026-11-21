import { ChurchStore } from "./store";

export { createApi, API_ROUTES } from "./api";
export { loadSermons } from "./adapters";
export { cachedSermons, clearSermonCache, pageOf } from "./http-cache";
export { CAPABILITIES, PUBLIC_KJV } from "./capabilities";
export { loadConfig, resolveEnvMode } from "./config";
export {
  OUTCOME_LABELS,
  QUIET_AFTER_DAYS,
  STAGE_LABELS,
  STAGES,
  TAG_KINDS,
  TOUCH_KINDS,
  TOUCH_LABELS,
  TOUCH_OUTCOMES,
  type Stage,
  type TagKind,
  type TouchKind,
  type TouchOutcome,
} from "./people-care";
export { churchImages, churchMedia, loadMedia, httpsURL, type ChurchImages, type ChurchMedia } from "./media";
export * from "./contracts";
export * from "./domain";
export * from "./faith";
export * from "./church-copy";
export * from "./public-url";
export * from "./social";
export * from "./coffee";
export { createLogger, redact, noopReporter } from "./logger";
export {
  SAMPLE_MEMBER_EMAIL,
  SAMPLE_PASSWORD,
  SAMPLE_PASTOR_EMAIL,
  SAMPLE_TOTP_BASE32,
} from "./sample-accounts";
export { ChurchStore } from "./store";
export {
  databaseUrl,
  isWriteConflict,
  retryWrite,
  runRequest,
  seedTenantIfEmpty,
  storeErrorResponse,
  withStore,
  UnknownTenantError,
  type StoreScope,
} from "./persist";
export { ADAPTERS, assertTruthful, projectCapabilities } from "./adapter-registry";
export { tablesFor } from "./request-tables";
export { WriteConflictError } from "./document-store";
export { localAuthProvider } from "./auth-provider";
export { emptyDocument, loadDocument, saveDocumentDiff } from "./document-store";
export { enqueueJob, claimJobs, finishJob } from "./outbox";
export { fakeEmailAdapter, readTenantSecret, saveTenantSecret } from "./integrations";
export { importLegacySnapshot } from "./snapshot-import";
export { exportTenant, restoreTenant } from "./tenant-bundle";
export { resolveTenant, tenantProfile } from "./tenancy";
export { withServiceRole } from "./service-role";
export { memorySyncStore, runSync } from "./sync";
export { totpCode, decodeBase32, encodeBase32 } from "./totp";
export { qrSvg } from "./qr-svg";
export {
  ANNOUNCEMENT_TEMPLATES,
  announcementIsLive,
  announcementTemplate,
  EVENT_TEMPLATES,
  eventTemplate,
  nextChurchMoment,
  PUSH_TEMPLATES,
  pushTemplate,
  SERVE_TEMPLATES,
  serveTemplate,
  chicagoInputValue,
  formatChicago,
  parseChicagoLocal,
} from "./staff-desk";
export { VERSION } from "./version";

const globalStore = globalThis as typeof globalThis & { __onehope?: ChurchStore };

export function getDemoStore(): ChurchStore {
  if (!globalStore.__onehope) globalStore.__onehope = ChurchStore.demo();
  return globalStore.__onehope;
}
