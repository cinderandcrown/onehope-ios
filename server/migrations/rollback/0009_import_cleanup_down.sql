-- Manual rollback for 0009_import_cleanup.sql. migrate() does not run this file.
-- Take a Neon branch or pg_dump first. People rows stay; only the import bookkeeping goes.

DELETE FROM schema_migrations WHERE version = '0009_import_cleanup';
DROP TABLE IF EXISTS saved_lists, person_merges, people_imports CASCADE;
DROP INDEX IF EXISTS people_import_idx;
DROP INDEX IF EXISTS person_profiles_import_idx;
ALTER TABLE people DROP COLUMN IF EXISTS import_id;
ALTER TABLE person_profiles DROP COLUMN IF EXISTS import_id;
ALTER TABLE person_profiles DROP COLUMN IF EXISTS source;
ALTER TABLE person_profiles DROP COLUMN IF EXISTS owner_id;
ALTER TABLE person_profiles DROP COLUMN IF EXISTS last_seen_at;
ALTER TABLE person_profiles DROP COLUMN IF EXISTS faith_steps;
