import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { createApi } from "../src/api.ts";
import { verifyPassword } from "../src/crypto.ts";
import { ADAPTERS, assertTruthful, projectCapabilities } from "../src/adapter-registry.ts";
import { fakeEmailAdapter, saveTenantSecret } from "../src/integrations.ts";
import { claimJobs, enqueueJob, finishJob, recordWebhook } from "../src/outbox.ts";
import { migrate, type SqlClient } from "../src/migrate.ts";
import { runRequest, seedTenantIfEmpty } from "../src/persist.ts";
import { importLegacySnapshot, refuseSampleInProduction } from "../src/snapshot-import.ts";
import { ChurchStore } from "../src/store.ts";
import { loadConfig } from "../src/config.ts";
import { exportTenant, restoreTenant } from "../src/tenant-bundle.ts";
import { resolveTenant } from "../src/tenancy.ts";
import { withServiceRole } from "../src/service-role.ts";
import { emptyDocument, loadDocument, saveDocumentDiff, stable, WriteConflictError } from "../src/document-store.ts";

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

async function database() {
  const db = new PGlite();
  const sql = client(db);
  await migrate(sql);
  return { db, sql };
}

const KEY = Buffer.alloc(32, 7);

test("tenant is resolved from the host and never from a caller-supplied id", () => {
  assert.equal(resolveTenant({ host: "order.myrevivalcoffee.com" }), "revivalcoffee");
  assert.equal(resolveTenant({ host: "OneHope-Beryl.vercel.app:443" }), "onehope");
  assert.equal(resolveTenant({ host: "unknown.example" }), null);
  assert.equal(
    resolveTenant({ host: "order.myrevivalcoffee.com", mode: "single", singleTenantId: "cinderandcrown" }),
    "cinderandcrown",
  );
  assert.throws(() => resolveTenant({ host: "localhost", mode: "single", singleTenantId: " " }));
});

test("truth gate refuses a live capability with no backing code", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  assertTruthful(new Set(), root);
  const projected = projectCapabilities(new Set());
  for (const row of projected) {
    if (row.status === "live") {
      const adapter = ADAPTERS.find((item) => item.provider === row.provider && item.product === row.product);
      assert.equal(adapter?.implemented, true);
      assert.ok(adapter?.backing);
      assert.equal(adapter?.requiresCredential, false);
    }
  }
  assert.equal(projected.find((row) => row.provider === "YouTube")?.status, "live");
  assert.equal(projected.find((row) => row.provider === "API.Bible")?.status, "not_built");
  assert.equal(projected.find((row) => row.provider === "Stripe")?.status, "not_built");
  assert.equal(projected.find((row) => row.provider === "Square")?.status, "dry_run");
  assert.equal(projectCapabilities(new Set(["square"])).find((row) => row.provider === "Square")?.status, "live");
  const source = readFileSync(new URL("../src/persist.ts", import.meta.url), "utf8");
  assert.equal(source.includes("demo_runtime"), false);
  assert.equal(source.includes("importLegacySnapshot"), false);
  assert.equal(source.includes("migrate("), false);
});

test("production refuses sample people", () => {
  const doc = emptyDocument();
  doc.people.push({
    id: "person-avery",
    displayName: "Avery Sample",
    email: "avery@sample.onehope",
    phone: "",
    role: "member",
    householdId: "hh",
    sample: true,
    emailPublic: false,
    phonePublic: false,
    listedInDirectory: false,
    passwordHash: null,
    totpSecret: null,
    deleted: false,
    lastIp: null,
    lastUserAgent: null,
  });
  assert.throws(() => refuseSampleInProduction(doc, { ONEHOPE_ENV: "production" }));
  assert.doesNotThrow(() => refuseSampleInProduction(doc, { ONEHOPE_ENV: "demo" }));
});

test("legacy snapshot imports once, reconciles counts, and then does not read the blob", async () => {
  const { sql } = await database();
  const church = new ChurchStore(loadConfig({}), { fixture: false, now: () => Date.parse("2026-11-20T15:00:00Z") });
  const signed = church.signup({
    email: "member@example.com",
    password: "password1",
    displayName: "Member Example",
    ip: "203.0.113.5",
    userAgent: "test",
  });
  assert.ok(signed.token);
  const payload = JSON.stringify(church.toDocument());
  await sql.query("INSERT INTO demo_runtime (id, payload) VALUES ('church', $1)", [payload]);
  const reads: string[] = [];
  const wrapped: SqlClient = {
    exec: (statement) => sql.exec(statement),
    async query(statement, params) {
      if (/demo_runtime\b/i.test(statement) && !/demo_runtime_backup/i.test(statement)) reads.push(statement);
      return sql.query(statement, params);
    },
  };
  assert.equal(await importLegacySnapshot(wrapped), "imported");
  assert.ok(reads.some((statement) => /from demo_runtime/i.test(statement)));
  const counts = await sql.query<{ row_counts: string }>(
    "SELECT row_counts FROM snapshot_imports WHERE id = 'legacy-blob'",
  );
  const stored = JSON.parse(counts.rows[0]?.row_counts ?? "{}") as { people: number };
  assert.equal(stored.people, church.toDocument().people.length);
  assert.equal(await importLegacySnapshot(wrapped), "already");
  const still = await sql.query<{ payload: string }>("SELECT payload FROM demo_runtime WHERE id = 'church'");
  assert.equal(still.rows[0]?.payload, payload);
  const changed = payload.replace("Member Example", "Member Edited");
  await sql.query("UPDATE demo_runtime SET payload = $2 WHERE id = $1", ["church", changed]);
  assert.equal(await importLegacySnapshot(sql), "updated");
  const afterDelta = await sql.query<{ payload: string }>("SELECT payload FROM demo_runtime WHERE id = 'church'");
  assert.equal(afterDelta.rows[0]?.payload, changed);
});

test("a second read writes no rows and overlapping inserts are not lost", async () => {
  const { sql } = await database();
  const writes: string[] = [];
  const logging: SqlClient = {
    exec: (statement) => sql.exec(statement),
    async query(statement, params) {
      if (/^(insert|update|delete)\b/i.test(statement.trim())) writes.push(statement.trim());
      return sql.query(statement, params);
    },
  };
  const reads: string[] = [];
  const watching: SqlClient = {
    exec: (statement) => logging.exec(statement),
    async query(statement, params) {
      reads.push(statement);
      return logging.query(statement, params);
    },
  };
  await runRequest(watching, (store) => store.status("test"), "localhost", process.env, { profile: "none" });
  assert.equal(
    reads.some((statement) => /audit_log|from people|from sessions/i.test(statement)),
    false,
  );
  assert.deepEqual(writes, []);

  await seedTenantIfEmpty(sql, "onehope");
  const baseline = await withServiceRole(sql, "onehope", () => loadDocument(sql, "onehope"));
  for (let index = 0; index < 50; index += 1) {
    const next = structuredClone(baseline);
    next.prayers = [
      ...baseline.prayers,
        {
        id: `pray-${index}`,
        authorId: "person-nicholas",
        body: `Prayer ${index}`,
        visibility: "public" as const,
        approved: true,
        sample: false,
      },
    ];
    await withServiceRole(sql, "onehope", () =>
      saveDocumentDiff(sql, "onehope", baseline, next, { syncModules: false }),
    );
  }
  const stored = await withServiceRole(sql, "onehope", () => loadDocument(sql, "onehope"));
  const added = stored.prayers.filter((prayer) => prayer.id.startsWith("pray-"));
  assert.equal(added.length, 50);
});

test("tenant A cannot read tenant B, including through the API", async () => {
  const { db, sql } = await database();
  await runRequest(
    sql,
    (store) =>
      store.signup({
        email: "guest@revival.test",
        password: "password1",
        displayName: "Revival Guest",
        ip: "203.0.113.8",
        userAgent: "test",
      }),
    "order.myrevivalcoffee.com",
  );
  const hidden = await withServiceRole(sql, "onehope", () =>
    sql.query("SELECT id FROM people WHERE email = 'guest@revival.test'"),
  );
  assert.equal(hidden.rows.length, 0);
  const visible = await withServiceRole(sql, "revivalcoffee", () =>
    sql.query("SELECT id FROM people WHERE email = 'guest@revival.test'"),
  );
  assert.equal(visible.rows.length, 1);
  const pickup = await sql.query<{ pickup_only: boolean; delivery_enabled: boolean }>(
    "SELECT pickup_only, delivery_enabled FROM pickup_settings WHERE tenant_id = 'revivalcoffee'",
  );
  assert.equal(pickup.rows[0]?.pickup_only, true);
  assert.equal(pickup.rows[0]?.delivery_enabled, false);

  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('app.tenant_id', 'onehope', false)");
  await db.exec("SET ROLE app_user");
  const leaked = await db.query<{ display_name: string }>("SELECT display_name FROM people");
  assert.equal(
    leaked.rows.some((row) => row.display_name === "Revival Guest"),
    false,
  );
  await assert.rejects(
    db.query(
      "INSERT INTO announcements (tenant_id, id, record) VALUES ('revivalcoffee', 'nope', '{}')",
    ),
  );
  await db.exec("RESET ROLE");

  const tables = await db.query<{ table_name: string }>(
    `SELECT c.relname AS table_name
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND EXISTS (
         SELECT 1 FROM information_schema.columns col
         WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenant_id'
       )
     ORDER BY c.relname`,
  );
  for (const table of tables.rows) {
    const forced = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1",
      [table.table_name],
    );
    assert.equal(forced.rows[0]?.relrowsecurity, true, table.table_name);
    assert.equal(forced.rows[0]?.relforcerowsecurity, true, table.table_name);
  }

  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('app.tenant_id', 'onehope', false)");
  await db.exec("SET ROLE app_service");
  await db.query(
    "INSERT INTO audit_log (id, actor_id, action, resource, tier, tenant_id, source) VALUES ('audit-lock', 'system', 'read', 'test', 0, 'onehope', 'app')",
  );
  await assert.rejects(db.query("UPDATE audit_log SET action = 'tampered' WHERE id = 'audit-lock'"));
  await assert.rejects(db.query("DELETE FROM audit_log WHERE id = 'audit-lock'"));
  await db.exec("RESET ROLE");
});

test("tenant export restores counts and checksums and omits secrets", async () => {
  const { sql } = await database();
  await runRequest(sql, (store) => store.status("test"), "localhost");
  await withServiceRole(sql, "onehope", () =>
    saveTenantSecret(sql, {
      tenantId: "onehope",
      provider: "fake-email",
      plaintext: "super-secret-value",
      platformKey: KEY,
      connectedBy: "test",
    }),
  );
  const bundle = await exportTenant(sql, "onehope");
  assert.equal(JSON.stringify(bundle).includes("super-secret-value"), false);
  const integration = bundle.tables.tenant_integrations?.find((row) => row.provider === "fake-email");
  assert.equal(integration?.credentials_ciphertext, null);
  const person = bundle.tables.people?.find((row) => typeof row.record === "string" && row.record.includes("passwordHash"));
  assert.equal(person, undefined);

  const restored = await database();
  await restoreTenant(restored.sql, bundle);
  const again = await exportTenant(restored.sql, "onehope");
  for (const table of Object.keys(bundle.tables)) {
    assert.equal(stable(again.tables[table]), stable(bundle.tables[table]), table);
  }
  assert.equal(again.checksum, bundle.checksum);
  assert.deepEqual(again.counts, bundle.counts);
  assert.equal(again.checksum.length, 64);
});

test("an adapter reads only an encrypted tenant credential and the outbox retries", async () => {
  const { sql } = await database();
  await withServiceRole(sql, "revivalcoffee", async () => {
    const adapter = fakeEmailAdapter(sql, "revivalcoffee", KEY);
    assert.deepEqual(await adapter.send("ready"), { delivered: false, reason: "dry_run" });
    await saveTenantSecret(sql, {
      tenantId: "revivalcoffee",
      provider: "fake-email",
      plaintext: "shop-key-1234",
      platformKey: KEY,
      connectedBy: "owner",
    });
    const stored = await sql.query<{ credentials_ciphertext: string }>(
      "SELECT credentials_ciphertext FROM tenant_integrations WHERE tenant_id = 'revivalcoffee' AND provider = 'fake-email'",
    );
    assert.equal(stored.rows[0]?.credentials_ciphertext.includes("shop-key-1234"), false);
    assert.deepEqual(await adapter.send("ready"), { delivered: true, reason: "sent" });
    const first = await enqueueJob(sql, {
      tenantId: "revivalcoffee",
      jobName: "email",
      idempotencyKey: "order-1",
      payload: { kind: "ready" },
    });
    const second = await enqueueJob(sql, {
      tenantId: "revivalcoffee",
      jobName: "email",
      idempotencyKey: "order-1",
      payload: { kind: "ready" },
    });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.id, second.id);
    const claimed = await claimJobs(sql, "revivalcoffee", 10);
    assert.equal(claimed.length, 1);
    await finishJob(sql, { tenantId: "revivalcoffee", id: claimed[0]?.id ?? "", status: "failed", error: "dry" });
    const again = await claimJobs(sql, "revivalcoffee", 10);
    assert.equal(again.length, 1);
    assert.equal(again[0]?.attempts, 2);
    await finishJob(sql, { tenantId: "revivalcoffee", id: again[0]?.id ?? "", status: "succeeded" });
    assert.equal((await claimJobs(sql, "revivalcoffee", 10)).length, 0);
    const webhook = await recordWebhook(sql, {
      tenantId: "revivalcoffee",
      provider: "square",
      eventId: "evt-1",
      payload: { ok: true },
    });
    assert.equal(webhook.duplicate, false);
    const replay = await recordWebhook(sql, {
      tenantId: "revivalcoffee",
      provider: "square",
      eventId: "evt-1",
      payload: { ok: true },
    });
    assert.equal(replay.duplicate, true);
  });
  const churchView = await withServiceRole(sql, "onehope", () =>
    sql.query("SELECT provider FROM tenant_integrations WHERE provider = 'fake-email'"),
  );
  assert.equal(churchView.rows.length, 0);
});

test("health and tenant routes answer from the relational store", async () => {
  const { sql } = await database();
  const handle = await runRequest(
    sql,
    (store) => createApi({ store }),
    "order.myrevivalcoffee.com",
  );
  const health = await handle(new Request("http://order.myrevivalcoffee.com/api/health"));
  assert.equal(health.status, 200);
  const tenant = await handle(new Request("http://order.myrevivalcoffee.com/api/tenant"));
  const body = (await tenant.json()) as { tenant: { id: string; pickupOnly: boolean } };
  assert.equal(body.tenant.id, "revivalcoffee");
  assert.equal(body.tenant.pickupOnly, true);
});

test("an unknown host is rejected and an audited child write is stored", async () => {
  const { sql } = await database();
  await assert.rejects(runRequest(sql, (store) => store.status("test"), "evil.example"), (error: unknown) => {
    return error instanceof Error && error.name === "UnknownTenantError";
  });
  await seedTenantIfEmpty(sql, "onehope");
  await runRequest(
    sql,
    (store) => {
      const session = store.signup({
        email: "parent@example.com",
        password: "password1",
        displayName: "Parent Example",
        ip: "203.0.113.9",
        userAgent: "test",
      });
      store.addChild(session.token, { displayName: "Ada Example", classroom: "Preschool" });
    },
    "localhost",
  );
  const rows = await withServiceRole(sql, "onehope", () =>
    sql.query<{ resource: string }>("SELECT resource FROM audit_log WHERE source = 'app' AND resource = 'kid'"),
  );
  assert.ok(rows.rows.length >= 1);
});

test("a stale row version loses and another tenant cannot read account emails", async () => {
  const { sql } = await database();
  await seedTenantIfEmpty(sql, "onehope");
  const loaded = await withServiceRole(sql, "onehope", () => loadDocument(sql, "onehope"));
  const first = structuredClone(loaded);
  const second = structuredClone(loaded);
  const person = first.people[0];
  assert.ok(person);
  person.displayName = "First Write";
  const other = second.people.find((row) => row.id === person.id);
  assert.ok(other);
  other.displayName = "Second Write";
  await withServiceRole(sql, "onehope", () =>
    saveDocumentDiff(sql, "onehope", loaded, first, { syncModules: false }),
  );
  await assert.rejects(
    withServiceRole(sql, "onehope", () => saveDocumentDiff(sql, "onehope", loaded, second, { syncModules: false })),
    (error: unknown) => error instanceof WriteConflictError,
  );
  await runRequest(
    sql,
    (store) =>
      store.signup({
        email: "shared@example.com",
        password: "password1",
        displayName: "Church Person",
        ip: "203.0.113.10",
        userAgent: "test",
      }),
    "localhost",
  );
  await runRequest(
    sql,
    (store) =>
      store.signup({
        email: "shared@example.com",
        password: "different1",
        displayName: "Shop Person",
        ip: "203.0.113.11",
        userAgent: "test",
      }),
    "order.myrevivalcoffee.com",
  );
  await assert.rejects(
    withServiceRole(sql, "revivalcoffee", () => sql.query("SELECT email FROM accounts")),
    (error: unknown) => error instanceof Error,
  );
  const church = await withServiceRole(sql, "onehope", () =>
    loadDocument(sql, "onehope", { platformKey: loadConfig({}).fieldEncryptionKey }),
  );
  const kept = church.people.find((row) => row.email === "shared@example.com");
  assert.equal(kept?.passwordHash?.length ? true : false, true);
  assert.equal(verifyPassword("password1", kept?.passwordHash ?? ""), true);
  assert.equal(verifyPassword("different1", kept?.passwordHash ?? ""), false);
});
