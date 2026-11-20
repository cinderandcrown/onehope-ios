import { ChurchStore } from "./store";

export { createApi, API_ROUTES } from "./api";
export { loadSermons } from "./adapters";
export { CAPABILITIES, PUBLIC_KJV } from "./capabilities";
export { churchImages, loadConfig } from "./config";
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
export { totpCode, decodeBase32 } from "./totp";
export { VERSION } from "./version";

const globalStore = globalThis as typeof globalThis & { __onehope?: ChurchStore };

export function getDemoStore(): ChurchStore {
  if (!globalStore.__onehope) globalStore.__onehope = ChurchStore.demo();
  return globalStore.__onehope;
}
