import { Pool, type PoolClient, neonConfig } from "@neondatabase/serverless";

import { ChurchStore } from "./store";
import { emptyDocument, loadDocument, saveDocumentDiff } from "./document-store";
import { migrate, type SqlClient } from "./migrate";
import { assumeService } from "./service-role";
import { importLegacySnapshot, refuseSampleInProduction } from "./snapshot-import";
import { resolveTenant, tenantProfile } from "./tenancy";

if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;

let pool: Pool | null = null;

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  return url.length > 0 ? url : null;
}

function sharedPool(url: string): Pool {
  if (!pool) pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}

export type StoreScope = { host?: string | null };

/**
 * Serves one request from tenant tables.
 * With no database URL, tests keep the in-memory store.
 * This function does not read or write the legacy JSON snapshot.
 */
export async function withStore<T>(
  fn: (store: ChurchStore) => Promise<T> | T,
  scope: StoreScope = {},
): Promise<T> {
  const url = databaseUrl();
  if (!url) return fn(getMemoryStore());
  const client = await sharedPool(url).connect();
  try {
    const sql = clientSql(client);
    await migrate(sql);
    await importLegacySnapshot(sql);
    return await runRequest(sql, fn, scope.host ?? null);
  } finally {
    client.release();
  }
}

export async function runRequest<T>(
  sql: SqlClient,
  fn: (store: ChurchStore) => Promise<T> | T,
  host: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<T> {
  const mode = env.TENANT_MODE ?? "pooled";
  let tenantId = resolveTenant({ host, mode, singleTenantId: env.TENANT_ID ?? null });
  await sql.query("BEGIN");
  try {
    await sql.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await assumeService(sql);
    if (mode !== "single") {
      const domains = await sql.query<{ host: string; tenant_id: string }>(
        "SELECT host, tenant_id FROM tenant_domains",
      );
      const resolved = resolveTenant({
        host,
        domains: domains.rows.map((row) => ({ host: row.host, tenantId: row.tenant_id })),
      });
      if (resolved !== tenantId) {
        tenantId = resolved;
        await sql.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      }
    }
    const profile = tenantProfile(tenantId);
    const ready = await sql.query<{ tenant_id: string }>("SELECT tenant_id FROM tenant_runtime WHERE tenant_id = $1", [
      tenantId,
    ]);
    if (ready.rows.length === 0) {
      const seeded = tenantId === "onehope" ? ChurchStore.demo(env).toDocument() : emptyDocument();
      refuseSampleInProduction(seeded, env);
      await saveDocumentDiff(sql, tenantId, emptyDocument(), seeded, { syncModules: tenantId === "onehope" });
      await sql.query("INSERT INTO tenant_runtime (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING", [tenantId]);
    }
    const loaded = await loadDocument(sql, tenantId);
    const store = ChurchStore.demo(env);
    if (tenantId === "onehope") store.installDocument(structuredClone(loaded));
    else store.replaceDocument(structuredClone(loaded));
    store.bindTenant(profile);
    const result = await fn(store);
    await saveDocumentDiff(sql, tenantId, loaded, store.toDocument(), { syncModules: tenantId === "onehope" });
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

function clientSql(client: PoolClient): SqlClient {
  return {
    async exec(sqlText) {
      await client.query(sqlText);
    },
    async query<T extends Record<string, unknown>>(text: string, params?: readonly unknown[]) {
      const result = await client.query(text, params ? [...params] : []);
      return { rows: result.rows as T[] };
    },
  };
}
