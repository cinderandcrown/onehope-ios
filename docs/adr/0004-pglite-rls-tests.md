# RLS tests run on PGlite

pgTAP is the usual way to assert policies. PGlite, which CI can run without a database service, does not include that extension. `server/test/rls.test.ts` applies the migrations, switches to a non-owner `app_user`, and asserts the policies. Superusers bypass RLS, so the test does not run as the default PGlite role.

Read auditing stays in the application. Postgres has no `SELECT` trigger. The API records Tier 3 reads. The SQL role cannot select another household's rows, so the unlogged path is not available to the app user.
