-- Phase 2a: people and care foundation. Care profiles (stage, last contact), tags, who has which tag,
-- and the touch log (calls, texts, visits). Names, phones, notes and addresses stay inside `record`,
-- and anything personal in a record is encrypted by the app before it is written.

CREATE TABLE IF NOT EXISTS person_profiles (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  person_id text NOT NULL,
  stage text NOT NULL DEFAULT 'guest',
  last_contact_at timestamptz,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tags (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  archived boolean NOT NULL DEFAULT false,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS person_tags (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  person_id text NOT NULL,
  tag_id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS interactions (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  person_id text NOT NULL,
  kind text NOT NULL,
  outcome text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS person_profiles_person_idx ON person_profiles (tenant_id, person_id);
CREATE INDEX IF NOT EXISTS person_profiles_stage_idx ON person_profiles (tenant_id, stage);
CREATE INDEX IF NOT EXISTS person_profiles_contact_idx ON person_profiles (tenant_id, last_contact_at);
CREATE UNIQUE INDEX IF NOT EXISTS person_tags_pair_idx ON person_tags (tenant_id, person_id, tag_id);
CREATE INDEX IF NOT EXISTS person_tags_tag_idx ON person_tags (tenant_id, tag_id);
CREATE INDEX IF NOT EXISTS interactions_person_idx ON interactions (tenant_id, person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS interactions_recent_idx ON interactions (tenant_id, created_at DESC);

ALTER TABLE person_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
ALTER TABLE person_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_service ON person_profiles;
CREATE POLICY tenant_service ON person_profiles FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON person_profiles;
CREATE POLICY tenant_user ON person_profiles FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_service ON tags;
CREATE POLICY tenant_service ON tags FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON tags;
CREATE POLICY tenant_user ON tags FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_service ON person_tags;
CREATE POLICY tenant_service ON person_tags FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON person_tags;
CREATE POLICY tenant_user ON person_tags FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_service ON interactions;
CREATE POLICY tenant_service ON interactions FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON interactions;
CREATE POLICY tenant_user ON interactions FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON person_profiles, tags, person_tags, interactions TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON person_profiles, tags, person_tags, interactions TO app_user;
