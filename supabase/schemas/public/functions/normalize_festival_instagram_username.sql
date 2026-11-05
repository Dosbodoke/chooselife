CREATE OR REPLACE FUNCTION public.normalize_festival_instagram_username (
  value text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $function$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    ELSE lower(
      CASE
        WHEN left(btrim(value), 1) = '@' THEN btrim(value)
        ELSE '@' || btrim(value)
      END
    )
  END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."normalize_festival_instagram_username"(text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."normalize_festival_instagram_username"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."normalize_festival_instagram_username"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."normalize_festival_instagram_username"(text) TO "postgres";
