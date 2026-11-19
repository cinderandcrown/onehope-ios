# Hosted demo state lives in Postgres

Superseded for the request path by [0007](0007-tenant-aware-platform.md). `demo_runtime` remains only as the import source and the rollback copy.

The access rules are still implemented in `ChurchStore`. With `DATABASE_URL` or `POSTGRES_URL`, each request loads and saves tenant rows. It does not rewrite a JSON snapshot. A read that changes nothing writes nothing.

`ONEHOPE_ENV=production` boots when `FIELD_ENCRYPTION_KEY` is set. It refuses to boot without that key. It does not refuse the relational store. The Lead Pastor seat stays empty unless `MASTER_ADMIN_SECONDARY_EMAIL` is set.
