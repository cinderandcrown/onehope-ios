# Tenant-aware platform

Supersedes [0001](0001-one-church-household-privacy.md).

One Hope is tenant `onehope` on a platform Cinder & Crown owns. Revival Coffee is tenant `revivalcoffee`, its own merchant, linked from One Hope by a `tenant_links` row and sharing no data unless that link is read by the church app. Cinder & Crown runs on the same code as tenant `cinderandcrown`. Later customers are more rows, not forks.

## Decisions

1. Every tenant-owned table has `tenant_id`, an index, and forced row level security. The request sets `app.tenant_id` with `set_config(..., true)` inside the transaction, then `SET LOCAL ROLE app_service`. Policies key on that setting. A client-sent tenant id is ignored. The tenant comes from `TENANT_MODE=single` or from the `Host` header via `tenant_domains` and the built-in host map. An unknown host is a 404. There is no default tenant. Household privacy from ADR 0001 stays on gifts, kids, care notes, prayers, and background checks for `app_user`. Migrations and the blob import run only from `server/scripts/seed.ts`.
2. `accounts` are global login identities. `memberships` hold the role for one tenant. The request role cannot select `accounts`. `link_membership` writes a password only when this tenant created the account or already owns that membership, so another tenant's signup cannot replace it. Login on the SQL path checks the hash loaded from `tenant_passwords` for the current tenant. The person `record` JSON does not contain `passwordHash` or `totpSecret`. TOTP is encrypted in `people.totp_secret`. Church roles stay the existing eight. Shop roles (`shop_owner`, `shop_manager`, `barista`, `customer`) and `platform_operator` are additional. A platform operator cannot read Tier 3 data. The break-glass screen is not built.
3. The live church document is stored as rows. A request loads the rows that request needs, runs the existing `ChurchStore` rules, and writes only the rows that changed. Health and tenant reads load no document. Other requests skip `audit_log` unless the audit route is open, and load only the session for the bearer token. The request path does not read or write `demo_runtime`. `server/scripts/seed.ts` is the only import. It takes an advisory lock, and a later run upserts rows when the blob checksum changed without deleting rows that exist only in the tables. Optimistic `row_version` checks reject a stale write.
4. `audit_log` is append-only. `app_user` and `app_service` have no update or delete grant, and a trigger rejects both statements.
5. `outbox_jobs` is the durable side-effect queue. Delivery adapters stay dry-run until a tenant credential exists, so a job can be recorded and retried without sending.
6. Integration secrets live in `tenant_integrations`, encrypted with a key derived per tenant from `FIELD_ENCRYPTION_KEY` (HKDF). The bundle exporter strips ciphertext. Adapters read this table. They do not report themselves live unless the code path exists and the credential is present. YouTube's public Atom feed is the exception: it needs no secret.
7. Auth stays the current password and TOTP implementation behind `AuthProvider`. Clerk is not adopted (decision D1 is still open). The database host stays the existing Postgres (Neon in production). `TENANT_MODE=single` is the seam for a later dedicated database (decision D2 is still open).
8. Revival ordering is pickup-only. `pickup_settings.delivery_enabled` is false. Payments for the shop stay behind the adapter; no processor is selected.
9. The iOS app targets 18.0. The phone shows five tabs: Home, Watch, Prayer, Give, and Connect. Know Jesus is a card on Home and a link inside Connect. Sunday remains 1251 S. Sherman St., Ste. 112, Richardson, TX 75081. Church-authored salvation and baptism wording stays behind `CONTENT_SALVATION_BAPTISM_APPROVED` until a pastor turns that on. King James verses still show.

## What this phase does not do

Children's Church station behavior, Planning Center import, live card charges, email, SMS, push delivery, and the Revival menu and checkout are later phases. The interfaces exist. The capability page says so.

## Rollback

See `docs/runbooks/phase-1-migration.md`. Back up with a Neon branch, a PITR restore point, or `pg_dump` before the script runs. The import does not modify `demo_runtime`. Down SQL is `server/migrations/rollback/0004_tenancy_down.sql`. It deletes the `0004_tenancy` migration row, drops forced RLS and the new policies on the original tables, and is not applied by the migrator.
