CREATE TABLE "public"."favorite_highline" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "highline_id" uuid                     NOT NULL,
  "profile_id"  uuid                     NOT NULL,
  CONSTRAINT "favorite_highline_pkey" PRIMARY KEY (id),
  CONSTRAINT "favorite_highline_highline_id_fkey" FOREIGN KEY (highline_id) REFERENCES public.highline(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "favorite_highline_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE "public"."favorite_highline"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable delete for users based on profile_id" ON "public"."favorite_highline"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = profile_id));

CREATE POLICY "Enable insert for users based on profile_id" ON "public"."favorite_highline"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = profile_id));

CREATE POLICY "Enable read users based on profile_id" ON "public"."favorite_highline"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = profile_id));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."favorite_highline" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."favorite_highline" TO "service_role";

REVOKE ALL ON TABLE "public"."favorite_highline" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."favorite_highline" TO "postgres";
