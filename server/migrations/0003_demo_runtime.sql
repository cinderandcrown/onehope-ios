-- Live demo state for the API. The TypeScript store is still the access-rule
-- implementation. This row is how a serverless host keeps that store across
-- requests. It is not granted to app_user and holds labeled demo data only.

CREATE TABLE IF NOT EXISTS demo_runtime (
  id text PRIMARY KEY,
  payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
