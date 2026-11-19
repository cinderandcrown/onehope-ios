import { Pool, neonConfig } from "@neondatabase/serverless";

import { migrate } from "../src/migrate.ts";
import { databaseUrl, withStore } from "../src/persist.ts";

if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;

const url = databaseUrl();
if (!url) {
  process.stderr.write("Set DATABASE_URL or POSTGRES_URL to the hosted Postgres connection string.\n");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });
const client = await pool.connect();
try {
  await migrate({
    exec: async (sql) => {
      await client.query(sql);
    },
    query: async <T extends Record<string, unknown>>(sql: string, params?: readonly unknown[]) => {
      const result = await client.query(sql, params ? [...params] : []);
      return { rows: result.rows as T[] };
    },
  });
} finally {
  client.release();
  await pool.end();
}

await withStore(async () => undefined);
process.stdout.write("Migrations are applied and the tenant tables are ready. Lead Pastor email was not set.\n");
