import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { migrate, type SqlClient } from "../src/migrate.ts";
import { provisionTenant, ProvisionRefusedError, tenantSpecSchema } from "../src/provision.ts";

function client(db: PGlite): SqlClient {
  return {
    async exec(sql) {
      await db.exec(sql);
    },
    async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
      const result = await db.query<T>(sql, [...params]);
      return { rows: result.rows };
    },
  };
}

const spec = {
  id: "acme_test",
  name: "Acme Test",
  kind: "business",
  timezone: "America/Chicago",
  modules: [
    { id: "crm", enabled: true },
    { id: "agents", enabled: false },
  ],
  domains: ["acme.example.test"],
  clerkOrgId: "org_acmeTest1",
};

test("the example spec in docs parses", () => {
  const raw: unknown = JSON.parse(
    readFileSync(new URL("../../docs/examples/tenant-spec.example.json", import.meta.url), "utf8"),
  );
  assert.equal(tenantSpecSchema.parse(raw).id, "exampletenant");
});

test("provisioning is idempotent and writes tenant rows under RLS", async () => {
  const db = new PGlite();
  const sql = client(db);
  await migrate(sql);
  await db.exec(
    "CREATE ROLE provisioner LOGIN; GRANT app_service TO provisioner; GRANT INSERT, SELECT, UPDATE ON tenants TO provisioner;",
  );
  await db.exec("SET ROLE provisioner");

  assert.deepEqual(await provisionTenant(sql, spec), {
    tenant: "created",
    modules: 2,
    domains: 1,
    clerkOrg: true,
  });
  assert.deepEqual(await provisionTenant(sql, spec), {
    tenant: "unchanged",
    modules: 2,
    domains: 1,
    clerkOrg: true,
  });

  await db.exec("RESET ROLE");
  const modules = await db.query<{ module_id: string; enabled: boolean }>(
    "SELECT module_id, enabled FROM tenant_modules WHERE tenant_id = 'acme_test' ORDER BY module_id",
  );
  assert.deepEqual(modules.rows, [
    { module_id: "agents", enabled: false },
    { module_id: "crm", enabled: true },
  ]);
  const org = await db.query<{ tenant_id: string }>(
    "SELECT tenant_id FROM tenant_auth_orgs WHERE external_org_id = 'org_acmeTest1'",
  );
  assert.equal(org.rows[0]?.tenant_id, "acme_test");

  await db.exec("SET ROLE provisioner");
  await assert.rejects(provisionTenant(sql, { ...spec, kind: "church" }), ProvisionRefusedError);
  await assert.rejects(
    provisionTenant(sql, { ...spec, id: "other_test", domains: ["acme.example.test"], clerkOrgId: null }),
    ProvisionRefusedError,
  );
  await assert.rejects(provisionTenant(sql, { ...spec, tenantId: "sneaky" }));
  const leftover = await sql.query("SELECT id FROM tenants WHERE id = 'other_test'");
  assert.equal(leftover.rows.length, 0);
  await db.close();
});
