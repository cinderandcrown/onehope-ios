-- Phase 2c: one-time people import, duplicate merges, and saved lists.
-- Names, phones, notes and the undo snapshot stay inside `record` (the app encrypts the snapshot).
-- Plain columns are only status and filters. This is a file import, not a Planning Center connection.

ALTER TABLE people ADD COLUMN IF NOT EXISTS import_id text;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS import_id text;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT '';
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS faith_steps text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS people_import_idx ON people (tenant_id, import_id);
CREATE INDEX IF NOT EXISTS person_profiles_import_idx ON person_profiles (tenant_id, import_id);

CREATE TABLE IF NOT EXISTS people_imports (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  status text NOT NULL DEFAULT 'receiving',
  created_by text,
  undo_until timestamptz,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS person_merges (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  kept_id text NOT NULL,
  merged_id text NOT NULL,
  by_id text,
  kind text NOT NULL DEFAULT 'merge',
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS saved_lists (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  owner_id text,
  shared boolean NOT NULL DEFAULT false,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS people_imports_status_idx ON people_imports (tenant_id, status, undo_until);
CREATE INDEX IF NOT EXISTS person_merges_kept_idx ON person_merges (tenant_id, kept_id);
CREATE INDEX IF NOT EXISTS person_merges_merged_idx ON person_merges (tenant_id, merged_id);
CREATE INDEX IF NOT EXISTS saved_lists_owner_idx ON saved_lists (tenant_id, owner_id);

ALTER TABLE people_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_imports FORCE ROW LEVEL SECURITY;
ALTER TABLE person_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_merges FORCE ROW LEVEL SECURITY;
ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_lists FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_service ON people_imports;
CREATE POLICY tenant_service ON people_imports FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON people_imports;
CREATE POLICY tenant_user ON people_imports FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_service ON person_merges;
CREATE POLICY tenant_service ON person_merges FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON person_merges;
CREATE POLICY tenant_user ON person_merges FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_service ON saved_lists;
CREATE POLICY tenant_service ON saved_lists FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON saved_lists;
CREATE POLICY tenant_user ON saved_lists FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON people_imports, person_merges, saved_lists TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON people_imports, person_merges, saved_lists TO app_user;
