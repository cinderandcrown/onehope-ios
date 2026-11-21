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
