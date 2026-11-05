CREATE TABLE "public"."events" (
  "id"               bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "title"            text                     NOT NULL,
  "description"      text,
  "city"             text                     NOT NULL,
  "state"            text,
  "country"          text                     NOT NULL,
  "start_date"       timestamp with time zone NOT NULL,
  "end_date"         timestamp with time zone,
  "type"             text                     NOT NULL,
  "lines"            integer,
  "registration_url" text,
  CONSTRAINT "events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."events"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_events" ON "public"."events"
  FOR SELECT
  TO PUBLIC
  USING (true);

REVOKE ALL ON SEQUENCE "public"."events_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."events_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."events_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."events_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."events_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."events_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."events_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."events_id_seq" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "service_role";

REVOKE ALL ON TABLE "public"."events" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "postgres";
