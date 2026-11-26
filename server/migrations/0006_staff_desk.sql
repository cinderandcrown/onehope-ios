-- Featured Sunday message and the kids-team list. Both used to live only in memory.

CREATE TABLE IF NOT EXISTS featured_messages (
  tenant_id text NOT NULL REFERENCES tenants (id),
  id text NOT NULL,
  record text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS kids_team (
  tenant_id text NOT NULL REFERENCES tenants (id),
  person_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id)
);

ALTER TABLE featured_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE kids_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids_team FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_service ON featured_messages;
CREATE POLICY tenant_service ON featured_messages FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON featured_messages;
CREATE POLICY tenant_user ON featured_messages FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_service ON kids_team;
CREATE POLICY tenant_service ON kids_team FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS tenant_user ON kids_team;
CREATE POLICY tenant_user ON kids_team FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON featured_messages, kids_team TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON featured_messages, kids_team TO app_user;
