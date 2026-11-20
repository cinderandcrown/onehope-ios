import { createClerkClient, verifyToken } from "@clerk/backend";
import { z } from "zod";

import type { SqlClient } from "./migrate";

/**
 * Clerk sign-in behind AuthProvider (decision D1).
 *
 * One Clerk Organization is one tenant. The server reads the active org from the Clerk session
 * token after verifying its signature, confirms the user is still a member of that org with the
 * Clerk Backend API, and maps the org to a tenant with a database row (tenant_auth_orgs).
 * Nothing the client sends (a header, query, cookie, or body field) can choose the tenant.
 *
 * Step-up maps to Clerk reverification. The session token's fva claim says how many minutes ago
 * the user last proved each factor. A request that needs step-up and fails the check gets the
 * reverification error body that Clerk's useReverification() hook knows how to handle.
 */

export const clerkEnvSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  /** PEM public key from the Clerk dashboard. Lets the server verify tokens without a network call. */
  CLERK_JWT_KEY: z.string().min(1).optional(),
  /** Comma-separated origins allowed in the token's azp claim, e.g. https://os.example.com */
  CLERK_AUTHORIZED_PARTIES: z.string().min(1),
  /** Minutes a reverification counts as fresh. Defaults to 5, same as local step-up. */
  CLERK_STEP_UP_MINUTES: z.coerce.number().int().min(1).max(60).optional(),
});

export type ClerkEnv = z.infer<typeof clerkEnvSchema>;

export function loadClerkEnv(env: NodeJS.ProcessEnv = process.env): ClerkEnv {
  const parsed = clerkEnvSchema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Clerk is not configured. Missing or invalid: ${names}`);
  }
  return parsed.data;
}

const orgClaimV2 = z.object({
  id: z.string().min(1),
  rol: z.string().optional(),
  slg: z.string().optional(),
});

export const clerkClaimsSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1),
  v: z.number().optional(),
  o: orgClaimV2.optional(),
  org_id: z.string().optional(),
  org_role: z.string().optional(),
  fva: z.tuple([z.number(), z.number()]).optional(),
  sts: z.string().optional(),
  act: z.object({ sub: z.string() }).passthrough().optional(),
});

export type ClerkClaims = z.infer<typeof clerkClaimsSchema>;

export type ClerkMembership = { orgId: string; role: string };

/** The two Clerk calls this module needs. Tests pass a fake. */
export type ClerkGateway = {
  /** Verifies signature, expiry, and azp. Throws when the token is not valid. */
  verifySessionToken(token: string): Promise<unknown>;
  listMemberships(userId: string): Promise<ClerkMembership[]>;
};

/** Maps a verified Clerk org id to a tenant id. Reads tenant_auth_orgs. */
export type OrgTenantLookup = (orgId: string) => Promise<string | null>;

export type StepUpLevel = "first_factor" | "second_factor" | "multi_factor";

export type StepUpPolicy = { level: StepUpLevel; afterMinutes: number };

export function defaultStepUpPolicy(env: Partial<ClerkEnv> = {}): StepUpPolicy {
  return { level: "second_factor", afterMinutes: env.CLERK_STEP_UP_MINUTES ?? 5 };
}

export type ClerkIdentity = {
  provider: "clerk";
  userId: string;
  sessionId: string;
  orgId: string;
  orgRole: string;
  tenantId: string;
  /** True when the user re-proved their factors within the policy window. Goes into app.step_up. */
  stepUp: boolean;
  /** Set when the session is driven by an agent or an impersonating admin. Never counts as a human approval. */
  actor: string | null;
};

export class ClerkAuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: "unauthenticated" | "no_active_org" | "not_a_member" | "unknown_org" | "pending_session",
    message: string,
  ) {
    super(message);
    this.name = "ClerkAuthError";
  }
}

/** Reads the active org from v1 (org_id) or v2 (o.id) session claims. */
export function activeOrg(claims: ClerkClaims): { id: string; role: string } | null {
  if (claims.o?.id) return { id: claims.o.id, role: claims.o.rol ?? "" };
  if (claims.org_id) return { id: claims.org_id, role: claims.org_role ?? "" };
  return null;
}

/**
 * Same rule as Clerk's reverification check, with one stricter case: an agent or impersonated
 * session (act claim) never passes step-up.
 * fva[n] is minutes since that factor was last verified, or -1 if never.
 */
export function reverificationSatisfied(claims: ClerkClaims, policy: StepUpPolicy): boolean {
  if (claims.act) return false;
  if (!claims.fva) return false;
  const [factor1Age, factor2Age] = claims.fva;
  const fresh = (age: number) => age !== -1 && age < policy.afterMinutes;
  switch (policy.level) {
    case "first_factor":
      return fresh(factor1Age);
    case "second_factor":
      return factor2Age !== -1 ? fresh(factor2Age) : fresh(factor1Age);
    case "multi_factor":
      return factor2Age === -1 ? fresh(factor1Age) : fresh(factor1Age) && fresh(factor2Age);
  }
}

/** 403 body that Clerk's useReverification() hook recognizes and answers with its modal. */
export function reverificationErrorBody(policy: StepUpPolicy) {
  return {
    clerk_error: {
      type: "forbidden" as const,
      reason: "reverification-error" as const,
      metadata: { reverification: { level: policy.level, afterMinutes: policy.afterMinutes } },
    },
  };
}

/** Bearer header first, then Clerk's __session cookie. Nothing else is read from the request. */
export function sessionTokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "__session" && rest.length > 0) {
      const token = decodeURIComponent(rest.join("="));
      if (token) return token;
    }
  }
  return null;
}

export type ResolveDeps = {
  gateway: ClerkGateway;
  lookupTenant: OrgTenantLookup;
  stepUp?: StepUpPolicy;
};

/**
 * Turns a request into a tenant-bound identity.
 * The only input is the signed session token. There is deliberately no tenant parameter.
 */
export async function authenticateClerkRequest(request: Request, deps: ResolveDeps): Promise<ClerkIdentity> {
  const token = sessionTokenFrom(request);
  if (!token) throw new ClerkAuthError(401, "unauthenticated", "Sign in to continue.");
  return resolveClerkSession(token, deps);
}

export async function resolveClerkSession(token: string, deps: ResolveDeps): Promise<ClerkIdentity> {
  let raw: unknown;
  try {
    raw = await deps.gateway.verifySessionToken(token);
  } catch {
    throw new ClerkAuthError(401, "unauthenticated", "Your session is not valid. Sign in again.");
  }
  const parsed = clerkClaimsSchema.safeParse(raw);
  if (!parsed.success)
    throw new ClerkAuthError(401, "unauthenticated", "Your session is not valid. Sign in again.");
  const claims = parsed.data;
  if (claims.sts === "pending") {
    throw new ClerkAuthError(403, "pending_session", "Finish setting up your account first.");
  }
  const org = activeOrg(claims);
  if (!org) throw new ClerkAuthError(403, "no_active_org", "Choose an organization to continue.");

  const memberships = await deps.gateway.listMemberships(claims.sub);
  const membership = memberships.find((row) => row.orgId === org.id);
  if (!membership)
    throw new ClerkAuthError(403, "not_a_member", "You are not a member of this organization.");

  const tenantId = await deps.lookupTenant(org.id);
  if (!tenantId)
    throw new ClerkAuthError(403, "unknown_org", "This organization is not set up on the platform.");

  return {
    provider: "clerk",
    userId: claims.sub,
    sessionId: claims.sid,
    orgId: org.id,
    // The role comes from Clerk's membership record, not from the token, so a role change applies at once.
    orgRole: membership.role,
    tenantId,
    stepUp: reverificationSatisfied(claims, deps.stepUp ?? defaultStepUpPolicy()),
    actor: claims.act?.sub ?? null,
  };
}

/**
 * Reads tenant_auth_orgs as app_service. Call inside the request transaction after
 * SET LOCAL ROLE app_service and before app.tenant_id is set. The route policy allows that read.
 */
export function sqlOrgTenantLookup(sql: SqlClient): OrgTenantLookup {
  return async (orgId) => {
    const found = await sql.query<{ tenant_id: string }>(
      "SELECT tenant_id FROM tenant_auth_orgs WHERE provider = 'clerk' AND external_org_id = $1",
      [orgId],
    );
    return found.rows[0]?.tenant_id ?? null;
  };
}

/** The live gateway. Needs the env vars in clerkEnvSchema. Not used by tests. */
export function createClerkGateway(env: ClerkEnv): ClerkGateway {
  const client = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  const authorizedParties = env.CLERK_AUTHORIZED_PARTIES.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    async verifySessionToken(token) {
      const result = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
        jwtKey: env.CLERK_JWT_KEY,
        authorizedParties,
      });
      if (result.errors) throw new Error("token rejected");
      return result.data;
    },
    async listMemberships(userId) {
      const out: ClerkMembership[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await client.users.getOrganizationMembershipList({ userId, limit: 100, offset });
        for (const row of page.data) out.push({ orgId: row.organization.id, role: row.role });
        if (page.data.length < 100) break;
      }
      return out;
    },
  };
}
