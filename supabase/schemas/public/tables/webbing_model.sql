CREATE TABLE "public"."webbing_model" (
  "id"                        bigint  GENERATED ALWAYS AS IDENTITY NOT NULL,
  "name"                      text    NOT NULL,
  "material" public.material_enum NOT NULL,
  "weave" public.weave_enum NOT NULL,
  "image_url"                 text,
  "strength_class" public.strength_class_enum,
  "recommended_lifetime_days" integer,
  CONSTRAINT "webbing_model_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."webbing_model"
  ENABLE ROW LEVEL SECURITY;




CREATE POLICY "Allow users to read webbing models" ON "public"."webbing_model"
  FOR SELECT
  TO PUBLIC
  USING (true);

REVOKE ALL ON SEQUENCE "public"."webbing_model_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."webbing_model_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."webbing_model_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."webbing_model_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."webbing_model_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."webbing_model_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."webbing_model_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."webbing_model_id_seq" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."webbing_model" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."webbing_model" TO "service_role";

COMMENT ON TABLE "public"."webbing_model" IS 'Deprecated catalog kept for app builds up to 1.9.5. New builds use SlackData. Dropped by GitHub issue #286.';

REVOKE ALL ON TABLE "public"."webbing_model" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."webbing_model" TO "postgres";
