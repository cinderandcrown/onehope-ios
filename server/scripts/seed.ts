import { clientSql, createPool } from "../src/db-pool.ts";
import { migrate } from "../src/migrate.ts";
import { databaseUrl, seedTenantIfEmpty } from "../src/persist.ts";
import { importLegacySnapshot } from "../src/snapshot-import.ts";

const url = databaseUrl();
if (!url) {
  process.stderr.write("Set DATABASE_URL or POSTGRES_URL to the hosted Postgres connection string.\n");
  process.exit(1);
}

const pool = createPool(url, 1);
const client = await pool.connect();
try {
  const sql = clientSql(client);
  await migrate(sql);
  await importLegacySnapshot(sql);
  await seedTenantIfEmpty(sql, "onehope");
} finally {
  client.release();
  await pool.end();
}

process.stdout.write(
  "Migrations are applied and the tenant tables are ready. Lead Pastor email was not set.\n",
);
