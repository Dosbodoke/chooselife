CREATE OR REPLACE FUNCTION public.get_crossing_time (
  highline_id uuid,
  page_number integer,
  page_size   integer
)
  RETURNS TABLE (
    instagram       text,
    crossing_time   integer,
    profile_picture text
  )
  LANGUAGE sql
  AS $function$
  select e.instagram, e.crossing_time, COALESCE(p.profile_picture, '') AS profile_picture
  from entry e
  LEFT JOIN profiles p on e.instagram = p.username
  where highline_id = get_crossing_time.highline_id 
  order by e.crossing_time asc
  OFFSET (get_crossing_time.page_number - 1) * get_crossing_time.page_size
  LIMIT get_crossing_time.page_size;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_crossing_time"(uuid, integer, integer) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_crossing_time"(uuid, integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_crossing_time"(uuid, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_crossing_time"(uuid, integer, integer) TO "postgres";
