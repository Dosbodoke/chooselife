CREATE OR REPLACE FUNCTION public.validate_locale_keys (
  json_data jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  AS $function$
DECLARE
    locale_key text;
BEGIN
    FOR locale_key IN SELECT jsonb_object_keys(json_data)
    LOOP
        IF NOT (locale_key::language IN (SELECT unnest(enum_range(NULL::language)))) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    RETURN TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_locale_keys"(jsonb) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."validate_locale_keys"(jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_locale_keys"(jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_locale_keys"(jsonb) TO "postgres";
