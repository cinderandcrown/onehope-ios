import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { loadConfig } from "../src/config.ts";
import { AccessError, allows, ROLES, type Role } from "../src/domain.ts";
import { loadDocument } from "../src/document-store.ts";
import {
  findDuplicatePairs,
  hashImport,
  looksLikePlanningCenter,
  parseCsv,
  planImport,
  suggestMapping,
} from "../src/import-people.ts";
import { migrate, type SqlClient } from "../src/migrate.ts";
import { runRequest, seedTenantIfEmpty } from "../src/persist.ts";
import { SAMPLE_PASSWORD, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { withServiceRole } from "../src/service-role.ts";
import { ChurchStore } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

const DAY = 24 * 60 * 60 * 1000;

function signIn(store: ChurchStore, email: string, at: number, password = SAMPLE_PASSWORD) {
  const session = store.login({ email, password, ip: "203.0.113.10", userAgent: "test" });
  if (session.mfaRequired) store.verifyMfa(session.token, totpCode(decodeBase32(SAMPLE_TOTP_BASE32), at));
  return session.token;
}

function stepped(store: ChurchStore, email: string, at: number, password = SAMPLE_PASSWORD) {
  const token = signIn(store, email, at, password);
  store.stepUp(token, { code: totpCode(decodeBase32(SAMPLE_TOTP_BASE32), at) });
  return token;
}

const isCode = (code: AccessError["code"]) => (error: unknown) =>
  error instanceof AccessError && error.code === code;

function clocked(start = Date.parse("2026-11-26T15:00:00.000Z")) {
  const clock = { now: start };
  const config = loadConfig({});
  const store = new ChurchStore(config, {
    now: () => clock.now,
    passwordOverrides: { [config.masterAdminPrimaryEmail]: "seat-password" },
    totpOverrides: { [config.masterAdminPrimaryEmail]: SAMPLE_TOTP_BASE32 },
  });
  return { store, clock, config };
}

function commitCsv(store: ChurchStore, token: string, csv: string, filename = "people.csv") {
  const opened = store.receivePeopleFile(token, { filename, text: csv });
  const page = store.importPage(token, { id: opened.id, step: "match" });
  assert.equal(page.step, "match");
  if (page.step !== "match") throw new Error("expected the match step");
  store.setPeopleImportMapping(
    token,
    opened.id,
    page.headers.map((header) => header.field),
  );
  return { id: opened.id, summary: store.commitPeopleImport(token, opened.id) };
}

test("column matching uses plain words and recognizes a Planning Center people export", () => {
  const generic = suggestMapping(["Email Address", "Given Name", "Surname", "Cell", "Favorite Color"]);
  assert.deepEqual(generic, ["email", "first_name", "last_name", "phone", "ignore"]);

  const planning = [
    "Person ID",
    "First Name",
    "Last Name",
    "Primary Email",
    "Primary Phone Number",
    "Membership",
    "Status",
    "Household",
  ];
  assert.equal(looksLikePlanningCenter(planning), true);
  assert.deepEqual(suggestMapping(planning), [
    "ignore",
    "first_name",
    "last_name",
    "email",
    "phone",
    "stage",
    "ignore",
    "ignore",
  ]);
  assert.equal(looksLikePlanningCenter(["Name", "Email"]), false);

  const parsed = parseCsv('Name,Email\n"Hope, Ada",ada.hope@example.test\n\nBen Lane,ben@example.test\n');
  assert.deepEqual(parsed.headers, ["Name", "Email"]);
  assert.equal(parsed.rows[0]?.[0], "Hope, Ada");
  assert.equal(parsed.rows.length, 2);

  const plan = planImport(
    [
      {
        line: 1,
        firstName: "Ada",
        lastName: "Hope",
        fullName: "",
        email: "ada@example.test",
        phone: "(214) 555-0100",
        stage: "guest",
        tags: [],
        source: null,
        faithSteps: [],
        ownerEmail: "",
        lastSeenAt: null,
        lastContactAt: null,
        note: "",
        address: "",
        birthday: "",
      },
      {
        line: 2,
        firstName: "Ada",
        lastName: "Hope",
        fullName: "",
        email: "ada.other@example.test",
        phone: "2145550100",
        stage: null,
        tags: [],
        source: null,
        faithSteps: [],
        ownerEmail: "",
        lastSeenAt: null,
        lastContactAt: null,
        note: "",
        address: "",
        birthday: "",
      },
    ],
    [],
  );
  assert.equal(plan[0]?.kind, "add");
  assert.equal(plan[1]?.kind, "add");
  if (plan[1]?.kind === "add") assert.match(plan[1].flag, /same phone/);
});

test("duplicate pairs match email or phone, and skip a name when both contacts differ", () => {
  const people = [
    { id: "a", displayName: "Ada Hope", email: "ada@example.test", phone: "2145550101", role: "member" as const, deleted: false },
    { id: "b", displayName: "Ada Hope", email: "ada@example.test", phone: "", role: "member" as const, deleted: false },
    { id: "c", displayName: "Ben Lane", email: "ben1@example.test", phone: "2145550102", role: "member" as const, deleted: false },
    { id: "d", displayName: "Ben Lane", email: "ben2@example.test", phone: "2145550199", role: "member" as const, deleted: false },
  ];
  const pairs = findDuplicatePairs(people, []);
  assert.ok(pairs.some((pair) => pair.why === "email" && pair.leftId === "a"));
  assert.equal(
    pairs.some((pair) => pair.leftId === "c" || pair.rightId === "c"),
    false,
  );
  const hidden = findDuplicatePairs(people, [{ leftId: "a", rightId: "b" }]);
  assert.equal(
    hidden.some((pair) => pair.leftId === "a" || pair.rightId === "a"),
    false,
  );
});

test("only a pastor or Master Admin can import, and only after step-up", () => {
  const expected: Record<Role, [boolean, boolean]> = {
    master_admin: [true, true],
    pastor: [true, true],
    care_team: [false, true],
    kids_director: [false, false],
    team_leader: [false, false],
    finance: [false, false],
    volunteer: [false, false],
    member: [false, false],
    shop_owner: [false, false],
    shop_manager: [false, false],
    barista: [false, false],
    customer: [false, false],
    platform_operator: [false, false],
  };
  for (const role of ROLES) {
    assert.deepEqual([allows(role, "import_people"), allows(role, "merge_people")], expected[role], role);
  }

  const { store, clock, config } = clocked();
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  const csv = "First Name,Last Name,Email\nAda,Hope,ada@example.test\n";
  assert.throws(() => store.receivePeopleFile(pastor, { filename: "people.csv", text: csv }), isCode("step_up_required"));

  const care = stepped(store, "eden@sample.onehope", clock.now);
  assert.throws(() => store.receivePeopleFile(care, { filename: "people.csv", text: csv }), isCode("forbidden"));
  assert.throws(() => store.duplicatePage(signIn(store, "dana@sample.onehope", clock.now)), isCode("forbidden"));

  const ready = stepped(store, "reese@sample.onehope", clock.now);
  const opened = store.receivePeopleFile(ready, { filename: "people.csv", text: csv });
  assert.equal(opened.resumed, false);

  const master = stepped(store, config.masterAdminPrimaryEmail, clock.now, "seat-password");
  const again = store.receivePeopleFile(master, { filename: "people.csv", text: csv });
  assert.equal(again.resumed, false);
  assert.notEqual(again.id, opened.id);
});

test("a 2000-row file imports with the right summary, and undo puts the church back", () => {
  const { store, clock } = clocked();
  const pastor = stepped(store, "reese@sample.onehope", clock.now);
  const before = store.personCare(pastor, "person-casey").phone;
  const lines = ["First Name,Last Name,Email,Mobile Phone,Stage,Tags"];
  for (let i = 0; i < 2000; i += 1) {
    lines.push(`Guest,Number${i},guest${i}@example.test,214${String(i).padStart(7, "0")},Guest,Imported`);
  }
  lines.push("Casey,Renamed,casey@sample.onehope,214-555-7777,Member,");
  const started = Date.now();
  const { id, summary } = commitCsv(store, pastor, lines.join("\n"), "guests.csv");
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 2 * 60 * 1000, `import took ${elapsed}ms`);
  assert.equal(summary.added, 2000);
  assert.equal(summary.updated, 1);
  assert.equal(summary.skipped, 0);
  assert.equal(store.personCare(pastor, "person-casey").phone, "214-555-7777");
  assert.equal(store.personCare(pastor, "person-casey").displayName, "Casey Renamed");
  assert.equal(
    store.peopleDirectory(pastor, { q: "guest0@example.test" }).rows.some((row) => row.displayName === "Guest Number0"),
    true,
  );

  const undone = store.undoPeopleImport(pastor, id);
  assert.equal(undone.kept, 0);
  assert.equal(store.personCare(pastor, "person-casey").phone, before);
  assert.equal(store.personCare(pastor, "person-casey").displayName, "Casey Sample");
  assert.equal(store.peopleDirectory(pastor, { q: "guest0@example.test" }).total, 0);
  const fresh = commitCsv(store, pastor, "First Name,Last Name,Email\nTiny,Guest,tiny.guest@example.test\n", "tiny.csv");
  clock.now += 25 * DAY;
  store.stepUp(pastor, { code: totpCode(decodeBase32(SAMPLE_TOTP_BASE32), clock.now) });
  assert.throws(() => store.undoPeopleImport(pastor, fresh.id), isCode("invalid"));
});

test("batches can resume, staff seats are skipped, and a saved list stays computed", () => {
  const { store, clock } = clocked();
  const pastor = stepped(store, "reese@sample.onehope", clock.now);
  const csv = [
    "Name,Email,Phone",
    "Jordan New,jordan.new@example.test,2145550188",
    "Jordan New,jordan.other@example.test,2145550188",
    "",
    "Former Member,former@example.test,",
    "Pastor Seat,reese@sample.onehope,2145550177",
  ].join("\n");
  const parsed = parseCsv(csv);
  const hash = hashImport(parsed.headers, parsed.rows);
  const first = store.openPeopleImport(pastor, {
    filename: "half.csv",
    headers: parsed.headers,
    totalBatches: 2,
    contentHash: hash,
  });
  store.addPeopleImportBatch(pastor, first.id, { index: 0, rows: [parsed.rows[0]!] });
  const resumed = store.openPeopleImport(pastor, {
    filename: "half.csv",
    headers: parsed.headers,
    totalBatches: 2,
    contentHash: hash,
  });
  assert.equal(resumed.id, first.id);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.received, 1);
  store.addPeopleImportBatch(pastor, first.id, { index: 0, rows: [parsed.rows[0]!] });
  store.addPeopleImportBatch(pastor, first.id, { index: 1, rows: parsed.rows.slice(1) });
  store.setPeopleImportMapping(pastor, first.id, suggestMapping(parsed.headers));
  const summary = store.commitPeopleImport(pastor, first.id);
  assert.equal(summary.added, 2);
  assert.ok(summary.skipped >= 1);
  assert.ok(summary.reasons.some((reason) => reason.why === "Staff seats stay as they are"));
  assert.equal(store.personCare(pastor, "person-reese").phone.includes("0177"), false);

  const page = store.duplicatePage(pastor);
  const pair = page.pairs.find((item) => item.why === "Same phone");
  assert.ok(pair);
  if (!pair) return;
  const merged = store.mergePeople(pastor, pair.leftId, pair.rightId);
  assert.equal(store.duplicatePage(pastor).pairs.some((item) => item.leftId === pair.leftId), false);
  store.undoMerge(pastor, merged.id);
  assert.ok(store.duplicatePage(pastor).pairs.some((item) => item.why === "Same phone"));
  store.dismissDuplicate(pastor, pair.leftId, pair.rightId);
  assert.equal(store.duplicatePage(pastor).pairs.some((item) => item.leftId === pair.leftId), false);

  const listed = store.saveList(pastor, { name: "Guests", stage: "guest" });
  const guests = store.peopleDirectory(pastor, { listId: listed.id }).total;
  const added = store.addPerson(pastor, { displayName: "Sky Guest", email: "sky.guest@example.test" });
  store.setPersonStage(pastor, added.id, "guest");
  assert.equal(store.peopleDirectory(pastor, { listId: listed.id }).total, guests + 1);
  store.setPersonStage(pastor, added.id, "member");
  assert.equal(store.peopleDirectory(pastor, { listId: listed.id }).total, guests);
  const saved = store.toDocument().lists?.find((list) => list.id === listed.id);
  assert.equal(saved?.filters.stage, "guest");
  assert.equal(JSON.stringify(saved).includes(added.id), false);

  const late = store.mergePeople(pastor, pair.leftId, pair.rightId);
  clock.now += 8 * DAY;
  const again = stepped(store, "reese@sample.onehope", clock.now);
  assert.throws(() => store.undoMerge(again, late.id), isCode("invalid"));
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

test("an import survives Postgres, the snapshot stays encrypted, and another church cannot see it", async () => {
  const db = new PGlite();
  const sql = client(db);
  await migrate(sql);
  await seedTenantIfEmpty(sql, "onehope", { ...process.env, ONEHOPE_SAMPLE_DATA: "true" });
  const at = Date.now();
  const pastor = await runRequest(
    sql,
    (store) => stepped(store, "reese@sample.onehope", at),
    "localhost",
    { ...process.env, ONEHOPE_SAMPLE_DATA: "true" },
  );
  await runRequest(
    sql,
    (store) => {
      const csv = "First Name,Last Name,Email,Note\nZeta,Row,zeta-row@example.test,secret prayer for zeta\n";
      const { summary } = commitCsv(store, pastor, csv);
      assert.equal(summary.added, 1);
    },
    "localhost",
    { ...process.env, ONEHOPE_SAMPLE_DATA: "true" },
    { sessionToken: pastor },
  );
  const raw = await db.query<{ record: string; import_id: string | null }>(
    "SELECT record, import_id FROM people WHERE email = 'zeta-row@example.test'",
  );
  assert.equal(raw.rows.length, 1);
  assert.ok(raw.rows[0]?.import_id);
  const job = await db.query<{ record: string }>("SELECT record FROM people_imports");
  assert.equal(job.rows.length, 1);
  assert.equal(job.rows[0]?.record.includes("zeta-row@example.test"), false);
  assert.equal(job.rows[0]?.record.includes("secret prayer"), false);
  const profile = await db.query<{ record: string }>(
    "SELECT record FROM person_profiles WHERE import_id = $1",
    [raw.rows[0]?.import_id],
  );
  assert.equal(profile.rows[0]?.record.includes("secret prayer"), false);

  const stored = await withServiceRole(sql, "onehope", () => loadDocument(sql, "onehope"));
  assert.equal(stored.imports?.length, 1);

  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('app.tenant_id', 'other-church', false)");
  await db.exec("SET ROLE app_user");
  for (const table of ["people_imports", "person_merges", "saved_lists"]) {
    const seen = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    assert.equal(seen.rows[0]?.n, 0, table);
  }
  await db.exec("RESET ROLE");
});
