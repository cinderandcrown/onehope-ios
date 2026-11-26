-- Manual rollback for 0007_people_care.sql. migrate() does not run this file.
-- Take a Neon branch or pg_dump first. Existing people, follow-ups and care notes are not touched.

DELETE FROM schema_migrations WHERE version = '0007_people_care';
DROP TABLE IF EXISTS interactions, person_tags, tags, person_profiles CASCADE;
