import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { loadConfig } from "../src/config.ts";
import { createLogger } from "../src/logger.ts";
import { ChurchStore } from "../src/store.ts";
import { memorySyncStore, runSync } from "../src/sync.ts";
import { VERSION } from "../src/version.ts";

test("health, card rejection, cross-site cookies, and push are enforced at the HTTP boundary", async () => {
  const lines: string[] = [];
  const store = new ChurchStore(
    loadConfig({ FACEBOOK_PAGE_ACCESS_TOKEN: "FACEBOOKSECRET", FACEBOOK_PAGE_ID: "99" }),
  );
  const handle = createApi({
    store,
    log: createLogger((line) => lines.push(line)),
    fetchImpl: async () => new Response("", { status: 500 }),
  });
  const health = await handle(new Request("http://localhost/api/health"));
  assert.equal(health.status, 200);
  const healthBody = (await health.json()) as { version: string; sendsEnabled: boolean };
  assert.equal(healthBody.version, VERSION);
  assert.equal(healthBody.sendsEnabled, false);

  const preview = await handle(
    new Request("http://localhost/api/auth/sample-staff", {
      method: "POST",
      headers: { authorization: "Bearer unused" },
    }),
  );
  assert.equal(preview.status, 200);
  const session = (await preview.json()) as { token: string };
  const gift = await handle(
    new Request("http://localhost/api/giving/gifts", {
      method: "POST",
      headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 500,
        fundId: "general",
        recurring: "once",
        cardNumber: "4242424242424242",
      }),
    }),
  );
  assert.equal(gift.status, 400);
  const clean = await handle(
    new Request("http://localhost/api/giving/gifts", {
      method: "POST",
      headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 500, fundId: "general", recurring: "once" }),
    }),
  );
  const cleanBody = (await clean.json()) as { gift: { charged: boolean } };
  assert.equal(clean.status, 200);
  assert.equal(cleanBody.gift.charged, false);

  const crossSite = await handle(
    new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: `onehope_session=${session.token}`, origin: "https://evil.test", host: "localhost" },
    }),
  );
  assert.equal(crossSite.status, 403);

  const capabilities = await handle(new Request("http://localhost/api/capabilities"));
  const capabilityText = await capabilities.text();
  assert.doesNotMatch(capabilityText, /FACEBOOKSECRET/);
  assert.match(capabilityText, /Planning Center/);
  assert.equal(
    lines.some((line) => line.includes("FACEBOOKSECRET")),
    false,
  );
});

test("a member reads their own classroom and next steps, not another household", async () => {
  const handle = createApi({ store: new ChurchStore(loadConfig({})) });
  const login = await handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "avery@sample.onehope", password: "hope-sample" }),
    }),
  );
  assert.equal(login.status, 200);
  const session = (await login.json()) as { token: string };
  const kids = await handle(
    new Request("http://localhost/api/kids/mine", {
      headers: { authorization: `Bearer ${session.token}` },
    }),
  );
  const kidsText = await kids.text();
  assert.equal(kids.status, 200);
  assert.match(kidsText, /Remy Sample/);
  assert.match(kidsText, /Preschool/);
  assert.doesNotMatch(kidsText, /Quinn/);
  assert.doesNotMatch(kidsText, /peanut/);
  assert.doesNotMatch(kidsText, /4821/);
  const pathway = await handle(
    new Request("http://localhost/api/pathways/mine", {
      headers: { authorization: `Bearer ${session.token}` },
    }),
  );
  const steps = (await pathway.json()) as { steps: { id: string }[] };
  assert.equal(pathway.status, 200);
  assert.equal(
    steps.steps.some((step) => step.id === "baptism"),
    true,
  );
  const serving = await handle(
    new Request("http://localhost/api/serving/mine", {
      headers: { authorization: `Bearer ${session.token}` },
    }),
  );
  const assignments = (await serving.json()) as { assignments: { personId: string }[] };
  assert.equal(serving.status, 200);
  assert.equal(
    assignments.assignments.every((item) => item.personId === "person-avery"),
    true,
  );
});

test("sync retries then skips a completed idempotency key", async () => {
  const saved = memorySyncStore();
  let tries = 0;
  const result = await runSync({
    key: "people-page-1",
    name: "planning-center-people",
    store: saved,
    retries: 3,
    sleep: async () => undefined,
    run: async () => {
      tries += 1;
      if (tries < 3) throw new Error("temporary");
    },
  });
  assert.equal(result.attempts, 3);
  assert.equal(result.skipped, false);
  const again = await runSync({
    key: "people-page-1",
    name: "planning-center-people",
    store: saved,
    run: async () => {
      throw new Error("should not run");
    },
  });
  assert.equal(again.skipped, true);
});

test("logger redacts emails and secrets", () => {
  const lines: string[] = [];
  createLogger((line) => lines.push(line)).log("info", "sign-in", {
    email: "avery@sample.onehope",
    password: "hope-sample",
    note: "reach avery@sample.onehope tomorrow",
  });
  assert.doesNotMatch(lines[0] ?? "", /avery@sample/);
  assert.doesNotMatch(lines[0] ?? "", /hope-sample/);
  assert.match(lines[0] ?? "", /redacted/);
});

test("package version matches VERSION", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  assert.equal(pkg.version, VERSION);
});

test("OpenAPI lists every route the server handles", async () => {
  const { API_ROUTES } = await import("../src/api.ts");
  const spec = JSON.parse(readFileSync(new URL("../../contracts/openapi.json", import.meta.url), "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
  };
  for (const [method, path] of API_ROUTES) {
    assert.ok(spec.paths[path]?.[method.toLowerCase()], `${method} ${path} missing from OpenAPI`);
  }
});
