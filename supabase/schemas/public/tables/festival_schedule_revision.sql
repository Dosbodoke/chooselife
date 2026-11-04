CREATE TABLE "public"."festival_schedule_revision" (
  "festival_id" uuid                     NOT NULL,
  "updated_at"  timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "festival_schedule_revision_festival_id_fkey" FOREIGN KEY (festival_id) REFERENCES public.festival(id) ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_revision_pkey" PRIMARY KEY (festival_id)
);

ALTER TABLE "public"."festival_schedule_revision"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."festival_schedule_revision"
  REPLICA IDENTITY FULL;

CREATE POLICY "Festival schedule revisions are viewable by everyone." ON "public"."festival_schedule_revision"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_revision" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_revision" TO "service_role";

REVOKE ALL ON TABLE "public"."festival_schedule_revision" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_revision" TO "postgres";
