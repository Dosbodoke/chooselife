-- Optional WhatsApp group invite for a highline (e.g. permanent lines with a
-- community group). Highline updates are open to every user, so restrict the
-- value to WhatsApp invite links instead of accepting arbitrary URLs.
ALTER TABLE "public"."highline"
    ADD COLUMN "whatsapp_group_url" "text",
    ADD CONSTRAINT "highline_whatsapp_group_url_check"
        CHECK ("whatsapp_group_url" ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$');

COMMENT ON COLUMN "public"."highline"."whatsapp_group_url" IS 'WhatsApp group invite link (https://chat.whatsapp.com/...)';

-- The return table changes, so the function must be dropped and recreated.
DROP FUNCTION IF EXISTS "public"."get_highline"("uuid"[], "text", integer, integer, "uuid");

CREATE FUNCTION "public"."get_highline"("searchid" "uuid"[] DEFAULT NULL::"uuid"[], "searchname" "text" DEFAULT ''::"text", "pagesize" integer DEFAULT NULL::integer, "pageparam" integer DEFAULT NULL::integer, "userid" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "name" "text", "height" numeric, "length" numeric, "description" "text", "sector_id" bigint, "cover_image" "text", "anchor_a_long" double precision, "anchor_a_lat" double precision, "anchor_b_long" double precision, "anchor_b_lat" double precision, "is_favorite" boolean, "status" "text", "whatsapp_group_url" "text")
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
        h.whatsapp_group_url
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
        AND (searchname = '' OR h.name ILIKE '%' || searchname || '%')
    LIMIT pagesize OFFSET COALESCE((pageparam - 1) * pagesize, 0);
END;
$$;

ALTER FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid") TO "service_role";
