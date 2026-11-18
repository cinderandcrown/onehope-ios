import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { loadConfig } from "../src/config.ts";
import { ChurchStore } from "../src/store.ts";

test("the public church has real gathering facts and accounts only after sign-up", async () => {
  const store = new ChurchStore(loadConfig({}), { fixture: false });
  const home = store.publicHome();
  assert.equal(
    home.announcements.some((item) => item.title.toLowerCase().includes("sample")),
    false,
  );
  assert.equal(home.events[0]?.title, "Sunday gathering");
  const handle = createApi({ store });
  const signup = await handle(
    new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "jen.miller.example@onehope.test",
        password: "gathering",
        displayName: "Jen Miller",
      }),
    }),
  );
  assert.equal(signup.status, 200);
  const session = (await signup.json()) as { token: string };
  const directory = await handle(
    new Request("http://localhost/api/directory", {
      headers: { authorization: `Bearer ${session.token}` },
    }),
  );
  const people = (await directory.json()) as { people: { email: string }[] };
  assert.equal(
    people.people.some((person) => person.email.includes("sample.onehope")),
    false,
  );
  const created = await handle(
    new Request("http://localhost/api/household/children", {
      method: "POST",
      headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Remy", classroom: "Preschool" }),
    }),
  );
  assert.equal(created.status, 200);
  const child = (await created.json()) as { child: { id: string } };
  const checked = await handle(
    new Request("http://localhost/api/kids/check-in", {
      method: "POST",
      headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
      body: JSON.stringify({ childId: child.child.id }),
    }),
  );
  assert.equal(checked.status, 200);
  const visit = (await checked.json()) as { code: string };
  assert.match(visit.code, /^\d{4}$/);
  const takeover = await handle(
    new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "nicholas.will@cinderandcrown.com",
        password: "gathering",
        displayName: "Not Nicholas",
      }),
    }),
  );
  assert.equal(takeover.status, 400);
  const stolen = await handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nicholas.will@cinderandcrown.com", password: "gathering" }),
    }),
  );
  assert.equal(stolen.status, 401);
  const health = await handle(new Request("http://localhost/api/health"));
  const status = (await health.json()) as { env: string };
  assert.equal(status.env, "production");
  const calendar = await handle(new Request("http://localhost/api/events/event-sunday/ics"));
  assert.equal(calendar.headers.get("content-type"), "text/calendar; charset=utf-8");
  assert.match(await calendar.text(), /BEGIN:VCALENDAR/);
});

test("an existing seat can be claimed only with an invite", () => {
  const store = new ChurchStore(loadConfig({}));
  const pastor = store.loginSampleStaff({ ip: "t", userAgent: "t" });
  assert.throws(() =>
    store.signup({
      email: "nicholas.will@cinderandcrown.com",
      password: "gathering",
      displayName: "Not Nicholas",
      ip: "t",
      userAgent: "t",
    }),
  );
  const issued = store.issueInvite(pastor.token, "nicholas.will@cinderandcrown.com");
  const claimed = store.claimInvite({
    email: issued.email,
    inviteToken: issued.inviteToken,
    password: "gathering",
    ip: "t",
    userAgent: "t",
  });
  assert.equal(claimed.person.role, "master_admin");
  assert.throws(() =>
    store.claimInvite({
      email: issued.email,
      inviteToken: issued.inviteToken,
      password: "gathering",
      ip: "t",
      userAgent: "t",
    }),
  );
});
