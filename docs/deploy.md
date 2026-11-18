# Deploy the One Hope demo

This puts the Staff Command Center, the member page, and the HTTP API on Vercel, with the demo store saved in hosted Postgres. Invented records stay labeled Sample. Do not put real member data in this database. Do not commit connection strings or keys.

## What you need

Set these in the Vercel project (Production and Preview). Names only; values stay in the host.

| Name                           | Required                    | Notes                                                                                                                |
| ------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Yes, for a shared live demo | Neon pooled connection string, or the Supabase transaction pooler URI. `POSTGRES_URL` is accepted as the same thing. |
| `ONEHOPE_ENV`                  | Yes                         | Set to `demo`. `production` refuses to boot this store.                                                              |
| `MASTER_ADMIN_PRIMARY_EMAIL`   | No                          | Defaults to `nicholas.will@cinderandcrown.com`.                                                                      |
| `MASTER_ADMIN_PRIMARY_NAME`    | No                          | Defaults to `Nicholas Will`.                                                                                         |
| `MASTER_ADMIN_SECONDARY_NAME`  | No                          | Defaults to `Lead Pastor`.                                                                                           |
| `MASTER_ADMIN_SECONDARY_EMAIL` | Leave unset                 | The second Master Admin seat stays empty until this is set.                                                          |
| `FIELD_ENCRYPTION_KEY`         | No                          | 32-byte key, base64. Empty uses the demo key. Do not invent one in git.                                              |
| `YOUTUBE_CHANNEL_ID`           | No                          | Defaults to the public One Hope channel.                                                                             |

Leave Stripe, Planning Center, Resend, Twilio, Facebook, and Apple Pay flags unset. Giving stays a demo and nothing is sent.

## Steps

1. Create a Vercel project from `cinderandcrown/onehope-ios`. Root directory is `web`. The install still uses the workspace lockfile at the repository root.
2. Provision Postgres. On this Vercel team the preferred path is the Neon marketplace integration (`vercel integration add neon`), which writes `DATABASE_URL` for you. Supabase is the other preferred host: create a project, run nothing in the Data API for these tables, and paste the pooler URI into `DATABASE_URL`.
3. Set `ONEHOPE_ENV=demo`. Do not set `MASTER_ADMIN_SECONDARY_EMAIL`.
4. From a machine that has the database URL in its environment, apply the migrations and seed the labeled demo:

   ```bash
   npm ci
   node --import tsx server/scripts/seed.ts
   ```

   The script reads `DATABASE_URL` or `POSTGRES_URL`. It does not print the URL. Re-running it skips migrations that already applied. It fills `households` and the other RLS tables only when `households` is empty, then saves the demo snapshot.

5. Deploy the branch. Open `/` for the staff Command Center and `/member` for the member demo. `/member` is a PWA (`manifest.webmanifest`, Apple web app title One Hope). Add it to a phone home screen from the browser share sheet.
6. Point a future iPhone build at the same origin with `API_BASE_URL` or the launch argument `-apiBaseURL`. The simulator CI argument still wins, so tests keep using the local API.

## How to tell it is live

`GET /api/health` includes `"persistence":"postgres"` when a database URL is present, and `"persistence":"memory"` when it is not. Memory mode is what CI uses. It is not a shared demo: each server instance would keep its own copy.

Staff preview and the member page both read that same snapshot, so a change made in one shows in the other after the next request.

## What this deploy is not

Live card charges, live Planning Center, email, SMS, and push stay off. The phone pickup screen is still a local practice check. The Lead Pastor seat is still waiting on `MASTER_ADMIN_SECONDARY_EMAIL`.
