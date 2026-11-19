import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.ts";
import { AccessError } from "../src/domain.ts";
import { SAMPLE_PASSWORD, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { ChurchStore } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

function demo(env: NodeJS.ProcessEnv = {}) {
  return new ChurchStore(loadConfig(env));
}

function member(store: ChurchStore, email: string) {
  return store.login({ email, password: SAMPLE_PASSWORD, ip: "203.0.113.10", userAgent: "test" }).token;
}

function code() {
  return totpCode(decodeBase32(SAMPLE_TOTP_BASE32), Date.now());
}

function staff(store: ChurchStore, email: string) {
  const { token } = store.login({ email, password: SAMPLE_PASSWORD, ip: "203.0.113.10", userAgent: "test" });
  store.verifyMfa(token, code());
  return token;
}

test("a member cannot read another household's giving, kids, or private prayer", () => {
  const store = demo();
  const avery = member(store, "avery@sample.onehope");
  store.stepUp(avery, { password: SAMPLE_PASSWORD });
  const gifts = store.myGifts(avery);
  assert.deepEqual(
    gifts.map((gift) => gift.amountCents),
    [2500],
  );
  assert.equal(
    gifts.every((gift) => gift.charged === false && gift.sample === true),
    true,
  );
  assert.throws(
    () => store.allGifts(avery),
    (error: AccessError) => error.code === "forbidden",
  );
  assert.equal(store.kidSensitive(avery, "child-remy").allergy, "Sample: peanut allergy");
  assert.throws(
    () => store.kidSensitive(avery, "child-quinn"),
    (error: AccessError) => error.code === "forbidden",
  );
  const prayers = JSON.stringify(store.listPrayers(avery));
  assert.match(prayers, /Avery's unspoken request/);
  assert.doesNotMatch(prayers, /Casey's family request/);
  const ministry = JSON.stringify(store.ministry(avery));
  assert.match(ministry, /Sample care note for Avery/);
  assert.doesNotMatch(ministry, /Sample care note for Casey/);
  assert.equal(store.storedGiftCiphertext("gift-avery").includes("amountCents"), false);
});

test("giving history requires step-up and finance can see both households only after it", () => {
  const store = demo();
  const dana = staff(store, "dana@sample.onehope");
  assert.throws(
    () => store.allGifts(dana),
    (error: AccessError) => error.code === "step_up_required",
  );
  store.stepUp(dana, { code: code() });
  const amounts = store
    .allGifts(dana)
    .map((gift) => gift.amountCents)
    .sort();
  assert.deepEqual(amounts, [2500, 4100]);
  const reads = store
    .audit(staff(store, "reese@sample.onehope"))
    .filter((entry) => entry.resource === "gift" && entry.action === "read");
  assert.ok(reads.some((entry) => entry.actorId === "person-dana"));
});

test("directory is opt-in per field", () => {
  const store = demo();
  const avery = member(store, "avery@sample.onehope");
  const directory = store.directory(avery);
  const casey = directory.find((person) => person.id === "person-casey");
  const self = directory.find((person) => person.id === "person-avery");
  const harper = directory.find((person) => person.id === "person-harper");
  assert.equal(casey?.email, "");
  assert.equal(casey?.phone, "");
  assert.equal(self?.phone, "214-555-0142");
  assert.equal(harper?.phone, "214-555-0100");
  assert.equal(
    directory.some((person) => person.id === "person-nicholas"),
    false,
  );
});

test("shared care notes and background checks stay with the people who were granted them", () => {
  const store = demo();
  const harper = member(store, "harper@sample.onehope");
  store.stepUp(harper, { password: SAMPLE_PASSWORD });
  const notes = store.ministry(harper).care.notes.map((note) => note.id);
  assert.deepEqual(notes, ["note-casey"]);
  const checks = store.ministry(harper).background.map((check) => check.personId);
  assert.deepEqual(checks, ["person-harper"]);
  const gray = staff(store, "gray@sample.onehope");
  store.stepUp(gray, { code: code() });
  assert.deepEqual(store.ministry(gray).care.notes, []);
  assert.equal(store.ministry(gray).care.queue.locked, true);
});

test("kids pickup is two-adult, guardian verified, and custody aware", () => {
  const store = demo();
  const frankie = staff(store, "frankie@sample.onehope");
  store.stepUp(frankie, { code: code() });
  store.clockIn(frankie);
  assert.equal(
    store.pickup(frankie, { childId: "child-remy", guardianPersonId: "person-avery", code: "4821" }).allowed,
    false,
  );
  store.clockIn(staff(store, "dana@sample.onehope"));
  assert.equal(
    store.pickup(frankie, { childId: "child-remy", guardianPersonId: "person-avery", code: "0000" }).allowed,
    false,
  );
  assert.equal(
    store.pickup(frankie, { childId: "child-remy", guardianPersonId: "person-blake", code: "4821" }).allowed,
    false,
  );
  assert.equal(
    store.pickup(frankie, { childId: "child-remy", guardianPersonId: "person-casey", code: "4821" }).allowed,
    false,
  );
  assert.equal(
    store.pickup(frankie, { childId: "child-remy", guardianPersonId: "person-avery", code: "4821" }).allowed,
    true,
  );
  assert.deepEqual(
    store.pickup(frankie, { childId: "child-remy", guardianPersonId: "person-avery", code: "4821" }),
    { allowed: false, reason: "This child is not checked in." },
  );
  const label = store.label(frankie, "child-remy");
  assert.equal(label.socketOpened, false);
  assert.match(label.zpl, /Remy Sample/);
});

test("roster does not include medical details", () => {
  const store = demo();
  const frankie = staff(store, "frankie@sample.onehope");
  const roster = JSON.stringify(store.roster(frankie));
  assert.doesNotMatch(roster, /peanut/);
  assert.doesNotMatch(roster, /4821/);
});

test("master admin changes need both seated admins and every tier 3 read is logged", () => {
  const env = {
    MASTER_ADMIN_SECONDARY_EMAIL: "eden@sample.onehope",
    MASTER_ADMIN_SECONDARY_NAME: "Eden Sample",
  };
  const store = demo(env);
  const config = loadConfig(env);
  const elevated = new ChurchStore(loadConfig(env), {
    passwordOverrides: { [config.masterAdminPrimaryEmail]: "seat-password" },
    totpOverrides: { [config.masterAdminPrimaryEmail]: SAMPLE_TOTP_BASE32 },
  });
  assert.throws(
    () =>
      store.proposeMasterAdmin(staff(store, "reese@sample.onehope"), {
        action: "revoke",
        targetPersonId: "person-nicholas",
      }),
    (error: AccessError) => error.code === "forbidden" || error.code === "seat_empty",
  );
  const eden = staff(elevated, "eden@sample.onehope");
  const nicholas = elevated.login({
    email: config.masterAdminPrimaryEmail,
    password: "seat-password",
    ip: "198.51.100.4",
    userAgent: "test",
  });
  elevated.verifyMfa(nicholas.token, code());
  elevated.stepUp(nicholas.token, { code: code() });
  elevated.allGifts(nicholas.token);
  assert.ok(
    elevated
      .audit(eden)
      .some(
        (entry) =>
          entry.actorId === "person-nicholas" && entry.resource === "gift" && entry.action === "read",
      ),
  );
  assert.throws(
    () => elevated.proposeMasterAdmin(eden, { action: "grant", targetPersonId: "person-harper" }),
    (error: AccessError) => error.code === "two_person",
  );
  const proposal = elevated.proposeMasterAdmin(eden, { action: "revoke", targetPersonId: "person-nicholas" });
  assert.equal(proposal.executed, false);
  assert.equal(elevated.seats().primary.filled, true);
  const finished = elevated.approveMasterAdmin(nicholas.token, proposal.id);
  assert.equal(finished.executed, true);
  assert.equal(elevated.seats().primary.filled, false);
  assert.throws(
    () => elevated.allGifts(nicholas.token),
    (error: AccessError) => error.code === "forbidden",
  );
});

test("one seated master admin cannot change the role", () => {
  const store = demo();
  assert.equal(store.seats().secondary.filled, false);
  assert.match(store.seats().secondary.name, /Lead Pastor/);
  const reese = staff(store, "reese@sample.onehope");
  assert.throws(
    () => store.proposeMasterAdmin(reese, { action: "revoke", targetPersonId: "person-nicholas" }),
    (error: AccessError) => error.code === "forbidden",
  );
});

test("pastor cannot grant finance, and a promoted staff session must sign in again", () => {
  const config = loadConfig({});
  const store = new ChurchStore(config, {
    passwordOverrides: { [config.masterAdminPrimaryEmail]: "seat-password" },
    totpOverrides: { [config.masterAdminPrimaryEmail]: SAMPLE_TOTP_BASE32 },
  });
  const reese = staff(store, "reese@sample.onehope");
  assert.throws(
    () => store.changeRole(reese, { personId: "person-harper", role: "finance" }),
    (error: AccessError) => error.code === "forbidden",
  );
  const nicholas = store.login({
    email: config.masterAdminPrimaryEmail,
    password: "seat-password",
    ip: "198.51.100.8",
    userAgent: "test",
  });
  store.verifyMfa(nicholas.token, code());
  const harper = member(store, "harper@sample.onehope");
  store.changeRole(nicholas.token, { personId: "person-harper", role: "finance" });
  assert.throws(
    () => store.me(harper),
    (error: AccessError) => error.code === "mfa_required",
  );
});

test("sample shortcut is labeled and refused in production", () => {
  const store = demo();
  const preview = store.loginSampleStaff({ ip: "192.0.2.9", userAgent: "preview" });
  assert.equal(preview.sample, true);
  assert.equal(store.me(preview.token).sample, true);
  const key = Buffer.alloc(32, 3).toString("base64");
  const production = ChurchStore.demo({ ONEHOPE_ENV: "production", FIELD_ENCRYPTION_KEY: key });
  assert.equal(production.status("1").env, "production");
  assert.equal(production.status("1").fieldEncryption, "configured");
  assert.throws(
    () => production.loginSampleStaff({ ip: "192.0.2.9", userAgent: "preview" }),
    (error: AccessError) => error.code === "forbidden",
  );
  assert.throws(() => loadConfig({ ONEHOPE_ENV: "production" }));
});

test("deletion removes a member's private rows and leaves the other household intact", () => {
  const store = demo();
  const casey = member(store, "casey@sample.onehope");
  store.stepUp(casey, { password: SAMPLE_PASSWORD });
  store.deleteSelf(casey);
  assert.throws(() =>
    store.login({
      email: "casey@sample.onehope",
      password: SAMPLE_PASSWORD,
      ip: "203.0.113.10",
      userAgent: "test",
    }),
  );
  const dana = staff(store, "dana@sample.onehope");
  store.stepUp(dana, { code: code() });
  assert.equal(
    store.allGifts(dana).some((gift) => gift.id === "gift-casey"),
    false,
  );
  assert.equal(
    store.allGifts(dana).some((gift) => gift.id === "gift-avery"),
    true,
  );
});

test("export without step-up omits tier 3 and never includes another member's prayer", () => {
  const store = demo();
  const avery = member(store, "avery@sample.onehope");
  const locked = JSON.stringify(store.exportSelf(avery));
  assert.doesNotMatch(locked, /peanut/);
  assert.doesNotMatch(locked, /unspoken request/);
  assert.doesNotMatch(locked, /Casey's family/);
  store.stepUp(avery, { password: SAMPLE_PASSWORD });
  const open = JSON.stringify(store.exportSelf(avery));
  assert.match(open, /peanut/);
  assert.match(open, /unspoken request/);
  assert.doesNotMatch(open, /Casey's family/);
});

test("sessions time out and a new IP is recorded", () => {
  let now = Date.parse("2026-11-17T18:00:00.000Z");
  const store = new ChurchStore(loadConfig({}), { now: () => now });
  const first = store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.10",
    userAgent: "phone",
  });
  assert.equal(store.alertsFor(first.token).length, 0);
  store.logout(first.token);
  const second = store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.80",
    userAgent: "phone",
  });
  assert.equal(
    store.alertsFor(second.token).some((alert) => alert.kind === "ip"),
    true,
  );
  now += 12 * 60 * 60 * 1000 + 1;
  assert.throws(
    () => store.me(second.token),
    (error: AccessError) => error.code === "session_expired",
  );
});

test("demo giving never charges, push never sends, and secrets stay on the server", () => {
  const store = demo();
  const avery = member(store, "avery@sample.onehope");
  store.stepUp(avery, { password: SAMPLE_PASSWORD });
  return store
    .createGift(avery, { amountCents: 1200, fundId: "christmas-giving-tree", recurring: "twice_monthly" })
    .then((gift) => {
      assert.equal(gift.charged, false);
      assert.equal(gift.processor, "demo");
      assert.match(store.statement(avery, 2026).text, /SAMPLE STATEMENT/);
    })
    .then(() => {
      const config = loadConfig({});
      const adminStore = new ChurchStore(config, {
        passwordOverrides: { [config.masterAdminPrimaryEmail]: "seat-password" },
        totpOverrides: { [config.masterAdminPrimaryEmail]: SAMPLE_TOTP_BASE32 },
      });
      const nicholas = adminStore.login({
        email: config.masterAdminPrimaryEmail,
        password: "seat-password",
        ip: "198.51.100.2",
        userAgent: "test",
      });
      adminStore.verifyMfa(nicholas.token, code());
      adminStore.setIntegration(nicholas.token, "stripe", "UNIQUESECRET9911");
      const revealed = JSON.stringify(adminStore.integrations(nicholas.token));
      assert.match(revealed, /9911/);
      assert.doesNotMatch(revealed, /UNIQUESECRET/);
      const reese = staff(adminStore, "reese@sample.onehope");
      assert.doesNotMatch(JSON.stringify(adminStore.integrations(reese)), /9911/);
      assert.doesNotMatch(adminStore.secretMaterial(), /UNIQUESECRET/);
      const preview = adminStore.loginSampleStaff({ ip: "192.0.2.10", userAgent: "preview" });
      const push = adminStore.sendPush(preview.token, {
        title: "Sunday",
        body: "Sample note",
        segment: "members",
      });
      assert.equal(push.sent, false);
    });
});

test("waitlist, groups, scheduling, rooms, and expenses follow the rules", () => {
  const store = demo();
  const avery = member(store, "avery@sample.onehope");
  assert.equal(store.register(avery, "event-workshop").status, "waitlist");
  assert.throws(() => store.listMessages(avery, "group-weekday"));
  store.joinGroup(avery, "group-weekday");
  assert.equal(store.listMessages(avery, "group-weekday").length, 1);
  const gray = staff(store, "gray@sample.onehope");
  assert.equal(store.respond(gray, "sched-gray", true).status, "accepted");
  assert.throws(() => store.respond(avery, "sched-gray", false));
  assert.deepEqual(store.suggestSchedule().assignments, [{ positionId: "greeter", personId: "person-gray" }]);
  assert.throws(() =>
    store.book(avery, {
      roomId: "room-auditorium",
      start: Date.parse("2026-11-22T16:30:00.000Z"),
      end: Date.parse("2026-11-22T17:30:00.000Z"),
    }),
  );
  assert.equal(
    store.book(avery, {
      roomId: "room-lobby",
      start: Date.parse("2026-11-22T16:30:00.000Z"),
      end: Date.parse("2026-11-22T17:30:00.000Z"),
    }).roomId,
    "room-lobby",
  );
  const dana = staff(store, "dana@sample.onehope");
  assert.throws(() => store.decideExpense(avery, "expense-1", "approve"));
  assert.equal(store.decideExpense(dana, "expense-1", "approve").state, "approved");
  assert.throws(() =>
    store.updatePathway(member(store, "casey@sample.onehope"), {
      personId: "person-avery",
      stepId: "baptism",
      status: "complete",
    }),
  );
});
