CREATE TABLE "public"."trails" (
  "id"          bigint             GENERATED ALWAYS AS IDENTITY NOT NULL,
  "name"        text               NOT NULL,
  "color"       text               NOT NULL,
  "coordinates" double precision[] NOT NULL,
  CONSTRAINT "trails_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."trails"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow everyone to create trails" ON "public"."trails"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "Allow everyone to read trails" ON "public"."trails"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

REVOKE ALL ON SEQUENCE "public"."trails_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."trails_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."trails_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."trails_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."trails_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."trails_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."trails_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."trails_id_seq" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trails" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trails" TO "service_role";

REVOKE ALL ON TABLE "public"."trails" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trails" TO "postgres";
