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
import { loadMigrations, migrate, type SqlClient } from "../src/migrate.ts";
import { retryWrite, runRequest, seedTenantIfEmpty, storeErrorResponse } from "../src/persist.ts";
import { tablesFor } from "../src/request-tables.ts";
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

test("truth gate refuses a live capability with no backing code", async () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  assertTruthful(new Set(), root);
  const handle = createApi({ store: ChurchStore.demo() });
  const capabilities = await handle(new Request("http://localhost/api/capabilities"));
  assert.equal(capabilities.status, 200);
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

test("capabilities answers when the source tree is not deployed", async () => {
  const missing = fileURLToPath(new URL("./no-such-source-root/", import.meta.url));
  assert.throws(() => assertTruthful(new Set(), missing), /youtube backing file is missing/);
  const handle = createApi({ store: ChurchStore.demo() });
  const response = await handle(new Request("http://localhost/api/capabilities"));
  assert.equal(response.status, 200);
  const route = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
  assert.equal(route.includes("assertTruthful()"), true);
  assert.equal(route.includes("sourceRoot("), false);
});

test("0005 replaces a link_membership shipped with the first 0004", async () => {
  const db = new PGlite();
  const sql = client(db);
  await migrate(
    sql,
    loadMigrations().filter((item) => item.version !== "0005_tenant_passwords"),
  );
  await sql.exec(`
    CREATE OR REPLACE FUNCTION link_membership(
      p_email text, p_password text, p_tenant text, p_person text, p_role text, p_status text
    ) RETURNS void LANGUAGE plpgsql AS $fn$
    BEGIN
      UPDATE accounts SET password_hash = p_password WHERE email = p_email;
    END;
    $fn$;
  `);
  const applied = await migrate(sql);
  assert.deepEqual(applied, ["0005_tenant_passwords"]);
  const found = await sql.query<{ def: string }>(
    "SELECT pg_get_functiondef('link_membership(text,text,text,text,text,text)'::regprocedure) AS def",
  );
  const def = found.rows[0]?.def ?? "";
  assert.equal(def.includes("password_hash = p_password"), false);
  assert.equal(def.includes("INSERT INTO tenant_passwords"), true);
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
  assert.equal(verifyPassword("password1", kept?.passwordHash ?? ""), true);
  assert.equal(verifyPassword("different1", kept?.passwordHash ?? ""), false);
  const shop = await withServiceRole(sql, "revivalcoffee", () =>
    loadDocument(sql, "revivalcoffee", { platformKey: loadConfig({}).fieldEncryptionKey }),
  );
  const shopPerson = shop.people.find((row) => row.email === "shared@example.com");
  assert.equal(verifyPassword("different1", shopPerson?.passwordHash ?? ""), true);
  assert.equal(verifyPassword("password1", shopPerson?.passwordHash ?? ""), false);
  assert.notEqual(kept?.passwordHash, shopPerson?.passwordHash);
});

test("the same email keeps a separate password in each tenant", async () => {
  const { sql } = await database();
  const signUp = (host: string, password: string, displayName: string) =>
    runRequest(
      sql,
      (store) =>
        store.signup({
          email: "victim@example.com",
          password,
          displayName,
          ip: "203.0.113.20",
          userAgent: "test",
        }),
      host,
    );
  const signIn = (host: string, password: string) =>
    runRequest(
      sql,
      (store) =>
        store.login({
          email: "victim@example.com",
          password,
          ip: "203.0.113.20",
          userAgent: "test",
        }),
      host,
    );
  await signUp("order.myrevivalcoffee.com", "password-a", "Shop Victim");
  await signUp("localhost", "password-b", "Church Victim");
  await signIn("localhost", "password-b");
  await assert.rejects(() => signIn("localhost", "password-a"));
  await signIn("order.myrevivalcoffee.com", "password-a");
  await assert.rejects(() => signIn("order.myrevivalcoffee.com", "password-b"));
  const shared = await sql.query<{ password_hash: string | null }>(
    "SELECT password_hash FROM accounts WHERE email = 'victim@example.com'",
  );
  assert.equal(shared.rows[0]?.password_hash, null);
  const hashes = await sql.query<{ password_hash: string }>("SELECT password_hash FROM tenant_passwords");
  assert.equal(hashes.rows.length, 2);
  assert.notEqual(hashes.rows[0]?.password_hash, hashes.rows[1]?.password_hash);
});

test("a lost row version is retried once and then reported as a conflict", async () => {
  let calls = 0;
  const recovered = await retryWrite(async () => {
    calls += 1;
    if (calls === 1) throw new WriteConflictError("people");
    return "saved";
  });
  assert.equal(recovered, "saved");
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    retryWrite(async () => {
      calls += 1;
      throw new WriteConflictError("people");
    }),
    (error: unknown) => error instanceof WriteConflictError,
  );
  assert.equal(calls, 2);
  const response = storeErrorResponse(new WriteConflictError("people"));
  assert.equal(response?.status, 409);
});

test("0004 backfills tenant_id on rows that already exist", async () => {
  const db = new PGlite();
  const sql = client(db);
  await migrate(
    sql,
    loadMigrations().filter((item) => item.version === "0001_init"),
  );
  await sql.exec(`
    INSERT INTO households (id, name) VALUES ('hh1', 'Ada');
    INSERT INTO people (id, household_id, role, display_name, email)
      VALUES ('p1', 'hh1', 'member', 'Ada', 'ada@example.com');
    INSERT INTO gifts (id, household_id, person_id, amount_ciphertext)
      VALUES ('g1', 'hh1', 'p1', 'cipher');
    INSERT INTO kids (id, household_id, display_name, medical_ciphertext)
      VALUES ('k1', 'hh1', 'Kid', 'cipher');
    INSERT INTO care_notes (id, subject_person_id, body_ciphertext)
      VALUES ('n1', 'p1', 'cipher');
    INSERT INTO care_note_shares (note_id, person_id) VALUES ('n1', 'p1');
    INSERT INTO prayers (id, author_id, body, visibility) VALUES ('pr1', 'p1', 'please', 'public');
    INSERT INTO background_checks (id, person_id, status, notes_ciphertext)
      VALUES ('b1', 'p1', 'clear', 'cipher');
    INSERT INTO audit_log (id, actor_id, action, resource, tier)
      VALUES ('a1', 'p1', 'read', 'person', 0);
  `);
  const applied = await migrate(sql);
  assert.equal(applied.includes("0004_tenancy"), true);
  const tables = [
    "households",
    "people",
    "gifts",
    "kids",
    "care_notes",
    "care_note_shares",
    "prayers",
    "background_checks",
    "audit_log",
  ];
  const seeded: Record<string, string> = {
    households: "hh1",
    people: "p1",
    gifts: "g1",
    kids: "k1",
    care_notes: "n1",
    prayers: "pr1",
    background_checks: "b1",
    audit_log: "a1",
  };
  for (const table of Object.keys(seeded)) {
    const marked = await sql.query<{ tenant_id: string }>(`SELECT tenant_id FROM ${table} WHERE id = $1`, [
      seeded[table],
    ]);
    assert.equal(marked.rows[0]?.tenant_id, "onehope", table);
  }
  const share = await sql.query<{ tenant_id: string }>(
    "SELECT tenant_id FROM care_note_shares WHERE note_id = 'n1' AND person_id = 'p1'",
  );
  assert.equal(share.rows[0]?.tenant_id, "onehope");
  for (const table of tables) {
    const nullable = await sql.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'tenant_id'`,
      [table],
    );
    assert.equal(nullable.rows[0]?.is_nullable, "NO", table);
  }
});

test("tenancy rollback removes tenant columns and can migrate again", async () => {
  const db = new PGlite();
  const sql = client(db);
  await migrate(sql);
  const down = readFileSync(new URL("../migrations/rollback/0004_tenancy_down.sql", import.meta.url), "utf8");
  await sql.exec(down);
  const missing = await sql.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'households' AND column_name = 'tenant_id'
     ) AS exists`,
  );
  assert.equal(missing.rows[0]?.exists, false);
  const again = await migrate(sql);
  assert.equal(again.includes("0004_tenancy"), true);
  const restored = await sql.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'households' AND column_name = 'tenant_id'
     ) AS exists`,
  );
  assert.equal(restored.rows[0]?.exists, true);
});

test("a home request does not read the rest of the tenant", async () => {
  const { sql } = await database();
  await seedTenantIfEmpty(sql, "onehope");
  const reads: string[] = [];
  const watching: SqlClient = {
    exec: (statement) => sql.exec(statement),
    async query(statement, params) {
      reads.push(statement);
      return sql.query(statement, params);
    },
  };
  const home = await runRequest(watching, (store) => store.publicHome(), "localhost", process.env, {
    tables: tablesFor("GET", "/api/home") ?? undefined,
  });
  assert.equal(typeof home.church.name, "string");
  const joined = reads.join("\n");
  assert.equal(/from announcements/i.test(joined), true);
  assert.equal(/from gifts|from people|from audit_log|from sessions/i.test(joined), false);
});

test("church image URLs come from the environment and ignore anything else", () => {
  const empty = loadConfig({});
  assert.equal(empty.images.hero, "");
  assert.equal(empty.images.revival, "");
  const configured = loadConfig({
    ONEHOPE_IMAGE_HERO: "https://example.com/hero.jpg",
    ONEHOPE_IMAGE_REVIVAL: "http://example.com/revival.jpg",
    ONEHOPE_IMAGE_OG: "not a url",
  });
  assert.equal(configured.images.hero, "https://example.com/hero.jpg");
  assert.equal(configured.images.revival, "");
  assert.equal(configured.images.og, "");
  const home = new ChurchStore(configured).publicHome();
  assert.equal(home.images.hero, "https://example.com/hero.jpg");
  assert.equal(home.images.about, "");
});
