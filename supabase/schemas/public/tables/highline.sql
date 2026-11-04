CREATE TABLE "public"."highline" (
  "id"                 uuid                             NOT NULL DEFAULT gen_random_uuid(),
  "created_at"         timestamp with time zone         NOT NULL DEFAULT now(),
  "name"               text                             NOT NULL,
  "height"             numeric                          NOT NULL,
  "length"             numeric                          NOT NULL,
  "description"        text,
  "sector_id"          bigint,
  "cover_image"        text,
  "anchor_a"           extensions.geography(Point,4326) DEFAULT NULL::extensions.geography,
  "anchor_b"           extensions.geography(Point,4326) DEFAULT NULL::extensions.geography,
  "whatsapp_group_url" text,
  "slug"               text                             NOT NULL,
  CONSTRAINT "highline_pkey" PRIMARY KEY (id),
  CONSTRAINT "highline_slug_check" CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (slug !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text))),
  CONSTRAINT "highline_slug_key" UNIQUE (slug),
  CONSTRAINT "highline_whatsapp_group_url_check" CHECK ((whatsapp_group_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'::text)),
  CONSTRAINT "highline_sector_id_fkey" FOREIGN KEY (sector_id) REFERENCES public.sector(id)
);

ALTER TABLE "public"."highline"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX highlines_geo_index ON public.highline USING gist (anchor_a);

CREATE TRIGGER set_highline_slug
  BEFORE INSERT OR UPDATE ON public.highline
  FOR EACH ROW
  EXECUTE FUNCTION public.set_highline_slug();

CREATE POLICY "Enable read access for all users" ON "public"."highline"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "Enable update for all users" ON "public"."highline"
  FOR UPDATE
  TO PUBLIC
  USING (true);

CREATE POLICY "public_insert" ON "public"."highline"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."highline" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."highline" TO "service_role";

COMMENT ON COLUMN "public"."highline"."cover_image" IS 'Card image cover';

COMMENT ON COLUMN "public"."highline"."description" IS 'Descrição da fita';

COMMENT ON COLUMN "public"."highline"."sector_id" IS 'Wich sector it belongs';

COMMENT ON COLUMN "public"."highline"."slug" IS 'URL identifier generated from the name on insert; immutable';

COMMENT ON COLUMN "public"."highline"."whatsapp_group_url" IS 'WhatsApp group invite link (https://chat.whatsapp.com/...)';

REVOKE ALL ON TABLE "public"."highline" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."highline" TO "postgres";
