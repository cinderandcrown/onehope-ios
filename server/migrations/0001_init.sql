-- One Hope is a single church. There is no tenant_id.
-- Members and households own their rows. Policies below are the database
-- enforcement. The API adds step-up and decryption on top.
-- Apply with a role that is not a superuser. Superusers bypass RLS.

CREATE TABLE households (
  id text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE people (
  id text PRIMARY KEY,
  household_id text,
  role text NOT NULL,
  display_name text NOT NULL,
  email text,
  email_public boolean NOT NULL DEFAULT false,
  phone text,
  phone_public boolean NOT NULL DEFAULT false
);

CREATE TABLE gifts (
  id text PRIMARY KEY,
  household_id text NOT NULL,
  person_id text NOT NULL,
  amount_ciphertext text NOT NULL,
  sample boolean NOT NULL DEFAULT true
);

CREATE TABLE kids (
  id text PRIMARY KEY,
  household_id text NOT NULL,
  display_name text NOT NULL,
  medical_ciphertext text NOT NULL,
  restricted boolean NOT NULL DEFAULT false
);

CREATE TABLE care_notes (
  id text PRIMARY KEY,
  subject_person_id text NOT NULL,
  body_ciphertext text NOT NULL
);

CREATE TABLE care_note_shares (
  note_id text NOT NULL,
  person_id text NOT NULL,
  PRIMARY KEY (note_id, person_id)
);

CREATE TABLE prayers (
  id text PRIMARY KEY,
  author_id text NOT NULL,
  body text NOT NULL,
  visibility text NOT NULL,
  approved boolean NOT NULL DEFAULT false
);

CREATE TABLE background_checks (
  id text PRIMARY KEY,
  person_id text NOT NULL,
  status text NOT NULL,
  notes_ciphertext text NOT NULL
);

CREATE TABLE audit_log (
  id text PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_id text NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id text,
  tier integer NOT NULL
);

ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts FORCE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids FORCE ROW LEVEL SECURITY;
ALTER TABLE care_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE care_note_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_note_shares FORCE ROW LEVEL SECURITY;
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayers FORCE ROW LEVEL SECURITY;
ALTER TABLE background_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_checks FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY gifts_select ON gifts FOR SELECT USING (
  household_id = current_setting('app.household_id', true)
  OR (
    current_setting('app.role', true) IN ('finance', 'pastor', 'master_admin')
    AND current_setting('app.step_up', true) = 'on'
  )
);

CREATE POLICY kids_select ON kids FOR SELECT USING (
  household_id = current_setting('app.household_id', true)
  OR (
    current_setting('app.role', true) IN ('kids_director', 'pastor', 'master_admin')
    AND current_setting('app.step_up', true) = 'on'
  )
);

CREATE POLICY care_share_select ON care_note_shares FOR SELECT USING (
  person_id = current_setting('app.person_id', true)
);

CREATE POLICY care_select ON care_notes FOR SELECT USING (
  subject_person_id = current_setting('app.person_id', true)
  OR EXISTS (
    SELECT 1 FROM care_note_shares s
    WHERE s.note_id = care_notes.id
      AND s.person_id = current_setting('app.person_id', true)
  )
  OR (
    current_setting('app.role', true) IN ('care_team', 'pastor', 'master_admin')
    AND current_setting('app.step_up', true) = 'on'
  )
);

CREATE POLICY prayer_select ON prayers FOR SELECT USING (
  (visibility = 'public' AND approved = true)
  OR author_id = current_setting('app.person_id', true)
  OR (
    visibility = 'private'
    AND current_setting('app.role', true) IN ('care_team', 'pastor', 'master_admin')
    AND current_setting('app.step_up', true) = 'on'
  )
);

CREATE POLICY background_select ON background_checks FOR SELECT USING (
  person_id = current_setting('app.person_id', true)
  OR (
    current_setting('app.role', true) IN ('kids_director', 'pastor', 'master_admin')
    AND current_setting('app.step_up', true) = 'on'
  )
);

CREATE POLICY audit_select ON audit_log FOR SELECT USING (
  current_setting('app.role', true) IN ('pastor', 'master_admin')
);

CREATE POLICY audit_insert ON audit_log FOR INSERT WITH CHECK (true);

CREATE VIEW directory_public AS
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
FROM people;

CREATE FUNCTION log_gift_write() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_log (id, actor_id, action, resource, resource_id, tier)
  VALUES (
    md5(random()::text || clock_timestamp()::text),
    COALESCE(current_setting('app.person_id', true), 'system'),
    lower(TG_OP),
    'gift',
    COALESCE(NEW.id, OLD.id),
    3
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER gifts_audit
  AFTER INSERT OR UPDATE OR DELETE ON gifts
  FOR EACH ROW EXECUTE FUNCTION log_gift_write();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT ON households, gifts, kids, care_notes, care_note_shares, prayers, background_checks, directory_public TO app_user;
GRANT SELECT (id, household_id, role, display_name) ON people TO app_user;
GRANT INSERT, SELECT ON audit_log TO app_user;
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
ALTER ROLE app_user SET search_path = public;
