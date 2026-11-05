CREATE TABLE "public"."festival_staff" (
  "festival_id" uuid                     NOT NULL,
  "profile_id"  uuid                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "festival_staff_festival_id_fkey" FOREIGN KEY (festival_id) REFERENCES public.festival(id) ON DELETE CASCADE,
  CONSTRAINT "festival_staff_pkey" PRIMARY KEY (festival_id, profile_id),
  CONSTRAINT "festival_staff_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

ALTER TABLE "public"."festival_staff"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own festival staff memberships." ON "public"."festival_staff"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = profile_id));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_staff" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_staff" TO "service_role";

REVOKE ALL ON TABLE "public"."festival_staff" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_staff" TO "postgres";
