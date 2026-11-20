# Phase 0: the platform on Supabase Postgres, Clerk sign-in, and a tenant from a spec

This is the runbook for moving the shared platform database to Supabase and signing in with Clerk.
The church tenant stays on Neon until a separate cutover (`tenant:export` / `tenant:restore`). Nothing here touches it.

No keys, client data, or tenant config go in this repository. They live in host env vars and database rows.

## 1. Supabase project, used as plain Postgres

- Supabase Auth, PostgREST policies, and the Data API are not used. The server connects as `postgres`
  and drops to `app_service` with `SET LOCAL ROLE` inside each request transaction.
- Turn the Data API off: Project Settings → Data API → turn off **Enable Data API** (or untick
  "Enable Data API" when creating the project). Migration `0006_supabase_lockdown` also revokes every
  grant that Supabase's default privileges give `anon`, `authenticated`, and `service_role` on the
  `public` schema, so nothing is reachable even if the Data API is switched back on. `service_role`
  bypasses RLS, which is why it is revoked too.
- Connection strings (Project → Connect):
  - **Migrations and provisioning:** the direct connection (`db.<ref>.supabase.co:5432`, IPv6 only unless
    the paid IPv4 add-on is on) or the **session pooler** (`<region>.pooler.supabase.com:5432`). `migrate()`
    holds a session advisory lock, so do not run it through the transaction pooler.
  - **Vercel runtime:** the **transaction pooler** (`:6543`). Each request is one transaction with
    `SET LOCAL`, which is what transaction pooling supports. Vercel functions have no IPv6, so the direct
    host will not work there.
- TLS: set `DATABASE_CA_CERT` to Supabase's root CA (Project Settings → Database → SSL, download) to verify
  the server certificate. Without it, the `sslmode` in the URL applies.
- Driver: hosts ending in `.neon.tech` use `@neondatabase/serverless`; everything else uses `pg`.
  `DATABASE_DRIVER=pg|neon` overrides.

Apply migrations from a machine that has the URL in its environment (the script never prints it):

```bash
npm ci
DATABASE_URL="<session pooler or direct URL>" node --import tsx server/scripts/seed.ts
```

`seed.ts` also seeds the One Hope sample tenant into an empty database. To apply migrations only on the
Cinder & Crown database, call `migrate()` from a one-off script or run the live test below, which migrates first.

Check it on a throwaway database (never production):

```bash
TEST_DATABASE_URL="<throwaway database URL>" npm test
```

`server/test/postgres-live.test.ts` applies every migration twice, checks tenant isolation under
`app_service` on the real server, checks that `anon`, `authenticated`, and `service_role` reach no public
table, and removes the two throwaway tenants it creates. Without `TEST_DATABASE_URL` it skips.

## 2. Clerk behind AuthProvider

`AUTH_PROVIDER=clerk` selects `clerkAuthProvider`. Clerk owns passwords and MFA; the provider refuses
password calls. `server/src/clerk-auth.ts` resolves a request:

1. Reads the Clerk session token from `Authorization: Bearer` or the `__session` cookie. Nothing else.
2. Verifies it (`@clerk/backend` `verifyToken`, with `authorizedParties`).
3. Takes the active org from the signed claim (`o.id`, or `org_id` on v1 tokens).
4. Confirms with the Clerk Backend API that the user is still a member, and takes the role from that membership.
5. Maps the org to a tenant with the `tenant_auth_orgs` row. There is no tenant parameter anywhere.

Step-up is Clerk reverification. `fva` in the token is minutes since each factor was verified. The
default policy is `second_factor` within `CLERK_STEP_UP_MINUTES` (5, same as local step-up). A session
with an `act` claim (an agent or an impersonating admin) never passes step-up. When step-up is needed and
missing, return `reverificationErrorBody(policy)` with status 403; Clerk's `useReverification()` shows
its modal and retries.

Env vars (host only):

| Name                       | Notes                                                               |
| -------------------------- | ------------------------------------------------------------------- |
| `AUTH_PROVIDER`            | `clerk` to switch on. Unset keeps local auth.                       |
| `CLERK_SECRET_KEY`         | Clerk dashboard → API keys.                                         |
| `CLERK_PUBLISHABLE_KEY`    | Same page. Also `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for the web UI. |
| `CLERK_JWT_KEY`            | Optional PEM public key; verifies tokens without a network call.    |
| `CLERK_AUTHORIZED_PARTIES` | Comma-separated app origins allowed in the token's `azp`.           |
| `CLERK_STEP_UP_MINUTES`    | Optional, 1 to 60. Default 5.                                       |

In the Clerk dashboard: turn on Organizations, create one organization per tenant, and turn on MFA.

## 3. Provision a tenant from a spec kept outside git

The spec shape is in `docs/examples/tenant-spec.example.json`. Keep the real file outside the repository.

```bash
node --import tsx server/scripts/provision-tenant.ts --spec /secure/path/tenant.json             # dry run
PROVISION_CONFIRM_DATABASE=postgres DATABASE_URL="<url>" \
  node --import tsx server/scripts/provision-tenant.ts --spec /secure/path/tenant.json --apply
```

It is idempotent and runs in one transaction. The `tenants` row is written by the connecting role; module,
domain, and Clerk org rows are written as `app_service` with `app.tenant_id` bound, so forced RLS checks
each row. It refuses to change an existing tenant's kind, or to take a domain or Clerk org that belongs to
another tenant. `--apply` refuses unless `PROVISION_CONFIRM_DATABASE` matches the target database name.
