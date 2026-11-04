CREATE TABLE "public"."festival_companion_config" (
  "singleton"                boolean                  NOT NULL DEFAULT true,
  "lead_minutes"             integer                  NOT NULL DEFAULT 60,
  "completion_grace_minutes" integer                  NOT NULL DEFAULT 15,
  "updated_at"               timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "festival_companion_config_completion_grace_minutes_check" CHECK (((completion_grace_minutes >= 0) AND (completion_grace_minutes <= 60))),
  CONSTRAINT "festival_companion_config_lead_minutes_check" CHECK (((lead_minutes >= 5) AND (lead_minutes <= 240))),
  CONSTRAINT "festival_companion_config_pkey" PRIMARY KEY (singleton),
  CONSTRAINT "festival_companion_config_singleton_check" CHECK (singleton)
);

ALTER TABLE "public"."festival_companion_config"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Festival companion configuration is readable." ON "public"."festival_companion_config"
  FOR SELECT
  TO "authenticated"
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_companion_config" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_companion_config" TO "service_role";

REVOKE ALL ON TABLE "public"."festival_companion_config" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_companion_config" TO "postgres";
