import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import {
  bucketFor,
  chicagoDayStart,
  DEFAULT_PLAYBOOKS,
  fillScript,
  pickCareSeat,
} from "../src/care-engine.ts";
import { loadConfig } from "../src/config.ts";
import { AccessError, allows, ROLES, type Role } from "../src/domain.ts";
import { loadDocument, saveDocumentDiff } from "../src/document-store.ts";
import { migrate, type SqlClient } from "../src/migrate.ts";
import { runRequest, seedTenantIfEmpty } from "../src/persist.ts";
import { SAMPLE_PASSWORD, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { withServiceRole } from "../src/service-role.ts";
import { ChurchStore } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function signIn(store: ChurchStore, email: string, at = Date.now(), password = SAMPLE_PASSWORD) {
  const session = store.login({ email, password, ip: "203.0.113.8", userAgent: "test" });
  if (session.mfaRequired) store.verifyMfa(session.token, totpCode(decodeBase32(SAMPLE_TOTP_BASE32), at));
  return session.token;
}

const isCode = (code: AccessError["code"]) => (error: unknown) =>
  error instanceof AccessError && error.code === code;

function clocked(start = Date.parse("2026-11-22T15:00:00.000Z")) {
  const clock = { now: start };
  const config = loadConfig({});
  const store = new ChurchStore(config, {
    now: () => clock.now,
    passwordOverrides: { [config.masterAdminPrimaryEmail]: "seat-password" },
    totpOverrides: { [config.masterAdminPrimaryEmail]: SAMPLE_TOTP_BASE32 },
  });
  return { store, clock, config };
}

test("care permissions: who works tasks and who manages playbooks", () => {
  const expected: Record<Role, [boolean, boolean]> = {
    master_admin: [true, true],
    pastor: [true, true],
    care_team: [true, false],
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
    assert.deepEqual(
      [allows(role, "work_care_tasks"), allows(role, "manage_playbooks")],
      expected[role],
      role,
    );
  }
});

test("every playbook starts off, and nothing happens until a pastor or Master Admin turns it on", () => {
  const { store, clock, config } = clocked();
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  const book = store.playbooks(pastor);
  assert.equal(book.playbooks.length, 2);
  assert.ok(book.playbooks.every((item) => !item.active));
  assert.equal(book.mayToggle, true);

  const avery = signIn(store, "avery@sample.onehope", clock.now);
  store.submitFollowUp(avery, { kind: "salvation", consent: true }, "test");
  assert.equal(store.careTasksFor(pastor, { team: true }).tasks.length, 0);

  // Care team and other roles cannot see or change playbooks; pastors and Master Admin both flip the switch.
  const eden = signIn(store, "eden@sample.onehope", clock.now);
  assert.throws(() => store.playbooks(eden), isCode("forbidden"));
  assert.throws(() => store.setPlaybookActive(eden, "playbook-salvation", true), isCode("forbidden"));
  const gray = signIn(store, "gray@sample.onehope", clock.now);
  assert.throws(() => store.setPlaybookActive(gray, "playbook-salvation", true), isCode("forbidden"));
  const nicholas = signIn(store, config.masterAdminPrimaryEmail, clock.now, "seat-password");
  assert.equal(store.playbooks(nicholas).mayToggle, true);
  assert.throws(() => store.setPlaybookActive(pastor, "playbook-nope", true), isCode("not_found"));
  assert.throws(() => store.setPlaybookActive(nicholas, "playbook-nope", true), isCode("not_found"));
});

test("Master Admin turns a playbook on and off; turning it off leaves open tasks alone", () => {
  const { store, clock, config } = clocked();
  const nicholas = signIn(store, config.masterAdminPrimaryEmail, clock.now, "seat-password");
  assert.deepEqual(store.setPlaybookActive(nicholas, "playbook-salvation", true), {
    id: "playbook-salvation",
    active: true,
  });
  const book = store.playbooks(nicholas).playbooks.find((item) => item.id === "playbook-salvation")!;
  assert.equal(book.active, true);
  assert.equal(book.updatedBy, config.masterAdminPrimaryName);
  assert.ok(
    store
      .toDocument()
      .auditLog.some((entry) => entry.resource === "playbook" && entry.resourceId === "playbook-salvation"),
  );

  const avery = signIn(store, "avery@sample.onehope", clock.now);
  store.submitFollowUp(avery, { kind: "salvation", consent: true }, "test");
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  const before = store.careTasksFor(pastor, { team: true }).tasks.length;
  assert.ok(before > 0);

  store.setPlaybookActive(nicholas, "playbook-salvation", false);
  assert.equal(store.careTasksFor(pastor, { team: true }).tasks.length, before, "open tasks stay");
  store.submitFollowUp(avery, { kind: "salvation", consent: true }, "test");
  assert.equal(store.careTasksFor(pastor, { team: true }).tasks.length, before, "no new tasks once off");
  // A pastor sees the Master Admin's change and can flip it back.
  assert.equal(store.playbooks(pastor).playbooks.find((item) => item.id === "playbook-salvation")!.active, false);
  store.setPlaybookActive(pastor, "playbook-salvation", true);
  assert.equal(store.playbooks(nicholas).playbooks.find((item) => item.id === "playbook-salvation")!.active, true);
});

test("salvation playbook: five tasks for the care team seat, first call within 24 hours, suggestions only", () => {
  const { store, clock } = clocked();
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  store.setPlaybookActive(pastor, "playbook-salvation", true);
  const avery = signIn(store, "avery@sample.onehope", clock.now);
  const sent = store.submitFollowUp(avery, { kind: "salvation", consent: true }, "test");
  assert.ok(sent);

  const eden = signIn(store, "eden@sample.onehope", clock.now);
  const mine = store.careTasksFor(eden).tasks;
  assert.equal(mine.length, DEFAULT_PLAYBOOKS.find((item) => item.trigger === "salvation")!.steps.length);
  assert.ok(
    mine.every((task) => task.assigneeName === "Eden Sample"),
    "only the care team seat gets tasks",
  );
  const first = mine[0]!;
  assert.equal(first.dueAt, clock.now + 24 * HOUR);
  assert.equal(first.salvation, true);
  assert.match(first.script, /^Hi Avery, this is Eden from One Hope Church/);
  assert.equal(first.script.includes("{"), false);
  assert.equal(first.why, "Said yes to Jesus, within 24 hours");

  // Volunteers, team leaders and kids directors never get or see care tasks.
  for (const email of [
    "harper@sample.onehope",
    "gray@sample.onehope",
    "frankie@sample.onehope",
    "dana@sample.onehope",
  ]) {
    assert.throws(() => store.careTasksFor(signIn(store, email, clock.now)), isCode("forbidden"), email);
  }
  // The task appears on Avery's person page for care staff.
  assert.equal(store.personCare(eden, "person-avery").openTasks.length, mine.length);
});

test("no consent means one prayer task; first visit works for guests without an account", () => {
  const { store, clock } = clocked();
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  // Contact details are care records: locked until "confirm it's you".
  store.setPlaybookActive(pastor, "playbook-first-visit", true);
  store.submitFollowUp(
    null,
    { kind: "visit", name: "Locked Guest", phone: "214-555-0100", consent: true },
    "g0",
  );
  const locked = store.careTasksFor(pastor, { team: true }).tasks[0];
  assert.equal(locked?.contactLocked, true);
  assert.equal(locked?.phone, "");
  for (const task of store.careTasksFor(pastor, { team: true }).tasks)
    store.completeTask(pastor, task.id, { outcome: "skipped" });
  store.stepUp(pastor, { code: totpCode(decodeBase32(SAMPLE_TOTP_BASE32), clock.now) });
  store.setPlaybookActive(pastor, "playbook-salvation", true);
  store.setPlaybookActive(pastor, "playbook-first-visit", true);
  store.submitFollowUp(null, { kind: "salvation", name: "Riley Guest", consent: false }, "guest-1");
  let team = store.careTasksFor(pastor, { team: true }).tasks;
  assert.equal(team.length, 1);
  assert.equal(team[0]?.channel, "prayer");
  assert.equal(team[0]?.consent, false);
  assert.equal(team[0]?.phone, "");
  assert.match(team[0]?.script ?? "", /Pray for Riley/);

  store.submitFollowUp(
    null,
    { kind: "visit", name: "Morgan Visitor", phone: "214-555-0101", consent: true },
    "guest-2",
  );
  team = store.careTasksFor(pastor, { team: true }).tasks;
  const visit = team.filter((task) => task.name === "Morgan Visitor");
  assert.equal(visit.length, 4);
  assert.equal(visit[0]?.phone, "214-555-0101");
  assert.equal(visit[0]?.personId, null);
  assert.deepEqual(
    visit.map((task) => (task.dueAt - clock.now) / DAY),
    [0, 2, 4, 7],
  );
  // Other kinds (baptism, growth track) have no playbook yet.
  store.submitFollowUp(null, { kind: "baptism", name: "Sam", consent: false }, "guest-3");
  assert.equal(store.careTasksFor(pastor, { team: true }).tasks.length, 5);

  // Turning a playbook off stops new tasks but leaves open ones.
  store.setPlaybookActive(pastor, "playbook-first-visit", false);
  store.submitFollowUp(null, { kind: "visit", name: "Late Visitor", consent: true }, "guest-4");
  assert.equal(store.careTasksFor(pastor, { team: true }).tasks.length, 5);
});

test("completing tasks: done logs a touch, couldn't reach retries three times, skip closes", () => {
  const { store, clock } = clocked();
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  store.setPlaybookActive(pastor, "playbook-salvation", true);
  const avery = signIn(store, "avery@sample.onehope", clock.now);
  store.submitFollowUp(avery, { kind: "salvation", consent: true }, "test");
  const eden = signIn(store, "eden@sample.onehope", clock.now);
  const [call, bible, mentor] = store.careTasksFor(eden).tasks;
  assert.ok(call && bible && mentor);

  clock.now += 2 * HOUR;
  // Staff sessions idle out, so both sign in again after the jump.
  const edenLater = signIn(store, "eden@sample.onehope", clock.now);
  const pastorLater = signIn(store, "reese@sample.onehope", clock.now);
  store.completeTask(edenLater, call.id, { outcome: "done", note: "Prayed together. So joyful." });
  const avCare = store.personCare(edenLater, "person-avery");
  assert.equal(avCare.touches[0]?.kind, "call");
  assert.equal(avCare.touches[0]?.note, "Prayed together. So joyful.");
  assert.equal(avCare.lastContactAt, clock.now);
  const today = store.careToday(pastorLater);
  assert.equal(today.decisionsThisWeek, 1);
  assert.equal(today.decisionsWaiting, 0, "the follow-up moved to contacted");
  assert.equal(today.reachedIn24, 1);
  assert.throws(() => store.completeTask(edenLater, call.id, { outcome: "done" }), isCode("not_found"));

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = store.completeTask(edenLater, bible.id, { outcome: "unreached" });
    assert.equal(result.status, "open");
    assert.equal(result.attempts, attempt);
    assert.equal(result.dueAt, clock.now + DAY);
  }
  assert.equal(store.completeTask(edenLater, bible.id, { outcome: "unreached" }).status, "unreached");

  store.completeTask(pastorLater, mentor.id, { outcome: "skipped" });
  assert.equal(store.careTasksFor(edenLater).tasks.length, 2);
  assert.throws(
    () => store.completeTask(edenLater, "task_missing", { outcome: "done" }),
    isCode("not_found"),
  );
  const [next] = store.careTasksFor(edenLater).tasks;
  assert.throws(() => store.completeTask(edenLater, next!.id, { outcome: "maybe" }), isCode("invalid"));
});

test("Today numbers: overdue and a late salvation call show up", () => {
  const { store, clock } = clocked();
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  store.setPlaybookActive(pastor, "playbook-salvation", true);
  store.submitFollowUp(
    null,
    { kind: "salvation", name: "Jo Guest", phone: "214-555-0102", consent: true },
    "g",
  );
  const eden = signIn(store, "eden@sample.onehope", clock.now);
  let today = store.careToday(eden);
  assert.equal(today.overdue, 0);
  assert.equal(today.teamOpen, null, "care team sees their own numbers");
  clock.now += 25 * HOUR;
  const later = signIn(store, "eden@sample.onehope", clock.now);
  today = store.careToday(later);
  // The 24-hour call and the day-1 Bible visit are both past due now.
  assert.equal(today.overdue, 2);
  assert.equal(today.salvationLate, 1);
  const pastorLater = signIn(store, "reese@sample.onehope", clock.now);
  assert.equal(store.careToday(pastorLater).teamOverdue, 2);
  assert.deepEqual(store.careToday(pastorLater).activePlaybooks, ["Said yes to Jesus"]);
});

test("tasks go only to care team seats: reassignment, role changes and leaving", () => {
  const { store, clock, config } = clocked();
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  store.setPlaybookActive(pastor, "playbook-first-visit", true);
  store.submitFollowUp(null, { kind: "visit", name: "Pat Guest", consent: true }, "g1");
  const [task] = store.careTasksFor(pastor, { team: true }).tasks;
  assert.ok(task);
  assert.throws(() => store.reassignTask(pastor, task.id, "person-gray"), isCode("invalid"));
  assert.throws(() => store.reassignTask(pastor, task.id, "person-reese"), isCode("invalid"));
  const eden = signIn(store, "eden@sample.onehope", clock.now);
  assert.throws(() => store.reassignTask(eden, task.id, "person-eden"), isCode("forbidden"));

  // Master Admin moves Harper onto the care team: new tasks balance across both seats.
  const nicholas = signIn(store, config.masterAdminPrimaryEmail, clock.now, "seat-password");
  store.changeRole(nicholas, { personId: "person-harper", role: "care_team" });
  store.submitFollowUp(null, { kind: "visit", name: "Quinn Guest", consent: true }, "g2");
  const quinn = store.careTasksFor(pastor, { team: true }).tasks.filter((row) => row.name === "Quinn Guest");
  assert.ok(
    quinn.every((row) => row.assigneeName === "Harper Sample"),
    "the seat with fewer open tasks",
  );
  store.reassignTask(pastor, quinn[0]!.id, "person-eden");

  // Harper leaves the care team: their open tasks go back to nobody, ready to move.
  store.changeRole(nicholas, { personId: "person-harper", role: "volunteer" });
  const open = store.careTasksFor(pastor, { team: true }).tasks;
  assert.equal(open.filter((row) => row.assigneeId === "person-harper").length, 0);
  assert.equal(store.careToday(pastor).unassigned, 3);

  // A member who leaves takes their tasks with them.
  store.setPlaybookActive(pastor, "playbook-salvation", true);
  const casey = signIn(store, "casey@sample.onehope", clock.now);
  store.submitFollowUp(casey, { kind: "salvation", consent: true }, "c");
  assert.ok(store.careTasksFor(pastor, { team: true }).tasks.some((row) => row.personId === "person-casey"));
  store.stepUp(casey, { password: SAMPLE_PASSWORD });
  store.deleteSelf(casey);
  assert.equal(
    store.toDocument().careTasks?.some((row) => row.personId === "person-casey"),
    false,
  );
});

test("a person's timeline pages 50 at a time", () => {
  const { store, clock } = clocked();
  const eden = signIn(store, "eden@sample.onehope", clock.now);
  for (let i = 0; i < 120; i += 1) {
    clock.now += 1000;
    store.logTouch(eden, "person-blake", { kind: "note", outcome: "reached", note: `n${i}` });
  }
  const first = store.personCare(eden, "person-blake");
  assert.equal(first.touches.length, 50);
  assert.equal(first.touches[0]?.note, "n119");
  assert.equal(first.newerPage, false);
  assert.ok(first.olderTouchesBefore);
  const second = store.personCare(eden, "person-blake", { before: first.olderTouchesBefore });
  assert.equal(second.touches[0]?.note, "n69");
  assert.equal(second.newerPage, true);
  const third = store.personCare(eden, "person-blake", { before: second.olderTouchesBefore });
  assert.equal(third.touches.length, 20);
  assert.equal(third.olderTouchesBefore, null);
});

test("helpers: script fill, round-robin, Chicago day buckets", () => {
  assert.equal(
    fillScript("Hi {first name}, it's {your name}.", { firstName: "Ana", yourName: "Eden" }),
    "Hi Ana, it's Eden.",
  );
  assert.equal(pickCareSeat([], new Map()), null);
  assert.equal(pickCareSeat(["b", "a"], new Map([["a", 2]])), "b");
  assert.equal(pickCareSeat(["b", "a"], new Map()), "a");
  const now = Date.parse("2026-11-22T05:30:00.000Z"); // 11:30 PM Saturday in Chicago
  assert.equal(new Date(chicagoDayStart(now)).toISOString(), "2026-11-21T06:00:00.000Z");
  assert.equal(bucketFor(now - 1, now), "overdue");
  assert.equal(bucketFor(now + 20 * 60 * 1000, now), "today");
  assert.equal(bucketFor(now + 2 * HOUR, now), "week", "after midnight Chicago is tomorrow");
  assert.equal(bucketFor(now + 8 * DAY, now), "later");
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

test("Postgres: tasks persist, touches page from the database, leaving erases unloaded rows, RLS holds", async () => {
  const db = new PGlite();
  const sql = client(db);
  await migrate(sql);
  await seedTenantIfEmpty(sql, "onehope", { ...process.env, ONEHOPE_SAMPLE_DATA: "true" });

  const pastor = await runRequest(sql, (store) => signIn(store, "reese@sample.onehope"), "localhost");
  const eden = await runRequest(sql, (store) => signIn(store, "eden@sample.onehope"), "localhost");
  await runRequest(
    sql,
    (store) => {
      store.setPlaybookActive(pastor, "playbook-first-visit", true);
      store.submitFollowUp(null, { kind: "visit", name: "Lee Guest", consent: true }, "pg");
    },
    "localhost",
    process.env,
    { sessionToken: pastor },
  );
  const tasks = await runRequest(sql, (store) => store.careTasksFor(eden).tasks, "localhost", process.env, {
    sessionToken: eden,
  });
  assert.equal(tasks.length, 4);
  const rows = await db.query<{ status: string; assignee_id: string; due_at: unknown; record: string }>(
    "SELECT status, assignee_id, due_at, record FROM care_tasks",
  );
  assert.equal(rows.rows.length, 4);
  assert.ok(
    rows.rows.every((row) => row.assignee_id === "person-eden" && row.status === "open" && row.due_at),
  );
  assert.equal(
    rows.rows.some((row) => row.record.includes("Lee Guest")),
    false,
    "no names in task rows",
  );

  // 60 touches, in small batches with distinct times.
  for (let batch = 0; batch < 6; batch += 1) {
    await runRequest(
      sql,
      (store) => {
        for (let i = 0; i < 10; i += 1) {
          // Distinct milliseconds, so the page boundary is exact.
          const tick = Date.now();
          while (Date.now() === tick) {
            /* wait one millisecond */
          }
          store.logTouch(eden, "person-casey", {
            kind: "note",
            outcome: "reached",
            note: `t${batch * 10 + i}`,
          });
        }
      },
      "localhost",
      process.env,
      { sessionToken: eden },
    );
  }
  const firstPage = await runRequest(
    sql,
    (store) => store.personCare(eden, "person-casey"),
    "localhost",
    process.env,
    { sessionToken: eden, touchPage: { personId: "person-casey" } },
  );
  assert.equal(firstPage.touches.length, 50);
  assert.ok(firstPage.olderTouchesBefore);
  const secondPage = await runRequest(
    sql,
    (store) => store.personCare(eden, "person-casey", { before: firstPage.olderTouchesBefore }),
    "localhost",
    process.env,
    { sessionToken: eden, touchPage: { personId: "person-casey", before: firstPage.olderTouchesBefore } },
  );
  assert.equal(secondPage.touches.length, 10);
  assert.equal(secondPage.olderTouchesBefore, null);
  const counted = await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM interactions WHERE touched_at IS NOT NULL",
  );
  assert.equal(counted.rows[0]?.n, 60);

  // Leaving deletes touches even when this request did not load them.
  const before = await withServiceRole(sql, "onehope", () => loadDocument(sql, "onehope"));
  const after = structuredClone(before);
  after.touches = [];
  before.touches = [];
  const casey = after.people.find((row) => row.id === "person-casey")!;
  casey.deleted = true;
  await withServiceRole(sql, "onehope", () =>
    saveDocumentDiff(sql, "onehope", before, after, { syncModules: false }),
  );
  const left = await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM interactions WHERE person_id = 'person-casey'",
  );
  assert.equal(left.rows[0]?.n, 0);

  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('app.tenant_id', 'other-church', false)");
  await db.exec("SET ROLE app_user");
  for (const table of ["care_tasks", "care_playbooks"]) {
    const seen = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    assert.equal(seen.rows[0]?.n, 0, table);
  }
  await assert.rejects(() =>
    db.query(
      "INSERT INTO care_tasks (tenant_id, id, status, record) VALUES ('onehope', 'task-x', 'open', '{}')",
    ),
  );
  await db.exec("RESET ROLE");
});

test("pastors remove members or volunteers (never staff), after confirming it's them", () => {
  const { store, clock } = clocked();
  const pastor = signIn(store, "reese@sample.onehope", clock.now);
  store.stepUp(pastor, { code: totpCode(decodeBase32(SAMPLE_TOTP_BASE32), clock.now) });
  const eden = signIn(store, "eden@sample.onehope", clock.now);
  store.logTouch(eden, "person-casey", { kind: "call", outcome: "reached", note: "hello" });
  assert.equal(store.personCare(pastor, "person-casey").mayRemove, true);
  assert.equal(store.personCare(pastor, "person-eden").mayRemove, false);

  assert.throws(() => store.removePerson(eden, "person-casey"), isCode("forbidden"));
  assert.throws(() => store.removePerson(pastor, "person-eden"), isCode("forbidden"));
  assert.throws(() => store.removePerson(pastor, "person-reese"), isCode("invalid"));
  store.removePerson(pastor, "person-casey");
  assert.throws(() => store.personCare(pastor, "person-casey"), isCode("not_found"));
  assert.throws(() => store.removePerson(pastor, "person-casey"), isCode("not_found"));
  const doc = store.toDocument();
  assert.equal(
    doc.touches?.some((row) => row.personId === "person-casey"),
    false,
  );
  assert.ok(
    doc.auditLog.some((entry) => entry.resource === "person_delete" && entry.resourceId === "person-casey"),
  );
  // The removed member can no longer sign in.
  assert.throws(() => signIn(store, "casey@sample.onehope", clock.now));
});

test("Master Admin can also remove a member, but never a staff seat", () => {
  const { store, clock, config } = clocked();
  const nicholas = signIn(store, config.masterAdminPrimaryEmail, clock.now, "seat-password");
  store.stepUp(nicholas, { code: totpCode(decodeBase32(SAMPLE_TOTP_BASE32), clock.now) });
  assert.equal(store.personCare(nicholas, "person-casey").mayRemove, true);
  assert.equal(store.personCare(nicholas, "person-reese").mayRemove, false);
  assert.throws(() => store.removePerson(nicholas, "person-reese"), isCode("forbidden"));
  assert.throws(() => store.removePerson(nicholas, "person-eden"), isCode("forbidden"));
  assert.throws(() => store.removePerson(nicholas, "person-nicholas"), isCode("invalid"));
  assert.deepEqual(store.removePerson(nicholas, "person-casey"), { id: "person-casey", removed: true });
  assert.throws(() => signIn(store, "casey@sample.onehope", clock.now));
});
