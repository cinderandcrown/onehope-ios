import assert from "node:assert/strict";
import test from "node:test";

import { COFFEE_MENU } from "../src/coffee.ts";
import { createApi } from "../src/api.ts";
import { loadConfig } from "../src/config.ts";
import { JOURNEY_MONTH, greeting, streakEncouragement } from "../src/faith.ts";
import { DEFAULT_PUBLIC_BASE_URL, inviteUrl, originAllowed, publicBaseUrl } from "../src/public-url.ts";
import { SAMPLE_PASSWORD, SAMPLE_PASTOR_EMAIL, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { SITE_SOCIAL } from "../src/social.ts";
import { squareSignature } from "../src/square.ts";
import { ChurchStore } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

function member(store: ChurchStore) {
  return store.signup({
    email: "neighbor@example.com",
    password: "hope-sample",
    displayName: "Neighbor Joy",
    ip: "t",
    userAgent: "t",
  }).token;
}

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

test("the public base URL defaults to the current host and rejects junk", () => {
  assert.equal(publicBaseUrl({}), DEFAULT_PUBLIC_BASE_URL);
  assert.equal(
    publicBaseUrl({ PUBLIC_BASE_URL: "https://app.weareonehope.com/" }),
    "https://app.weareonehope.com",
  );
  assert.throws(() => publicBaseUrl({ PUBLIC_BASE_URL: "not a url" }));
  assert.equal(originAllowed("https://www.weareonehope.com"), true);
  assert.equal(originAllowed("https://evil.test"), false);
  assert.equal(
    inviteUrl("https://app.weareonehope.com", "Come sit with me"),
    "https://app.weareonehope.com/invite?note=Come+sit+with+me",
  );
});

test("home share links and social links come from the church site", async () => {
  const store = new ChurchStore(loadConfig({ PUBLIC_BASE_URL: "https://app.weareonehope.com" }));
  const handle = createApi({ store });
  const home = (await (await handle(new Request("http://localhost/api/home"))).json()) as {
    invite: { url: string };
    social: { id: string; url: string }[];
  };
  assert.equal(home.invite.url, "https://app.weareonehope.com/invite");
  assert.deepEqual(
    home.social.map((link) => link.url),
    SITE_SOCIAL.map((link) => link.url),
  );
  assert.equal(
    home.social.some((link) => link.id === "instagram" && link.url.includes("instagram.com/iamonehope")),
    true,
  );
  const cors = await handle(
    new Request("http://localhost/api/home", { headers: { origin: "https://www.weareonehope.com" } }),
  );
  assert.equal(cors.headers.get("access-control-allow-origin"), "https://www.weareonehope.com");
  const evil = await handle(
    new Request("http://localhost/api/home", { headers: { origin: "https://evil.test" } }),
  );
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
});

test("staff can edit follow-along links and a member cannot", async () => {
  const store = new ChurchStore(loadConfig({}));
  const handle = createApi({ store });
  const denied = await handle(
    new Request("http://localhost/api/social", {
      method: "POST",
      headers: { authorization: `Bearer ${member(store)}`, "content-type": "application/json" },
      body: JSON.stringify({ links: [] }),
    }),
  );
  assert.equal(denied.status, 403);
  const saved = await handle(
    new Request("http://localhost/api/social", {
      method: "POST",
      headers: { authorization: `Bearer ${pastor(store)}`, "content-type": "application/json" },
      body: JSON.stringify({
        links: [{ id: "youtube", name: "YouTube", url: "https://www.youtube.com/@Weareonehope" }],
      }),
    }),
  );
  assert.equal(saved.status, 200);
  const links = store.socialLinks();
  assert.equal(links.length, 1);
  assert.equal(links[0]?.url, "https://www.youtube.com/@Weareonehope");
});

test("the coffee menu matches the published site and order-ahead stays off", async () => {
  const drip = COFFEE_MENU.flatMap((section) => section.items).find((item) => item.id === "drip");
  const oats = COFFEE_MENU.flatMap((section) => section.items).find((item) => item.id === "overnight-oats");
  assert.equal(drip?.priceCents, 300);
  assert.equal(oats?.priceCents, null);
  const store = new ChurchStore(loadConfig({}));
  const handle = createApi({ store });
  const guide = (await (await handle(new Request("http://localhost/api/coffee"))).json()) as {
    ordering: { live: boolean; message: string };
    shop: { hours: { day: string; hours: string }[]; phone: string | null; email: string };
    eventsBody?: string;
    shopEvents?: string;
  };
  assert.equal(guide.ordering.live, false);
  assert.match(guide.ordering.message, /coming soon/i);
  assert.equal(guide.shop.phone, null);
  assert.equal(guide.shop.email, "info@myrevivalcoffee.com");
  assert.equal(guide.shop.hours.find((day) => day.day === "Saturday")?.hours, "TBD");
  const order = await handle(
    new Request("http://localhost/api/coffee/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lines: [{ catalogObjectId: "VAR", quantity: 1 }],
        sourceId: "cnon:test-nonce",
        idempotencyKey: "idem-key-1",
        pickupName: "Avery",
      }),
    }),
  );
  assert.equal(order.status, 400);
  const card = await handle(
    new Request("http://localhost/api/coffee/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lines: [{ catalogObjectId: "VAR", quantity: 1 }],
        sourceId: "4242424242424242",
        idempotencyKey: "idem-key-2",
        pickupName: "Avery",
      }),
    }),
  );
  assert.equal(card.status, 400);
});

test("Square is called only when ordering is live, and a webhook signature is checked", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/catalog/")) {
      return new Response(
        JSON.stringify({
          objects: [
            {
              type: "ITEM",
              item_data: {
                name: "Latte",
                variations: [
                  { id: "VAR_LATTE", item_variation_data: { name: "Regular", price_money: { amount: 500 } } },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/v2/orders")) {
      return new Response(JSON.stringify({ order: { id: "ORDER1", total_money: { amount: 500 } } }), {
        status: 200,
      });
    }
    if (url.endsWith("/v2/payments")) {
      assert.equal(
        String(init?.headers && (init.headers as Record<string, string>).Authorization).includes("sq-secret"),
        false,
      );
      return new Response(JSON.stringify({ payment: { id: "PAY1", status: "COMPLETED" } }), { status: 200 });
    }
    return new Response("no", { status: 404 });
  };
  const quiet = new ChurchStore(loadConfig({ COFFEE_ORDERING_LIVE: "true" }), { fetchImpl });
  assert.equal(quiet.coffeePublic().ordering.live, false);
  assert.equal(calls.length, 0);

  const store = new ChurchStore(
    loadConfig({
      COFFEE_ORDERING_LIVE: "true",
      SQUARE_ACCESS_TOKEN: "test-square-token",
      SQUARE_LOCATION_ID: "LOC1",
      SQUARE_APPLICATION_ID: "sandbox-app",
      SQUARE_WEBHOOK_SIGNATURE_KEY: "whsec-test",
      SQUARE_WEBHOOK_NOTIFICATION_URL: "https://app.weareonehope.com/api/coffee/square-webhook",
    }),
    { fetchImpl },
  );
  const handle = createApi({ store });
  const catalog = (await (await handle(new Request("http://localhost/api/coffee/catalog"))).json()) as {
    items: { catalogObjectId: string; priceCents: number }[];
  };
  assert.equal(catalog.items[0]?.catalogObjectId, "VAR_LATTE");
  assert.equal(catalog.items[0]?.priceCents, 500);
  const placed = await handle(
    new Request("http://localhost/api/coffee/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lines: [{ catalogObjectId: "VAR_LATTE", quantity: 1 }],
        sourceId: "cnon:card-nonce",
        idempotencyKey: "idem-live-1",
        pickupName: "Sam",
      }),
    }),
  );
  assert.equal(placed.status, 200);
  const body = JSON.stringify({ data: { object: { payment: { order_id: "ORDER1", status: "COMPLETED" } } } });
  const url = "https://app.weareonehope.com/api/coffee/square-webhook";
  const bad = await handle(
    new Request("http://localhost/api/coffee/square-webhook", {
      method: "POST",
      headers: { "x-square-hmacsha256-signature": "nope" },
      body,
    }),
  );
  assert.equal(bad.status, 403);
  const good = await handle(
    new Request("http://localhost/api/coffee/square-webhook", {
      method: "POST",
      headers: { "x-square-hmacsha256-signature": squareSignature("whsec-test", url, body) },
      body,
    }),
  );
  assert.equal(good.status, 200);
});

test("a prayer on the wall can be prayed for once, and a private one cannot", () => {
  const store = new ChurchStore(loadConfig({}));
  const token = member(store);
  const { id } = store.submitPrayer(token, {
    body: "Pray for our block.",
    visibility: "public",
    serve: "Just pray",
  });
  assert.throws(() => store.markPrayed(token, id));
  const lead = pastor(store);
  store.moderatePrayer(lead, id, true);
  assert.equal(store.markPrayed(token, id).prayedCount, 1);
  assert.equal(store.markPrayed(token, id).prayedCount, 1);
  const wall = store.listPrayers(null).find((prayer) => prayer.id === id);
  assert.equal(wall?.prayedCount, 1);
  assert.equal(JSON.stringify(wall).includes("neighbor@example.com"), false);
  store.stepUp(token, { password: "hope-sample" });
  const hidden = store.submitPrayer(token, { body: "Unspoken.", visibility: "private" });
  assert.throws(() => store.markPrayed(token, hidden.id));
});

test("neighborhood prayers wait for staff, my five stays private, and milestones need a yes", async () => {
  const store = new ChurchStore(loadConfig({}));
  const handle = createApi({ store });
  const sent = await handle(
    new Request("http://localhost/api/neighborhood/prayers", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
      body: JSON.stringify({ body: "Pray for the shops on Sherman." }),
    }),
  );
  assert.equal(sent.status, 200);
  assert.equal(
    store.listPrayers(null).some((prayer) => prayer.body.includes("Sherman")),
    false,
  );
  const lead = pastor(store);
  const pending = store.listPrayers(lead).find((prayer) => prayer.neighborhood);
  assert.equal(pending?.approved, false);
  store.moderatePrayer(lead, pending?.id ?? "", true);
  assert.equal(
    store.listPrayers(null).some((prayer) => prayer.body.includes("Sherman")),
    true,
  );

  const token = member(store);
  store.saveMyFive(token, ["Mom", "The neighbor across the street"]);
  assert.deepEqual(store.myFiveNames(token).names, ["Mom", "The neighbor across the street"]);
  assert.equal(JSON.stringify(store.listPrayers(lead)).includes("Mom"), false);
  assert.throws(() =>
    store.publishMilestone(lead, { kind: "baptism", title: "A baptism", detail: "", consent: false }),
  );
  const published = store.publishMilestone(lead, {
    kind: "salvation",
    title: "Someone said yes",
    detail: "Shared with their yes.",
    consent: true,
  });
  assert.equal(
    store.listMilestones().some((row) => row.id === published.id),
    true,
  );

  const testimony = store.submitTestimony(token, {
    displayName: "Joy",
    body: "Jesus changed my days.",
    consent: true,
  });
  assert.equal(
    store.community(null).testimonies.some((row) => row.id === testimony.id),
    false,
  );
  store.moderateTestimony(lead, testimony.id, true);
  assert.equal(
    store.community(null).testimonies.some((row) => row.body.includes("Jesus")),
    true,
  );
});

test("the new-believer month is thirty KJV days and the staff desk is role gated", () => {
  assert.equal(JOURNEY_MONTH.length, 30);
  assert.equal(JOURNEY_MONTH[0]?.reference, "John 3:17");
  assert.equal(JOURNEY_MONTH[6]?.title, "You belong");
  assert.equal(JOURNEY_MONTH[29]?.reference, "Revelation 21:5");
  assert.match(greeting(Date.parse("2026-11-19T15:00:00Z"), "Neighbor Joy"), /^Good morning, Neighbor$/);
  assert.equal(streakEncouragement(7), "A week of showing up.");

  const store = new ChurchStore(loadConfig({}));
  const token = member(store);
  assert.throws(() => store.staffHome(token));
  const lead = pastor(store);
  const desk = store.staffHome(lead);
  assert.equal(desk.cards.length >= 4, true);
  const added = store.addPerson(lead, {
    displayName: "Sam Neighbor",
    email: "sam.neighbor@example.com",
    phone: "214-555-0190",
  });
  assert.match(added.note, /Nothing was emailed/);
  assert.equal(store.undoAddPerson(lead, added.id).removed, true);
  const spot = store.assignServing(lead, { personId: "person-avery", position: "Door" });
  assert.equal(store.undoServing(lead, spot.id).removed, true);
});
