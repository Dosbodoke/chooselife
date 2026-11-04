CREATE OR REPLACE FUNCTION public.slugify (
  value text
)
  RETURNS text
  LANGUAGE sql
  STABLE
  STRICT
  SET search_path TO ''
  AS $function$
  SELECT trim(BOTH '-' FROM regexp_replace(
    lower(extensions.unaccent(value)),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$function$;

GRANT EXECUTE ON FUNCTION "public"."slugify"(text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."slugify"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."slugify"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."slugify"(text) TO "postgres";
