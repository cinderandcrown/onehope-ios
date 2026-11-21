// Applies server/migrations to the Preview database during a Vercel Preview build.
// It runs only when VERCEL_ENV is "preview" and a DATABASE_URL is set, so
// production deployments and local or CI builds skip it. Migrations are
// additive and tracked in schema_migrations, so a re-run is a no-op.
// The connection string is never logged.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const env = process.env;
if (env.VERCEL_ENV !== "preview") {
  console.log(`preview-migrate: skipped (VERCEL_ENV=${env.VERCEL_ENV ?? "unset"})`);
  process.exit(0);
}
const url = env.DATABASE_URL || env.POSTGRES_URL;
if (!url) {
  console.log("preview-migrate: skipped (no DATABASE_URL in this Preview build)");
  process.exit(0);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../server/migrations");
const migrations = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => ({ version: name.replace(/\.sql$/, ""), sql: readFileSync(join(dir, name), "utf8") }));

const local = /localhost|127\.0\.0\.1/.test(url);
let pool;
if (local) {
  const { Pool } = await import("pg");
  pool = new Pool({ connectionString: url, max: 1 });
} else {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
  pool = new Pool({ connectionString: url, max: 1 });
}

const LOCK = 14012; // same advisory lock as server/src/migrate.ts
const client = await pool.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query("SELECT pg_advisory_lock($1)", [LOCK]);
  const applied = [];
  try {
    for (const m of migrations) {
      const found = await client.query("SELECT version FROM schema_migrations WHERE version = $1", [
        m.version,
      ]);
      if (found.rows.length > 0) continue;
      await client.query(m.sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [m.version]);
      applied.push(m.version);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK]);
  }
  const versions = (await client.query("SELECT version FROM schema_migrations ORDER BY version")).rows.map(
    (r) => r.version,
  );
  const tables = (
    await client.query(
      "SELECT to_regclass('public.featured_messages') IS NOT NULL AS featured_messages, to_regclass('public.kids_team') IS NOT NULL AS kids_team",
    )
  ).rows[0];
  console.log(`preview-migrate: applied now [${applied.join(", ") || "none"}]`);
  console.log(`preview-migrate: schema_migrations [${versions.join(", ")}]`);
  console.log(
    `preview-migrate: tables featured_messages=${tables.featured_messages} kids_team=${tables.kids_team}`,
  );
} finally {
  client.release();
  await pool.end();
}
