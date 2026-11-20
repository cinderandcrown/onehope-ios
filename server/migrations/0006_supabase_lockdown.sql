-- Supabase hosts only. On Neon, PGlite, or plain Postgres the roles below do not exist and this does nothing.
-- Supabase's default privileges grant every new public table, sequence, and function to anon,
-- authenticated, and service_role so the Data API (PostgREST) can serve them. This platform uses
-- Supabase as plain Postgres: the server connects as postgres and drops to app_service with
-- SET LOCAL ROLE. Nothing should be reachable through the Data API, even if it is switched back on.
-- service_role has BYPASSRLS, so a table grant to it would skip forced RLS. Revoke all of it.

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END
$$;
