CREATE OR REPLACE FUNCTION public.profile_username_disambiguated (
  normalized_username text,
  profile_id          uuid
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $function$
  WITH parts AS (
    SELECT
      regexp_replace(normalized_username, '^@', '') AS username,
      '_' || substr(md5(profile_id::TEXT), 1, 6) AS suffix
  )
  SELECT '@' || btrim(left(username, 30 - length(suffix)), '.') || suffix
  FROM parts;
$function$;

GRANT EXECUTE ON FUNCTION "public"."profile_username_disambiguated"(text, uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."profile_username_disambiguated"(text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."profile_username_disambiguated"(text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."profile_username_disambiguated"(text, uuid) TO "postgres";
