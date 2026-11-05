CREATE TABLE "public"."choosen_course_entitlements" (
  "user_id"    uuid                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "choosen_course_entitlements_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "choosen_course_entitlements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."choosen_course_entitlements"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own course entitlement" ON "public"."choosen_course_entitlements"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."choosen_course_entitlements" TO "service_role";

REVOKE ALL ON TABLE "public"."choosen_course_entitlements" FROM "authenticated";

GRANT SELECT ON TABLE "public"."choosen_course_entitlements" TO "authenticated";

REVOKE ALL ON TABLE "public"."choosen_course_entitlements" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."choosen_course_entitlements" TO "postgres";

REVOKE ALL ON TABLE "public"."choosen_course_entitlements" FROM "anon";
