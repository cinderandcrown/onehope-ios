import { ChurchStore } from "./store";
import {
  emptyDocument,
  loadDocument,
  saveDocumentDiff,
  WriteConflictError,
  type LoadOptions,
} from "./document-store";
import { loadConfig } from "./config";
import { clientSql, createPool, type DbPool } from "./db-pool";
import type { SqlClient } from "./migrate";
import { assumeService } from "./service-role";
import { refuseSampleInProduction } from "./snapshot-import";
import { resolveTenant, tenantProfile, UnknownTenantError } from "./tenancy";

export { UnknownTenantError };

let pool: DbPool | null = null;

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  return url.length > 0 ? url : null;
}

function sharedPool(url: string): DbPool {
  if (!pool) pool = createPool(url, 5);
  return pool;
}

export type RequestProfile = "none" | "request" | "audit";

export type StoreScope = {
  host?: string | null;
  token?: string | null;
  profile?: RequestProfile;
  /** Omit to load every table. An empty list loads nothing. */
  tables?: readonly string[];
};

/**
 * Serves one request from tenant tables.
 * Migrations and the blob import are not run here. Use server/scripts/seed.ts.
 * With no database URL, tests keep the in-memory store.
 */
export async function withStore<T>(
  fn: (store: ChurchStore) => Promise<T> | T,
  scope: StoreScope = {},
): Promise<T> {
  const url = databaseUrl();
  if (!url) return fn(getMemoryStore());
  const client = await sharedPool(url).connect();
  try {
    return await runRequest(clientSql(client), fn, scope.host ?? null, process.env, {
      profile: scope.profile ?? "request",
      sessionToken: scope.token ?? null,
      tables: scope.tables,
    });
  } finally {
    client.release();
  }
}

export async function seedTenantIfEmpty(
  sql: SqlClient,
  tenantId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await sql.query("BEGIN");
  try {
    await sql.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await assumeService(sql);
    const ready = await sql.query<{ tenant_id: string }>(
      "SELECT tenant_id FROM tenant_runtime WHERE tenant_id = $1",
      [tenantId],
    );
    if (ready.rows.length === 0) {
      const seeded = tenantId === "onehope" ? ChurchStore.demo(env).toDocument() : emptyDocument();
      refuseSampleInProduction(seeded, env);
      await saveDocumentDiff(sql, tenantId, emptyDocument(), seeded, {
        syncModules: tenantId === "onehope",
        platformKey: loadConfig(env).fieldEncryptionKey,
      });
      await sql.query("INSERT INTO tenant_runtime (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING", [
        tenantId,
      ]);
    }
    await sql.query("COMMIT");
  } catch (error) {
    await sql.query("ROLLBACK");
    throw error;
  }
}

export function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof WriteConflictError || (error instanceof Error && error.name === "WriteConflictError")
  );
}

/** Runs once, and a second time when the first attempt loses a row version. */
export async function retryWrite<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isWriteConflict(error)) throw error;
  }
  return run();
}

export function storeErrorResponse(error: unknown): { status: number; body: Record<string, unknown> } | null {
  if (isWriteConflict(error)) {
    return {
      status: 409,
      body: { ok: false, error: "This page changed. Reload and try again.", code: "conflict" },
    };
  }
  if (
    error instanceof UnknownTenantError ||
    (error instanceof Error && error.name === "UnknownTenantError")
  ) {
    return { status: 404, body: { ok: false, error: error.message, code: "not_found" } };
  }
  return null;
}

export async function runRequest<T>(
  sql: SqlClient,
  fn: (store: ChurchStore) => Promise<T> | T,
  host: string | null,
  env: NodeJS.ProcessEnv = process.env,
  options: { profile?: RequestProfile; sessionToken?: string | null; tables?: readonly string[] } = {},
): Promise<T> {
  return retryWrite(() => runRequestOnce(sql, fn, host, env, options));
}

async function runRequestOnce<T>(
  sql: SqlClient,
  fn: (store: ChurchStore) => Promise<T> | T,
  host: string | null,
  env: NodeJS.ProcessEnv,
  options: { profile?: RequestProfile; sessionToken?: string | null; tables?: readonly string[] },
): Promise<T> {
  const mode = env.TENANT_MODE ?? "pooled";
  await sql.query("BEGIN");
  try {
    await assumeService(sql);
    const domains =
      mode === "single"
        ? []
        : (
            await sql.query<{ host: string; tenant_id: string }>("SELECT host, tenant_id FROM tenant_domains")
          ).rows.map((row) => ({ host: row.host, tenantId: row.tenant_id }));
    const tenantId = resolveTenant({
      host,
      mode,
      singleTenantId: env.TENANT_ID ?? null,
      domains: domains.length > 0 ? domains : undefined,
    });
    if (!tenantId) throw new UnknownTenantError(host ?? "");
    await sql.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const profile = tenantProfile(tenantId);
    const store = ChurchStore.demo(env);
    store.bindTenant(profile);
    if ((options.profile ?? "request") === "none") {
      const result = await fn(store);
      await sql.query("COMMIT");
      return result;
    }
    const loadOptions: LoadOptions = {
      includeAudit: options.profile === "audit",
      sessionToken: options.sessionToken ?? null,
      platformKey: loadConfig(env).fieldEncryptionKey,
      tables: options.tables,
    };
    const loaded = await loadDocument(sql, tenantId, loadOptions);
    store.replaceDocument(structuredClone(loaded));
    store.bindTenant(profile);
    const result = await fn(store);
    await saveDocumentDiff(sql, tenantId, loaded, store.toDocument(), {
      syncModules: false,
      platformKey: loadConfig(env).fieldEncryptionKey,
      onlyTables: options.tables,
    });
    await sql.query("COMMIT");
    return result;
  } catch (error) {
    await sql.query("ROLLBACK");
    throw error;
  }
}

function getMemoryStore(): ChurchStore {
  const globalStore = globalThis as typeof globalThis & { __onehope?: ChurchStore };
  if (!globalStore.__onehope) globalStore.__onehope = ChurchStore.demo();
  return globalStore.__onehope;
}
