CREATE OR REPLACE FUNCTION public.profile_stats (
  username text
)
  RETURNS TABLE (
    total_distance_walked numeric,
    total_cadenas         integer,
    total_full_lines      integer
  )
  LANGUAGE sql
  AS $function$ 
    SELECT      
        sum(distance_walked) as total_distance_walked,
        sum(cadenas) as total_cadenas,
        sum(full_lines) as total_full_lines
  FROM entry
  WHERE
    instagram = username;
$function$;

GRANT EXECUTE ON FUNCTION "public"."profile_stats"(text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."profile_stats"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."profile_stats"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."profile_stats"(text) TO "postgres";
