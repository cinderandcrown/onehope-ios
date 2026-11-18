# Hosted demo state lives in Postgres

The access rules are implemented and tested in `ChurchStore`. The SQL migrations are the same rules, tested with PGlite, but they do not yet execute every screen. A serverless host cannot keep the store in memory across requests.

When `DATABASE_URL` or `POSTGRES_URL` is set, each request loads a versioned snapshot from `demo_runtime`, runs the store, and writes the snapshot back under a transaction lock. The first time the relational tables exist and are empty, the same snapshot's labeled demo rows are inserted there too. Passwords and TOTP secrets stay in the snapshot, not in those tables. Medical and gift plaintext stay ciphertext.

`ONEHOPE_ENV=production` still refuses this store. The public demo stays in demo mode until a real encryption key and a real cutover exist. The Lead Pastor seat stays empty unless `MASTER_ADMIN_SECONDARY_EMAIL` is set in the host environment.
