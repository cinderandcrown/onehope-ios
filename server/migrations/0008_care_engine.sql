-- Phase 2b: care engine. Playbooks (all off until a pastor turns one on) and care tasks for care team seats.
-- Touches get a real timestamp column so pages of a person's timeline load straight from Postgres.
-- Scripts and names never live in these columns; the app fills names in when it shows a task.

ALTER TABLE interactions ADD COLUMN IF NOT EXISTS touched_at timestamptz;
UPDATE interactions
  SET touched_at = to_timestamp(((record::jsonb) ->> 'at')::double precision / 1000.0)
  WHERE touched_at IS NULL AND record IS NOT NULL AND (record::jsonb) ? 'at';
CREATE INDEX IF NOT EXISTS interactions_person_time_idx ON interactions (tenant_id, person_id, touched_at DESC);
CREATE INDEX IF NOT EXISTS interactions_time_idx ON interactions (tenant_id, touched_at DESC);

CREATE TABLE IF NOT EXISTS care_playbooks (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  trigger text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS care_tasks (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  person_id text,
  follow_up_id text,
  playbook_id text,
  assignee_id text,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  completed_at timestamptz,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS care_tasks_assignee_idx ON care_tasks (tenant_id, assignee_id, status, due_at);
CREATE INDEX IF NOT EXISTS care_tasks_open_idx ON care_tasks (tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS care_tasks_person_idx ON care_tasks (tenant_id, person_id);
CREATE INDEX IF NOT EXISTS care_tasks_follow_up_idx ON care_tasks (tenant_id, follow_up_id);

ALTER TABLE care_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_playbooks FORCE ROW LEVEL SECURITY;
ALTER TABLE care_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_service ON care_playbooks;
CREATE POLICY tenant_service ON care_playbooks FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON care_playbooks;
CREATE POLICY tenant_user ON care_playbooks FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_service ON care_tasks;
CREATE POLICY tenant_service ON care_tasks FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON care_tasks;
CREATE POLICY tenant_user ON care_tasks FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON care_playbooks, care_tasks TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON care_playbooks, care_tasks TO app_user;
