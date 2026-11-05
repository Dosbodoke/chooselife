CREATE TABLE "public"."entry" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "instagram"       text                     NOT NULL,
  "is_highliner"    boolean                  NOT NULL,
  "distance_walked" numeric,
  "highline_id"     uuid                     NOT NULL,
  "witness"         text[],
  "crossing_time"   numeric,
  "comment"         text,
  "cadenas"         integer                  DEFAULT 0,
  "full_lines"      integer                  DEFAULT 0,
  CONSTRAINT "entry_pkey" PRIMARY KEY (id),
  CONSTRAINT "entry_highline_id_fkey" FOREIGN KEY (highline_id) REFERENCES public.highline(id)
);

ALTER TABLE "public"."entry"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for everyone" ON "public"."entry"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."entry"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entry" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entry" TO "service_role";

REVOKE ALL ON TABLE "public"."entry" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entry" TO "postgres";
