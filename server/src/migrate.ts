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

const MIGRATE_LOCK = 14012;

export async function migrate(db: SqlClient, migrations = loadMigrations()): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.query("SELECT pg_advisory_lock($1)", [MIGRATE_LOCK]);
  const applied: string[] = [];
  try {
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
  } finally {
    await db.query("SELECT pg_advisory_unlock($1)", [MIGRATE_LOCK]);
  }
  return applied;
}
