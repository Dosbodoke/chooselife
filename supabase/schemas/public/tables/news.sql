CREATE TABLE "public"."news" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "content"         text                     NOT NULL,
  "slug"            text                     NOT NULL,
  "organization_id" uuid,
  CONSTRAINT "news_pkey" PRIMARY KEY (id),
  CONSTRAINT "news_slug_key" UNIQUE (slug),
  CONSTRAINT "news_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

ALTER TABLE "public"."news"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public news are viewable by everyone." ON "public"."news"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news" TO "service_role";

REVOKE ALL ON TABLE "public"."news" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news" TO "postgres";
