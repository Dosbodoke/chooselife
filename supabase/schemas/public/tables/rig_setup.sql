CREATE TABLE "public"."rig_setup" (
  "id"          bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "highline_id" uuid                     NOT NULL,
  "riggers"     uuid[]                   NOT NULL,
  "rig_date"    timestamp with time zone NOT NULL,
  "unrigged_at" timestamp with time zone,
  "is_rigged"   boolean                  NOT NULL,
  CONSTRAINT "rig_setup_highline_id_fkey" FOREIGN KEY (highline_id) REFERENCES public.highline(id) ON DELETE CASCADE,
  CONSTRAINT "rig_setup_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."rig_setup"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_rig_setup_highline_id ON public.rig_setup USING btree (highline_id);

CREATE POLICY "Anyone can read rig_setup" ON "public"."rig_setup"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "Authenticated users can insert rig_setup" ON "public"."rig_setup"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rig_setup" ON "public"."rig_setup"
  FOR UPDATE
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON SEQUENCE "public"."rig_setup_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."rig_setup_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."rig_setup_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."rig_setup_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."rig_setup_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."rig_setup_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."rig_setup_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."rig_setup_id_seq" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rig_setup" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rig_setup" TO "service_role";

REVOKE ALL ON TABLE "public"."rig_setup" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rig_setup" TO "postgres";
