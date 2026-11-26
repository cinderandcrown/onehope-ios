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

## Record the blob checksum

Run this before the import and keep the value. The import must not change it.

```sql
SELECT md5(payload) AS before_import FROM demo_runtime WHERE id = 'church';
```

## Pre-flight counts

These tables already have rows. `0004` adds `tenant_id` as nullable, backfills `onehope`, then sets the column `NOT NULL`. Write the counts down so you can compare them after the import.

```sql
SELECT 'households' AS table_name, count(*) FROM households
UNION ALL SELECT 'people', count(*) FROM people
UNION ALL SELECT 'gifts', count(*) FROM gifts
UNION ALL SELECT 'kids', count(*) FROM kids
UNION ALL SELECT 'care_notes', count(*) FROM care_notes
UNION ALL SELECT 'care_note_shares', count(*) FROM care_note_shares
UNION ALL SELECT 'prayers', count(*) FROM prayers
UNION ALL SELECT 'background_checks', count(*) FROM background_checks
UNION ALL SELECT 'audit_log', count(*) FROM audit_log;
```

## Freeze writes

Do every item before the import. The old server writes `demo_runtime` on each request, so a write during the import is a row the new tables will miss.

1. Tell the staff not to use the Command Center or the member site until you say the window is over.
2. In Vercel, open the **onehope** project, Deployments, Production, and pause production. If pause is not available, set a maintenance response that returns 503 for `/api/*` without touching the database.
3. Confirm the pause: a request to `https://onehope-beryl.vercel.app/api/health` fails or returns the maintenance response, and it does not write.
4. Run `SELECT md5(payload) FROM demo_runtime WHERE id = 'church'` again. If it differs from the value you recorded, write down the new value and use that as `before_import`.
5. If you cannot pause, run the import once now and a second time immediately before the new deployment starts. The second run upserts rows whose blob checksum changed and does not delete rows that exist only in the tables.

## Import

```bash
npm ci
node --import tsx server/scripts/seed.ts
```

The script takes advisory lock `14012` while it applies migrations, then lock `14011` while it reads `demo_runtime` and upserts tenant `onehope`. It does not update `demo_runtime`.

Verify:

```sql
SELECT status, source_checksum, row_counts FROM snapshot_imports WHERE id = 'legacy-blob';
SELECT md5(payload) AS after_import FROM demo_runtime WHERE id = 'church';
```

`after_import` must equal the `before_import` value you recorded. The script also stores a sha256 of the exact payload and refuses to finish if the payload changes mid-import. Repeat the pre-flight `count(*)` query. Households, people, gifts, kids, care notes, shares, prayers, background checks, and the audit log must be at least the counts you wrote down. `tenant_id` on those rows is `onehope`.

## Deploy and smoke test

1. Deploy this branch to a Vercel preview whose `DATABASE_URL` is not production. Do not point a preview at the production database.
2. On that preview, `GET /api/health` returns 200, and `GET /api/tenant` with `Host: localhost` returns tenant `onehope`.
3. Promote the production deployment only after the import's `after_import` checksum still matches.
4. Smoke test production without printing the connection string:
   - `GET /api/health` returns 200.
   - Open the member home page and confirm the Sherman Street address.
   - Sign in as a staff account you already control. A wrong password is rejected.
   - `GET /api/capabilities` returns YouTube as live and Stripe as not built.
5. Unpause production and tell staff the window is over.

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

Passwords live in `tenant_passwords`, one hash per tenant and person. The shared `accounts` row does not keep a password another tenant can use. `app_service` cannot select either table. TOTP secrets are encrypted in `people.totp_secret` and are not copied into `record`.
