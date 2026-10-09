-- Human readable highline URLs (/highline/golden-hour instead of a UUID).
-- Slugs are generated from the name on insert and never change afterwards, so
-- shared links keep working when a highline is renamed. Highline updates are
-- open to every user, which is another reason the slug is not editable.
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."slugify"("value" "text") RETURNS "text"
    LANGUAGE "sql" STABLE STRICT
    SET "search_path" TO ''
    AS $$
  SELECT trim(BOTH '-' FROM regexp_replace(
    lower(extensions.unaccent(value)),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

ALTER FUNCTION "public"."slugify"("value" "text") OWNER TO "postgres";

-- Returns a slug for `highline_name` that no other highline uses, appending
-- -2, -3, ... on collisions.
CREATE OR REPLACE FUNCTION "public"."generate_highline_slug"("highline_name" "text", "highline_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  base text;
  candidate text;
  suffix integer := 1;
BEGIN
  base := trim(BOTH '-' FROM left(coalesce(public.slugify(highline_name), ''), 80));
  IF base = '' THEN
    base := 'highline';
  END IF;

  candidate := base;
  WHILE EXISTS (
    SELECT 1
    FROM public.highline h
    WHERE h.slug = candidate
      AND h.id IS DISTINCT FROM highline_id
  ) LOOP
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;

  RETURN candidate;
END;
$$;

ALTER FUNCTION "public"."generate_highline_slug"("highline_name" "text", "highline_id" "uuid") OWNER TO "postgres";

ALTER TABLE "public"."highline" ADD COLUMN "slug" "text";

-- Backfill oldest first so the original line keeps the unsuffixed slug.
DO $$
DECLARE
  hl record;
BEGIN
  FOR hl IN SELECT id, name FROM public.highline ORDER BY created_at, id LOOP
    UPDATE public.highline
    SET slug = public.generate_highline_slug(hl.name, hl.id)
    WHERE id = hl.id;
  END LOOP;
END;
$$;

ALTER TABLE "public"."highline"
    ALTER COLUMN "slug" SET NOT NULL,
    ADD CONSTRAINT "highline_slug_key" UNIQUE ("slug"),
    -- Lowercase words joined by single hyphens, and never shaped like a UUID so
    -- routes can tell the two identifiers apart.
    ADD CONSTRAINT "highline_slug_check" CHECK (
        "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        AND "slug" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    );

COMMENT ON COLUMN "public"."highline"."slug" IS 'URL identifier generated from the name on insert; immutable';

CREATE OR REPLACE FUNCTION "public"."set_highline_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.slug := OLD.slug;
  ELSE
    NEW.slug := public.generate_highline_slug(NEW.name, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_highline_slug"() OWNER TO "postgres";

CREATE TRIGGER "set_highline_slug"
    BEFORE INSERT OR UPDATE ON "public"."highline"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_highline_slug"();

-- Expose the slug and allow looking a highline up by it. The return table
-- changes, so the function must be dropped and recreated.
DROP FUNCTION IF EXISTS "public"."get_highline"("uuid"[], "text", integer, integer, "uuid");

CREATE FUNCTION "public"."get_highline"("searchid" "uuid"[] DEFAULT NULL::"uuid"[], "searchname" "text" DEFAULT ''::"text", "pagesize" integer DEFAULT NULL::integer, "pageparam" integer DEFAULT NULL::integer, "userid" "uuid" DEFAULT NULL::"uuid", "searchslug" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "name" "text", "height" numeric, "length" numeric, "description" "text", "sector_id" bigint, "cover_image" "text", "anchor_a_long" double precision, "anchor_a_lat" double precision, "anchor_b_long" double precision, "anchor_b_lat" double precision, "is_favorite" boolean, "status" "text", "whatsapp_group_url" "text", "slug" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id,
        h.created_at,
        h.name,
        h.height,
        h.length,
        h.description,
        h.sector_id,
        h.cover_image,
        extensions.st_x(anchor_a::extensions.geometry) as anchor_a_long,
        extensions.st_y(anchor_a::extensions.geometry) as anchor_a_lat,
        extensions.st_x(anchor_b::extensions.geometry) as anchor_b_long,
        extensions.st_y(anchor_b::extensions.geometry) as anchor_b_lat,
        EXISTS (
            SELECT 1
            FROM public.favorite_highline fh
            WHERE fh.highline_id = h.id
              AND fh.profile_id = userid
        ) as is_favorite,
        CASE
            WHEN r.rig_date IS NOT NULL AND r.unrigged_at IS NULL AND r.is_rigged = false THEN 'planned'
            WHEN r.rig_date IS NOT NULL AND r.unrigged_at IS NULL AND r.is_rigged = true THEN 'rigged'
            ELSE 'unrigged'
        END as status,
        h.whatsapp_group_url,
        h.slug
    FROM
        public.highline h
    LEFT JOIN (
      SELECT DISTINCT ON (rs.highline_id)
        rs.rig_date,
        rs.unrigged_at,
        rs.is_rigged,
        rs.highline_id
      FROM public.rig_setup rs
      ORDER BY rs.highline_id, rs.rig_date DESC, rs.id DESC
    ) r ON r.highline_id = h.id
    WHERE
        (searchid IS NULL OR h.id = ANY(searchid))
        AND (searchslug IS NULL OR h.slug = searchslug)
        AND (searchname = '' OR h.name ILIKE '%' || searchname || '%')
    LIMIT pagesize OFFSET COALESCE((pageparam - 1) * pagesize, 0);
END;
$$;

ALTER FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid", "searchslug" "text") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid", "searchslug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid", "searchslug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid", "searchslug" "text") TO "service_role";
