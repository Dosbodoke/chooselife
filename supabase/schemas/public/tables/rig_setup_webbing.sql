CREATE TABLE "public"."rig_setup_webbing" (
  "id"          bigint  GENERATED ALWAYS AS IDENTITY NOT NULL,
  "setup_id"    bigint  NOT NULL,
  "webbing_id"  bigint,
  "length"      numeric NOT NULL,
  "left_loop"   boolean NOT NULL,
  "right_loop"  boolean NOT NULL,
  "description" text,
  "webbing_type" public.webbing_type NOT NULL,
  CONSTRAINT "rig_setup_webbing_pkey" PRIMARY KEY (id),
  CONSTRAINT "rig_setup_webbing_setup_id_fkey" FOREIGN KEY (setup_id) REFERENCES public.rig_setup(id) ON DELETE CASCADE,
  CONSTRAINT "rig_setup_webbing_webbing_id_fkey" FOREIGN KEY (webbing_id) REFERENCES public.webbing(id) ON DELETE SET NULL
);

ALTER TABLE "public"."rig_setup_webbing"
  ENABLE ROW LEVEL SECURITY;


CREATE INDEX idx_rig_setup_webbing_setup_id ON public.rig_setup_webbing USING btree (setup_id);

CREATE POLICY "Anyone can read rig_setup_webbing" ON "public"."rig_setup_webbing"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "Authenticated users can delete rig_setup_webbing" ON "public"."rig_setup_webbing"
  FOR DELETE
  TO "authenticated"
  USING (true);

CREATE POLICY "Authenticated users can insert rig_setup_webbing" ON "public"."rig_setup_webbing"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rig_setup_webbing" ON "public"."rig_setup_webbing"
  FOR UPDATE
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON SEQUENCE "public"."rig_setup_webbing_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."rig_setup_webbing_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."rig_setup_webbing_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."rig_setup_webbing_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."rig_setup_webbing_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."rig_setup_webbing_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."rig_setup_webbing_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."rig_setup_webbing_id_seq" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rig_setup_webbing" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rig_setup_webbing" TO "service_role";

REVOKE ALL ON TABLE "public"."rig_setup_webbing" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rig_setup_webbing" TO "postgres";
