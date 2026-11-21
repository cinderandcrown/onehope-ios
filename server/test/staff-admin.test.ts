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

function staffOf(store: ChurchStore, email: string) {
  const { token } = store.login({
    email,
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(token, code());
  return token;
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
  const finance = store.login({
    email: "dana@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(finance.token, code());
  const refused = await handle(
    new Request("http://localhost/api/kids/clock-in", {
      method: "POST",
      headers: { authorization: `Bearer ${finance.token}` },
    }),
  );
  assert.equal(refused.status, 403);
  const refusedBody = (await refused.json()) as { error: string };
  assert.match(refusedBody.error, /kids team/);
  await handle(
    new Request("http://localhost/api/kids/clock-in", {
      method: "POST",
      headers: { authorization: `Bearer ${frankie.token}` },
    }),
  );
  const gray = store.login({
    email: "gray@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(gray.token, code());
  const second = await handle(
    new Request("http://localhost/api/kids/clock-in", {
      method: "POST",
      headers: { authorization: `Bearer ${gray.token}` },
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

test("only the kids team can clock in as the second adult", () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const finance = staffOf(store, "dana@sample.onehope");
  assert.throws(
    () => store.clockIn(finance),
    (error: AccessError) => error.code === "forbidden" && /kids team/.test(error.message),
  );
  const harper = store.login({
    email: "harper@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  }).token;
  assert.throws(() => store.clockIn(harper), (error: AccessError) => /kids volunteer/.test(error.message));
  const asked = store.assignServing(lead, { personId: "person-harper", position: "Kids" });
  assert.equal(asked.positionId, "kids");
  assert.throws(() => store.clockIn(harper), (error: AccessError) => /kids team/.test(error.message));
  const named = store.assignServing(lead, { personId: "person-harper", position: "Skid-steer parking" });
  store.respond(harper, named.id, true);
  assert.throws(() => store.clockIn(harper), (error: AccessError) => /kids team/.test(error.message));
  store.respond(harper, asked.id, true);
  assert.equal(store.clockIn(harper).onDuty, true);
  const gray = staffOf(store, "gray@sample.onehope");
  assert.equal(store.stationBoard(gray, null).canClockIn, true);
  assert.equal(store.stationBoard(gray, null).canOperate, false);
  assert.equal(store.clockIn(gray).adultsOnDuty, 2);
  store.changeRole(gray, { personId: "person-avery", role: "volunteer" });
  assert.throws(
    () => store.changeRole(gray, { personId: "person-avery", role: "pastor" }),
    (error: AccessError) => error.code === "forbidden",
  );
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
    (error: AccessError) => error.code === "forbidden",
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
  assert.throws(
    () => store.respond(harper, kept.id, false),
    (error: AccessError) => error.code === "invalid" && /already answered/.test(error.message),
  );
  assert.throws(
    () => store.assignServing(lead, { personId: "person-harper", position: "Kids" }),
    (error: AccessError) => error.code === "invalid" && /already has this spot/.test(error.message),
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
  const savedDraft = store.ministry(lead).communications;
  assert.equal(savedDraft.locked, false);
  if (!savedDraft.locked) assert.equal(savedDraft.drafts.some((row) => row.body === "Come early."), true);
  assert.equal(store.pushDesk(lead).counts.members, 9);
  const signedUp = store.signup({
    email: "guest.neighbor@example.com",
    password: "gathering1",
    displayName: "Guest Neighbor",
    ip: "203.0.113.40",
    userAgent: "phone",
  });
  assert.equal(signedUp.person.role, "member");
  assert.equal(store.pushDesk(lead).counts.members, 10);
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

test("the audit log filters by date and downloads as a spreadsheet", async () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const guest = member(store);
  store.addPerson(lead, { displayName: "Audit Neighbor", email: "audit.neighbor@example.com" });
  const rows = store.audit(lead, { from: Date.now() - 60_000, to: Date.now() + 60_000 });
  assert.ok(rows.some((row) => row.resource === "person" && row.actorName.includes("Reese")));
  assert.equal(store.audit(lead, { from: Date.now() + 60_000, to: Date.now() + 120_000 }).length, 0);
  assert.throws(
    () => store.audit(guest),
    (error: AccessError) => error.code === "forbidden",
  );
  const csv = store.auditCsv(lead, { from: Date.now() - 60_000, to: Date.now() + 60_000 });
  assert.match(csv, /^When \(Central\),Who,Action,Record,Record id,Tier/);
  assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(csv), false);
  assert.equal(csv.includes("hope-sample"), false);
  const handle = createApi({ store });
  const file = await handle(
    new Request("http://localhost/api/audit?format=csv", {
      headers: { authorization: `Bearer ${lead}` },
    }),
  );
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-type") ?? "", /text\/csv/);
  const finance = store.login({
    email: "dana@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "test",
  });
  store.verifyMfa(finance.token, code());
  const denied = await handle(
    new Request("http://localhost/api/audit?format=csv", {
      headers: { authorization: `Bearer ${finance.token}` },
    }),
  );
  assert.equal(denied.status, 403);
});

test("the Sunday desk links each card to a screen that finishes the job", () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  const hrefs = store.staffHome(lead).cards.map((card) => card.href);
  for (const href of ["/checkin", "/care", "/serving", "/events", "/communications", "/media", "/giving"]) {
    assert.ok(hrefs.includes(href), href);
  }
  assert.equal(store.publicHome().sampleSermon.title, "");
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

test("a lower role cannot invite, claim, or erase a Master Admin seat", () => {
  const store = new ChurchStore(
    loadConfig({
      MASTER_ADMIN_SECONDARY_EMAIL: "second.master@example.com",
      MASTER_ADMIN_SECONDARY_NAME: "Second Master",
    }),
    {
      passwordOverrides: { "nicholas.will@cinderandcrown.com": "gathering-password" },
      totpOverrides: { "nicholas.will@cinderandcrown.com": SAMPLE_TOTP_BASE32 },
    },
  );
  const lead = pastor(store);
  const leader = staffOf(store, "gray@sample.onehope");
  assert.throws(
    () => store.issueInvite(lead, "nicholas.will@cinderandcrown.com"),
    (error: AccessError) => error.code === "forbidden" && /Master Admin/.test(error.message),
  );
  assert.throws(
    () => store.issueInvite(leader, "second.master@example.com"),
    (error: AccessError) => error.code === "forbidden",
  );
  assert.throws(
    () => store.issueInvite(leader, "reese@sample.onehope"),
    (error: AccessError) => error.code === "forbidden" && /pastor/.test(error.message),
  );
  assert.throws(
    () => store.undoAddPerson(leader, "person-nicholas"),
    (error: AccessError) => error.code === "forbidden",
  );
  assert.equal(store.staffPeople(leader).find((person) => person.id === "person-nicholas")?.canUndo, false);
  assert.equal(
    store.staffPeople(leader).some((person) => person.role === "master_admin" && person.canInvite),
    false,
  );

  const signed = store.login({
    email: "nicholas.will@cinderandcrown.com",
    password: "gathering-password",
    ip: "203.0.113.9",
    userAgent: "test",
  });
  store.verifyMfa(signed.token, code());
  const issued = store.issueInvite(signed.token, "second.master@example.com");
  const stripped = store.toDocument();
  for (const invite of stripped.invites ?? []) {
    invite.issuerRole = null;
    invite.issuerId = "";
  }
  const blocked = new ChurchStore(loadConfig({}), { fixture: true });
  blocked.installDocument(stripped);
  assert.throws(() =>
    blocked.claimInvite({
      email: issued.email,
      inviteToken: issued.inviteToken,
      password: "gathering-password",
      ip: "203.0.113.9",
      userAgent: "test",
    }),
  );
  const claimed = store.claimInvite({
    email: issued.email,
    inviteToken: issued.inviteToken,
    password: "gathering-password",
    ip: "203.0.113.9",
    userAgent: "test",
  });
  assert.equal(claimed.person.role, "master_admin");
});

test("undo add is only for the person who just added a non-staff seat", () => {
  let now = Date.now();
  const store = new ChurchStore(loadConfig({}), { now: () => now });
  const lead = pastor(store);
  const leader = staffOf(store, "gray@sample.onehope");
  const added = store.addPerson(lead, { displayName: "Sam Neighbor", email: "sam.undo@example.com" });
  assert.equal(store.staffPeople(lead).find((person) => person.id === added.id)?.canUndo, true);
  assert.equal(store.staffPeople(leader).find((person) => person.id === added.id)?.canUndo, false);
  assert.throws(
    () => store.undoAddPerson(leader, added.id),
    (error: AccessError) => error.code === "forbidden",
  );
  now += 11 * 60 * 1000;
  assert.equal(store.staffPeople(lead).find((person) => person.id === added.id)?.canUndo, false);
  assert.throws(
    () => store.undoAddPerson(lead, added.id),
    (error: AccessError) => error.code === "forbidden",
  );
});

test("care assignment lists only people who can open Care", () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = pastor(store);
  store.stepUp(lead, { code: code() });
  const ids = store.careAssignees(lead).map((person) => person.id);
  assert.ok(ids.includes("person-reese"));
  assert.ok(ids.includes("person-eden"));
  assert.equal(ids.includes("person-dana"), false);
  assert.equal(ids.includes("person-frankie"), false);
  assert.equal(ids.includes("person-gray"), false);
});

test("a wrong pickup code and a lockout say so in plain language", () => {
  const store = new ChurchStore(loadConfig({}));
  const frankie = staffOf(store, "frankie@sample.onehope");
  store.stepUp(frankie, { code: code() });
  const gray = staffOf(store, "gray@sample.onehope");
  store.clockIn(frankie);
  store.clockIn(gray);
  const visit = store.staffCheckIn(frankie, "child-remy");
  const bad = visit.code === "1111" ? "2222" : "1111";
  const wrong = store.pickup(frankie, {
    childId: "child-remy",
    guardianPersonId: "person-avery",
    code: bad,
  });
  assert.equal(wrong.allowed, false);
  assert.match(wrong.reason, /Security code does not match/);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    store.pickup(frankie, { childId: "child-remy", guardianPersonId: "person-avery", code: bad });
  }
  assert.throws(
    () => store.pickup(frankie, { childId: "child-remy", guardianPersonId: "person-avery", code: visit.code }),
    (error: AccessError) => error.code === "rate_limited" && /locked/.test(error.message),
  );
});

test("a team leader can add, code a peer, and edit Home cards, but not a pastor or Master seat", () => {
  const store = new ChurchStore(loadConfig({}), {
    passwordOverrides: { "nicholas.will@cinderandcrown.com": "gathering-password" },
    totpOverrides: { "nicholas.will@cinderandcrown.com": SAMPLE_TOTP_BASE32 },
  });
  const lead = pastor(store);
  const leader = staffOf(store, "gray@sample.onehope");
  const added = store.addPerson(leader, { displayName: "Sam Neighbor", email: "sam.peer@example.com" });
  assert.ok(added.inviteToken.length >= 8);
  const card = store.createAnnouncement(leader, { title: "Team note", body: "Come early for coffee." });
  assert.equal(card.title, "Team note");

  const peer = store.addPerson(lead, { displayName: "Pat Leader", email: "pat.leader@example.com" });
  store.changeRole(lead, { personId: peer.id, role: "team_leader" });
  const memberCode = store.issueInvite(leader, "sam.peer@example.com");
  assert.ok(memberCode.inviteToken.length >= 8);
  assert.throws(
    () => store.issueInvite(leader, "pat.leader@example.com"),
    (error: AccessError) => error.code === "forbidden" && /below your own level/.test(error.message),
  );
  assert.equal(store.staffPeople(leader).find((person) => person.id === peer.id)?.canInvite, false);

  assert.throws(
    () => store.issueInvite(leader, "reese@sample.onehope"),
    (error: AccessError) => error.code === "forbidden" && /pastor/.test(error.message),
  );
  store.changeRole(leader, { personId: added.id, role: "volunteer" });
  assert.equal(store.me(leader).role, "team_leader");
  assert.throws(
    () => store.changeRole(leader, { personId: peer.id, role: "volunteer" }),
    (error: AccessError) => error.code === "forbidden" && /below your own level/.test(error.message),
  );
  assert.throws(
    () => store.changeRole(leader, { personId: "person-gray", role: "team_leader" }),
    (error: AccessError) => error.code === "forbidden",
  );
  assert.equal(store.me(leader).role, "team_leader");
  assert.throws(
    () => store.changeRole(leader, { personId: added.id, role: "pastor" }),
    (error: AccessError) => error.code === "forbidden",
  );
  assert.throws(
    () => store.changeRole(lead, { personId: added.id, role: "pastor" }),
    (error: AccessError) => error.code === "forbidden" && /pastor/.test(error.message),
  );

  const pastorSeat = store.addPerson(lead, { displayName: "Future Pastor", email: "future.pastor@example.com" });
  const master = store.login({
    email: "nicholas.will@cinderandcrown.com",
    password: "gathering-password",
    ip: "203.0.113.9",
    userAgent: "test",
  });
  store.verifyMfa(master.token, code());
  store.changeRole(master.token, { personId: pastorSeat.id, role: "pastor" });
  assert.throws(
    () => store.issueInvite(lead, "future.pastor@example.com"),
    (error: AccessError) => error.code === "forbidden" && /pastor/.test(error.message),
  );
  const fromMaster = store.issueInvite(master.token, "future.pastor@example.com");
  assert.equal(fromMaster.email, "future.pastor@example.com");
});

test("the shared sample sessions do not idle out", () => {
  let now = Date.parse("2026-11-17T18:00:00.000Z");
  const store = new ChurchStore(loadConfig({}), { now: () => now });
  const staff = store.toDocument().sessions.find((session) => session.token === "session-staff-demo");
  assert.ok(staff);
  now += 16 * 60 * 1000;
  assert.equal(store.me("session-staff-demo").role, "pastor");
  const refreshed = store.toDocument().sessions.find((session) => session.token === "session-staff-demo");
  assert.equal(refreshed?.lastActivity, now);
  now += 30_000;
  store.me("session-staff-demo");
  assert.equal(
    store.toDocument().sessions.find((session) => session.token === "session-staff-demo")?.lastActivity,
    now - 30_000,
  );
  now += 13 * 60 * 60 * 1000;
  assert.equal(store.me("session-member-demo").role, "member");
  store.logout("session-staff-demo");
  store.logout("session-member-demo");
  assert.equal(store.me("session-staff-demo").role, "pastor");
  assert.equal(store.me("session-member-demo").role, "member");
});

test("a production sign-in still times out even with the sample user agent", () => {
  let now = Date.parse("2026-11-17T18:00:00.000Z");
  const key = Buffer.alloc(32, 7).toString("base64");
  const store = new ChurchStore(
    loadConfig({ ONEHOPE_ENV: "production", FIELD_ENCRYPTION_KEY: key }),
    { now: () => now, memoryForTests: true },
  );
  const session = store.login({
    email: "reese@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "staff-demo",
  });
  store.verifyMfa(session.token, totpCode(decodeBase32(SAMPLE_TOTP_BASE32), now));
  now += 16 * 60 * 1000;
  assert.throws(
    () => store.me(session.token),
    (error: AccessError) => error.code === "session_expired",
  );
});
