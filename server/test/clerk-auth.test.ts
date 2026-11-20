import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { authProviderFor, clerkAuthProvider, localAuthProvider } from "../src/auth-provider.ts";
import {
  authenticateClerkRequest,
  ClerkAuthError,
  loadClerkEnv,
  reverificationErrorBody,
  reverificationSatisfied,
  sqlOrgTenantLookup,
  type ClerkGateway,
  type ClerkMembership,
} from "../src/clerk-auth.ts";
import { migrate, type SqlClient } from "../src/migrate.ts";
import { assumeService } from "../src/service-role.ts";

/**
 * A fake Clerk. A token is "valid" when it is a key in `sessions`; its value is the claims Clerk
 * would have signed. Memberships are what Clerk's Backend API returns for each user.
 * One Clerk user has one email, so "the same email in two tenants" is one user in two orgs.
 */
function fakeClerk(
  sessions: Record<string, Record<string, unknown>>,
  memberships: Record<string, ClerkMembership[]>,
): ClerkGateway & { membershipCalls: string[] } {
  const membershipCalls: string[] = [];
  return {
    membershipCalls,
    async verifySessionToken(token) {
      const claims = sessions[token];
      if (!claims) throw new Error("bad signature");
      return claims;
    },
    async listMemberships(userId) {
      membershipCalls.push(userId);
      return memberships[userId] ?? [];
    },
  };
}

const SAME_EMAIL_USER = "user_same_email"; // signs in as shared@example.test in both orgs
const ORG_CC = "org_cinder";
const ORG_RC = "org_revival";
const ORG_UNMAPPED = "org_unmapped";

const orgMap: Record<string, string> = { [ORG_CC]: "cinderandcrown", [ORG_RC]: "revivalcoffee" };
const lookupTenant = async (orgId: string) => orgMap[orgId] ?? null;

const fresh: [number, number] = [1, 1];

const clerk = fakeClerk(
  {
    "tok-cc": { sub: SAME_EMAIL_USER, sid: "sess_1", v: 2, o: { id: ORG_CC, rol: "admin" }, fva: fresh },
    "tok-rc": { sub: SAME_EMAIL_USER, sid: "sess_1", v: 2, o: { id: ORG_RC, rol: "member" }, fva: [30, 30] },
    "tok-rc-v1": { sub: SAME_EMAIL_USER, sid: "sess_2", org_id: ORG_RC, org_role: "org:member", fva: fresh },
    "tok-none": { sub: SAME_EMAIL_USER, sid: "sess_3", v: 2, fva: fresh },
    "tok-unmapped": { sub: SAME_EMAIL_USER, sid: "sess_4", v: 2, o: { id: ORG_UNMAPPED }, fva: fresh },
    "tok-removed": { sub: "user_removed", sid: "sess_5", v: 2, o: { id: ORG_CC, rol: "admin" }, fva: fresh },
    "tok-agent": {
      sub: SAME_EMAIL_USER,
      sid: "sess_6",
      v: 2,
      o: { id: ORG_CC, rol: "admin" },
      fva: fresh,
      act: { sub: "agent_bot", type: "agent" },
    },
    "tok-pending": {
      sub: SAME_EMAIL_USER,
      sid: "sess_7",
      v: 2,
      o: { id: ORG_CC },
      sts: "pending",
      fva: fresh,
    },
  },
  {
    [SAME_EMAIL_USER]: [
      { orgId: ORG_CC, role: "org:admin" },
      { orgId: ORG_RC, role: "org:member" },
      { orgId: ORG_UNMAPPED, role: "org:member" },
    ],
    user_removed: [],
  },
);

const deps = { gateway: clerk, lookupTenant };

function request(
  token: string | null,
  extra: Record<string, string> = {},
  url = "https://os.example.test/api/me",
) {
  const headers = new Headers(extra);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(url, { headers });
}

test("the same email in two tenants resolves to the tenant of the active org only", async () => {
  const inCc = await authenticateClerkRequest(request("tok-cc"), deps);
  const inRc = await authenticateClerkRequest(request("tok-rc"), deps);
  assert.equal(inCc.userId, inRc.userId);
  assert.equal(inCc.tenantId, "cinderandcrown");
  assert.equal(inRc.tenantId, "revivalcoffee");
  // Role comes from Clerk's membership in that org, not from the other tenant.
  assert.equal(inCc.orgRole, "org:admin");
  assert.equal(inRc.orgRole, "org:member");
  // Step-up is per session: fresh in one, stale in the other.
  assert.equal(inCc.stepUp, true);
  assert.equal(inRc.stepUp, false);
});

test("v1 org claims resolve the same way", async () => {
  const identity = await authenticateClerkRequest(request("tok-rc-v1"), deps);
  assert.equal(identity.tenantId, "revivalcoffee");
});

test("a client-sent tenant id, header, query, or cookie cannot choose the tenant", async () => {
  const forged = request(
    "tok-cc",
    { "x-tenant-id": "revivalcoffee", "x-org-id": ORG_RC, cookie: "tenant=revivalcoffee; org=org_revival" },
    "https://os.example.test/api/me?tenant=revivalcoffee&tenantId=revivalcoffee&org_id=org_revival",
  );
  const identity = await authenticateClerkRequest(forged, deps);
  assert.equal(identity.tenantId, "cinderandcrown");
  assert.equal(identity.orgId, ORG_CC);
});

test("the __session cookie works when there is no bearer header", async () => {
  const identity = await authenticateClerkRequest(request(null, { cookie: "a=b; __session=tok-rc" }), deps);
  assert.equal(identity.tenantId, "revivalcoffee");
});

async function rejectsWith(promise: Promise<unknown>, status: number, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ClerkAuthError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

test("missing, forged, org-less, unmapped, removed, and pending sessions are refused", async () => {
  await rejectsWith(authenticateClerkRequest(request(null), deps), 401, "unauthenticated");
  await rejectsWith(authenticateClerkRequest(request("tok-forged"), deps), 401, "unauthenticated");
  await rejectsWith(authenticateClerkRequest(request("tok-none"), deps), 403, "no_active_org");
  await rejectsWith(authenticateClerkRequest(request("tok-unmapped"), deps), 403, "unknown_org");
  await rejectsWith(authenticateClerkRequest(request("tok-removed"), deps), 403, "not_a_member");
  await rejectsWith(authenticateClerkRequest(request("tok-pending"), deps), 403, "pending_session");
});

test("step-up maps to Clerk reverification and an agent session never counts", async () => {
  const policy = { level: "second_factor" as const, afterMinutes: 5 };
  const base = { sub: "u", sid: "s" };
  assert.equal(reverificationSatisfied({ ...base, fva: [1, 2] }, policy), true);
  assert.equal(reverificationSatisfied({ ...base, fva: [1, 9] }, policy), false);
  // No second factor enrolled: Clerk falls back to the first factor.
  assert.equal(reverificationSatisfied({ ...base, fva: [1, -1] }, policy), true);
  assert.equal(reverificationSatisfied({ ...base, fva: [-1, -1] }, policy), false);
  assert.equal(reverificationSatisfied({ ...base }, policy), false);
  assert.equal(
    reverificationSatisfied({ ...base, fva: [1, 9] }, { level: "first_factor", afterMinutes: 5 }),
    true,
  );
  assert.equal(
    reverificationSatisfied({ ...base, fva: [1, 9] }, { level: "multi_factor", afterMinutes: 5 }),
    false,
  );

  const agent = await authenticateClerkRequest(request("tok-agent"), deps);
  assert.equal(agent.stepUp, false);
  assert.equal(agent.actor, "agent_bot");

  assert.deepEqual(reverificationErrorBody(policy), {
    clerk_error: {
      type: "forbidden",
      reason: "reverification-error",
      metadata: { reverification: { level: "second_factor", afterMinutes: 5 } },
    },
  });
});

test("the Clerk provider refuses password work and local stays the default", () => {
  assert.throws(() => clerkAuthProvider.hashPassword("x"), /handled by clerk/);
  assert.throws(() => clerkAuthProvider.verifyPassword("x", "y"), /handled by clerk/);
  assert.equal(authProviderFor({}).id, "local");
  assert.equal(authProviderFor({ AUTH_PROVIDER: "clerk" }).id, "clerk");
  assert.equal(authProviderFor({ AUTH_PROVIDER: "other" }), localAuthProvider);
});

test("Clerk env is validated and names what is missing without echoing values", () => {
  assert.throws(() => loadClerkEnv({}), /CLERK_SECRET_KEY/);
  const env = loadClerkEnv({
    CLERK_SECRET_KEY: "test-secret-placeholder",
    CLERK_PUBLISHABLE_KEY: "test-publishable-placeholder",
    CLERK_AUTHORIZED_PARTIES: "https://os.example.test",
  });
  assert.equal(env.CLERK_STEP_UP_MINUTES, undefined);
});

function pgliteSql(db: PGlite): SqlClient {
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

test("the org-to-tenant map is a database row that app_service can route on but not rewrite across tenants", async () => {
  const db = new PGlite();
  const sql = pgliteSql(db);
  await migrate(sql);
  await db.exec(`
    INSERT INTO tenant_auth_orgs (provider, external_org_id, tenant_id) VALUES
      ('clerk', 'org_cinder', 'cinderandcrown'),
      ('clerk', 'org_revival', 'revivalcoffee');
    CREATE ROLE tester LOGIN;
    GRANT app_service TO tester;
  `);
  await db.exec("SET ROLE tester");

  await sql.query("BEGIN");
  await assumeService(sql);
  const lookup = sqlOrgTenantLookup(sql);
  assert.equal(await lookup("org_cinder"), "cinderandcrown");
  assert.equal(await lookup("org_revival"), "revivalcoffee");
  assert.equal(await lookup("org_unknown"), null);
  await sql.query("SELECT set_config('app.tenant_id', 'cinderandcrown', true)");
  // Another tenant's row is outside the write policy, so the update touches nothing.
  const hijack = await sql.query<{ n: number }>(
    "WITH u AS (UPDATE tenant_auth_orgs SET tenant_id = 'cinderandcrown' WHERE external_org_id = 'org_revival' RETURNING 1) SELECT count(*)::int AS n FROM u",
  );
  assert.equal(hijack.rows[0]?.n, 0);
  assert.equal(await lookup("org_revival"), "revivalcoffee");
  // A new row cannot point an org at a tenant other than the bound one.
  await assert.rejects(
    sql.query(
      "INSERT INTO tenant_auth_orgs (provider, external_org_id, tenant_id) VALUES ('clerk', 'org_x', 'revivalcoffee')",
    ),
  );
  await sql.query("ROLLBACK");

  await sql.query("BEGIN");
  await assumeService(sql);
  await sql.query("SELECT set_config('app.tenant_id', 'cinderandcrown', true)");
  const moved = await sql.query<{ n: number }>(
    "WITH u AS (DELETE FROM tenant_auth_orgs WHERE external_org_id = 'org_revival' RETURNING 1) SELECT count(*)::int AS n FROM u",
  );
  assert.equal(moved.rows[0]?.n, 0);
  await sql.query("ROLLBACK");
  await db.close();
});
