CREATE OR REPLACE FUNCTION public.set_normalized_profile_username()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.username := public.normalize_profile_username(NEW.username);
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_normalized_profile_username"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_normalized_profile_username"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_normalized_profile_username"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_normalized_profile_username"() TO "postgres";
