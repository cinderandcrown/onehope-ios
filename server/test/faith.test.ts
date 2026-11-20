import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { loadConfig } from "../src/config.ts";
import { CHURCH, parseYoutubeRss } from "../src/domain.ts";
import { DAILY_READINGS, DEFAULT_PATHWAY, currentStreak, dailyReading, nextStreak } from "../src/faith.ts";
import { SAMPLE_PASSWORD, SAMPLE_PASTOR_EMAIL, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { ChurchStore, type StoreDocument } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

function pastor(store: ChurchStore) {
  const { token } = store.login({
    email: SAMPLE_PASTOR_EMAIL,
    password: SAMPLE_PASSWORD,
    ip: "t",
    userAgent: "t",
  });
  const code = totpCode(decodeBase32(SAMPLE_TOTP_BASE32), Date.now());
  store.verifyMfa(token, code);
  store.stepUp(token, { code });
  return token;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("a guest opens Home, Know Jesus, and the Daily Word without signing in", async () => {
  const handle = createApi({ store: new ChurchStore(loadConfig({}), { fixture: false }) });
  const home = (await (await handle(new Request("http://localhost/api/home"))).json()) as {
    visit: { serviceTime: string; mapsUrl: string; calendarPath: string };
    giving: { online: { url: string }; text: { number: string }; mail: { address: string } };
    invite: { title: string };
  };
  assert.equal(home.visit.serviceTime, "Sundays at 10:30 a.m.");
  assert.match(home.visit.mapsUrl, /^https:\/\/maps\.apple\.com\//);
  const calendar = await handle(new Request(`http://localhost${home.visit.calendarPath}`));
  assert.equal(calendar.status, 200);
  assert.equal(home.giving.online.url, "https://weareonehope.churchcenter.com/giving");
  assert.equal(home.giving.text.number, "84321");
  assert.equal(home.giving.mail.address, "PO Box 211926, Dallas, TX 75211");
  assert.match(home.invite.title, /sit with me/i);

  const gospel = await handle(new Request("http://localhost/api/know-jesus"));
  assert.equal(gospel.status, 200);
  const body = (await gospel.json()) as { gospel: { steps: unknown[] }; journey: { day: number }[] };
  assert.equal(body.gospel.steps.length > 0, true);
  assert.deepEqual(
    body.journey.map((day) => day.day),
    [1, 2, 3, 4, 5, 6, 7],
  );

  const word = await handle(new Request("http://localhost/api/daily-word"));
  assert.equal(word.status, 200);
  const daily = (await word.json()) as {
    reading: { reference: string; text: string };
    streak: number | null;
  };
  assert.equal(daily.streak, null);
  assert.equal(daily.reading.text.length > 0, true);
});

test("a guest decision lands in the staff queue with contact details only after consent", async () => {
  const store = new ChurchStore(loadConfig({}));
  const handle = createApi({ store });
  const ip = { "x-forwarded-for": "198.51.100.7, 10.0.0.1" };

  const noConsent = await handle(
    post("/api/follow-ups", { kind: "salvation", name: "Sam", email: "sam@example.com", consent: false }, ip),
  );
  assert.equal(noConsent.status, 400);
  const extra = await handle(
    post("/api/follow-ups", { kind: "salvation", name: "Sam", consent: true, note: "x" }, ip),
  );
  assert.equal(extra.status, 400);
  const badEmail = await handle(
    post("/api/follow-ups", { kind: "new", name: "Sam", email: "nope", consent: true }, ip),
  );
  assert.equal(badEmail.status, 400);
  const noName = await handle(post("/api/follow-ups", { kind: "new", consent: false }, ip));
  assert.equal(noName.status, 400);

  const sent = await handle(
    post(
      "/api/follow-ups",
      {
        kind: "salvation",
        name: "Sam Guest",
        email: "Sam@Example.com",
        phone: "214-555-0100",
        consent: true,
      },
      ip,
    ),
  );
  assert.equal(sent.status, 200);
  const created = (await sent.json()) as { followUp: { id: string; journey: boolean } };
  assert.equal(created.followUp.journey, true);
  const nameOnly = await handle(post("/api/follow-ups", { kind: "visit", name: "Pat", consent: false }, ip));
  assert.equal(nameOnly.status, 200);

  assert.equal(JSON.stringify(store.toDocument()).includes("Sam Guest"), false);
  assert.equal(JSON.stringify(store.toDocument()).includes("198.51.100.7"), false);

  const staff = pastor(store);
  const queue = await handle(
    new Request("http://localhost/api/care/follow-ups", { headers: { authorization: `Bearer ${staff}` } }),
  );
  assert.equal(queue.status, 200);
  const rows = (
    (await queue.json()) as {
      followUps: { id: string; kind: string; name: string; email: string; phone: string; member: boolean }[];
    }
  ).followUps;
  const sam = rows.find((row) => row.id === created.followUp.id);
  assert.deepEqual(
    sam && { kind: sam.kind, name: sam.name, email: sam.email, phone: sam.phone, member: sam.member },
    { kind: "salvation", name: "Sam Guest", email: "sam@example.com", phone: "214-555-0100", member: false },
  );
  assert.equal(rows.find((row) => row.name === "Pat")?.email, "");
  assert.equal(JSON.stringify(store.ministry(staff).care.queue).includes("Sam Guest"), true);
  assert.equal(
    store
      .audit(staff)
      .some((entry) => entry.resource === "follow_up" && entry.resourceId === created.followUp.id),
    true,
  );

  const closed = await handle(
    post(
      "/api/care/follow-ups/" + created.followUp.id,
      { status: "contacted" },
      { authorization: `Bearer ${staff}` },
    ),
  );
  assert.equal(closed.status, 200);
  assert.equal(store.followUpsFor(staff).find((row) => row.id === created.followUp.id)?.status, "contacted");
});

test("members cannot read the follow-up queue", async () => {
  const store = new ChurchStore(loadConfig({}));
  const handle = createApi({ store });
  const member = store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "t",
    userAgent: "t",
  });
  store.stepUp(member.token, { password: SAMPLE_PASSWORD });
  const queue = await handle(
    new Request("http://localhost/api/care/follow-ups", {
      headers: { authorization: `Bearer ${member.token}` },
    }),
  );
  assert.equal(queue.status, 403);
  const anonymous = await handle(new Request("http://localhost/api/care/follow-ups"));
  assert.equal(anonymous.status, 401);
});

test("guest decisions are rate limited per client and the limit is shared through the snapshot", async () => {
  const store = new ChurchStore(loadConfig({}));
  const handle = createApi({ store });
  const ip = { "x-forwarded-for": "203.0.113.50" };
  for (let index = 0; index < 5; index += 1) {
    const ok = await handle(
      post("/api/follow-ups", { kind: "new", name: `Guest ${index}`, consent: false }, ip),
    );
    assert.equal(ok.status, 200);
  }
  const copy = new ChurchStore(loadConfig({}));
  copy.installDocument(JSON.parse(JSON.stringify(store.toDocument())) as StoreDocument);
  const limited = await createApi({ store: copy })(
    post("/api/follow-ups", { kind: "new", name: "Guest 6", consent: false }, ip),
  );
  assert.equal(limited.status, 429);
  const other = await createApi({ store: copy })(
    post(
      "/api/follow-ups",
      { kind: "new", name: "Neighbor", consent: false },
      { "x-forwarded-for": "203.0.113.51" },
    ),
  );
  assert.equal(other.status, 200);
});

test("the throttle forgets requests older than an hour", () => {
  let now = Date.parse("2026-11-18T18:00:00Z");
  const store = new ChurchStore(loadConfig({}), { now: () => now });
  for (let index = 0; index < 5; index += 1) {
    store.submitFollowUp(null, { kind: "new", name: "Guest", consent: false }, "192.0.2.1");
  }
  assert.throws(
    () => store.submitFollowUp(null, { kind: "new", name: "Guest", consent: false }, "192.0.2.1"),
    (error: { code?: string }) => error.code === "rate_limited",
  );
  now += 61 * 60 * 1000;
  store.submitFollowUp(null, { kind: "new", name: "Guest", consent: false }, "192.0.2.1");
  assert.equal(
    (store.toDocument().throttle ?? []).every((row) => row.hits.length <= 2),
    true,
  );
});

test("a new account starts with the default pathway and a decision moves it", () => {
  const store = new ChurchStore(loadConfig({}), { fixture: false });
  const { token } = store.signup({
    email: "new.believer@onehope.test",
    password: "gathering",
    displayName: "New Believer",
    ip: "t",
    userAgent: "t",
  });
  const steps = store.myPathway(token).steps;
  assert.deepEqual(
    steps.map((step) => step.id),
    DEFAULT_PATHWAY.map((step) => step.id),
  );
  assert.equal(
    steps.every((step) => step.status === "not-started"),
    true,
  );
  store.submitFollowUp(token, { kind: "salvation", consent: true }, "t");
  store.submitFollowUp(token, { kind: "baptism", consent: true }, "t");
  const after = store.myPathway(token).steps;
  assert.equal(after.find((step) => step.id === "know-jesus")?.status, "done");
  assert.equal(after.find((step) => step.id === "baptism")?.status, "requested");
});

test("an account made before build 6 gets the default pathway on first read", () => {
  const store = new ChurchStore(loadConfig({}), { fixture: false });
  const { token, person } = store.signup({
    email: "older@onehope.test",
    password: "gathering",
    displayName: "Older Account",
    ip: "t",
    userAgent: "t",
  });
  const document = store.toDocument();
  document.pathways = document.pathways.filter((row) => row.personId !== person.id);
  delete document.followUps;
  delete document.streaks;
  delete document.throttle;
  const copy = new ChurchStore(loadConfig({}), { fixture: false });
  copy.installDocument(document);
  assert.equal(copy.myPathway(token).steps.length, DEFAULT_PATHWAY.length);
  assert.deepEqual(copy.toDocument().followUps, []);
});

test("deleting an account removes that member's follow-ups and streak", () => {
  const store = new ChurchStore(loadConfig({}));
  const { token } = store.signup({
    email: "leaving@onehope.test",
    password: "gathering",
    displayName: "Leaving Soon",
    ip: "t",
    userAgent: "t",
  });
  store.submitFollowUp(token, { kind: "new", consent: true }, "t");
  store.markDailyWordRead(token);
  store.stepUp(token, { password: "gathering" });
  store.deleteSelf(token);
  const staff = pastor(store);
  assert.equal(
    store.followUpsFor(staff).some((row) => row.name === "Leaving Soon"),
    false,
  );
  assert.equal(store.toDocument().streaks?.length, 0);
});

test("the daily word is the same all church day and the streak counts consecutive days", () => {
  const morning = Date.parse("2026-11-18T13:00:00Z");
  const lateNight = Date.parse("2026-11-19T05:30:00Z");
  assert.equal(dailyReading(morning).day, "2026-11-18");
  assert.equal(dailyReading(lateNight).day, "2026-11-18");
  assert.equal(dailyReading(morning).reference, dailyReading(lateNight).reference);
  assert.notEqual(dailyReading(morning + 86_400_000).reference, dailyReading(morning).reference);
  assert.equal(new Set(DAILY_READINGS.map((reading) => reading.reference)).size >= 30, true);

  assert.equal(nextStreak(null, "2026-11-18"), 1);
  assert.equal(nextStreak({ lastDay: "2026-11-18", count: 3 }, "2026-11-18"), 3);
  assert.equal(nextStreak({ lastDay: "2026-11-17", count: 3 }, "2026-11-18"), 4);
  assert.equal(nextStreak({ lastDay: "2026-11-15", count: 3 }, "2026-11-18"), 1);
  assert.equal(currentStreak({ lastDay: "2026-11-15", count: 3 }, "2026-11-18"), 0);

  let now = morning;
  const store = new ChurchStore(loadConfig({}), { now: () => now });
  const { token } = store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "t",
    userAgent: "t",
  });
  assert.equal(store.markDailyWordRead(token).streak, 1);
  assert.equal(store.markDailyWordRead(token).streak, 1);
  now += 86_400_000;
  const tomorrow = store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "t",
    userAgent: "t",
  }).token;
  assert.equal(store.markDailyWordRead(tomorrow).streak, 2);
  assert.equal(store.dailyWord(tomorrow).streak, 2);
  assert.equal(store.dailyWord(null).streak, null);
});

test("YouTube Shorts are told apart from full messages", () => {
  const xml = `<feed>
<entry><yt:videoId>full1</yt:videoId><title>A Godly Remodel</title><link rel="alternate" href="https://www.youtube.com/watch?v=full1"/><published>2026-11-09T06:34:02+00:00</published><media:thumbnail url="https://i2.ytimg.com/vi/full1/hqdefault.jpg"/></entry>
<entry><yt:videoId>clip1</yt:videoId><title>Why Reading God&#39;s Word Changes Everything #shorts</title><link rel="alternate" href="https://www.youtube.com/shorts/clip1"/><published>2026-11-07T01:04:26+00:00</published></entry>
</feed>`;
  const videos = parseYoutubeRss(xml);
  assert.deepEqual(
    videos.map((video) => [video.id, video.kind, video.title]),
    [
      ["full1", "message", "A Godly Remodel"],
      ["clip1", "short", "Why Reading God's Word Changes Everything"],
    ],
  );
});

test("Sunday gathers at 1251 S. Sherman St. Ste. 112", () => {
  assert.equal(CHURCH.addressLine, "1251 S. Sherman St., Ste. 112");
  assert.equal(CHURCH.city, "Richardson");
  assert.equal(CHURCH.region, "TX");
  assert.equal(CHURCH.postalCode, "75081");
});

test("salvation and baptism copy waits for pastor approval", () => {
  const previous = process.env.CONTENT_SALVATION_BAPTISM_APPROVED;
  delete process.env.CONTENT_SALVATION_BAPTISM_APPROVED;
  try {
    const pending = new ChurchStore(loadConfig({})).knowJesus();
    assert.equal(pending.gospel.pastoralCopy, "pending");
    assert.equal(pending.gospel.prayer.includes("Lord Jesus"), false);
    assert.equal(pending.gospel.baptism.includes("outward profession"), false);
    assert.equal(pending.journey.find((day) => day.day === 6)?.prompt.includes("baptism"), false);
    assert.match(pending.gospel.steps[0]?.text ?? "", /For God so loved the world/);
    process.env.CONTENT_SALVATION_BAPTISM_APPROVED = "true";
    const approved = new ChurchStore(loadConfig({})).knowJesus();
    assert.equal(approved.gospel.pastoralCopy, "approved");
    assert.match(approved.gospel.prayer, /Lord Jesus/);
    assert.match(approved.gospel.baptism, /outward profession/);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_SALVATION_BAPTISM_APPROVED;
    else process.env.CONTENT_SALVATION_BAPTISM_APPROVED = previous;
  }
});
