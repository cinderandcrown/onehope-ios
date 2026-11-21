import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { loadConfig } from "../src/config.ts";
import { AccessError, allows, ROLES, type Role } from "../src/domain.ts";
import { loadDocument } from "../src/document-store.ts";
import { migrate, type SqlClient } from "../src/migrate.ts";
import { defaultStage, isQuiet, QUIET_AFTER_DAYS } from "../src/people-care.ts";
import { runRequest, seedTenantIfEmpty } from "../src/persist.ts";
import { SAMPLE_PASSWORD, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { withServiceRole } from "../src/service-role.ts";
import { ChurchStore } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

function signIn(store: ChurchStore, email: string, at = Date.now()) {
  const session = store.login({ email, password: SAMPLE_PASSWORD, ip: "203.0.113.8", userAgent: "test" });
  if (session.mfaRequired) store.verifyMfa(session.token, totpCode(decodeBase32(SAMPLE_TOTP_BASE32), at));
  return session.token;
}

function ids(store: ChurchStore, token: string) {
  return store
    .peopleDirectory(token, { limit: 500 })
    .rows.map((row) => row.id)
    .sort();
}

const isCode = (code: AccessError["code"]) => (error: unknown) =>
  error instanceof AccessError && error.code === code;

test("people permissions: who may view, edit and manage tags", () => {
  const expected: Record<Role, [boolean, boolean, boolean]> = {
    master_admin: [true, true, true],
    pastor: [true, true, true],
    care_team: [true, true, true],
    kids_director: [true, true, false],
    team_leader: [true, true, false],
    finance: [false, false, false],
    volunteer: [false, false, false],
    member: [false, false, false],
    shop_owner: [false, false, false],
    shop_manager: [false, false, false],
    barista: [false, false, false],
    customer: [false, false, false],
    platform_operator: [false, false, false],
  };
  for (const role of ROLES) {
    const got = [allows(role, "view_people"), allows(role, "edit_people"), allows(role, "manage_tags")];
    assert.deepEqual(got, expected[role], role);
  }
});

test("each role sees the right slice of People", () => {
  const store = new ChurchStore(loadConfig({}));
  const everyone = ids(store, signIn(store, "reese@sample.onehope"));
  assert.ok(everyone.includes("person-casey"));
  assert.ok(everyone.includes("person-eden"));
  assert.deepEqual(ids(store, signIn(store, "eden@sample.onehope")), everyone);

  // Kids director: kids households (Avery, Blake, Casey), the kids team (Gray), and self.
  assert.deepEqual(ids(store, signIn(store, "frankie@sample.onehope")), [
    "person-avery",
    "person-blake",
    "person-casey",
    "person-frankie",
    "person-gray",
  ]);

  // Team leader: the Greeters team they lead (Blake) and self.
  const gray = signIn(store, "gray@sample.onehope");
  assert.deepEqual(ids(store, gray), ["person-blake", "person-gray"]);
  assert.throws(() => store.personCare(gray, "person-casey"), isCode("not_found"));

  // Someone a team leader adds is theirs to look after.
  const added = store.addPerson(gray, { displayName: "Jordan Newcomer", email: "jordan@example.test" });
  assert.ok(ids(store, gray).includes(added.id));

  for (const email of ["dana@sample.onehope", "harper@sample.onehope"]) {
    const token = signIn(store, email);
    assert.throws(() => store.peopleDirectory(token), isCode("forbidden"), email);
    assert.throws(() => store.personCare(token, "person-casey"), isCode("forbidden"), email);
  }
  const member = signIn(store, "avery@sample.onehope");
  assert.throws(() => store.peopleDirectory(member), isCode("forbidden"));
});

test("search, stage, tag and quiet filters, with paging", () => {
  let now = Date.parse("2026-11-21T15:00:00.000Z");
  const store = new ChurchStore(loadConfig({}), { now: () => now });
  const pastor = signIn(store, "reese@sample.onehope", now);
  assert.deepEqual(
    store.peopleDirectory(pastor, { q: "CASEY" }).rows.map((row) => row.id),
    ["person-casey"],
  );
  assert.deepEqual(
    store.peopleDirectory(pastor, { q: "214-555-0199" }).rows.map((row) => row.id),
    ["person-casey"],
  );
  assert.deepEqual(
    store.peopleDirectory(pastor, { tagId: "tag-greeters" }).rows.map((row) => row.id),
    ["person-blake"],
  );
  store.setPersonStage(pastor, "person-casey", "returning");
  assert.deepEqual(
    store.peopleDirectory(pastor, { stage: "returning" }).rows.map((row) => row.id),
    ["person-casey"],
  );
  const quietBefore = store.peopleDirectory(pastor, { quiet: true }).total;
  store.logTouch(pastor, "person-casey", { kind: "call", outcome: "reached" });
  assert.equal(store.peopleDirectory(pastor, { quiet: true }).total, quietBefore - 1);
  now += (QUIET_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000;
  // Staff sessions idle out, so sign in again after the jump.
  const later = signIn(store, "reese@sample.onehope", now);
  assert.equal(store.peopleDirectory(later, { quiet: true }).total, quietBefore);

  const page = store.peopleDirectory(later, { limit: 2, offset: 2 });
  assert.equal(page.rows.length, 2);
  assert.ok(page.total > 4);
  assert.equal(page.offset, 2);
});

test("logging touches: timeline, encrypted note, last contact, do-not-contact", () => {
  const store = new ChurchStore(loadConfig({}));
  const eden = signIn(store, "eden@sample.onehope");
  const before = store.personCare(eden, "person-casey");
  assert.equal(before.lastContactAt, null);
  assert.equal(before.stage, defaultStage("member", true));

  store.logTouch(eden, "person-casey", {
    kind: "note",
    outcome: "needs_follow_up",
    note: "Ask about the new job.",
  });
  assert.equal(store.personCare(eden, "person-casey").lastContactAt, null, "a private note is not contact");

  const call = store.logTouch(eden, "person-casey", {
    kind: "call",
    outcome: "prayed",
    note: "Prayed for her mom.",
  });
  const after = store.personCare(eden, "person-casey");
  assert.equal(after.lastContactAt, call.lastContactAt);
  assert.equal(after.touches[0]?.note, "Prayed for her mom.");
  assert.equal(after.touches[0]?.byName, "Eden Sample");
  assert.equal(after.touches.length, 2);

  // The note is encrypted at rest.
  const stored = JSON.stringify(store.toDocument().touches);
  assert.equal(stored.includes("Prayed for her mom"), false);
  assert.equal(stored.includes("new job"), false);

  assert.throws(
    () => store.logTouch(eden, "person-casey", { kind: "visit", outcome: "bogus" }),
    isCode("invalid"),
  );
  assert.throws(
    () => store.logTouch(eden, "person-casey", { kind: "call", outcome: "reached", note: "x".repeat(2001) }),
    isCode("invalid"),
  );

  store.logTouch(eden, "person-casey", { kind: "call", outcome: "asked_not_to_contact" });
  assert.equal(store.personCare(eden, "person-casey").doNotContact, true);
  assert.throws(
    () => store.logTouch(eden, "person-casey", { kind: "text", outcome: "reached" }),
    (error: unknown) => error instanceof AccessError && /not to contact/.test(error.message),
  );
  // Praying and private notes still work.
  store.logTouch(eden, "person-casey", { kind: "prayer", outcome: "prayed" });
  store.logTouch(eden, "person-casey", { kind: "note", outcome: "reached", note: "Respecting their ask." });

  // A team leader cannot lift it; care team can.
  const gray = signIn(store, "gray@sample.onehope");
  assert.throws(() => store.allowContactAgain(gray, "person-blake"), isCode("forbidden"));
  store.allowContactAgain(eden, "person-casey");
  assert.equal(store.personCare(eden, "person-casey").doNotContact, false);

  const audit = store.toDocument().auditLog.filter((entry) => entry.resource === "touch");
  assert.ok(audit.length >= 5);
});

test("tags: managers create teams with leaders; leaders tag only their own team", () => {
  const store = new ChurchStore(loadConfig({}));
  const pastor = signIn(store, "reese@sample.onehope");
  const gray = signIn(store, "gray@sample.onehope");
  const frankie = signIn(store, "frankie@sample.onehope");

  assert.throws(() => store.createTag(gray, { name: "Parking" }), isCode("forbidden"));
  assert.throws(() => store.createTag(frankie, { name: "Parking" }), isCode("forbidden"));
  assert.throws(() => store.createTag(pastor, { name: "   " }), isCode("invalid"));
  assert.throws(() => store.createTag(pastor, { name: "greeters (SAMPLE)" }), isCode("invalid"));
  assert.throws(
    () => store.createTag(pastor, { name: "Parking", kind: "team", leaderIds: ["person-avery"] }),
    isCode("invalid"),
    "members cannot lead a team tag",
  );
  const parking = store.createTag(pastor, { name: "Parking", kind: "team", leaderIds: ["person-gray"] });
  assert.deepEqual(parking.leaderIds, ["person-gray"]);

  // Gray can put Blake (already theirs) on Parking, but cannot use the custom tag.
  store.tagPerson(gray, "person-blake", parking.id);
  assert.throws(() => store.tagPerson(gray, "person-blake", "tag-new-here"), isCode("forbidden"));
  // Gray still cannot reach Casey, so cannot add them to a team to widen their own view.
  assert.throws(() => store.tagPerson(gray, "person-casey", parking.id), isCode("not_found"));

  // Pastor adds Casey to Parking; now Gray can see Casey.
  store.tagPerson(pastor, "person-casey", parking.id);
  assert.ok(ids(store, gray).includes("person-casey"));
  const care = store.personCare(gray, "person-casey");
  assert.deepEqual(
    care.addableTags.map((tag) => tag.id),
    ["tag-greeters"],
  );
  assert.deepEqual(care.removableTagIds, [parking.id]);
  assert.deepEqual(care.followUps, [], "team leaders do not see care follow-ups");

  // Removing a team leader from the team takes away the view.
  store.setTagLeaders(pastor, parking.id, []);
  assert.equal(ids(store, gray).includes("person-casey"), false);

  // Archiving drops the tag from lists and chips.
  store.archiveTag(pastor, parking.id);
  assert.equal(
    store.careTags(pastor).tags.some((tag) => tag.id === parking.id),
    false,
  );
  assert.equal(
    store.personCare(pastor, "person-casey").tags.some((tag) => tag.id === parking.id),
    false,
  );
  assert.equal(store.untagPerson(pastor, "person-casey", "tag-new-here").removed, true);
});

test("leaving the church erases their care rows", () => {
  const store = new ChurchStore(loadConfig({}));
  const pastor = signIn(store, "reese@sample.onehope");
  store.logTouch(pastor, "person-casey", { kind: "call", outcome: "reached", note: "Hi" });
  store.setPersonStage(pastor, "person-casey", "member");
  const casey = signIn(store, "casey@sample.onehope");
  store.stepUp(casey, { password: SAMPLE_PASSWORD });
  store.deleteSelf(casey);
  const doc = store.toDocument();
  assert.equal(
    doc.touches?.some((row) => row.personId === "person-casey"),
    false,
  );
  assert.equal(
    doc.profiles?.some((row) => row.personId === "person-casey"),
    false,
  );
  assert.equal(
    doc.personTags?.some((row) => row.personId === "person-casey"),
    false,
  );
  assert.equal(ids(store, pastor).includes("person-casey"), false);
});

test("quiet means no contact in 30 days", () => {
  const now = Date.parse("2026-11-21T15:00:00.000Z");
  assert.equal(isQuiet(null, now), true);
  assert.equal(isQuiet(now - 29 * 86_400_000, now), false);
  assert.equal(isQuiet(now - 31 * 86_400_000, now), true);
});

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

test("profiles, tags and touches survive Postgres, and RLS keeps them in their church", async () => {
  const db = new PGlite();
  const sql = client(db);
  await migrate(sql);
  await seedTenantIfEmpty(sql, "onehope", { ...process.env, ONEHOPE_SAMPLE_DATA: "true" });

  const eden = await runRequest(sql, (store) => signIn(store, "eden@sample.onehope"), "localhost");
  const tagId = await runRequest(
    sql,
    (store) => {
      const tag = store.createTag(eden, { name: "Prayer team", kind: "ministry" });
      store.tagPerson(eden, "person-casey", tag.id);
      store.setPersonStage(eden, "person-casey", "connected");
      store.logTouch(eden, "person-casey", { kind: "visit", outcome: "reached", note: "Brought a meal." });
      return tag.id;
    },
    "localhost",
    process.env,
    { sessionToken: eden },
  );

  const care = await runRequest(
    sql,
    (store) => store.personCare(eden, "person-casey"),
    "localhost",
    process.env,
    {
      sessionToken: eden,
    },
  );
  assert.equal(care.stage, "connected");
  assert.ok(care.tags.some((tag) => tag.id === tagId));
  assert.equal(care.touches[0]?.note, "Brought a meal.");

  const stored = await withServiceRole(sql, "onehope", () => loadDocument(sql, "onehope"));
  assert.equal(stored.profiles?.find((row) => row.personId === "person-casey")?.stage, "connected");
  const raw = await db.query<{ record: string; kind: string; person_id: string }>(
    "SELECT record, kind, person_id FROM interactions",
  );
  assert.equal(raw.rows.length, 1);
  assert.equal(raw.rows[0]?.kind, "visit");
  assert.equal(raw.rows[0]?.record.includes("Brought a meal"), false, "the note is encrypted in Postgres");
  const contact = await db.query<{ last_contact_at: unknown }>(
    "SELECT last_contact_at FROM person_profiles WHERE person_id = 'person-casey'",
  );
  assert.ok(contact.rows[0]?.last_contact_at);

  // Another church's app_user sees none of it.
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('app.tenant_id', 'other-church', false)");
  await db.exec("SET ROLE app_user");
  for (const table of ["person_profiles", "tags", "person_tags", "interactions"]) {
    const seen = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    assert.equal(seen.rows[0]?.n, 0, table);
  }
  await assert.rejects(() =>
    db.query("INSERT INTO tags (tenant_id, id, kind, record) VALUES ('onehope', 'tag-x', 'custom', '{}')"),
  );
  await db.query("SELECT set_config('app.tenant_id', 'onehope', false)");
  const own = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM interactions");
  assert.equal(own.rows[0]?.n, 1);
  await db.exec("RESET ROLE");
});
