# Tenant-aware platform

Supersedes [0001](0001-one-church-household-privacy.md).

One Hope is tenant `onehope` on a platform Cinder & Crown owns. Revival Coffee is tenant `revivalcoffee`, its own merchant, linked from One Hope by a `tenant_links` row and sharing no data unless that link is read by the church app. Cinder & Crown runs on the same code as tenant `cinderandcrown`. Later customers are more rows, not forks.

## Decisions

1. Every tenant-owned table has `tenant_id`, an index, and forced row level security. The request sets `app.tenant_id` with `set_config(..., true)` inside the transaction, then `SET LOCAL ROLE app_service`. Policies key on that setting. A client-sent tenant id is ignored. The tenant comes from `TENANT_MODE=single` or from the `Host` header via `tenant_domains` (and the built-in host map). Household privacy from ADR 0001 stays on gifts, kids, care notes, prayers, and background checks for `app_user`.
2. `accounts` are global login identities. `memberships` hold the role for one tenant. Church roles stay the existing eight. Shop roles (`shop_owner`, `shop_manager`, `barista`, `customer`) and `platform_operator` are additional. A platform operator is not a tenant admin: the role cannot read Tier 3 data, and `operator_grants` is empty unless a tenant admin approves a time-boxed grant. That approval screen is not built in this phase.
3. The live church document is stored as rows. A request loads the tenant's rows, runs the existing `ChurchStore` rules, and writes only the rows that changed. It does not read or write `demo_runtime`. The one-time importer in `snapshot-import.ts` is the only code that reads the blob, and only until `snapshot_imports` says the blob was imported or was absent. A second request does not touch it.
4. `audit_log` is append-only. `app_user` and `app_service` have no update or delete grant, and a trigger rejects both statements.
5. `outbox_jobs` is the durable side-effect queue. Delivery adapters stay dry-run until a tenant credential exists, so a job can be recorded and retried without sending.
6. Integration secrets live in `tenant_integrations`, encrypted with a key derived per tenant from `FIELD_ENCRYPTION_KEY` (HKDF). The bundle exporter strips ciphertext. Adapters read this table. They do not report themselves live unless the code path exists and the credential is present. YouTube's public Atom feed is the exception: it needs no secret.
7. Auth stays the current password and TOTP implementation behind `AuthProvider`. Clerk is not adopted (decision D1 is still open). The database host stays the existing Postgres (Neon in production). `TENANT_MODE=single` is the seam for a later dedicated database (decision D2 is still open).
8. Revival ordering is pickup-only. `pickup_settings.delivery_enabled` is false. Payments for the shop stay behind the adapter; no processor is selected.
9. The iOS app targets 18.0. The phone shows five tabs: Home, Watch, Know Jesus, Prayer, and Connect. Give is a screen inside Connect because the iPhone tab bar shows five items. Sunday remains 1251 S. Sherman St., Ste. 112, Richardson, TX 75081. Church-authored salvation and baptism wording stays behind `CONTENT_SALVATION_BAPTISM_APPROVED` until a pastor turns that on. King James verses still show.

## What this phase does not do

Children's Church station behavior, Planning Center import, live card charges, email, SMS, push delivery, and the Revival menu and checkout are later phases. The interfaces exist. The capability page says so.

## Rollback

See `docs/runbooks/phase-1-migration.md`. The blob is copied to `demo_runtime_backup` before import and is left in place. Down SQL is `server/migrations/rollback/0004_tenancy_down.sql`. It is not applied by the migrator.
