import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { loadConfig } from "../src/config.ts";
import { decryptString } from "../src/crypto.ts";
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
  const status = (await health.json()) as { env: string; fieldEncryption: string };
  assert.equal(status.env, "demo");
  assert.equal(status.fieldEncryption, "demo");
  const calendar = await handle(new Request("http://localhost/api/events/event-sunday/ics"));
  assert.equal(calendar.headers.get("content-type"), "text/calendar; charset=utf-8");
  assert.match(await calendar.text(), /BEGIN:VCALENDAR/);
});

test("a living member cannot take the name Former member or lose their records", () => {
  const store = new ChurchStore(loadConfig({}), { fixture: false });
  const session = store.signup({
    email: "ada@onehope.test",
    password: "gathering",
    displayName: "Ada",
    ip: "t",
    userAgent: "t",
  });
  store.addChild(session.token, { displayName: "Remy", classroom: "Preschool" });
  store.submitPrayer(session.token, { body: "For the city.", visibility: "public" });
  assert.throws(() => store.updateProfile(session.token, { displayName: "Former member" }));
  const copy = new ChurchStore(loadConfig({}), { fixture: false });
  copy.installDocument(store.toDocument());
  const again = copy.login({ email: "ada@onehope.test", password: "gathering", ip: "t", userAgent: "t" });
  assert.equal(copy.myKids(again.token).length, 1);
  assert.equal(
    copy.listPrayers(again.token).some((row) => row.body.includes("city")),
    true,
  );
});

test("an existing seat can be claimed only with an invite", async () => {
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
  const restored = new ChurchStore(loadConfig({}));
  restored.installDocument(store.toDocument());
  const claimed = restored.claimInvite({
    email: issued.email,
    inviteToken: issued.inviteToken,
    password: "gathering",
    ip: "t",
    userAgent: "t",
  });
  assert.equal(claimed.person.role, "master_admin");
  const spent = new ChurchStore(loadConfig({}));
  spent.installDocument(restored.toDocument());
  assert.throws(() =>
    spent.claimInvite({
      email: issued.email,
      inviteToken: issued.inviteToken,
      password: "gathering",
      ip: "t",
      userAgent: "t",
    }),
  );
  const takeover = await createApi({ store: new ChurchStore(loadConfig({}), { fixture: false }) })(
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
  const body = (await takeover.json()) as { error: string };
  assert.equal(takeover.status, 400);
  assert.doesNotMatch(body.error, /already exists/i);
});

test("a configured key re-reads fields saved with the demo key", () => {
  const source = new ChurchStore(loadConfig({}));
  const cipher = source.storedGiftCiphertext("gift-avery");
  assert.ok(cipher);
  const key = Buffer.alloc(32, 9);
  const next = new ChurchStore(loadConfig({ FIELD_ENCRYPTION_KEY: key.toString("base64") }), { fixture: true });
  next.installDocument(source.toDocument());
  const rotated = next.storedGiftCiphertext("gift-avery");
  assert.notEqual(rotated, cipher);
  assert.match(decryptString(rotated, key), /2500|general|amountCents/);
});

test("seats stay behind staff sign-in and deletion removes owned rows", async () => {
  const store = new ChurchStore(loadConfig({}));
  const handle = createApi({ store });
  const open = await handle(new Request("http://localhost/api/security/seats"));
  assert.equal(open.status, 401);
  const member = store.login({
    email: "avery@sample.onehope",
    password: "hope-sample",
    ip: "t",
    userAgent: "t",
  });
  store.register(member.token, store.publicHome().events[0]?.id ?? "");
  store.joinGroup(member.token, store.listGroups(member.token)[0]?.id ?? "");
  store.stepUp(member.token, { password: "hope-sample" });
  store.deleteSelf(member.token);
  const doc = store.toDocument();
  assert.equal(doc.registrations.some((row) => row.personId === "person-avery"), false);
  assert.equal(doc.notes.some((row) => row.subjectPersonId === "person-avery" || row.authorId === "person-avery"), false);
  assert.equal(doc.groups.some((group) => group.memberIds.includes("person-avery")), false);
  const copy = new ChurchStore(loadConfig({}));
  copy.installDocument(doc);
  assert.equal(copy.toDocument().prayers.some((row) => row.authorId === "person-avery"), false);
});
