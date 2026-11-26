import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { migrate, type SqlClient } from "../src/migrate.ts";

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

async function asUser(db: PGlite, settings: Record<string, string>) {
  await db.exec("RESET ROLE");
  const merged = { "app.tenant_id": "onehope", ...settings };
  for (const [key, value] of Object.entries(merged)) {
    await db.query("SELECT set_config($1, $2, false)", [key, value]);
  }
  await db.exec("SET ROLE app_user");
}

test("migrations apply once and Postgres RLS isolates households", async () => {
  const db = new PGlite();
  const sql = client(db);
  const first = await migrate(sql);
  const second = await migrate(sql);
  assert.deepEqual(first, [
    "0001_init",
    "0002_retention",
    "0003_demo_runtime",
    "0004_tenancy",
    "0005_tenant_passwords",
    "0006_staff_desk",
    "0007_people_care",
    "0008_care_engine",
    "0009_import_cleanup",
  ]);
  assert.deepEqual(second, []);

  await db.exec("RESET ROLE");
  await db.exec(`
    INSERT INTO households (id, name, tenant_id) VALUES ('hh-a', 'Avery', 'onehope'), ('hh-c', 'Casey', 'onehope');
    INSERT INTO people (id, household_id, role, display_name, email, email_public, phone, phone_public, tenant_id)
    VALUES
      ('person-a', 'hh-a', 'member', 'Avery', 'avery@sample.onehope', true, '111', false, 'onehope'),
      ('person-c', 'hh-c', 'member', 'Casey', 'casey@sample.onehope', false, '222', false, 'onehope');
    INSERT INTO gifts (id, household_id, person_id, amount_ciphertext, sample, tenant_id)
    VALUES
      ('gift-a', 'hh-a', 'person-a', 'cipher-a', true, 'onehope'),
      ('gift-c', 'hh-c', 'person-c', 'cipher-c', true, 'onehope');
    INSERT INTO kids (id, household_id, display_name, medical_ciphertext, restricted, tenant_id)
    VALUES ('kid-a', 'hh-a', 'Remy', 'cipher-medical', false, 'onehope');
    INSERT INTO care_notes (id, subject_person_id, body_ciphertext, tenant_id) VALUES
      ('note-a', 'person-a', 'cipher-note', 'onehope'),
      ('note-c', 'person-c', 'cipher-note-c', 'onehope');
    INSERT INTO care_note_shares (note_id, person_id, tenant_id) VALUES ('note-c', 'person-harper', 'onehope');
    INSERT INTO prayers (id, author_id, body, visibility, approved, tenant_id) VALUES
      ('prayer-public', 'person-a', 'public prayer', 'public', true, 'onehope'),
      ('prayer-c', 'person-c', 'casey private', 'private', false, 'onehope');
    INSERT INTO background_checks (id, person_id, status, notes_ciphertext, tenant_id)
    VALUES ('bg-c', 'person-c', 'pending', 'cipher-bg', 'onehope');
  `);

  await asUser(db, {
    "app.person_id": "person-c",
    "app.household_id": "hh-c",
    "app.role": "member",
    "app.step_up": "off",
  });
  const gifts = await db.query<{ id: string }>("SELECT id FROM gifts ORDER BY id");
  assert.deepEqual(
    gifts.rows.map((row) => row.id),
    ["gift-c"],
  );
  const kids = await db.query<{ id: string }>("SELECT id FROM kids");
  assert.equal(kids.rows.length, 0);
  const notes = await db.query<{ id: string }>("SELECT id FROM care_notes ORDER BY id");
  assert.deepEqual(
    notes.rows.map((row) => row.id),
    ["note-c"],
  );
  const prayers = await db.query<{ id: string }>("SELECT id FROM prayers ORDER BY id");
  assert.deepEqual(
    prayers.rows.map((row) => row.id),
    ["prayer-c", "prayer-public"],
  );
  const directory = await db.query<{ id: string; email: string | null }>(
    "SELECT id, email FROM directory_public ORDER BY id",
  );
  assert.equal(directory.rows.find((row) => row.id === "person-a")?.email, "avery@sample.onehope");
  assert.equal(directory.rows.find((row) => row.id === "person-c")?.email, "casey@sample.onehope");

  await asUser(db, {
    "app.person_id": "person-a",
    "app.household_id": "hh-a",
    "app.role": "member",
    "app.step_up": "off",
  });
  const hidden = await db.query<{ email: string | null }>(
    "SELECT email FROM directory_public WHERE id = 'person-c'",
  );
  assert.equal(hidden.rows[0]?.email, null);
  await assert.rejects(db.query("SELECT email FROM people"));

  await asUser(db, {
    "app.person_id": "person-finance",
    "app.household_id": "hh-staff",
    "app.role": "finance",
    "app.step_up": "off",
  });
  const locked = await db.query("SELECT id FROM gifts");
  assert.equal(locked.rows.length, 0);
  await asUser(db, {
    "app.person_id": "person-finance",
    "app.household_id": "hh-staff",
    "app.role": "finance",
    "app.step_up": "on",
  });
  const unlocked = await db.query<{ id: string }>("SELECT id FROM gifts ORDER BY id");
  assert.deepEqual(
    unlocked.rows.map((row) => row.id),
    ["gift-a", "gift-c"],
  );

  await asUser(db, {
    "app.person_id": "person-harper",
    "app.household_id": "hh-vol",
    "app.role": "volunteer",
    "app.step_up": "off",
  });
  const shared = await db.query<{ id: string }>("SELECT id FROM care_notes ORDER BY id");
  assert.deepEqual(
    shared.rows.map((row) => row.id),
    ["note-c"],
  );

  await db.exec("RESET ROLE");
  const auditBefore = await db.query<{ id: string }>("SELECT id FROM audit_log");
  assert.ok(auditBefore.rows.length >= 2);
  await asUser(db, {
    "app.person_id": "person-a",
    "app.household_id": "hh-a",
    "app.role": "member",
    "app.step_up": "off",
  });
  const memberAudit = await db.query("SELECT id FROM audit_log");
  assert.equal(memberAudit.rows.length, 0);
  await assert.rejects(db.exec("UPDATE audit_log SET action = 'tampered'"));
  await assert.rejects(db.exec("DELETE FROM audit_log"));
  await db.close();
});
