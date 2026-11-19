-- Manual rollback for 0004_tenancy.sql. migrate() does not run this file.
-- Take a Neon branch, PITR restore point, or pg_dump before you run it.
-- demo_runtime is not modified.

DELETE FROM schema_migrations WHERE version = '0004_tenancy';

DROP FUNCTION IF EXISTS link_membership(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS tenant_passwords(text);

DROP TRIGGER IF EXISTS audit_no_update ON audit_log;
DROP FUNCTION IF EXISTS reject_audit_mutation();

DROP TABLE IF EXISTS tenant_runtime, pickup_settings, operator_grants, exports, webhook_inbox,
  outbox_jobs, locations, tenant_links, tenant_integrations, tenant_themes, tenant_modules,
  social_links, coffee_orders, outreach_rsvps, outreach_events, milestones, testimonies,
  my_five, prayer_amens, rate_limits, streaks, follow_ups, member_invites, message_drafts,
  care_requests, visitors, pathways, expenses, bookings, rooms, volunteers, schedule_assignments,
  announcements, registrations, events, group_messages, groups, station_duty, proposals, alerts,
  sessions, memberships, mfa_factors, accounts, tenant_domains, snapshot_imports CASCADE;

DROP POLICY IF EXISTS gifts_select ON gifts;
DROP POLICY IF EXISTS gifts_insert ON gifts;
DROP POLICY IF EXISTS gifts_update ON gifts;
DROP POLICY IF EXISTS gifts_delete ON gifts;
DROP POLICY IF EXISTS gifts_write ON gifts;
DROP POLICY IF EXISTS kids_select ON kids;
DROP POLICY IF EXISTS kids_insert ON kids;
DROP POLICY IF EXISTS kids_update ON kids;
DROP POLICY IF EXISTS kids_delete ON kids;
DROP POLICY IF EXISTS care_share_select ON care_note_shares;
DROP POLICY IF EXISTS care_share_insert ON care_note_shares;
DROP POLICY IF EXISTS care_select ON care_notes;
DROP POLICY IF EXISTS care_insert ON care_notes;
DROP POLICY IF EXISTS prayer_select ON prayers;
DROP POLICY IF EXISTS prayer_insert ON prayers;
DROP POLICY IF EXISTS background_select ON background_checks;
DROP POLICY IF EXISTS background_insert ON background_checks;
DROP POLICY IF EXISTS audit_select ON audit_log;
DROP POLICY IF EXISTS audit_insert ON audit_log;
DROP POLICY IF EXISTS tenant_service ON gifts;
DROP POLICY IF EXISTS tenant_service ON kids;
DROP POLICY IF EXISTS tenant_service ON care_notes;
DROP POLICY IF EXISTS tenant_service ON care_note_shares;
DROP POLICY IF EXISTS tenant_service ON prayers;
DROP POLICY IF EXISTS tenant_service ON background_checks;
DROP POLICY IF EXISTS tenant_service ON people;
DROP POLICY IF EXISTS tenant_service_select ON audit_log;
DROP POLICY IF EXISTS tenant_service_insert ON audit_log;
DROP POLICY IF EXISTS people_select ON people;
DROP POLICY IF EXISTS tenant_service ON households;

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
ALTER TABLE people DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE people DROP COLUMN IF EXISTS password_hash;
ALTER TABLE people DROP COLUMN IF EXISTS totp_secret;
ALTER TABLE people DROP COLUMN IF EXISTS listed_in_directory;
ALTER TABLE people DROP COLUMN IF EXISTS deleted;
ALTER TABLE people DROP COLUMN IF EXISTS last_ip;
ALTER TABLE people DROP COLUMN IF EXISTS last_user_agent;
ALTER TABLE people DROP COLUMN IF EXISTS sample;
ALTER TABLE people DROP COLUMN IF EXISTS record;
ALTER TABLE gifts DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE gifts DROP COLUMN IF EXISTS record;
ALTER TABLE gifts DROP COLUMN IF EXISTS row_version;
ALTER TABLE households DROP COLUMN IF EXISTS row_version;
ALTER TABLE people DROP COLUMN IF EXISTS row_version;
ALTER TABLE kids DROP COLUMN IF EXISTS row_version;
ALTER TABLE care_notes DROP COLUMN IF EXISTS row_version;
ALTER TABLE prayers DROP COLUMN IF EXISTS row_version;
ALTER TABLE background_checks DROP COLUMN IF EXISTS row_version;
ALTER TABLE kids DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE kids DROP COLUMN IF EXISTS record;
ALTER TABLE care_notes DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE care_notes DROP COLUMN IF EXISTS author_id;
ALTER TABLE care_notes DROP COLUMN IF EXISTS sample;
ALTER TABLE care_notes DROP COLUMN IF EXISTS record;
ALTER TABLE care_note_shares DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE prayers DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE prayers DROP COLUMN IF EXISTS sample;
ALTER TABLE prayers DROP COLUMN IF EXISTS record;
ALTER TABLE background_checks DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE background_checks DROP COLUMN IF EXISTS sample;
ALTER TABLE background_checks DROP COLUMN IF EXISTS record;
ALTER TABLE audit_log DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE audit_log DROP COLUMN IF EXISTS source;
ALTER TABLE audit_log DROP COLUMN IF EXISTS at_ms;
ALTER TABLE audit_log DROP COLUMN IF EXISTS record;

-- Restore the policies from 0001_init.sql.
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

DROP TABLE IF EXISTS tenants CASCADE;
