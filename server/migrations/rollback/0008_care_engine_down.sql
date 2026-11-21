-- Manual rollback for 0008_care_engine.sql. migrate() does not run this file.
-- Take a Neon branch or pg_dump first. Follow-ups, touches and people are not touched.

DELETE FROM schema_migrations WHERE version = '0008_care_engine';
DROP TABLE IF EXISTS care_tasks, care_playbooks CASCADE;
DROP INDEX IF EXISTS interactions_person_time_idx;
DROP INDEX IF EXISTS interactions_time_idx;
ALTER TABLE interactions DROP COLUMN IF EXISTS touched_at;
