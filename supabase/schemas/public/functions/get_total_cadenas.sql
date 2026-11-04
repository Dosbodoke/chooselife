CREATE OR REPLACE FUNCTION public.get_total_cadenas (
  highline_ids uuid[],
  page_number  integer,
  page_size    integer,
  start_date   timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  end_date     timestamp with time zone DEFAULT NULL::timestamp WITH time zone
)
  RETURNS TABLE (
    instagram       text,
    total_cadenas   integer,
    profile_picture text
  )
  LANGUAGE plpgsql
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_total_cadenas"(uuid[], integer, integer, timestamp WITH time zone, timestamp WITH time zone) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_total_cadenas"(uuid[], integer, integer, timestamp WITH time zone, timestamp WITH time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_total_cadenas"(uuid[], integer, integer, timestamp WITH time zone, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_total_cadenas"(uuid[], integer, integer, timestamp WITH time zone, timestamp WITH time zone) TO "postgres";
