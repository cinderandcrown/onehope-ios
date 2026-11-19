# Phase 1 migration and rollback

Do this in a maintenance window. The request path does not migrate and does not import the blob. Nothing in this runbook is a copy of the database into itself.

## Where the connection string is

Production `DATABASE_URL` is in the Vercel project **onehope**, Settings, Environment Variables, Production. Neon shows the same string under the project that Vercel attached. Do not copy it into git, a shell history you share, or this repository. Preview deployments must not use the production URL. That split is a separate change.

## Backup, before anything else

1. In the Neon console, create a branch of the production database, or set a PITR restore point and write down the timestamp.
2. Or, from a machine that already has the URL in its environment and does not print it:

   ```bash
   pg_dump --format=custom --file=onehope-pre-phase1.dump "$DATABASE_URL"
   ```

3. Confirm the dump or branch exists before you continue. `demo_runtime_backup` is not a backup.

## Freeze writes

Pause the Vercel production deployment, or put the app in maintenance, so the old server stops writing `demo_runtime` while you import. If you cannot pause, run the import twice: once now, and again immediately before the new deployment starts. The second run upserts rows whose blob checksum changed and does not delete rows that exist only in the tables.

## Import

```bash
npm ci
node --import tsx server/scripts/seed.ts
```

The script applies `0004_tenancy.sql`, takes an advisory lock, reads `demo_runtime`, and upserts tenant `onehope`. It does not update `demo_runtime`.

Verify:

```sql
SELECT status, source_checksum, row_counts FROM snapshot_imports WHERE id = 'legacy-blob';
SELECT md5(payload) FROM demo_runtime WHERE id = 'church';
```

The payload checksum must match the value you recorded before the import. `md5` here is only a spot check; the script stores a sha256 of the exact payload and refuses to finish if the payload changes mid-import.

Unknown hosts do not map to One Hope. `onehope-beryl.vercel.app`, `weareonehope.com`, and `localhost` do.

`CONTENT_SALVATION_BAPTISM_APPROVED` stays unset until a pastor approves that wording.

## Tenants

| Slug | What it is |
| --- | --- |
| `onehope` | The church |
| `revivalcoffee` | The shop. Pickup only. Linked from One Hope. No church rows |
| `cinderandcrown` | The platform operator's tenant. Generic modules only |

## Rollback

1. Restore the Neon branch or the `pg_dump` if the new tables must disappear. That is the real undo.
2. Or point Vercel back at the previous deployment. The previous release reads `demo_runtime`, which this import does not change. Signups that exist only in the new tables are not in the blob. Export them first if you need them.
3. `server/migrations/rollback/0004_tenancy_down.sql` deletes the `0004_tenancy` row from `schema_migrations`, drops the new tables, drops forced RLS and the new policies on the original tables, and restores the original policies. `migrate()` does not run it. Run it only after the backup restore decision above.

Passwords for the relational store live on `accounts`, not in the person JSON. `app_service` cannot select that table. TOTP secrets are encrypted in `people.totp_secret` and are not copied into `record`.
