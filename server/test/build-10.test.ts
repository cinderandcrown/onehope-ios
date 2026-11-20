import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { loadConfig } from "../src/config.ts";
import { clearSermonCache } from "../src/http-cache.ts";
import { churchMedia, httpsURL } from "../src/media.ts";
import { SAMPLE_PASSWORD } from "../src/sample-accounts.ts";
import { ChurchStore } from "../src/store.ts";

const MEDIA = {
  images: {
    hero: "https://img.example.org/hero.jpg",
    kids: "https://img.example.org/kids.jpg",
    revival_sign: "https://img.example.org/sign.jpg",
    bad_scheme: "http://img.example.org/x.jpg",
    "Bad Name": "https://img.example.org/y.jpg",
  },
  team: [
    { id: "pat", name: "Pat Sample", role: "Teaching Pastor", photo: "https://img.example.org/pat.jpg" },
    { id: "no-photo", name: "Lee Sample", role: "Greeter", photo: "javascript:alert(1)" },
    { id: "blank", name: "  ", role: "", photo: "https://img.example.org/blank.jpg" },
  ],
  ministries: [
    {
      id: "kids",
      title: "Kids",
      blurb: "A safe place.",
      photo: "https://img.example.org/kids.jpg",
      url: "https://example.org/kids",
    },
  ],
  revival: { gallery: [{ id: "one", caption: "Latte", url: "https://img.example.org/latte.jpg" }] },
  credits: [
    { title: "Sample photography", detail: "Used by the church.", url: "https://example.org/credits" },
    { title: "Bad link", detail: "", url: "http://example.org/x" },
    { title: "  ", detail: "dropped", url: "" },
  ],
};

function store(extra: NodeJS.ProcessEnv = {}) {
  return new ChurchStore(loadConfig({ ONEHOPE_MEDIA_JSON: JSON.stringify(MEDIA), ...extra }));
}

test("media JSON keeps only https URLs, valid slot names and named people", () => {
  const { images, media } = churchMedia({ ONEHOPE_MEDIA_JSON: JSON.stringify(MEDIA) });
  assert.equal(images.hero, "https://img.example.org/hero.jpg");
  assert.equal(images.kids, "https://img.example.org/kids.jpg");
  assert.equal(images.about, "");
  assert.equal(images.bad_scheme, undefined);
  assert.equal(images["Bad Name"], undefined);
  assert.deepEqual(
    media.team.map((member) => [member.id, member.photo]),
    [
      ["pat", "https://img.example.org/pat.jpg"],
      ["no-photo", ""],
    ],
  );
  assert.equal(media.ministries[0]?.url, "https://example.org/kids");
  assert.equal(media.revival.gallery.length, 1);
  assert.deepEqual(
    media.credits.map((credit) => [credit.title, credit.url]),
    [
      ["Sample photography", "https://example.org/credits"],
      ["Bad link", ""],
    ],
  );
});

test("a giving statement says no goods or services were provided and claims nothing more", async () => {
  const store = new ChurchStore(loadConfig({}));
  const session = store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "t",
    userAgent: "t",
  });
  store.stepUp(session.token, { password: SAMPLE_PASSWORD });
  const year = new Date().getUTCFullYear();
  const { text } = store.statement(session.token, year);
  assert.match(text, /No goods or services were provided/);
  assert.match(text, /SAMPLE STATEMENT/);
  assert.doesNotMatch(text, /tax[- ]deductible/i);
});

test("broken media JSON and oversized lists fall back to nothing", () => {
  assert.deepEqual(churchMedia({ ONEHOPE_MEDIA_JSON: "{nope" }).media.team, []);
  assert.deepEqual(churchMedia({ ONEHOPE_MEDIA_JSON: '{"team":"x"}' }).media.team, []);
  const many = {
    team: Array.from({ length: 61 }, (_, i) => ({ id: `p${i}`, name: "N", role: "R", photo: "" })),
  };
  assert.deepEqual(churchMedia({ ONEHOPE_MEDIA_JSON: JSON.stringify(many) }).media.team, []);
  assert.equal(httpsURL("https://localhost/x.jpg"), "");
  assert.equal(httpsURL(`https://example.org/${"a".repeat(700)}`), "");
});

test("legacy image env vars still work and the media JSON wins", () => {
  const { images } = churchMedia({
    ONEHOPE_IMAGE_HERO: "https://old.example.org/h.jpg",
    ONEHOPE_IMAGE_ABOUT: "https://old.example.org/a.jpg",
    ONEHOPE_MEDIA_JSON: JSON.stringify({ images: { hero: "https://new.example.org/h.jpg" } }),
  });
  assert.equal(images.hero, "https://new.example.org/h.jpg");
  assert.equal(images.about, "https://old.example.org/a.jpg");
});

test("home serves the media to its own tenant and nothing to another tenant", () => {
  const own = store();
  own.bindTenant({ id: "onehope", name: "One Hope", timezone: "America/Chicago", pickupOnly: false });
  assert.equal(own.publicHome().images.kids, "https://img.example.org/kids.jpg");
  assert.equal(own.publicHome().media.team.length, 2);
  const other = store();
  other.bindTenant({ id: "revivalcoffee", name: "Revival", timezone: "America/Chicago", pickupOnly: false });
  assert.equal(other.publicHome().images.hero, "");
  assert.equal(other.publicHome().images.kids, undefined);
  assert.equal(other.publicHome().media.team.length, 0);
  const moved = store({ ONEHOPE_MEDIA_TENANT: "revivalcoffee" });
  moved.bindTenant({ id: "revivalcoffee", name: "Revival", timezone: "America/Chicago", pickupOnly: false });
  assert.equal(moved.publicHome().images.hero, "https://img.example.org/hero.jpg");
});

test("the coffee guide carries the Revival photos", () => {
  const guide = store().coffeePublic();
  assert.equal(guide.photos.sign, "https://img.example.org/sign.jpg");
  assert.equal(guide.photos.gallery[0]?.caption, "Latte");
  assert.equal(new ChurchStore(loadConfig({})).coffeePublic().photos.hero, "");
});

test("public GETs are cacheable, carry an ETag and answer 304 on a repeat", async () => {
  const handle = createApi({ store: store() });
  const first = await handle(new Request("http://localhost/api/home"));
  assert.equal(first.status, 200);
  assert.match(first.headers.get("cache-control") ?? "", /s-maxage=30/);
  const etag = first.headers.get("etag") ?? "";
  assert.ok(etag.startsWith('W/"'));
  const again = await handle(
    new Request("http://localhost/api/home", { headers: { "if-none-match": etag } }),
  );
  assert.equal(again.status, 304);
  const signedIn = await handle(
    new Request("http://localhost/api/home", { headers: { authorization: "Bearer nope" } }),
  );
  assert.equal(signedIn.headers.get("cache-control"), null);
  const health = await handle(new Request("http://localhost/api/health"));
  assert.equal(health.headers.get("cache-control"), null);
});

function feed(count: number): string {
  const entries = Array.from({ length: count }, (_, i) => {
    const short = i % 3 === 2;
    const link = short ? `https://www.youtube.com/shorts/vid${i}` : `https://www.youtube.com/watch?v=vid${i}`;
    return `<entry><yt:videoId>vid${i}</yt:videoId><title>Message ${i}</title><link rel="alternate" href="${link}"/><published>2026-11-${String(10 + (i % 9)).padStart(2, "0")}T06:00:00+00:00</published><media:thumbnail url="https://i1.ytimg.com/vi/vid${i}/hqdefault.jpg"/></entry>`;
  }).join("");
  return `<feed>${entries}</feed>`;
}

test("sermons page by limit and offset, filter by kind, and read the feed once", async () => {
  clearSermonCache();
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response(feed(12), { status: 200 });
  };
  const handle = createApi({ store: store({ YOUTUBE_CHANNEL_ID: "UCtest" }), fetchImpl });
  const page1 = (await (await handle(new Request("http://localhost/api/sermons?limit=5"))).json()) as {
    videos: { id: string; thumbnailHd: string }[];
    total: number;
    nextOffset: number | null;
  };
  assert.equal(page1.videos.length, 5);
  assert.equal(page1.total, 12);
  assert.equal(page1.nextOffset, 5);
  assert.equal(page1.videos[0]?.thumbnailHd, "https://i.ytimg.com/vi/vid0/maxresdefault.jpg");
  const page3 = (await (
    await handle(new Request("http://localhost/api/sermons?limit=5&offset=10"))
  ).json()) as {
    videos: unknown[];
    nextOffset: number | null;
  };
  assert.equal(page3.videos.length, 2);
  assert.equal(page3.nextOffset, null);
  const messages = (await (
    await handle(new Request("http://localhost/api/sermons?kind=message"))
  ).json()) as {
    videos: { id: string }[];
    total: number;
  };
  assert.equal(messages.total, 8);
  assert.equal(calls, 1);
  clearSermonCache();
});

test("a failed feed read keeps the last good list instead of an empty screen", async () => {
  clearSermonCache();
  let fail = false;
  const fetchImpl: typeof fetch = async () =>
    fail ? new Response("", { status: 500 }) : new Response(feed(3), { status: 200 });
  const { cachedSermons } = await import("../src/http-cache.ts");
  const first = await cachedSermons(fetchImpl, "UCkeep", 1_000);
  assert.equal(first.length, 3);
  fail = true;
  const stale = await cachedSermons(fetchImpl, "UCkeep", 1_000 + 10 * 60 * 1000);
  assert.equal(stale.length, 3);
  clearSermonCache();
});

test("the directory pages and searches", async () => {
  const s = store();
  const token = s.signup({
    email: "pager@example.com",
    password: "hope-sample-1",
    displayName: "Pager Joy",
    ip: "t",
    userAgent: "t",
  }).token;
  const handle = createApi({ store: s });
  const get = async (query: string) =>
    (await (
      await handle(
        new Request(`http://localhost/api/directory${query}`, {
          headers: { authorization: `Bearer ${token}` },
        }),
      )
    ).json()) as {
      people: { displayName: string }[];
      total: number;
      nextOffset: number | null;
    };
  const all = await get("");
  assert.ok(all.total >= 1);
  const one = await get("?limit=1");
  assert.equal(one.people.length, 1);
  const none = await get("?q=zzzz-no-match");
  assert.equal(none.total, 0);
  assert.equal(none.nextOffset, null);
});

test("a member can report a prayer: it leaves the wall at once, and authors cannot report their own", () => {
  const store = new ChurchStore(loadConfig({}));
  const { token } = store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "t",
    userAgent: "t",
  });
  const wall = store.listPrayers(token) as { id: string; mine: boolean; approved: boolean }[];
  const others = wall.find((item) => !item.mine && item.approved);
  assert.ok(others, "the sample wall has someone else's approved prayer");
  assert.deepEqual(store.reportPrayer(token, others.id), { id: others.id, reported: true });
  assert.ok(!(store.listPrayers(token) as { id: string }[]).some((item) => item.id === others.id));
  assert.throws(() => store.reportPrayer(token, others.id), /isn't on the wall/);
  const mine = wall.find((item) => item.mine);
  if (mine) assert.throws(() => store.reportPrayer(token, mine.id), /isn't on the wall/);
});
