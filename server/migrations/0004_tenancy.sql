-- Tenant-aware schema. Supersedes the "no tenant_id" note in 0001.
-- Apply with a role that is not a superuser if you want RLS to bind that role.
-- app_service is the API role. app_user is the member role the RLS tests use.
-- demo_runtime is kept for rollback and is not granted to either role.

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO tenants (id, name, kind, timezone) VALUES
  ('onehope', 'One Hope', 'church', 'America/Chicago'),
  ('revivalcoffee', 'Revival Coffee', 'shop', 'America/Chicago'),
  ('cinderandcrown', 'Cinder & Crown', 'platform', 'America/Chicago')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_domains (
  host text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants (id)
);

INSERT INTO tenant_domains (host, tenant_id) VALUES
  ('onehope-beryl.vercel.app', 'onehope'),
  ('weareonehope.com', 'onehope'),
  ('www.weareonehope.com', 'onehope'),
  ('localhost', 'onehope'),
  ('127.0.0.1', 'onehope'),
  ('order.myrevivalcoffee.com', 'revivalcoffee')
ON CONFLICT (host) DO NOTHING;

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mfa_factors (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  kind text NOT NULL,
  secret_ciphertext text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snapshot_imports (
  id text PRIMARY KEY,
  status text NOT NULL,
  source_checksum text,
  row_counts text,
  imported_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo_runtime_backup (
  id text PRIMARY KEY,
  payload text NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE households ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE people ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE people ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS listed_in_directory boolean NOT NULL DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS last_ip text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS last_user_agent text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS sample boolean NOT NULL DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS record text;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS record text;
ALTER TABLE kids ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE kids ADD COLUMN IF NOT EXISTS record text;
ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS author_id text;
ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS sample boolean NOT NULL DEFAULT false;
ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS record text;
ALTER TABLE care_note_shares ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS sample boolean NOT NULL DEFAULT false;
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS record text;
ALTER TABLE background_checks ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE background_checks ADD COLUMN IF NOT EXISTS sample boolean NOT NULL DEFAULT false;
ALTER TABLE background_checks ADD COLUMN IF NOT EXISTS record text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'onehope';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS at_ms text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS record text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'households_tenant_fk') THEN
    ALTER TABLE households ADD CONSTRAINT households_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'people_tenant_fk') THEN
    ALTER TABLE people ADD CONSTRAINT people_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_tenant_fk') THEN
    ALTER TABLE gifts ADD CONSTRAINT gifts_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kids_tenant_fk') THEN
    ALTER TABLE kids ADD CONSTRAINT kids_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_notes_tenant_fk') THEN
    ALTER TABLE care_notes ADD CONSTRAINT care_notes_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_note_shares_tenant_fk') THEN
    ALTER TABLE care_note_shares ADD CONSTRAINT care_note_shares_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prayers_tenant_fk') THEN
    ALTER TABLE prayers ADD CONSTRAINT prayers_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_checks_tenant_fk') THEN
    ALTER TABLE background_checks ADD CONSTRAINT background_checks_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_tenant_fk') THEN
    ALTER TABLE audit_log ADD CONSTRAINT audit_log_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS households_tenant_idx ON households (tenant_id);
CREATE INDEX IF NOT EXISTS people_tenant_idx ON people (tenant_id);
CREATE INDEX IF NOT EXISTS gifts_tenant_idx ON gifts (tenant_id);
CREATE INDEX IF NOT EXISTS kids_tenant_idx ON kids (tenant_id);
CREATE INDEX IF NOT EXISTS care_notes_tenant_idx ON care_notes (tenant_id);
CREATE INDEX IF NOT EXISTS prayers_tenant_idx ON prayers (tenant_id);
CREATE INDEX IF NOT EXISTS background_checks_tenant_idx ON background_checks (tenant_id);
CREATE INDEX IF NOT EXISTS audit_log_tenant_idx ON audit_log (tenant_id);

CREATE TABLE IF NOT EXISTS memberships (
  id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  account_id text NOT NULL,
  person_id text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  person_id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_tenant_idx ON sessions (tenant_id);

CREATE TABLE IF NOT EXISTS alerts (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  person_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS proposals (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS station_duty (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  person_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS groups (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  group_id text,
  author_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS events (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS registrations (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  event_id text,
  person_id text,
  status text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS announcements (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS schedule_assignments (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  person_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS volunteers (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  person_id text NOT NULL,
  record text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS rooms (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS bookings (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS expenses (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  person_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS pathways (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  person_id text NOT NULL,
  record text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS visitors (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS care_requests (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  person_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS message_drafts (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS member_invites (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  token_hash text NOT NULL,
  email text NOT NULL DEFAULT '',
  expires_ms text,
  record text,
  PRIMARY KEY (tenant_id, token_hash)
);

CREATE TABLE IF NOT EXISTS follow_ups (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  person_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS streaks (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  person_id text NOT NULL,
  record text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  bucket_key text NOT NULL,
  record text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, bucket_key)
);

CREATE TABLE IF NOT EXISTS prayer_amens (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  prayer_id text NOT NULL,
  person_id text NOT NULL,
  PRIMARY KEY (tenant_id, prayer_id, person_id)
);

CREATE TABLE IF NOT EXISTS my_five (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  person_id text NOT NULL,
  record text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS testimonies (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  author_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS milestones (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS outreach_events (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS outreach_rsvps (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  outreach_id text,
  person_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS coffee_orders (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  person_id text,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS social_links (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tenant_modules (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  module_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, module_id)
);

CREATE TABLE IF NOT EXISTS tenant_themes (
  tenant_id text PRIMARY KEY REFERENCES tenants (id),
  tokens text NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tenant_integrations (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  provider text NOT NULL,
  mode text NOT NULL DEFAULT 'dry_run',
  credentials_ciphertext text,
  key_id text NOT NULL DEFAULT 'tenant',
  last4 text NOT NULL DEFAULT '',
  scopes text NOT NULL DEFAULT '',
  connected_by text,
  connected_at timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS tenant_links (
  tenant_id text NOT NULL REFERENCES tenants (id),
  from_tenant text NOT NULL REFERENCES tenants (id),
  to_tenant text NOT NULL REFERENCES tenants (id),
  kind text NOT NULL,
  show_in_app boolean NOT NULL DEFAULT false,
  PRIMARY KEY (from_tenant, to_tenant, kind)
);

CREATE TABLE IF NOT EXISTS locations (
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  id text NOT NULL,
  name text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'America/Chicago',
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS outbox_jobs (
  id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  job_name text NOT NULL,
  idempotency_key text NOT NULL,
  payload text NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS webhook_inbox (
  id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  provider text NOT NULL,
  event_id text NOT NULL,
  payload text NOT NULL DEFAULT '{}',
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, provider, event_id)
);

CREATE TABLE IF NOT EXISTS exports (
  id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  schema_version text NOT NULL DEFAULT '2',
  row_counts text NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS operator_grants (
  id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'onehope' REFERENCES tenants (id),
  account_id text NOT NULL,
  approved_by text,
  tier3 boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS pickup_settings (
  tenant_id text PRIMARY KEY REFERENCES tenants (id),
  pickup_only boolean NOT NULL DEFAULT true,
  delivery_enabled boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Chicago'
);

CREATE TABLE IF NOT EXISTS tenant_runtime (
  tenant_id text PRIMARY KEY REFERENCES tenants (id),
  seeded_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO tenant_modules (tenant_id, module_id, enabled) VALUES
  ('onehope', 'discipleship', true),
  ('onehope', 'serving', true),
  ('onehope', 'worship', true),
  ('onehope', 'kids', true),
  ('onehope', 'communications', true),
  ('onehope', 'facilities', true),
  ('onehope', 'finance', true),
  ('onehope', 'missions', true),
  ('onehope', 'admin', true),
  ('onehope', 'media', true),
  ('onehope', 'groups', true),
  ('onehope', 'events', true),
  ('onehope', 'giving', true),
  ('onehope', 'checkin', true),
  ('onehope', 'prayer', true),
  ('revivalcoffee', 'ordering', true),
  ('revivalcoffee', 'menu', true),
  ('revivalcoffee', 'queue', true),
  ('cinderandcrown', 'command_center', true),
  ('cinderandcrown', 'crm', true),
  ('cinderandcrown', 'service_desk', true),
  ('cinderandcrown', 'projects', true),
  ('cinderandcrown', 'document_vault', true),
  ('cinderandcrown', 'audit', true),
  ('cinderandcrown', 'admin', true),
  ('cinderandcrown', 'notifications', true),
  ('cinderandcrown', 'inbox', true),
  ('cinderandcrown', 'reports', true)
ON CONFLICT (tenant_id, module_id) DO NOTHING;

INSERT INTO tenant_themes (tenant_id, tokens) VALUES
  ('onehope', '{"paper":"#E5E4D0","ink":"#1C1B1B","olive":"#3F4903","sky":"#CADDF6","terracotta":"#DF8052","card":"#F7F4EA"}'),
  ('revivalcoffee', '{"paper":"#F6F1E7","ink":"#2A2118","olive":"#6B3E26","sky":"#E7D3C1","terracotta":"#C46B3A","card":"#FFF9F2"}'),
  ('cinderandcrown', '{"paper":"#F4F1EA","ink":"#1A1A1A","olive":"#2F3A2A","sky":"#D9D3C5","terracotta":"#8C3A2F","card":"#FFFFFF"}')
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_links (tenant_id, from_tenant, to_tenant, kind, show_in_app) VALUES
  ('onehope', 'onehope', 'revivalcoffee', 'shop', true)
ON CONFLICT (from_tenant, to_tenant, kind) DO NOTHING;

INSERT INTO locations (tenant_id, id, name, timezone) VALUES
  ('onehope', 'richardson', 'Richardson', 'America/Chicago'),
  ('revivalcoffee', 'shop', 'Revival Coffee', 'America/Chicago'),
  ('cinderandcrown', 'hq', 'Cinder & Crown', 'America/Chicago')
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO pickup_settings (tenant_id, pickup_only, delivery_enabled, timezone) VALUES
  ('revivalcoffee', true, false, 'America/Chicago')
ON CONFLICT (tenant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION log_gift_write() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_log (id, actor_id, action, resource, resource_id, tier, tenant_id, source)
  VALUES (
    md5(random()::text || clock_timestamp()::text),
    COALESCE(NULLIF(current_setting('app.person_id', true), ''), 'system'),
    lower(TG_OP),
    'gift',
    COALESCE(NEW.id, OLD.id),
    3,
    COALESCE(NULLIF(current_setting('app.tenant_id', true), ''), NEW.tenant_id, OLD.tenant_id, 'onehope'),
    'trigger'
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_no_update ON audit_log;
CREATE TRIGGER audit_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

DROP POLICY IF EXISTS gifts_select ON gifts;
DROP POLICY IF EXISTS kids_select ON kids;
DROP POLICY IF EXISTS care_share_select ON care_note_shares;
DROP POLICY IF EXISTS care_select ON care_notes;
DROP POLICY IF EXISTS prayer_select ON prayers;
DROP POLICY IF EXISTS background_select ON background_checks;
DROP POLICY IF EXISTS audit_select ON audit_log;
DROP POLICY IF EXISTS audit_insert ON audit_log;

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE households FORCE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE people FORCE ROW LEVEL SECURITY;

CREATE POLICY gifts_select ON gifts FOR SELECT TO app_user USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND (
    household_id = current_setting('app.household_id', true)
    OR (
      current_setting('app.role', true) IN ('finance', 'pastor', 'master_admin')
      AND current_setting('app.step_up', true) = 'on'
    )
  )
);

CREATE POLICY gifts_insert ON gifts FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY gifts_update ON gifts FOR UPDATE TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY gifts_delete ON gifts FOR DELETE TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY kids_select ON kids FOR SELECT TO app_user USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND (
    household_id = current_setting('app.household_id', true)
    OR (
      current_setting('app.role', true) IN ('kids_director', 'pastor', 'master_admin')
      AND current_setting('app.step_up', true) = 'on'
    )
  )
);

CREATE POLICY kids_insert ON kids FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY kids_update ON kids FOR UPDATE TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY kids_delete ON kids FOR DELETE TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY care_share_select ON care_note_shares FOR SELECT TO app_user USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND person_id = current_setting('app.person_id', true)
);

CREATE POLICY care_share_insert ON care_note_shares FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY care_select ON care_notes FOR SELECT TO app_user USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND (
    subject_person_id = current_setting('app.person_id', true)
    OR EXISTS (
      SELECT 1 FROM care_note_shares s
      WHERE s.note_id = care_notes.id
        AND s.person_id = current_setting('app.person_id', true)
        AND s.tenant_id = care_notes.tenant_id
    )
    OR (
      current_setting('app.role', true) IN ('care_team', 'pastor', 'master_admin')
      AND current_setting('app.step_up', true) = 'on'
    )
  )
);

CREATE POLICY care_insert ON care_notes FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY prayer_select ON prayers FOR SELECT TO app_user USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND (
    (visibility = 'public' AND approved = true)
    OR author_id = current_setting('app.person_id', true)
    OR (
      visibility = 'private'
      AND current_setting('app.role', true) IN ('care_team', 'pastor', 'master_admin')
      AND current_setting('app.step_up', true) = 'on'
    )
  )
);

CREATE POLICY prayer_insert ON prayers FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY background_select ON background_checks FOR SELECT TO app_user USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND (
    person_id = current_setting('app.person_id', true)
    OR (
      current_setting('app.role', true) IN ('kids_director', 'pastor', 'master_admin')
      AND current_setting('app.step_up', true) = 'on'
    )
  )
);

CREATE POLICY background_insert ON background_checks FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY audit_select ON audit_log FOR SELECT TO app_user USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND current_setting('app.role', true) IN ('pastor', 'master_admin')
);

CREATE POLICY audit_insert ON audit_log FOR INSERT TO app_user WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)
);

CREATE POLICY people_select ON people FOR SELECT USING (
  tenant_id = current_setting('app.tenant_id', true)
);

CREATE OR REPLACE VIEW directory_public AS
SELECT
  id,
  display_name,
  CASE
    WHEN email_public OR id = current_setting('app.person_id', true) THEN email
    ELSE NULL
  END AS email,
  CASE
    WHEN phone_public OR id = current_setting('app.person_id', true) THEN phone
    ELSE NULL
  END AS phone
FROM people
WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service NOINHERIT;
  END IF;
END
$$;

GRANT app_service TO CURRENT_USER;
ALTER ROLE app_service SET search_path = public;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'households', 'memberships', 'sessions', 'alerts', 'proposals', 'station_duty', 'groups',
    'group_messages', 'events', 'registrations', 'announcements', 'schedule_assignments',
    'volunteers', 'rooms', 'bookings', 'expenses', 'pathways', 'visitors', 'care_requests',
    'message_drafts', 'member_invites', 'follow_ups', 'streaks', 'rate_limits', 'prayer_amens',
    'my_five', 'testimonies', 'milestones', 'outreach_events', 'outreach_rsvps', 'coffee_orders',
    'social_links', 'tenant_modules', 'tenant_themes', 'tenant_integrations', 'tenant_links',
    'locations', 'outbox_jobs', 'webhook_inbox', 'exports', 'operator_grants', 'pickup_settings',
    'gifts', 'kids', 'care_notes', 'care_note_shares', 'prayers', 'background_checks', 'people'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_service ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_service ON %I FOR ALL TO app_service USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_service', t);
  END LOOP;
END
$$;

REVOKE UPDATE, DELETE ON audit_log FROM app_service;
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
GRANT SELECT, INSERT ON audit_log TO app_service;

DROP POLICY IF EXISTS tenant_service ON audit_log;
CREATE POLICY tenant_service_select ON audit_log FOR SELECT TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_service_insert ON audit_log FOR INSERT TO app_service
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'households', 'memberships', 'sessions', 'alerts', 'proposals', 'station_duty', 'groups',
    'group_messages', 'events', 'registrations', 'announcements', 'schedule_assignments',
    'volunteers', 'rooms', 'bookings', 'expenses', 'pathways', 'visitors', 'care_requests',
    'message_drafts', 'member_invites', 'follow_ups', 'streaks', 'rate_limits', 'prayer_amens',
    'my_five', 'testimonies', 'milestones', 'outreach_events', 'outreach_rsvps', 'coffee_orders',
    'social_links', 'tenant_modules', 'tenant_themes', 'tenant_integrations', 'tenant_links',
    'locations', 'outbox_jobs', 'webhook_inbox', 'exports', 'operator_grants', 'pickup_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_user ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_user ON %I FOR ALL TO app_user USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', t);
  END LOOP;
END
$$;

ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS domains_route ON tenant_domains;
CREATE POLICY domains_route ON tenant_domains FOR SELECT TO app_service USING (true);
DROP POLICY IF EXISTS domains_service_write ON tenant_domains;
CREATE POLICY domains_service_write ON tenant_domains FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS domains_user ON tenant_domains;
CREATE POLICY domains_user ON tenant_domains FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON gifts, kids, care_notes, care_note_shares, prayers, background_checks TO app_user;

REVOKE ALL ON people FROM app_user;
GRANT SELECT (id, tenant_id, household_id, role, display_name) ON people TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON people TO app_service;

REVOKE ALL ON demo_runtime FROM PUBLIC;
REVOKE ALL ON demo_runtime FROM app_user;
REVOKE ALL ON demo_runtime FROM app_service;
REVOKE ALL ON demo_runtime_backup FROM app_user;
REVOKE ALL ON demo_runtime_backup FROM app_service;
REVOKE ALL ON snapshot_imports FROM app_user;
REVOKE ALL ON accounts FROM app_user;
REVOKE ALL ON mfa_factors FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts, mfa_factors, snapshot_imports, tenant_runtime TO app_service;

ALTER TABLE tenant_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_runtime FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS runtime_service ON tenant_runtime;
CREATE POLICY runtime_service ON tenant_runtime FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT ON tenant_runtime TO app_user;
DROP POLICY IF EXISTS runtime_user ON tenant_runtime;
CREATE POLICY runtime_user ON tenant_runtime FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true));
