import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { GIVING_FREQUENCY_IDS, SUPPORT_NEEDS } from "../src/church-copy.ts";
import { loadConfig } from "../src/config.ts";
import { SAMPLE_PASSWORD, SAMPLE_PASTOR_EMAIL, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { ChurchStore } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

function code() {
  return totpCode(decodeBase32(SAMPLE_TOTP_BASE32), Date.now());
}

function login(church: ChurchStore, email: string) {
  return church.login({ email, password: SAMPLE_PASSWORD, ip: "203.0.113.10", userAgent: "test" }).token;
}

function staff(church: ChurchStore, email: string) {
  const token = login(church, email);
  church.verifyMfa(token, code());
  church.stepUp(token, { code: code() });
  return token;
}

function post(path: string, body: unknown, client = "198.51.100.7") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": client },
    body: JSON.stringify(body),
  });
}

test("a guest's Support/Assistance request reaches the care queue with the boxes they checked", async () => {
  const church = new ChurchStore(loadConfig({}));
  const handle = createApi({ store: church });
  const response = await handle(
    post("/api/support", {
      needs: ["hospital", "clothing"],
      name: "Sam Guest",
      phone: "214-555-0100",
      consent: true,
    }),
  );
  assert.equal(response.status, 200);
  const { support } = (await response.json()) as { support: { id: string; needs: string[] } };
  assert.deepEqual(support.needs, ["Hospital visitation request", "In need of clothing"]);
  const row = church.followUpsFor(staff(church, SAMPLE_PASTOR_EMAIL)).find((item) => item.id === support.id);
  assert.equal(row?.kind, "support");
  assert.equal(row?.label, "Support/Assistance request");
  assert.equal(row?.phone, "214-555-0100");
  assert.equal(row?.member, false);
  assert.deepEqual(row?.needs, ["Hospital visitation request", "In need of clothing"]);
  assert.equal(church.toDocument().followUps?.at(-1)?.ciphertext.includes("hospital"), false);
});

test("the support form needs a box, consent, and a way to reach a guest", async () => {
  const handle = createApi({ store: new ChurchStore(loadConfig({})) });
  const cases = [
    { needs: [], name: "Sam", phone: "214-555-0100", consent: true },
    { needs: ["volunteer"], name: "Sam", phone: "214-555-0100", consent: false },
    { needs: ["volunteer", "volunteer"], name: "Sam", phone: "214-555-0100", consent: true },
    { needs: ["prophecy"], name: "Sam", phone: "214-555-0100", consent: true },
    { needs: ["volunteer"], name: "Sam", consent: true },
  ];
  for (const body of cases) {
    const response = await handle(post("/api/support", body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("a member's support request uses their account and is rate limited", () => {
  const church = new ChurchStore(loadConfig({}));
  const avery = login(church, "avery@sample.onehope");
  const sent = church.submitSupport(avery, { needs: ["counseling"], consent: true }, "t");
  assert.deepEqual(sent.needs, ["Short term pastoral counseling"]);
  const row = church.followUpsFor(staff(church, SAMPLE_PASTOR_EMAIL)).find((item) => item.id === sent.id);
  assert.equal(row?.email, "avery@sample.onehope");
  assert.equal(row?.member, true);
  for (let index = 1; index < 10; index += 1)
    church.submitSupport(avery, { needs: ["volunteer"], consent: true }, "t");
  assert.throws(() => church.submitSupport(avery, { needs: ["volunteer"], consent: true }, "t"), {
    code: "rate_limited",
  });
});

test("the Toolkit, Recovery page, and support choices are public and match the church's pages", async () => {
  const handle = createApi({ store: new ChurchStore(loadConfig({}), { fixture: false }) });
  const response = await handle(new Request("http://localhost/api/growth"));
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    toolkit: {
      scriptures: { reference: string }[];
      readingPlan: { url: string };
      proclamations: { url: string };
    };
    recovery: {
      worksheet: { areas: string[]; pdfUrl: string };
      group: { id: string; joinType: string } | null;
    };
    support: { needs: { label: string }[] };
  };
  assert.deepEqual(
    body.toolkit.scriptures.map((verse) => verse.reference),
    [
      "2 Timothy 1:7",
      "Isaiah 53:4",
      "Psalm 91:10",
      "Psalm 91:7-8",
      "Ephesians 2:14",
      "Isaiah 54:17",
      "Deuteronomy 28:13",
      "Philippians 2:9-11",
    ],
  );
  assert.match(body.toolkit.readingPlan.url, /^https:\/\/docs\.google\.com\//);
  assert.match(body.toolkit.proclamations.url, /^https:\/\/hopecitydallas-my\.sharepoint\.com\//);
  assert.equal(body.recovery.worksheet.areas.length, 10);
  assert.match(body.recovery.worksheet.pdfUrl, /^https:\/\/drive\.google\.com\//);
  assert.deepEqual(body.recovery.group, {
    ...body.recovery.group,
    id: "unlocking-freedom",
    joinType: "request",
  });
  assert.deepEqual(
    body.support.needs.map((need) => need.label),
    SUPPORT_NEEDS.map((need) => need.label),
  );
});

test("giving offers the church's frequencies and only fund names the church publishes", async () => {
  const church = new ChurchStore(loadConfig({}));
  const avery = login(church, "avery@sample.onehope");
  church.stepUp(avery, { password: SAMPLE_PASSWORD });
  assert.deepEqual(
    church.funds().map((fund) => fund.name),
    ["One Hope Church", "Christmas Giving Tree"],
  );
  for (const recurring of GIVING_FREQUENCY_IDS) {
    const gift = await church.createGift(avery, {
      amountCents: 2500,
      fundId: "christmas-giving-tree",
      recurring,
    });
    assert.equal(gift.recurring, recurring);
    assert.equal(gift.fundName, "Christmas Giving Tree");
    assert.equal(gift.charged, false);
  }
  const handle = createApi({ store: church });
  const response = await handle(
    new Request("http://localhost/api/giving/gifts", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${avery}` },
      body: JSON.stringify({ amountCents: 500, fundId: "outreach", recurring: "once" }),
    }),
  );
  assert.equal(response.status, 400);
});

test("a family checks in, sees it, and only a verified guardian with the code picks up once", () => {
  const church = new ChurchStore(loadConfig({}));
  const avery = login(church, "avery@sample.onehope");
  church.clockIn(staff(church, "frankie@sample.onehope"));
  church.clockIn(staff(church, "dana@sample.onehope"));
  const { code: tag } = church.checkIn(avery, "child-remy");
  assert.match(tag, /^\d{4}$/);
  assert.equal(church.myKids(avery).find((child) => child.id === "child-remy")?.checkedIn, true);
  const wrong = tag === "1000" ? "1001" : "1000";
  assert.equal(church.householdPickup(avery, { childId: "child-remy", code: wrong }).allowed, false);
  assert.deepEqual(church.householdPickup(avery, { childId: "child-remy", code: tag }), {
    allowed: true,
    reason: "Guardian verified and the security code matches.",
  });
  assert.equal(church.myKids(avery).find((child) => child.id === "child-remy")?.checkedIn, false);
  assert.equal(church.householdPickup(avery, { childId: "child-remy", code: tag }).allowed, false);
});

test("pickup locks after five wrong codes", () => {
  const church = new ChurchStore(loadConfig({}));
  const avery = login(church, "avery@sample.onehope");
  const { code: tag } = church.checkIn(avery, "child-remy");
  const wrong = tag === "1000" ? "1001" : "1000";
  for (let index = 0; index < 5; index += 1)
    assert.equal(church.householdPickup(avery, { childId: "child-remy", code: wrong }).allowed, false);
  assert.throws(() => church.householdPickup(avery, { childId: "child-remy", code: tag }), {
    code: "rate_limited",
  });
});
