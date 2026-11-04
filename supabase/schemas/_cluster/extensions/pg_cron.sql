CREATE EXTENSION "pg_cron";

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

-- Preserve the explicit owner grants left by historical extension setup.
GRANT USAGE ON SCHEMA "cron" TO "postgres";
GRANT SELECT ON TABLE "cron"."job" TO "postgres";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRUNCATE, UPDATE
  ON TABLE "cron"."job_run_details" TO "postgres";
