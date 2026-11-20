# Pastor beta cutover: demo database to production

The TestFlight beta can run against a **Preview** deployment backed by its own demo Postgres. That keeps real church data out of the beta until the production Phase 1 migration is done. Cutover is a pointer change, not a data copy.

## Today

| Piece          | Preview (beta)                                                                                   | Production                                                    |
| -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `DATABASE_URL` | Preview-scoped Vercel var that points at a separate demo Neon project                            | Production-scoped Vercel var (unchanged)                      |
| Schema         | Migrations 0001–0005 applied, seeded by `server/scripts/seed.ts` with `ONEHOPE_SAMPLE_DATA=true` | Still the build 8 schema. Phase 1 (0004/0005) not yet applied |
| Data           | Sample people (`@sample.onehope`) plus the App Review demo account                               | Real church data                                              |

The demo database is disposable. Drop and re-seed it whenever you like. Nothing in it is church data.

Preview-only env vars that go with the demo database: `DATABASE_URL` (sensitive), `TENANT_MODE=single` with `TENANT_ID=onehope`, because preview hostnames are not in `tenant_domains`, and `ONEHOPE_SAMPLE_DATA=true`. None of them are set for Production.

## Swap the demo database (hot-swap)

1. Create or reset a demo Postgres. For example, create a new Neon project, or reset the existing one's branch.
2. Run, from a machine with the URL in its environment (do not print it):
   ```bash
   DATABASE_URL="<demo unpooled url>" ONEHOPE_ENV=demo ONEHOPE_SAMPLE_DATA=true node --import tsx server/scripts/seed.ts
   ```
3. Update the Preview-scoped `DATABASE_URL` in Vercel (pooled URL), then redeploy the preview. Env vars are read at boot.
4. Recreate the App Review demo account with in-app sign-up, and keep its credentials outside the repo.

If the demo project was a Neon "claimable" project, claiming it rotates its password. After a claim, update the Preview `DATABASE_URL` and redeploy.

## Cut the beta over to production

Do this only after `docs/runbooks/phase-1-migration.md` has been completed on production: backup, write freeze, `seed.ts`, checksum and count checks, and the production deploy of this branch.

Pick one:

- **Point the app at production (preferred).** The iOS app's API base URL is the stable production hostname. Ship a TestFlight build whose API base URL is the production hostname, or, if the beta build already uses a stable alias you control, move that alias from the preview deployment to production.
- **Point the preview at production data (not recommended).** Changing the Preview `DATABASE_URL` to production would let every preview deployment write production data. Don't.

After cutover:

1. Create the App Review demo account on production (see `app_review_notes`, kept outside the repo), add one test child and one test prayer, and record the credentials outside the repo.
2. Smoke test production: `/api/health` 200, Home shows Sunday 10:30 a.m. in Chicago time, photos load, sign-in works, account deletion works on a throwaway account.
3. Leave the demo database in place for later betas, or delete it.
