-- Databases that already applied the first 0004 still have the shared-password
-- functions. This file replaces them. A fresh database runs the same statements
-- again; every statement is safe to repeat.

DROP FUNCTION IF EXISTS tenant_passwords(text);

DO $body$
BEGIN
  IF to_regclass('public.tenant_passwords') IS NULL THEN
    EXECUTE $ddl$
      CREATE TABLE tenant_passwords (
        tenant_id text NOT NULL REFERENCES tenants (id),
        person_id text NOT NULL,
        password_hash text NOT NULL,
        PRIMARY KEY (tenant_id, person_id)
      )
    $ddl$;
  END IF;
END
$body$;

ALTER TABLE tenant_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_passwords FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_passwords_definer ON tenant_passwords;
CREATE POLICY tenant_passwords_definer ON tenant_passwords FOR ALL
  USING (true) WITH CHECK (true);
REVOKE ALL ON tenant_passwords FROM PUBLIC;
REVOKE ALL ON tenant_passwords FROM app_service;
REVOKE ALL ON tenant_passwords FROM app_user;

INSERT INTO tenant_passwords (tenant_id, person_id, password_hash)
SELECT m.tenant_id, m.person_id, a.password_hash
FROM memberships m
JOIN accounts a ON a.id = m.account_id
WHERE a.password_hash IS NOT NULL
ON CONFLICT (tenant_id, person_id) DO NOTHING;

CREATE OR REPLACE FUNCTION link_membership(
  p_email text,
  p_password text,
  p_tenant text,
  p_person text,
  p_role text,
  p_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct text;
BEGIN
  IF p_tenant IS DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '') THEN
    RAISE EXCEPTION 'membership tenant does not match the request';
  END IF;
  INSERT INTO accounts (id, email, password_hash)
  VALUES ('acct_' || md5(p_email), p_email, NULL)
  ON CONFLICT (email) DO UPDATE SET password_hash = NULL;
  SELECT id INTO acct FROM accounts WHERE email = p_email;
  INSERT INTO memberships (id, tenant_id, account_id, person_id, role, status)
  VALUES ('mem_' || p_tenant || '_' || p_person, p_tenant, acct, p_person, p_role, p_status)
  ON CONFLICT (tenant_id, person_id) DO UPDATE
    SET role = EXCLUDED.role, status = EXCLUDED.status, account_id = EXCLUDED.account_id, updated_at = now();
  IF p_password IS NOT NULL THEN
    INSERT INTO tenant_passwords (tenant_id, person_id, password_hash)
    VALUES (p_tenant, p_person, p_password)
    ON CONFLICT (tenant_id, person_id) DO UPDATE
      SET password_hash = EXCLUDED.password_hash;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION read_tenant_passwords(p_tenant text)
RETURNS TABLE (person_id text, password_hash text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant IS DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '') THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT rows.person_id, rows.password_hash
    FROM tenant_passwords AS rows
    WHERE rows.tenant_id = p_tenant;
END;
$$;

REVOKE ALL ON FUNCTION link_membership(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION read_tenant_passwords(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION link_membership(text, text, text, text, text, text) TO app_service;
GRANT EXECUTE ON FUNCTION read_tenant_passwords(text) TO app_service;
