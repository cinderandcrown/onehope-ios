-- Manual rollback for 0004_tenancy.sql. migrate() does not run this file.
-- Take a Neon branch, PITR restore point, or pg_dump before you run it.
-- demo_runtime is not modified.

DELETE FROM schema_migrations WHERE version IN ('0004_tenancy', '0005_tenant_passwords');

DROP FUNCTION IF EXISTS link_membership(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS read_tenant_passwords(text);
DROP FUNCTION IF EXISTS tenant_passwords(text);

DROP TRIGGER IF EXISTS audit_no_update ON audit_log;
DROP FUNCTION IF EXISTS reject_audit_mutation();

DROP TABLE IF EXISTS tenant_passwords, tenant_runtime, pickup_settings, operator_grants, exports, webhook_inbox,
  outbox_jobs, locations, tenant_links, tenant_integrations, tenant_themes, tenant_modules,
  social_links, coffee_orders, outreach_rsvps, outreach_events, milestones, testimonies,
  my_five, prayer_amens, rate_limits, streaks, follow_ups, member_invites, message_drafts,
  care_requests, visitors, pathways, expenses, bookings, rooms, volunteers, schedule_assignments,
  announcements, registrations, events, group_messages, groups, station_duty, proposals, alerts,
  sessions, memberships, mfa_factors, accounts, tenant_domains, snapshot_imports CASCADE;

-- The directory view and every policy and tenant index depend on tenant_id.
DROP VIEW IF EXISTS directory_public;

DO $$
DECLARE
  pol record;
  idx record;
BEGIN
  FOR pol IN
    SELECT c.relname AS table_name, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'households', 'people', 'gifts', 'kids', 'care_notes', 'care_note_shares',
        'prayers', 'background_checks', 'audit_log'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.polname, pol.table_name);
  END LOOP;

  FOR idx IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'households', 'people', 'gifts', 'kids', 'care_notes', 'care_note_shares',
        'prayers', 'background_checks', 'audit_log'
      )
      AND indexdef ILIKE '%(tenant_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
  END LOOP;
END
$$;

ALTER TABLE households DISABLE ROW LEVEL SECURITY;
ALTER TABLE households NO FORCE ROW LEVEL SECURITY;
ALTER TABLE people DISABLE ROW LEVEL SECURITY;
ALTER TABLE people NO FORCE ROW LEVEL SECURITY;

ALTER TABLE households DROP CONSTRAINT IF EXISTS households_tenant_fk;
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_tenant_fk;
ALTER TABLE gifts DROP CONSTRAINT IF EXISTS gifts_tenant_fk;
ALTER TABLE kids DROP CONSTRAINT IF EXISTS kids_tenant_fk;
ALTER TABLE care_notes DROP CONSTRAINT IF EXISTS care_notes_tenant_fk;
ALTER TABLE care_note_shares DROP CONSTRAINT IF EXISTS care_note_shares_tenant_fk;
ALTER TABLE prayers DROP CONSTRAINT IF EXISTS prayers_tenant_fk;
ALTER TABLE background_checks DROP CONSTRAINT IF EXISTS background_checks_tenant_fk;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_tenant_fk;

ALTER TABLE households DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE households DROP COLUMN IF EXISTS row_version;
ALTER TABLE people DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE people DROP COLUMN IF EXISTS password_hash;
ALTER TABLE people DROP COLUMN IF EXISTS totp_secret;
ALTER TABLE people DROP COLUMN IF EXISTS listed_in_directory;
ALTER TABLE people DROP COLUMN IF EXISTS deleted;
ALTER TABLE people DROP COLUMN IF EXISTS last_ip;
ALTER TABLE people DROP COLUMN IF EXISTS last_user_agent;
ALTER TABLE people DROP COLUMN IF EXISTS sample;
ALTER TABLE people DROP COLUMN IF EXISTS record;
ALTER TABLE people DROP COLUMN IF EXISTS row_version;
ALTER TABLE gifts DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE gifts DROP COLUMN IF EXISTS record;
ALTER TABLE gifts DROP COLUMN IF EXISTS row_version;
ALTER TABLE kids DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE kids DROP COLUMN IF EXISTS record;
ALTER TABLE kids DROP COLUMN IF EXISTS row_version;
ALTER TABLE care_notes DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE care_notes DROP COLUMN IF EXISTS author_id;
ALTER TABLE care_notes DROP COLUMN IF EXISTS sample;
ALTER TABLE care_notes DROP COLUMN IF EXISTS record;
ALTER TABLE care_notes DROP COLUMN IF EXISTS row_version;
ALTER TABLE care_note_shares DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE prayers DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE prayers DROP COLUMN IF EXISTS sample;
ALTER TABLE prayers DROP COLUMN IF EXISTS record;
ALTER TABLE prayers DROP COLUMN IF EXISTS row_version;
ALTER TABLE background_checks DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE background_checks DROP COLUMN IF EXISTS sample;
ALTER TABLE background_checks DROP COLUMN IF EXISTS record;
ALTER TABLE background_checks DROP COLUMN IF EXISTS row_version;
ALTER TABLE audit_log DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE audit_log DROP COLUMN IF EXISTS source;
ALTER TABLE audit_log DROP COLUMN IF EXISTS at_ms;
ALTER TABLE audit_log DROP COLUMN IF EXISTS record;

-- Restore the policies, view, and gift trigger function from 0001_init.sql.
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

CREATE OR REPLACE FUNCTION log_gift_write() RETURNS trigger
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

DROP TABLE IF EXISTS tenants CASCADE;
