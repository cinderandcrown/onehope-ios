-- Retention settings for one church. Safe to apply once; the migration
-- runner records the version and will not run this file again.
-- INSERT uses ON CONFLICT so a restored database that already has the rows
-- does not fail if an operator runs the file by hand.

CREATE TABLE IF NOT EXISTS retention_settings (
  domain text PRIMARY KEY,
  years integer NOT NULL CHECK (years > 0 AND years <= 50)
);

INSERT INTO retention_settings (domain, years) VALUES
  ('audit', 7),
  ('giving', 7),
  ('care', 7),
  ('kids', 7)
ON CONFLICT (domain) DO NOTHING;

CREATE TABLE IF NOT EXISTS sync_cursors (
  idempotency_key text PRIMARY KEY,
  job_name text NOT NULL,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
