import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Migration = { version: string; sql: string };

export type SqlClient = {
  exec: (sql: string) => Promise<void>;
  query: <T extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: T[] }>;
};

export function loadMigrations(dir = defaultMigrationDir()): Migration[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      version: name.replace(/\.sql$/, ""),
      sql: readFileSync(join(dir, name), "utf8"),
    }));
}

export function defaultMigrationDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../migrations");
}

export async function migrate(db: SqlClient, migrations = loadMigrations()): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied: string[] = [];
  for (const migration of migrations) {
    const found = await db.query<{ version: string }>(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [migration.version],
    );
    if (found.rows.length > 0) continue;
    await db.exec(migration.sql);
    await db.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migration.version]);
    applied.push(migration.version);
  }
  return applied;
}
