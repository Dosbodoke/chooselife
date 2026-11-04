CREATE TABLE "public"."festival" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "slug"       text                     NOT NULL,
  "name"       text                     NOT NULL,
  "subtitle"   text,
  "start_at"   timestamp with time zone NOT NULL,
  "end_at"     timestamp with time zone NOT NULL,
  "timezone"   text                     NOT NULL DEFAULT 'America/Sao_Paulo'::text,
  "is_active"  boolean                  NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "festival_pkey" PRIMARY KEY (id),
  CONSTRAINT "festival_slug_key" UNIQUE (slug)
);

ALTER TABLE "public"."festival"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Festival rows are viewable by everyone." ON "public"."festival"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival" TO "service_role";

REVOKE ALL ON TABLE "public"."festival" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival" TO "postgres";
