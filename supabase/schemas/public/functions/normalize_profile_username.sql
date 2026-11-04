CREATE OR REPLACE FUNCTION public.normalize_profile_username (
  value text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $function$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    ELSE '@' || regexp_replace(lower(btrim(value)), '^@+', '')
  END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."normalize_profile_username"(text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."normalize_profile_username"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."normalize_profile_username"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."normalize_profile_username"(text) TO "postgres";
