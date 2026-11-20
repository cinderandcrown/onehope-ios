import assert from "node:assert/strict";
import test from "node:test";

import {
  SAMPLE_FUNNEL,
  autoSchedule,
  evaluatePickup,
  eventToIcs,
  findRoomConflict,
  nextSundayService,
  parseYoutubeRss,
  permissionMatrix,
  projectDirectory,
  transitionExpense,
  zebraLabel,
} from "../src/domain.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

test("next Sunday service stays in America/Chicago", () => {
  const tuesday = nextSundayService(new Date("2026-11-17T18:00:00.000Z"));
  assert.equal(tuesday.service.toISOString(), "2026-11-22T16:30:00.000Z");
  assert.equal(tuesday.preService.toISOString(), "2026-11-22T16:00:00.000Z");
  const before = nextSundayService(new Date("2026-11-22T15:00:00.000Z"));
  assert.equal(before.service.toISOString(), "2026-11-22T16:30:00.000Z");
  const after = nextSundayService(new Date("2026-11-22T17:00:00.000Z"));
  assert.equal(after.service.toISOString(), "2026-11-29T16:30:00.000Z");
});

test("pickup requires two adults, a guardian, no custody block, and the code", () => {
  const ok = {
    code: "4821",
    expectedCode: "4821",
    guardianAuthorized: true,
    custodyRestricted: false,
    adultsOnDuty: 2,
  };
  assert.equal(evaluatePickup(ok).allowed, true);
  assert.equal(evaluatePickup(ok).countsTowardLockout, false);
  const shortStaffed = evaluatePickup({ ...ok, adultsOnDuty: 1 });
  assert.equal(shortStaffed.allowed, false);
  assert.equal(shortStaffed.countsTowardLockout, false);
  assert.equal(shortStaffed.reason, "Two adults must be on duty at the station.");
  assert.equal(evaluatePickup({ ...ok, guardianAuthorized: false }).countsTowardLockout, false);
  assert.equal(evaluatePickup({ ...ok, custodyRestricted: true }).countsTowardLockout, false);
  const wrongCode = evaluatePickup({ ...ok, code: "0000" });
  assert.equal(wrongCode.allowed, false);
  assert.equal(wrongCode.countsTowardLockout, true);
  const notCheckedIn = evaluatePickup({ ...ok, code: "", expectedCode: "" });
  assert.equal(notCheckedIn.allowed, false);
  assert.equal(notCheckedIn.countsTowardLockout, false);
});

test("directory hides fields that are not opted in", () => {
  const people = [
    {
      id: "a",
      displayName: "Avery",
      email: "avery@sample.onehope",
      emailPublic: true,
      phone: "111",
      phonePublic: false,
    },
    {
      id: "c",
      displayName: "Casey",
      email: "casey@sample.onehope",
      emailPublic: false,
      phone: "222",
      phonePublic: false,
    },
  ];
  const viewed = projectDirectory("a", people);
  assert.equal(viewed[0]?.phone, "111");
  assert.equal(viewed[1]?.email, "");
  assert.equal(viewed[1]?.phone, "");
});

test("room conflicts and auto scheduling respect blockouts", () => {
  const existing = [{ id: "1", roomId: "auditorium", start: 10, end: 20 }];
  assert.ok(findRoomConflict(existing, { roomId: "auditorium", start: 15, end: 25 }));
  assert.equal(findRoomConflict(existing, { roomId: "lobby", start: 15, end: 25 }), null);
  const assigned = autoSchedule(
    [{ positionId: "greeter", count: 1 }],
    [
      { personId: "harper", positionId: "greeter", blockouts: [{ start: 10, end: 20 }] },
      { personId: "gray", positionId: "greeter", blockouts: [] },
    ],
    10,
    20,
  );
  assert.deepEqual(assigned, [{ positionId: "greeter", personId: "gray" }]);
});

test("expense transitions and label text stay explicit", () => {
  assert.equal(transitionExpense("submitted", "approve"), "approved");
  assert.throws(() => transitionExpense("draft", "approve"));
  assert.match(zebraLabel("Remy", "4821"), /\^XA/);
  assert.match(
    eventToIcs({
      id: "e",
      title: "Sunday",
      start: new Date(0),
      end: new Date(60_000),
      location: "Richardson",
      description: "Gather",
    }),
    /BEGIN:VEVENT/,
  );
});

test("YouTube RSS parses without an API key", () => {
  const videos = parseYoutubeRss(
    `<feed><entry><yt:videoId>abc12345678</yt:videoId><title>Hope &amp; Grace</title><published>2026-11-01T00:00:00Z</published><link rel="alternate" href="https://www.youtube.com/watch?v=abc12345678"/><media:thumbnail url="https://i.ytimg.com/vi/abc12345678/0.jpg"/></entry></feed>`,
  );
  assert.equal(videos[0]?.id, "abc12345678");
  assert.equal(videos[0]?.title, "Hope & Grace");
});

test("TOTP matches the RFC 6238 SHA1 vector", () => {
  const secret = Buffer.from("12345678901234567890", "utf8");
  assert.equal(totpCode(secret, 59_000), "287082");
  assert.equal(decodeBase32("JBSWY3DPEHPK3PXP").subarray(0, 6).toString("utf8"), "Hello!");
});

test("Master Admin is the first row of the permission matrix", () => {
  const matrix = permissionMatrix();
  assert.equal(matrix[0]?.role, "master_admin");
  assert.equal(matrix[0]?.grants.propose_master_admin, true);
  assert.equal(matrix.find((row) => row.role === "pastor")?.grants.manage_integrations, false);
  assert.equal(matrix.find((row) => row.role === "member")?.grants.view_all_giving, false);
  const householdReaders = new Set([
    "master_admin",
    "pastor",
    "care_team",
    "finance",
    "kids_director",
    "team_leader",
    "volunteer",
    "member",
  ]);
  assert.equal(
    matrix.every((row) => row.grants.view_household_tier3 === householdReaders.has(row.role)),
    true,
  );
  assert.equal(matrix.find((row) => row.role === "platform_operator")?.grants.view_household_tier3, false);
  assert.equal(matrix.find((row) => row.role === "shop_owner")?.grants.view_all_giving, false);
  assert.equal(matrix.find((row) => row.role === "barista")?.grants.view_kids_medical, false);
  assert.equal(SAMPLE_FUNNEL.sample, true);
});
