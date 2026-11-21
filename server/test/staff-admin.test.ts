import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { loadConfig } from "../src/config.ts";
import { AccessError } from "../src/domain.ts";
import { SAMPLE_PASSWORD, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { nextChurchMoment, parseChicagoLocal } from "../src/staff-desk.ts";
import { ChurchStore } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

function code() {
  return totpCode(decodeBase32(SAMPLE_TOTP_BASE32), Date.now());
}

function pastor(store: ChurchStore) {
  const { token } = store.login({
    email: "reese@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(token, code());
  return token;
}

function member(store: ChurchStore) {
  return store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  }).token;
}

test("Central wall time parses to the church time zone", () => {
  const ms = parseChicagoLocal("2026-11-22T10:30");
  assert.equal(ms, Date.parse("2026-11-22T16:30:00.000Z"));
  assert.equal(parseChicagoLocal("not a date"), null);
});

test("pastors post, schedule, edit, and archive home cards; members cannot", async () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const guest = member(store);
  assert.throws(
    () => store.createAnnouncement(guest, { title: "Nope", body: "A member cannot post this." }),
    (error: AccessError) => error.code === "forbidden",
  );
  const later = Date.now() + 3 * 24 * 60 * 60 * 1000;
  const scheduled = store.createAnnouncement(lead, {
    title: "Prayer night",
    body: "Join us Wednesday.",
    startsAt: later,
    endsAt: later + 60 * 60 * 1000,
  });
  assert.equal(
    store.publicHome().announcements.some((item) => item.id === scheduled.id),
    false,
  );
  assert.equal(store.staffAnnouncements(lead).find((item) => item.id === scheduled.id)?.live, false);
  store.updateAnnouncement(lead, scheduled.id, {
    title: "Prayer night",
    body: "Join us Wednesday in the lobby.",
    startsAt: null,
    endsAt: null,
  });
  assert.equal(
    store.publicHome().announcements.some((item) => item.body.includes("lobby")),
    true,
  );
  assert.equal(store.archiveAnnouncement(lead, scheduled.id, true).archived, true);
  assert.equal(
    store.publicHome().announcements.some((item) => item.id === scheduled.id),
    false,
  );
  assert.throws(
    () => store.updateAnnouncement(lead, scheduled.id, { title: "", body: "x" }),
    (error: AccessError) => error.code === "invalid",
  );

  const handle = createApi({ store });
  const denied = await handle(
    new Request("http://localhost/api/announcements", {
      method: "POST",
      headers: { authorization: `Bearer ${guest}`, "content-type": "application/json" },
      body: JSON.stringify({ title: "Nope", body: "Still no." }),
    }),
  );
  assert.equal(denied.status, 403);
  const posted = await handle(
    new Request("http://localhost/api/announcements", {
      method: "POST",
      headers: { authorization: `Bearer ${lead}`, "content-type": "application/json" },
      body: JSON.stringify({ title: "Kids check-in is open", body: "Stop by the kids desk." }),
    }),
  );
  assert.equal(posted.status, 200);
  const created = (await posted.json()) as { announcement: { id: string } };
  const archived = await handle(
    new Request(`http://localhost/api/announcements/${created.announcement.id}/archive`, {
      method: "POST",
      headers: { authorization: `Bearer ${lead}`, "content-type": "application/json" },
      body: JSON.stringify({ archived: true }),
    }),
  );
  assert.equal(archived.status, 200);
  const finance = store.login({
    email: "dana@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(finance.token, code());
  const financeDenied = await handle(
    new Request("http://localhost/api/staff/announcements", {
      headers: { authorization: `Bearer ${finance.token}` },
    }),
  );
  assert.equal(financeDenied.status, 403);
  const list = await handle(
    new Request("http://localhost/api/staff/announcements", {
      headers: { authorization: `Bearer ${lead}` },
    }),
  );
  assert.equal(list.status, 200);
});

test("events and serve days keep the date staff chose, and a cancel stays canceled", async () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const guest = member(store);
  const start = parseChicagoLocal("2026-12-02T18:30");
  const end = parseChicagoLocal("2026-12-02T20:00");
  assert.ok(start && end);
  assert.throws(
    () => store.createEvent(guest, { title: "Nope", location: "Lobby", start, end }),
    (error: AccessError) => error.code === "forbidden",
  );
  assert.throws(
    () => store.createEvent(lead, { title: "Backwards", location: "Lobby", start: end, end: start }),
    (error: AccessError) => error.code === "invalid",
  );
  const created = store.createEvent(lead, {
    title: "Prayer night",
    location: "Lobby",
    description: "Come as you are.",
    capacity: 40,
    start,
    end,
  });
  assert.equal(created.start, start);
  assert.notEqual(created.start, Date.now() + 7 * 24 * 60 * 60 * 1000);
  assert.equal(store.publicHome().events.some((event) => event.id === created.id), true);
  assert.equal(store.cancelEvent(lead, created.id, true).cancelled, true);
  assert.equal(store.publicHome().events.some((event) => event.id === created.id), false);

  const serve = store.createOutreach(lead, {
    title: "Serve the neighborhood",
    location: "Church lobby",
    detail: "Meet and go out together.",
    start,
    end,
  });
  assert.equal(store.listOutreach().some((row) => row.id === serve.id), true);
  store.cancelOutreach(lead, serve.id, true);
  assert.equal(store.listOutreach().some((row) => row.id === serve.id), false);
  assert.throws(
    () => store.rsvpOutreach(guest, serve.id),
    (error: AccessError) => error.code === "not_found",
  );

  const handle = createApi({ store });
  const posted = await handle(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { authorization: `Bearer ${lead}`, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Christmas choir",
        location: "Auditorium",
        description: "One rehearsal.",
        capacity: 30,
        start,
        end,
      }),
    }),
  );
  assert.equal(posted.status, 200);
  const body = (await posted.json()) as { event: { id: string } };
  const canceled = await handle(
    new Request(`http://localhost/api/events/${body.event.id}/cancel`, {
      method: "POST",
      headers: { authorization: `Bearer ${lead}`, "content-type": "application/json" },
      body: JSON.stringify({ cancelled: true }),
    }),
  );
  assert.equal(canceled.status, 200);
  const care = store.login({
    email: "eden@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(care.token, code());
  const denied = await handle(
    new Request("http://localhost/api/staff/events", { headers: { authorization: `Bearer ${care.token}` } }),
  );
  assert.equal(denied.status, 403);
});

test("a canceled church event is not put back by the catalog", () => {
  const config = loadConfig({});
  const store = new ChurchStore(config, {
    fixture: false,
    passwordOverrides: { [config.masterAdminPrimaryEmail]: "seat-password" },
    totpOverrides: { [config.masterAdminPrimaryEmail]: SAMPLE_TOTP_BASE32 },
  });
  const { token } = store.login({
    email: config.masterAdminPrimaryEmail,
    password: "seat-password",
    ip: "203.0.113.9",
    userAgent: "test",
  });
  store.verifyMfa(token, code());
  const target = store.staffEvents(token).find((event) => event.id === "cc-3990859");
  assert.ok(target);
  store.cancelEvent(token, "cc-3990859", true);
  const restored = new ChurchStore(config, { fixture: false });
  restored.installDocument(store.toDocument());
  assert.equal(
    restored.publicHome().events.some((event) => event.id === "cc-3990859"),
    false,
  );
  const moment = nextChurchMoment(Date.parse("2026-11-18T18:00:00.000Z"), {
    weekday: "Sun",
    hour: 10,
    minute: 30,
    durationMin: 90,
  });
  assert.equal(new Date(moment.start).toISOString(), "2026-11-22T16:30:00.000Z");
  assert.equal(moment.end - moment.start, 90 * 60 * 1000);
});

test("care can assign, note, and date a follow-up, and reported prayers and testimonies wait for staff", async () => {
  const store = new ChurchStore(loadConfig({}));
  const guest = member(store);
  const careLogin = store.login({
    email: "eden@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(careLogin.token, code());
  const follow = store.submitFollowUp(
    guest,
    { kind: "visit", name: "Neighbor", email: "neighbor@example.com", phone: "", consent: true },
    "care-test",
  );
  assert.throws(
    () => store.updateFollowUp(careLogin.token, follow.id, "contacted"),
    (error: AccessError) => error.code === "step_up_required",
  );
  assert.throws(
    () => store.reportedPrayers(guest),
    (error: AccessError) => error.code === "forbidden" || error.code === "step_up_required",
  );
  store.stepUp(careLogin.token, { code: code() });
  const due = parseChicagoLocal("2026-11-25T15:00");
  assert.ok(due);
  store.updateFollowUp(careLogin.token, follow.id, {
    status: "contacted",
    assigneeId: "person-eden",
    dueAt: due,
    staffNote: "Called Tuesday",
  });
  const saved = store.followUpsFor(careLogin.token).find((row) => row.id === follow.id);
  assert.equal(saved?.status, "contacted");
  assert.equal(saved?.assigneeId, "person-eden");
  assert.equal(saved?.staffNote, "Called Tuesday");
  assert.equal(JSON.stringify(store.toDocument()).includes("Called Tuesday"), false);
  assert.throws(
    () => store.updateFollowUp(careLogin.token, follow.id, { assigneeId: "person-avery" }),
    (error: AccessError) => error.code === "invalid",
  );

  const prayer = store.submitPrayer(guest, { body: "Pray for our street.", visibility: "public" });
  store.moderatePrayer(careLogin.token, prayer.id, true);
  const harper = store.login({
    email: "harper@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  }).token;
  assert.equal(store.reportPrayer(harper, prayer.id).reported, true);
  assert.equal(store.reportedPrayers(careLogin.token).some((row) => row.id === prayer.id), true);
  store.moderatePrayer(careLogin.token, prayer.id, false);
  assert.equal(store.reportedPrayers(careLogin.token).some((row) => row.id === prayer.id), false);

  const testimony = store.submitTestimony(guest, {
    displayName: "Avery Sample",
    body: "Jesus met me this week.",
    consent: true,
  });
  const handle = createApi({ store });
  const hidden = await handle(
    new Request("http://localhost/api/care/testimonies", {
      headers: { authorization: `Bearer ${guest}` },
    }),
  );
  assert.equal(hidden.status, 403);
  const listed = await handle(
    new Request("http://localhost/api/care/testimonies", {
      headers: { authorization: `Bearer ${careLogin.token}` },
    }),
  );
  assert.equal(listed.status, 200);
  store.moderateTestimony(careLogin.token, testimony.id, true);
  assert.equal(
    store.community(null).testimonies.some((row) => row.id === testimony.id),
    true,
  );
  const denied = await handle(
    new Request("http://localhost/api/care/reported-prayers", {
      headers: { authorization: `Bearer ${guest}` },
    }),
  );
  assert.equal(denied.status, 403);
});

test("the kids desk clocks adults in, filters rooms, shows a code, and honors pickup rules", async () => {
  const store = new ChurchStore(loadConfig({}));
  const frankie = store.login({
    email: "frankie@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(frankie.token, code());
  const guest = member(store);
  const handle = createApi({ store });
  const memberClock = await handle(
    new Request("http://localhost/api/kids/clock-in", {
      method: "POST",
      headers: { authorization: `Bearer ${guest}` },
    }),
  );
  assert.equal(memberClock.status, 403);
  const roster = await handle(
    new Request("http://localhost/api/kids/roster?classroom=Preschool", {
      headers: { authorization: `Bearer ${frankie.token}` },
    }),
  );
  const rosterBody = (await roster.json()) as { children: { displayName: string }[] };
  assert.deepEqual(
    rosterBody.children.map((child) => child.displayName),
    ["Remy Sample"],
  );
  assert.equal(JSON.stringify(rosterBody).includes("4821"), false);
  assert.equal(JSON.stringify(rosterBody).includes("peanut"), false);
  const board = store.stationBoard(frankie.token, "Preschool");
  assert.equal(board.children[0]?.code, "4821");
  assert.equal(JSON.stringify(board).includes("peanut"), false);
  assert.equal(board.children[0]?.guardians.find((adult) => adult.displayName === "Blake Sample")?.blocked, true);
  const checked = await handle(
    new Request("http://localhost/api/kids/staff-check-in", {
      method: "POST",
      headers: { authorization: `Bearer ${frankie.token}`, "content-type": "application/json" },
      body: JSON.stringify({ childId: "child-remy" }),
    }),
  );
  assert.equal(checked.status, 200);
  const visit = (await checked.json()) as { code: string };
  assert.match(visit.code, /^\d{4}$/);
  store.stepUp(frankie.token, { code: code() });
  assert.equal(
    store.pickup(frankie.token, { childId: "child-remy", guardianPersonId: "person-avery", code: visit.code })
      .allowed,
    false,
  );
  const dana = store.login({
    email: "dana@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(dana.token, code());
  await handle(
    new Request("http://localhost/api/kids/clock-in", {
      method: "POST",
      headers: { authorization: `Bearer ${frankie.token}` },
    }),
  );
  const second = await handle(
    new Request("http://localhost/api/kids/clock-in", {
      method: "POST",
      headers: { authorization: `Bearer ${dana.token}` },
    }),
  );
  assert.equal(second.status, 200);
  assert.equal(
    store.pickup(frankie.token, { childId: "child-remy", guardianPersonId: "person-blake", code: visit.code })
      .allowed,
    false,
  );
  assert.equal(
    store.pickup(frankie.token, { childId: "child-remy", guardianPersonId: "person-avery", code: visit.code })
      .allowed,
    true,
  );
  const out = await handle(
    new Request("http://localhost/api/kids/clock-out", {
      method: "POST",
      headers: { authorization: `Bearer ${frankie.token}` },
    }),
  );
  assert.equal(out.status, 200);
  const label = store.stationLabel(frankie.token, "child-quinn");
  assert.match(label.zpl, /Quinn Sample/);
  assert.equal(label.socketOpened, false);
});

test("an invite can be claimed, undone while unclaimed, and a new staff member enrolls TOTP", async () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const guest = member(store);
  assert.throws(
    () => store.changeRole(guest, { personId: "person-harper", role: "team_leader" }),
    (error: AccessError) => error.code === "forbidden",
  );
  const added = store.addPerson(lead, {
    displayName: "Sam Neighbor",
    email: "sam.neighbor@example.com",
  });
  assert.ok(added.inviteToken.length >= 8);
  assert.ok(added.expires > Date.now());
  assert.equal(store.staffPeople(lead).find((person) => person.id === added.id)?.claimed, false);
  const handle = createApi({ store });
  const claimed = await handle(
    new Request("http://localhost/api/auth/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "sam.neighbor@example.com",
        inviteToken: added.inviteToken,
        password: "gathering-password",
      }),
    }),
  );
  assert.equal(claimed.status, 200);
  assert.throws(
    () => store.undoAddPerson(lead, added.id),
    (error: AccessError) => error.code === "invalid",
  );
  store.changeRole(lead, { personId: added.id, role: "team_leader" });
  assert.throws(
    () => store.changeRole(lead, { personId: added.id, role: "finance" }),
    (error: AccessError) => error.code === "forbidden",
  );

  const fresh = store.addPerson(lead, {
    displayName: "Pat Leader",
    email: "pat.leader@example.com",
  });
  assert.equal(store.undoAddPerson(lead, fresh.id).removed, true);
  const leader = store.login({
    email: "sam.neighbor@example.com",
    password: "gathering-password",
    ip: "203.0.113.20",
    userAgent: "phone",
  });
  assert.equal(store.totpStatus(leader.token), "enroll");
  const started = await handle(
    new Request("http://localhost/api/auth/totp/start", {
      method: "POST",
      headers: { authorization: `Bearer ${leader.token}` },
    }),
  );
  assert.equal(started.status, 200);
  const setup = (await started.json()) as { setupKey: string; otpauthUrl: string };
  assert.match(setup.otpauthUrl, /^otpauth:\/\/totp\//);
  assert.equal(setup.setupKey.includes(" "), false);
  const confirmed = await handle(
    new Request("http://localhost/api/auth/totp/confirm", {
      method: "POST",
      headers: { authorization: `Bearer ${leader.token}`, "content-type": "application/json" },
      body: JSON.stringify({ code: totpCode(decodeBase32(setup.setupKey), Date.now()) }),
    }),
  );
  assert.equal(confirmed.status, 200);
  assert.equal(store.me(leader.token).displayName, "Sam Neighbor");
  assert.equal(JSON.stringify(store.audit(lead)).includes(setup.setupKey), false);
});

test("serving can be assigned and undone only while it is still waiting", async () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const guest = member(store);
  assert.throws(
    () => store.assignServing(guest, { personId: "person-harper", position: "Door" }),
    (error: AccessError) => error.code === "forbidden",
  );
  const handle = createApi({ store });
  const assigned = await handle(
    new Request("http://localhost/api/staff/serving", {
      method: "POST",
      headers: { authorization: `Bearer ${lead}`, "content-type": "application/json" },
      body: JSON.stringify({ personId: "person-harper", position: "Door" }),
    }),
  );
  assert.equal(assigned.status, 200);
  const body = (await assigned.json()) as { assignment: { id: string } };
  const undone = await handle(
    new Request(`http://localhost/api/staff/serving/${body.assignment.id}/undo`, {
      method: "POST",
      headers: { authorization: `Bearer ${lead}` },
    }),
  );
  assert.equal(undone.status, 200);
  const kept = store.assignServing(lead, { personId: "person-harper", position: "Kids" });
  const harper = store.login({
    email: "harper@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  }).token;
  store.respond(harper, kept.id, true);
  assert.throws(
    () => store.undoServing(lead, kept.id),
    (error: AccessError) => error.code === "invalid",
  );
});

test("a pastor can feature a YouTube message and a member cannot", async () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const guest = member(store);
  assert.equal(store.publicHome().sampleSermon.title, "");
  assert.throws(
    () =>
      store.featureMessage(guest, {
        videoId: "abcdefghijk",
        title: "Hope",
        link: "https://www.youtube.com/watch?v=abcdefghijk",
      }),
    (error: AccessError) => error.code === "forbidden",
  );
  assert.throws(
    () =>
      store.featureMessage(lead, {
        videoId: "abcdefghijk",
        title: "Hope",
        link: "https://evil.example/watch?v=abcdefghijk",
      }),
    (error: AccessError) => error.code === "invalid",
  );
  const handle = createApi({ store });
  const featured = await handle(
    new Request("http://localhost/api/media/feature", {
      method: "POST",
      headers: { authorization: `Bearer ${lead}`, "content-type": "application/json" },
      body: JSON.stringify({
        videoId: "abcdefghijk",
        title: "Sunday hope",
        speaker: "Pastor Sample",
        passage: "John 3:16",
        link: "https://www.youtube.com/watch?v=abcdefghijk",
      }),
    }),
  );
  assert.equal(featured.status, 200);
  assert.equal(store.publicHome().sampleSermon.title, "Sunday hope");
  assert.equal(store.publicHome().sampleSermon.speaker, "Pastor Sample");
  const cleared = await handle(
    new Request("http://localhost/api/media/feature/clear", {
      method: "POST",
      headers: { authorization: `Bearer ${lead}` },
    }),
  );
  assert.equal(cleared.status, 200);
  assert.equal(store.publicHome().sampleSermon.title, "");
});

test("push saves a draft until Apple push is live, then asks before it sends", async () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const guest = member(store);
  const draft = store.sendPush(lead, { title: "Sunday at 10:30", body: "Come early.", segment: "members" });
  assert.equal(draft.sent, false);
  assert.equal(draft.drafted, true);
  assert.match(draft.reason, /Nothing was sent/);
  assert.ok(draft.count >= 1);
  assert.throws(
    () => store.sendPush(guest, { title: "Nope", body: "Nope", segment: "members" }),
    (error: AccessError) => error.code === "forbidden",
  );
  let sent = 0;
  const live = new ChurchStore(loadConfig({}), {
    pushSender: () => {
      sent += 1;
      return 4;
    },
  });
  const pastorLive = pastor(live);
  const held = live.sendPush(pastorLive, { title: "Prayer night", body: "Come as you are.", segment: "members" });
  assert.equal(held.needsConfirm, true);
  assert.equal(held.sent, false);
  assert.equal(sent, 0);
  const gone = live.sendPush(pastorLive, {
    title: "Prayer night",
    body: "Come as you are.",
    segment: "members",
    confirm: true,
  });
  assert.equal(gone.sent, true);
  assert.equal(gone.count, 4);
  assert.equal(sent, 1);
});

test("built-in Sunday and Kids cards are not written back over a staff edit", () => {
  const config = loadConfig({});
  const store = new ChurchStore(config, {
    fixture: false,
    passwordOverrides: { [config.masterAdminPrimaryEmail]: "seat-password" },
    totpOverrides: { [config.masterAdminPrimaryEmail]: SAMPLE_TOTP_BASE32 },
  });
  const { token } = store.login({
    email: config.masterAdminPrimaryEmail,
    password: "seat-password",
    ip: "203.0.113.9",
    userAgent: "test",
  });
  store.verifyMfa(token, code());
  assert.ok(store.publicHome().announcements.some((item) => item.id === "ann-sunday"));
  store.updateAnnouncement(token, "ann-sunday", {
    title: "Staff Sunday",
    body: "The church wrote this. Leave it alone.",
  });
  store.archiveAnnouncement(token, "ann-kids", true);
  const restored = new ChurchStore(config, { fixture: false });
  restored.installDocument(store.toDocument());
  const sunday = restored.staffAnnouncements(token).find((item) => item.id === "ann-sunday");
  assert.equal(sunday?.title, "Staff Sunday");
  assert.equal(sunday?.body, "The church wrote this. Leave it alone.");
  const kids = restored.staffAnnouncements(token).find((item) => item.id === "ann-kids");
  assert.equal(kids?.archived, true);
  assert.equal(
    restored.publicHome().announcements.some((item) => item.id === "ann-kids"),
    false,
  );
});
