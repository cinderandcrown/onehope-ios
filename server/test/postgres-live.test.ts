import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { clientSql, createPool, driverFor } from "../src/db-pool.ts";
import { migrate } from "../src/migrate.ts";
import { provisionTenant } from "../src/provision.ts";

/**
 * Runs only when TEST_DATABASE_URL points at a throwaway database (a fresh Supabase project,
 * or a local Postgres). CI leaves it unset, so this file skips there.
 * It applies every migration, then checks RLS and the Supabase lockdown on a real server
 * with the same driver the app uses. It writes one throwaway tenant and removes it.
 */
const url = process.env.TEST_DATABASE_URL ?? "";
const skip = url.length === 0 ? "set TEST_DATABASE_URL to a throwaway database to run" : false;

test("driver choice: Neon hosts use the Neon driver, everything else node-postgres", () => {
  assert.equal(driverFor("postgres://u:p@ep-x-123.us-east-2.aws.neon.tech/db"), "neon");
  assert.equal(driverFor("postgres://u:p@db.abcd.supabase.co:5432/postgres"), "pg");
  assert.equal(driverFor("postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres"), "pg");
  assert.equal(driverFor("postgres://u:p@localhost/db", { DATABASE_DRIVER: "neon" }), "neon");
});

test("migrations, RLS, and the Supabase lockdown hold on a real Postgres server", { skip }, async () => {
  const pool = createPool(url, 1);
  const conn = await pool.connect();
  const sql = clientSql(conn);
  const tenantA = `zz_live_a_${randomBytes(3).toString("hex")}`;
  const tenantB = `zz_live_b_${randomBytes(3).toString("hex")}`;
  try {
    await migrate(sql);
    assert.deepEqual(await migrate(sql), []);

    const roles = await sql.query<{ rolname: string }>(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')",
    );
    for (const { rolname } of roles.rows) {
      const exposed = await sql.query<{ relname: string }>(
        `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'S')
           AND (has_table_privilege($1, c.oid, 'SELECT') OR has_table_privilege($1, c.oid, 'INSERT')
             OR has_table_privilege($1, c.oid, 'UPDATE') OR has_table_privilege($1, c.oid, 'DELETE'))`,
        [rolname],
      );
      assert.deepEqual(exposed.rows, [], `${rolname} must not reach public tables`);
    }

    const base = { kind: "business", timezone: "America/Chicago", domains: [], clerkOrgId: null };
    await provisionTenant(sql, {
      ...base,
      id: tenantA,
      name: "Live A",
      modules: [{ id: "crm", enabled: true }],
    });
    await provisionTenant(sql, {
      ...base,
      id: tenantB,
      name: "Live B",
      modules: [{ id: "agents", enabled: true }],
    });

    await sql.query("BEGIN");
    await sql.query("SET LOCAL ROLE app_service");
    await sql.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
    const seen = await sql.query<{ tenant_id: string; module_id: string }>(
      "SELECT tenant_id, module_id FROM tenant_modules WHERE tenant_id IN ($1, $2)",
      [tenantA, tenantB],
    );
    assert.deepEqual(seen.rows, [{ tenant_id: tenantA, module_id: "crm" }]);
    await assert.rejects(
      sql.query("INSERT INTO tenant_modules (tenant_id, module_id, enabled) VALUES ($1, 'x', true)", [
        tenantB,
      ]),
    );
    await sql.query("ROLLBACK");

    await sql.query("BEGIN");
    await sql.query("SET LOCAL ROLE app_service");
    await assert.rejects(sql.query("SELECT id FROM tenants"));
    await sql.query("ROLLBACK");
  } finally {
    for (const id of [tenantA, tenantB]) {
      await sql.query("BEGIN");
      await sql.query("SELECT set_config('app.tenant_id', $1, true)", [id]);
      await sql.query("SET LOCAL ROLE app_service");
      await sql.query("DELETE FROM tenant_modules WHERE tenant_id = $1", [id]);
      await sql.query("RESET ROLE");
      await sql.query("DELETE FROM tenants WHERE id = $1", [id]);
      await sql.query("COMMIT");
    }
    conn.release();
    await pool.end();
  }
});
