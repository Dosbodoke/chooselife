
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "gis";

ALTER SCHEMA "gis" OWNER TO "postgres";

CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."material_enum" AS ENUM (
    'nylon',
    'dyneema',
    'polyester'
);

ALTER TYPE "public"."material_enum" OWNER TO "postgres";

CREATE TYPE "public"."weave_enum" AS ENUM (
    'flat',
    'tubular'
);

ALTER TYPE "public"."weave_enum" OWNER TO "postgres";

CREATE TYPE "public"."webbing_type" AS ENUM (
    'main',
    'backup'
);

ALTER TYPE "public"."webbing_type" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_crossing_time"("highline_id" "uuid", "page_number" integer, "page_size" integer) RETURNS TABLE("instagram" "text", "crossing_time" integer, "profile_picture" "text")
    LANGUAGE "sql"
    AS $$
  select e.instagram, e.crossing_time, COALESCE(p.profile_picture, '') AS profile_picture
  from entry e
  LEFT JOIN profiles p on e.instagram = p.username
  where highline_id = get_crossing_time.highline_id 
  order by e.crossing_time asc
  OFFSET (get_crossing_time.page_number - 1) * get_crossing_time.page_size
  LIMIT get_crossing_time.page_size;
$$;

ALTER FUNCTION "public"."get_crossing_time"("highline_id" "uuid", "page_number" integer, "page_size" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_highline"("searchid" "uuid"[] DEFAULT NULL::"uuid"[], "searchname" "text" DEFAULT ''::"text", "pagesize" integer DEFAULT NULL::integer, "pageparam" integer DEFAULT NULL::integer, "userid" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "name" "text", "height" numeric, "length" numeric, "description" "text", "sector_id" bigint, "cover_image" "text", "anchor_a_long" double precision, "anchor_a_lat" double precision, "anchor_b_long" double precision, "anchor_b_lat" double precision, "is_favorite" boolean, "status" "text")
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
            WHEN r.rig_date IS NOT NULL AND r.is_rigged = false THEN 'planned'
            WHEN r.rig_date IS NOT NULL AND r.is_rigged = true THEN 'rigged'
            ELSE 'unrigged'
        END as status
    FROM
        public.highline h
    LEFT JOIN (
      SELECT rig_date, unrigged_at, is_rigged, highline_id
      FROM public.rig_setup
      ORDER BY rig_date DESC
      LIMIT 1
    ) r ON r.highline_id = h.id
    WHERE
        (searchid IS NULL OR h.id = ANY(searchid))
        AND (searchname = '' OR h.name ILIKE '%' || searchname || '%')
    LIMIT pagesize OFFSET (pageparam - 1) * pagesize;
END;
$$;

ALTER FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_total_cadenas"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("instagram" "text", "total_cadenas" integer, "profile_picture" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RETURN QUERY
SELECT e.instagram, SUM(e.cadenas)::integer AS total_cadenas, COALESCE(p.profile_picture, '') AS profile_picture 
FROM public.entry e 
LEFT JOIN public.profiles p ON e.instagram = p.username 
WHERE e.highline_id = ANY(get_total_cadenas.highline_ids) 
AND (e.created_at >= COALESCE(start_date, '1970-01-01'::timestamp) OR start_date IS NULL) 
AND (e.created_at <= COALESCE(end_date, now()) OR end_date IS NULL) 
GROUP BY e.instagram, p.profile_picture 
HAVING SUM(e.cadenas) > 0 
ORDER BY total_cadenas DESC 
OFFSET (get_total_cadenas.page_number - 1) * get_total_cadenas.page_size 
LIMIT get_total_cadenas.page_size;
END;
$$;

ALTER FUNCTION "public"."get_total_cadenas"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_total_full_lines"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("instagram" "text", "total_full_lines" integer, "profile_picture" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RETURN QUERY
SELECT e.instagram, SUM(e.full_lines)::integer AS total_full_lines, COALESCE(p.profile_picture, '') AS profile_picture 
FROM public.entry e 
LEFT JOIN public.profiles p ON e.instagram = p.username 
WHERE e.highline_id = ANY(get_total_full_lines.highline_ids) 
AND (e.created_at >= COALESCE(start_date, '1970-01-01'::timestamp) OR start_date IS NULL) 
AND (e.created_at <= COALESCE(end_date, now()) OR end_date IS NULL) 
GROUP BY e.instagram, p.profile_picture 
HAVING SUM(e.full_lines) > 0 
ORDER BY total_full_lines DESC 
OFFSET (get_total_full_lines.page_number - 1) * get_total_full_lines.page_size 
LIMIT get_total_full_lines.page_size;
END;
$$;

ALTER FUNCTION "public"."get_total_full_lines"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_total_walked"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("instagram" "text", "total_distance_walked" integer, "profile_picture" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RETURN QUERY
SELECT e.instagram, SUM(e.distance_walked)::integer AS total_distance_walked, COALESCE(p.profile_picture, '') AS profile_picture 
FROM public.entry e 
LEFT JOIN public.profiles p ON e.instagram = p.username 
WHERE e.highline_id = ANY(get_total_walked.highline_ids) 
AND (e.created_at >= COALESCE(start_date, '1970-01-01'::timestamp) OR start_date IS NULL) 
AND (e.created_at <= COALESCE(end_date, now()) OR end_date IS NULL) 
AND e.distance_walked IS NOT NULL 
GROUP BY e.instagram, p.profile_picture 
ORDER BY total_distance_walked DESC 
OFFSET (get_total_walked.page_number - 1) * get_total_walked.page_size 
LIMIT page_size;
END;
$$;

ALTER FUNCTION "public"."get_total_walked"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."highlines_in_view"("min_lat" double precision, "min_long" double precision, "max_lat" double precision, "max_long" double precision) RETURNS TABLE("id" "uuid", "name" "text", "anchor_a_lat" double precision, "anchor_a_long" double precision, "anchor_b_lat" double precision, "anchor_b_long" double precision)
    LANGUAGE "sql"
    AS $$
	select id, name, st_y(anchor_a::geometry) as anchor_a_lat, st_x(anchor_a::geometry) as anchor_b_long, st_y(anchor_b::geometry) as anchor_b_lat, st_x(anchor_b::geometry) as anchor_b_long
	from public.highline
	where anchor_a && ST_SetSRID(ST_MakeBox2D(ST_Point(min_long, min_lat), ST_Point(max_long, max_lat)), 4326)
$$;

ALTER FUNCTION "public"."highlines_in_view"("min_lat" double precision, "min_long" double precision, "max_lat" double precision, "max_long" double precision) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."profile_stats"("username" "text") RETURNS TABLE("total_distance_walked" numeric, "total_cadenas" integer, "total_full_lines" integer)
    LANGUAGE "sql"
    AS $$ 
    SELECT      
        sum(distance_walked) as total_distance_walked,
        sum(cadenas) as total_cadenas,
        sum(full_lines) as total_full_lines
  FROM entry
  WHERE
    instagram = username;
$$;

ALTER FUNCTION "public"."profile_stats"("username" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."entry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instagram" "text" NOT NULL,
    "is_highliner" boolean NOT NULL,
    "distance_walked" numeric,
    "highline_id" "uuid" NOT NULL,
    "witness" "text"[],
    "crossing_time" numeric,
    "comment" "text",
    "cadenas" integer DEFAULT 0,
    "full_lines" integer DEFAULT 0
);

ALTER TABLE "public"."entry" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."favorite_highline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "highline_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL
);

ALTER TABLE "public"."favorite_highline" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."highline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "height" numeric NOT NULL,
    "length" numeric NOT NULL,
    "description" "text",
    "sector_id" bigint,
    "cover_image" "text",
    "anchor_a" "extensions"."geography"(Point,4326) DEFAULT NULL::"extensions"."geography",
    "anchor_b" "extensions"."geography"(Point,4326) DEFAULT NULL::"extensions"."geography"
);

ALTER TABLE "public"."highline" OWNER TO "postgres";

COMMENT ON COLUMN "public"."highline"."description" IS 'Descrição da fita';

COMMENT ON COLUMN "public"."highline"."sector_id" IS 'Wich sector it belongs';

COMMENT ON COLUMN "public"."highline"."cover_image" IS 'Card image cover';

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" character varying,
    "description" character varying,
    "birthday" "date",
    "username" character varying,
    "profile_picture" "text"
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rig_setup" (
    "id" bigint NOT NULL,
    "highline_id" "uuid" NOT NULL,
    "riggers" "uuid"[] NOT NULL,
    "rig_date" timestamp with time zone NOT NULL,
    "unrigged_at" timestamp with time zone,
    "is_rigged" boolean NOT NULL
);

ALTER TABLE "public"."rig_setup" OWNER TO "postgres";

ALTER TABLE "public"."rig_setup" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."rig_setup_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."rig_setup_webbing" (
    "id" bigint NOT NULL,
    "setup_id" bigint NOT NULL,
    "webbing_id" bigint,
    "length" numeric NOT NULL,
    "left_loop" boolean NOT NULL,
    "right_loop" boolean NOT NULL,
    "description" "text",
    "webbing_type" "public"."webbing_type" NOT NULL
);

ALTER TABLE "public"."rig_setup_webbing" OWNER TO "postgres";

ALTER TABLE "public"."rig_setup_webbing" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."rig_setup_webbing_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."sector" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "name" "text" NOT NULL
);

ALTER TABLE "public"."sector" OWNER TO "postgres";

COMMENT ON TABLE "public"."sector" IS 'Setor de Highlines';

ALTER TABLE "public"."sector" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sector_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."webbing" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "length" numeric NOT NULL,
    "left_loop" boolean NOT NULL,
    "right_loop" boolean NOT NULL,
    "model" bigint,
    "tag_name" "text",
    "description" "text"
);

ALTER TABLE "public"."webbing" OWNER TO "postgres";

ALTER TABLE "public"."webbing" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."webbing_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."webbing_model" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "material" "public"."material_enum" NOT NULL,
    "weave" "public"."weave_enum" NOT NULL
);

ALTER TABLE "public"."webbing_model" OWNER TO "postgres";

ALTER TABLE "public"."webbing_model" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."webbing_model_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE ONLY "public"."entry"
    ADD CONSTRAINT "entry_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."favorite_highline"
    ADD CONSTRAINT "favorite_highline_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."highline"
    ADD CONSTRAINT "highline_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");

ALTER TABLE ONLY "public"."rig_setup"
    ADD CONSTRAINT "rig_setup_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rig_setup_webbing"
    ADD CONSTRAINT "rig_setup_webbing_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."sector"
    ADD CONSTRAINT "sector_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."webbing_model"
    ADD CONSTRAINT "webbing_model_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."webbing"
    ADD CONSTRAINT "webbing_pkey" PRIMARY KEY ("id");

CREATE INDEX "highlines_geo_index" ON "public"."highline" USING "gist" ("anchor_a");

CREATE INDEX "idx_rig_setup_highline_id" ON "public"."rig_setup" USING "btree" ("highline_id");

CREATE INDEX "idx_rig_setup_webbing_setup_id" ON "public"."rig_setup_webbing" USING "btree" ("setup_id");

CREATE INDEX "idx_webbings_model" ON "public"."webbing" USING "btree" ("model");

CREATE INDEX "idx_webbings_user_id" ON "public"."webbing" USING "btree" ("user_id");

ALTER TABLE ONLY "public"."entry"
    ADD CONSTRAINT "entry_highline_id_fkey" FOREIGN KEY ("highline_id") REFERENCES "public"."highline"("id");

ALTER TABLE ONLY "public"."favorite_highline"
    ADD CONSTRAINT "favorite_highline_highline_id_fkey" FOREIGN KEY ("highline_id") REFERENCES "public"."highline"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."favorite_highline"
    ADD CONSTRAINT "favorite_highline_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."highline"
    ADD CONSTRAINT "highline_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "public"."sector"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rig_setup"
    ADD CONSTRAINT "rig_setup_highline_id_fkey" FOREIGN KEY ("highline_id") REFERENCES "public"."highline"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rig_setup_webbing"
    ADD CONSTRAINT "rig_setup_webbing_setup_id_fkey" FOREIGN KEY ("setup_id") REFERENCES "public"."rig_setup"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rig_setup_webbing"
    ADD CONSTRAINT "rig_setup_webbing_webbing_id_fkey" FOREIGN KEY ("webbing_id") REFERENCES "public"."webbing"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."webbing"
    ADD CONSTRAINT "webbing_model_fkey" FOREIGN KEY ("model") REFERENCES "public"."webbing_model"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."webbing"
    ADD CONSTRAINT "webbing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Allow authenticated users to insert webbing" ON "public"."webbing" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow users to delete their own webbing" ON "public"."webbing" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Allow users to read their own webbing" ON "public"."webbing" FOR SELECT USING (true);

CREATE POLICY "Allow users to read webbing models" ON "public"."webbing_model" FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own webbing" ON "public"."webbing" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Anyone can read rig_setup" ON "public"."rig_setup" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Anyone can read rig_setup_webbing" ON "public"."rig_setup_webbing" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Authenticated users can delete rig_setup_webbing" ON "public"."rig_setup_webbing" FOR DELETE TO "authenticated" USING (true);

CREATE POLICY "Authenticated users can insert rig_setup" ON "public"."rig_setup" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Authenticated users can insert rig_setup_webbing" ON "public"."rig_setup_webbing" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Authenticated users can update rig_setup" ON "public"."rig_setup" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update rig_setup_webbing" ON "public"."rig_setup_webbing" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for users based on profile_id" ON "public"."favorite_highline" FOR DELETE USING (("auth"."uid"() = "profile_id"));

CREATE POLICY "Enable insert for everyone" ON "public"."entry" FOR INSERT TO "anon", "authenticated" WITH CHECK (true);

CREATE POLICY "Enable insert for users based on profile_id" ON "public"."favorite_highline" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));

CREATE POLICY "Enable read access for all users" ON "public"."entry" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."highline" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."sector" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Enable read users based on profile_id" ON "public"."favorite_highline" FOR SELECT USING (("auth"."uid"() = "profile_id"));

CREATE POLICY "Enable update for all users" ON "public"."highline" FOR UPDATE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can update own profile." ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));

ALTER TABLE "public"."entry" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."favorite_highline" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."highline" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert" ON "public"."highline" FOR INSERT TO "anon", "authenticated" WITH CHECK (true);

ALTER TABLE "public"."rig_setup" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rig_setup_webbing" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sector" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."webbing" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."webbing_model" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."get_crossing_time"("highline_id" "uuid", "page_number" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_crossing_time"("highline_id" "uuid", "page_number" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_crossing_time"("highline_id" "uuid", "page_number" integer, "page_size" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_highline"("searchid" "uuid"[], "searchname" "text", "pagesize" integer, "pageparam" integer, "userid" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_total_cadenas"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_cadenas"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_cadenas"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_total_full_lines"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_full_lines"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_full_lines"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_total_walked"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_walked"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_walked"("highline_ids" "uuid"[], "page_number" integer, "page_size" integer, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."highlines_in_view"("min_lat" double precision, "min_long" double precision, "max_lat" double precision, "max_long" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."highlines_in_view"("min_lat" double precision, "min_long" double precision, "max_lat" double precision, "max_long" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."highlines_in_view"("min_lat" double precision, "min_long" double precision, "max_lat" double precision, "max_long" double precision) TO "service_role";

GRANT ALL ON FUNCTION "public"."profile_stats"("username" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."profile_stats"("username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_stats"("username" "text") TO "service_role";

GRANT ALL ON TABLE "public"."entry" TO "anon";
GRANT ALL ON TABLE "public"."entry" TO "authenticated";
GRANT ALL ON TABLE "public"."entry" TO "service_role";

GRANT ALL ON TABLE "public"."favorite_highline" TO "anon";
GRANT ALL ON TABLE "public"."favorite_highline" TO "authenticated";
GRANT ALL ON TABLE "public"."favorite_highline" TO "service_role";

GRANT ALL ON TABLE "public"."highline" TO "anon";
GRANT ALL ON TABLE "public"."highline" TO "authenticated";
GRANT ALL ON TABLE "public"."highline" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."rig_setup" TO "anon";
GRANT ALL ON TABLE "public"."rig_setup" TO "authenticated";
GRANT ALL ON TABLE "public"."rig_setup" TO "service_role";

GRANT ALL ON SEQUENCE "public"."rig_setup_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rig_setup_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rig_setup_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."rig_setup_webbing" TO "anon";
GRANT ALL ON TABLE "public"."rig_setup_webbing" TO "authenticated";
GRANT ALL ON TABLE "public"."rig_setup_webbing" TO "service_role";

GRANT ALL ON SEQUENCE "public"."rig_setup_webbing_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rig_setup_webbing_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rig_setup_webbing_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."sector" TO "anon";
GRANT ALL ON TABLE "public"."sector" TO "authenticated";
GRANT ALL ON TABLE "public"."sector" TO "service_role";

GRANT ALL ON SEQUENCE "public"."sector_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sector_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sector_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."webbing" TO "anon";
GRANT ALL ON TABLE "public"."webbing" TO "authenticated";
GRANT ALL ON TABLE "public"."webbing" TO "service_role";

GRANT ALL ON SEQUENCE "public"."webbing_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."webbing_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."webbing_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."webbing_model" TO "anon";
GRANT ALL ON TABLE "public"."webbing_model" TO "authenticated";
GRANT ALL ON TABLE "public"."webbing_model" TO "service_role";

GRANT ALL ON SEQUENCE "public"."webbing_model_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."webbing_model_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."webbing_model_id_seq" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

RESET ALL;