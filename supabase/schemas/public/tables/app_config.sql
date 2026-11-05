CREATE TABLE "public"."app_config" (
  "key"        text                     NOT NULL,
  "value"      jsonb                    NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "app_config_pkey" PRIMARY KEY (key)
);

ALTER TABLE "public"."app_config"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_config_updated_at();

CREATE POLICY "Allow public read access to app_config" ON "public"."app_config"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."app_config" TO "service_role";

COMMENT ON TABLE "public"."app_config" IS 'Application configuration key-value store for app settings like minimum version requirements';

REVOKE ALL ON TABLE "public"."app_config" FROM "anon";

GRANT REFERENCES, SELECT, TRIGGER ON TABLE "public"."app_config" TO "anon";

REVOKE ALL ON TABLE "public"."app_config" FROM "authenticated";

GRANT REFERENCES, SELECT, TRIGGER ON TABLE "public"."app_config" TO "authenticated";

REVOKE ALL ON TABLE "public"."app_config" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."app_config" TO "postgres";
