import { createHash } from "node:crypto";

import { stable } from "./document-store";
import { assumeService } from "./service-role";
import type { SqlClient } from "./migrate";

const SECRET_COLUMNS = new Set([
  "credentials_ciphertext",
  "password_hash",
  "totp_secret",
  "secret_ciphertext",
]);

export type TenantBundle = {
  schemaVersion: "2";
  tenantId: string;
  counts: Record<string, number>;
  checksum: string;
  secretsOmitted: true;
  tables: Record<string, Record<string, unknown>[]>;
};

export async function exportTenant(sql: SqlClient, tenantId: string): Promise<TenantBundle> {
  await sql.query("BEGIN");
  try {
    await sql.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await assumeService(sql);
    const tables = await tenantTables(sql);
    const body: Record<string, Record<string, unknown>[]> = {};
    const counts: Record<string, number> = {};
    for (const table of tables) {
      if (table === "exports") continue;
      const found = await sql.query<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE tenant_id = $1`,
        [tenantId],
      );
      const rows = found.rows
        .map((row) => stripSecrets(normalizeRow(row)))
        .sort((left, right) => stable(left).localeCompare(stable(right)));
      body[table] = rows;
      counts[table] = rows.length;
    }
    const checksum = createHash("sha256").update(stable({ tables: body })).digest("hex");
    await sql.query(
      `INSERT INTO exports (id, tenant_id, schema_version, row_counts) VALUES ($1, $2, '2', $3)`,
      [`export_${Date.now()}`, tenantId, JSON.stringify(counts)],
    );
    await sql.query("COMMIT");
    return { schemaVersion: "2", tenantId, counts, checksum, secretsOmitted: true, tables: body };
  } catch (error) {
    await sql.query("ROLLBACK");
    throw error;
  }
}

export async function restoreTenant(sql: SqlClient, bundle: TenantBundle): Promise<void> {
  if (bundle.schemaVersion !== "2") throw new Error("This bundle version is not supported.");
  if (bundle.secretsOmitted !== true) throw new Error("Refusing a bundle that claims to contain secrets.");
  await sql.query("BEGIN");
  try {
    await sql.query("SELECT set_config('app.tenant_id', $1, true)", [bundle.tenantId]);
    await assumeService(sql);
    for (const [table, rows] of Object.entries(bundle.tables)) {
      if (!/^[a-z][a-z0-9_]*$/.test(table)) throw new Error(`Rejected table ${table}.`);
      for (const row of rows) {
        const cleaned = stripSecrets(row);
        const columns = Object.keys(cleaned).filter((column) => /^[a-z][a-z0-9_]*$/.test(column));
        if (columns.length === 0) continue;
        const values = columns.map((column) => cleaned[column]);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        await sql.query(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
      }
    }
    await sql.query("COMMIT");
  } catch (error) {
    await sql.query("ROLLBACK");
    throw error;
  }
}

async function tenantTables(sql: SqlClient): Promise<string[]> {
  const found = await sql.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'tenant_id'
     GROUP BY table_name
     ORDER BY table_name`,
  );
  return found.rows.map((row) => row.table_name).filter((name) => /^[a-z][a-z0-9_]*$/.test(name));
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date || key === "at" || key.endsWith("_at")) continue;
    copy[key] = value;
  }
  return copy;
}

function stripSecrets(row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_COLUMNS.has(key)) {
      copy[key] = null;
      continue;
    }
    if (key === "record" && typeof value === "string") {
      copy[key] = stripRecord(value);
      continue;
    }
    copy[key] = value;
  }
  return copy;
}

function stripRecord(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return value;
    const record = { ...(parsed as Record<string, unknown>) };
    delete record.passwordHash;
    delete record.totpSecret;
    return JSON.stringify(record);
  } catch {
    return value;
  }
}
