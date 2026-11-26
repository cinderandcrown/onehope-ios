import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { CHURCH_GROUPS, RETIRED_GROUP_IDS } from "../src/church-copy.ts";
import { loadConfig } from "../src/config.ts";
import { SAMPLE_PASSWORD, SAMPLE_PASTOR_EMAIL, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { ChurchStore, type StoreDocument } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

const NOV_18 = Date.parse("2026-11-18T18:00:00.000Z");

function store(now = NOV_18) {
  return new ChurchStore(loadConfig({}), { fixture: false, now: () => now });
}

function member(church: ChurchStore, email = "member@example.com") {
  return church.signup({
    displayName: "Pat Member",
    email,
    password: "a long enough password 42",
    ip: "t",
    userAgent: "t",
  }).token;
}

type GroupView = { id: string; joinType: string; leaders: string[]; url: string | null; joined: boolean };

test("a guest browses the church's real groups from Church Center", async () => {
  const handle = createApi({ store: store() });
  const response = await handle(new Request("http://localhost/api/groups"));
  assert.equal(response.status, 200);
  const { groups } = (await response.json()) as { groups: GroupView[] };
  assert.equal(groups.length, 13);
  assert.equal(groups.filter((group) => group.joinType === "request").length, 2);
  assert.ok(groups.every((group) => group.url?.startsWith("https://weareonehope.churchcenter.com/groups/")));
  assert.ok(groups.every((group) => !group.joined));
  assert.deepEqual(groups.find((group) => group.id === "men-s-mentorship-group")?.leaders, ["Tony Neis"]);
  assert.ok(!groups.some((group) => RETIRED_GROUP_IDS.includes(group.id)));
});

test("members join open groups in the app; request-to-join groups stay on Church Center", () => {
  const church = store();
  const token = member(church);
  assert.deepEqual(church.joinGroup(token, "sunday-morning-prayer"), {
    id: "sunday-morning-prayer",
    joined: true,
  });
  assert.equal(church.listGroups(token).find((group) => group.id === "sunday-morning-prayer")?.joined, true);
  assert.throws(() => church.joinGroup(token, "unlocking-freedom"), { code: "invalid" });
});

test("a saved snapshot retires placeholder groups and keeps real memberships", () => {
  const church = store();
  const token = member(church);
  church.joinGroup(token, "one-hope-youth");
  const document = JSON.parse(JSON.stringify(church.toDocument())) as StoreDocument;
  document.groups.push({
    id: "group-small",
    name: "Small Groups",
    summary: "",
    sample: false,
    memberIds: [],
  });
  document.messages.push({ id: "m1", groupId: "group-small", authorId: "x", body: "hi", sample: false });
  const copy = store();
  copy.installDocument(document);
  const saved = copy.toDocument();
  assert.equal(saved.groups.length, CHURCH_GROUPS.length);
  assert.equal(saved.messages.length, 0);
  assert.equal(copy.listGroups(token).find((group) => group.id === "one-hope-youth")?.joined, true);
});

test("Home lists Sunday with the two Church Center events, and drops events once they end", () => {
  const before = store().publicHome() as { events: { id: string; url: string | null }[] };
  assert.deepEqual(
    before.events.map((event) => event.id),
    ["cc-2569980", "event-sunday", "cc-3990859"],
  );
  assert.equal(before.events[0]?.url, "https://weareonehope.churchcenter.com/registrations/events/2569980");
  const after = store(Date.parse("2026-11-21T12:00:00.000Z")).publicHome() as { events: { id: string }[] };
  assert.deepEqual(
    after.events.map((event) => event.id),
    ["event-sunday", "cc-3990859"],
  );
});

test("Church Center events register on Church Center, not in the app", () => {
  const church = store();
  assert.throws(() => church.register(member(church), "cc-3990859"), { code: "invalid" });
});

test("Give mentions the Christmas Giving Tree only until Christmas", () => {
  const now = store().publicHome() as { giving: { seasonal: { title: string } | null } };
  assert.equal(now.giving.seasonal?.title, "Christmas Giving Tree");
  const later = store(Date.parse("2026-12-27T12:00:00.000Z")).publicHome() as { giving: { seasonal: null } };
  assert.equal(later.giving.seasonal, null);
});

function pastor(church: ChurchStore) {
  const { token } = church.login({
    email: SAMPLE_PASTOR_EMAIL,
    password: SAMPLE_PASSWORD,
    ip: "t",
    userAgent: "t",
  });
  const code = totpCode(decodeBase32(SAMPLE_TOTP_BASE32), Date.now());
  church.verifyMfa(token, code);
  church.stepUp(token, { code });
  return token;
}

test("a prayer request carries Church Center's fields, and Please contact me reaches the care queue", async () => {
  const church = new ChurchStore(loadConfig({}));
  const token = member(church);
  const handle = createApi({ store: church });
  const response = await handle(
    new Request("http://localhost/api/prayers", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        serve: "Pray for my family",
        contact: true,
        body: "My mom is sick.",
        visibility: "public",
      }),
    }),
  );
  assert.equal(response.status, 200);
  const mine = church.listPrayers(token).find((prayer) => prayer.mine);
  assert.equal(mine?.serve, "Pray for my family");
  assert.equal(mine?.contactRequested, true);
  const queue = church.followUpsFor(pastor(church));
  assert.deepEqual(
    queue.filter((row) => row.kind === "prayer").map((row) => [row.name, row.email]),
    [["Pat Member", "member@example.com"]],
  );
  const legacy = await handle(
    new Request("http://localhost/api/prayers", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ body: "Build 5 still posts this shape.", visibility: "public" }),
    }),
  );
  assert.equal(legacy.status, 200);
  assert.equal(church.followUpsFor(pastor(church)).filter((row) => row.kind === "prayer").length, 1);
});
