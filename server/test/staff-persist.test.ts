import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { AccessError } from "../src/domain.ts";
import { loadDocument } from "../src/document-store.ts";
import { migrate, type SqlClient } from "../src/migrate.ts";
import { runRequest, seedTenantIfEmpty } from "../src/persist.ts";
import { tablesFor } from "../src/request-tables.ts";
import { SAMPLE_PASSWORD, SAMPLE_PASTOR_EMAIL, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { withServiceRole } from "../src/service-role.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

function client(db: PGlite): SqlClient {
  return {
    async exec(sql) {
      await db.exec(sql);
    },
    async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
      const result = await db.query<T>(sql, [...params]);
      return { rows: result.rows };
    },
  };
}

function code() {
  return totpCode(decodeBase32(SAMPLE_TOTP_BASE32), Date.now());
}

test("featured message, kids team, pickup, and push audience survive Postgres", async () => {
  const db = new PGlite();
  const sql = client(db);
  await migrate(sql);
  await seedTenantIfEmpty(sql, "onehope", { ...process.env, ONEHOPE_SAMPLE_DATA: "true" });

  const pastor = await runRequest(
    sql,
    (store) => {
      const session = store.login({
        email: SAMPLE_PASTOR_EMAIL,
        password: SAMPLE_PASSWORD,
        ip: "203.0.113.8",
        userAgent: "test",
      });
      store.verifyMfa(session.token, code());
      store.featureMessage(session.token, {
        videoId: "abcdefghijk",
        title: "Hope for the city",
        speaker: "Reese Sample",
        passage: "John 3",
        link: "https://www.youtube.com/watch?v=abcdefghijk",
      });
      return session.token;
    },
    "localhost",
  );

  const home = await runRequest(sql, (store) => store.publicHome(), "localhost", process.env, {
    tables: tablesFor("GET", "/api/home") ?? undefined,
  });
  assert.equal(home.sampleSermon.title, "Hope for the city");
  assert.equal(home.sampleSermon.speaker, "Reese Sample");
  assert.equal(home.sampleSermon.videoId, "abcdefghijk");

  const stored = await withServiceRole(sql, "onehope", () => loadDocument(sql, "onehope"));
  assert.equal(stored.featuredMessage?.title, "Hope for the city");
  assert.ok(stored.kidsTeam?.includes("person-frankie"));
  assert.ok(stored.kidsTeam?.includes("person-gray"));
  assert.equal(stored.kidsTeam?.includes("person-dana"), false);

  const frankie = await runRequest(
    sql,
    (store) => {
      const session = store.login({
        email: "frankie@sample.onehope",
        password: SAMPLE_PASSWORD,
        ip: "203.0.113.8",
        userAgent: "test",
      });
      store.verifyMfa(session.token, code());
      return session.token;
    },
    "localhost",
  );
  await runRequest(sql, (store) => store.clockIn(frankie), "localhost", process.env, { sessionToken: frankie });

  const dana = await runRequest(
    sql,
    (store) => {
      const session = store.login({
        email: "dana@sample.onehope",
        password: SAMPLE_PASSWORD,
        ip: "203.0.113.8",
        userAgent: "test",
      });
      store.verifyMfa(session.token, code());
      return session.token;
    },
    "localhost",
  );
  await assert.rejects(
    () => runRequest(sql, (store) => store.clockIn(dana), "localhost", process.env, { sessionToken: dana }),
    (error: unknown) => error instanceof AccessError && /kids team/.test(error.message),
  );

  const gray = await runRequest(
    sql,
    (store) => {
      const session = store.login({
        email: "gray@sample.onehope",
        password: SAMPLE_PASSWORD,
        ip: "203.0.113.8",
        userAgent: "test",
      });
      store.verifyMfa(session.token, code());
      return session.token;
    },
    "localhost",
  );
  await runRequest(sql, (store) => store.clockIn(gray), "localhost", process.env, { sessionToken: gray });

  const released = await runRequest(
    sql,
    (store) => {
      store.stepUp(frankie, { code: code() });
      const visit = store.staffCheckIn(frankie, "child-remy");
      const alone = store.pickup(frankie, {
        childId: "child-remy",
        guardianPersonId: "person-avery",
        code: visit.code,
      });
      return { allowed: alone.allowed, adults: store.stationBoard(frankie, null).adultsOnDuty };
    },
    "localhost",
    process.env,
    { sessionToken: frankie },
  );
  assert.equal(released.adults, 2);
  assert.equal(released.allowed, true);

  const audience = await runRequest(
    sql,
    (store) => store.pushDesk(pastor).counts.members,
    "localhost",
    process.env,
    { sessionToken: pastor },
  );
  assert.equal(audience, 9);

  const care = await runRequest(
    sql,
    (store) => {
      store.stepUp(pastor, { code: code() });
      return store.careAssignees(pastor).map((person) => person.id);
    },
    "localhost",
    process.env,
    { sessionToken: pastor },
  );
  assert.ok(care.includes("person-eden"));
  assert.equal(care.includes("person-dana"), false);
  assert.equal(care.includes("person-frankie"), false);
});
