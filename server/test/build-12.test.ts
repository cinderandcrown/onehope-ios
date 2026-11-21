import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../src/api.ts";
import { loadConfig, resolveEnvMode } from "../src/config.ts";
import { AccessError } from "../src/domain.ts";
import { SAMPLE_PASSWORD, SAMPLE_TOTP_BASE32 } from "../src/sample-accounts.ts";
import { refuseSampleInProduction } from "../src/snapshot-import.ts";
import { ChurchStore } from "../src/store.ts";
import { decodeBase32, totpCode } from "../src/totp.ts";

function staffOf(store: ChurchStore, email: string) {
  const { token } = store.login({ email, password: SAMPLE_PASSWORD, ip: "203.0.113.8", userAgent: "test" });
  store.verifyMfa(token, totpCode(decodeBase32(SAMPLE_TOTP_BASE32), Date.now()));
  return token;
}

test("removing someone from the kids team takes them off duty everywhere", async () => {
  const store = new ChurchStore(loadConfig({}));
  const lead = staffOf(store, "reese@sample.onehope");
  const gray = staffOf(store, "gray@sample.onehope");
  const before = store.stationBoard(lead, null).adultsOnDuty;
  assert.equal(store.clockIn(gray).onDuty, true);
  assert.equal(store.kidsDuty(gray).onDuty, true);
  assert.equal(store.stationBoard(lead, null).adultsOnDuty, before + 1);

  store.removeKidsTeamMember(lead, "person-gray");

  assert.deepEqual(store.kidsDuty(gray), { canClockIn: false, onDuty: false });
  assert.equal(store.stationBoard(lead, null).adultsOnDuty, before);
  assert.ok(!store.stationBoard(lead, null).namesOnDuty.includes("Gray Sample"));
  const api = createApi({ store });
  const res = await api(
    new Request("http://localhost/api/kids/mine", { headers: { authorization: `Bearer ${gray}` } }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { duty: { onDuty: boolean; canClockIn: boolean } };
  assert.equal(body.duty.onDuty, false);
  assert.equal(body.duty.canClockIn, false);
  assert.throws(
    () => store.clockIn(gray),
    (error: AccessError) => error.code === "forbidden",
  );

  // Back on the team does not silently put them back on duty; they clock in again.
  store.addKidsTeamMember(lead, "person-gray");
  assert.equal(store.kidsDuty(gray).onDuty, false);
  assert.equal(store.clockIn(gray).onDuty, true);
});

test("a member signing in is told the staff desk is for staff", () => {
  const store = new ChurchStore(loadConfig({}));
  const session = store.login({
    email: "avery@sample.onehope",
    password: SAMPLE_PASSWORD,
    ip: "203.0.113.8",
    userAgent: "staff-form",
  });
  assert.equal(session.mfaRequired, false);
  assert.throws(
    () => store.staffMe(session.token),
    (error: AccessError) => error.code === "forbidden" && /staff/.test(error.message),
  );
});

test("an unknown ONEHOPE_ENV off Vercel refuses to start instead of falling back to demo", () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    for (const typo of ["prod", "produciton", "staging", "live", "true"]) {
      assert.throws(() => loadConfig({ ONEHOPE_ENV: typo }), /not recognized/);
      assert.throws(() => loadConfig({ ONEHOPE_ENV: typo, VERCEL_ENV: "preview" }), /not recognized/);
      assert.throws(
        () => ChurchStore.demo({ ONEHOPE_ENV: typo, ONEHOPE_SAMPLE_DATA: "true" }),
        /not recognized/,
      );
    }
    // On Vercel production a typo still resolves to production (the safe side), loudly.
    assert.equal(resolveEnvMode({ ONEHOPE_ENV: "prod", VERCEL_ENV: "production" }), "production");
    assert.throws(
      () => loadConfig({ ONEHOPE_ENV: "prod", VERCEL_ENV: "production" }),
      /FIELD_ENCRYPTION_KEY/,
    );
  } finally {
    console.error = quiet;
  }
  // Exact values and tolerant casing still work.
  assert.equal(loadConfig({}).env, "demo");
  assert.equal(loadConfig({ ONEHOPE_ENV: "demo" }).env, "demo");
  assert.equal(loadConfig({ ONEHOPE_ENV: " Demo " }).env, "demo");
  assert.throws(() => loadConfig({ ONEHOPE_ENV: "PRODUCTION" }), /FIELD_ENCRYPTION_KEY/);
  const key = Buffer.alloc(32, 7).toString("base64");
  assert.equal(loadConfig({ ONEHOPE_ENV: "Production", FIELD_ENCRYPTION_KEY: key }).env, "production");
});

test("sample people are refused on Vercel production even when ONEHOPE_ENV is unset", () => {
  const doc = {
    version: 1,
    people: [{ id: "p", email: "x@sample.onehope", sample: true }],
  } as unknown as Parameters<typeof refuseSampleInProduction>[0];
  assert.throws(() => refuseSampleInProduction(doc, { VERCEL_ENV: "production" }));
  assert.doesNotThrow(() => refuseSampleInProduction(doc, { VERCEL_ENV: "preview" }));
});
