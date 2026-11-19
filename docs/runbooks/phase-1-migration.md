# Phase 1 migration and rollback

Do this before the new server is the one answering production traffic. Do not run it against production from a laptop that prints `DATABASE_URL`.

## What changes

`0004_tenancy.sql` adds tenants, accounts, memberships, and the tables that hold the live church. Row level security is forced. The request path stops reading `demo_runtime`.

The importer copies that blob once:

1. It writes a copy to `demo_runtime_backup` and leaves `demo_runtime` in place.
2. It upserts rows for tenant `onehope`.
3. It checks people, gifts, children, sessions, prayers, groups, events, and notes counts.
4. It records the result in `snapshot_imports`. A later request does not read the blob.

Sample people (`sample: true` or `@sample.onehope`) are refused when `ONEHOPE_ENV=production`.

## Apply

```bash
npm ci
node --import tsx server/scripts/seed.ts
```

`seed.ts` applies migrations and imports the blob when `DATABASE_URL` or `POSTGRES_URL` is set. It does not print the URL. Run it once, then deploy this release. Deploying first is safe only if `snapshot_imports` is written before members use the new server: the first request also imports, under an advisory lock, and will not import a second time.

After import, `SELECT status, row_counts FROM snapshot_imports WHERE id = 'legacy-blob';` should show `imported` and the counts you expect. `demo_runtime` should still hold the original payload.

## Tenants

| Slug | What it is |
| --- | --- |
| `onehope` | The church. Hosts include `onehope-beryl.vercel.app`, `weareonehope.com`, and `localhost`. |
| `revivalcoffee` | The shop. Pickup only. Linked from One Hope. No church rows. |
| `cinderandcrown` | The platform operator's own tenant. Generic modules only. |

`TENANT_MODE=single` and `TENANT_ID` pin one deployment to one tenant. Otherwise the tenant comes from the `Host` header. A client-sent tenant id is ignored.

`CONTENT_SALVATION_BAPTISM_APPROVED` stays unset until a pastor approves that wording. Scripture still shows.

## Rollback

The previous release reads `demo_runtime` and ignores the new tables.

1. Point Vercel back at the previous deployment. Do not delete the database.
2. If this release has taken new signups you need to keep, they exist only in the tenant tables. Export them first (`exportTenant` in `server/src/tenant-bundle.ts`) or accept that a code rollback returns to the blob from before those signups.
3. If `demo_runtime` was edited by hand after the backup, restore it from `demo_runtime_backup` before the old release serves traffic:

   ```sql
   UPDATE demo_runtime AS live
   SET payload = backup.payload, updated_at = now()
   FROM demo_runtime_backup AS backup
   WHERE live.id = backup.id;
   ```

4. `server/migrations/rollback/0004_tenancy_down.sql` drops the new tables and the append-only trigger. Run it only when you intend to remove the tenant schema. It is not applied by `migrate()`. The audit trigger rejects `UPDATE` and `DELETE` until that file drops the trigger.

Secrets are not in a tenant export. Reconnect each provider after a restore.
