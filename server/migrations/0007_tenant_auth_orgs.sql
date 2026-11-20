-- Maps an identity provider's organization to a tenant (decision D1: one Clerk Organization is one tenant).
-- Rows are tenant config. They are written by server/scripts/provision-tenant.ts from a spec kept
-- outside git, never by a migration.
CREATE TABLE IF NOT EXISTS tenant_auth_orgs (
  provider text NOT NULL,
  external_org_id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, external_org_id),
  UNIQUE (provider, tenant_id)
);

CREATE INDEX IF NOT EXISTS tenant_auth_orgs_tenant_idx ON tenant_auth_orgs (tenant_id);

ALTER TABLE tenant_auth_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_auth_orgs FORCE ROW LEVEL SECURITY;

-- Like tenant_domains: the server reads the map before it knows the tenant, then binds app.tenant_id.
DROP POLICY IF EXISTS auth_orgs_route ON tenant_auth_orgs;
CREATE POLICY auth_orgs_route ON tenant_auth_orgs FOR SELECT TO app_service USING (true);
DROP POLICY IF EXISTS auth_orgs_service_write ON tenant_auth_orgs;
CREATE POLICY auth_orgs_service_write ON tenant_auth_orgs FOR ALL TO app_service
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

REVOKE ALL ON tenant_auth_orgs FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_auth_orgs TO app_service;

-- Supabase only: keep this table out of the Data API like everything else (see 0006).
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON tenant_auth_orgs FROM %I', r);
    END IF;
  END LOOP;
END
$$;
