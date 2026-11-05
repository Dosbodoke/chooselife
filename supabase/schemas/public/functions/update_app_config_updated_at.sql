CREATE OR REPLACE FUNCTION public.update_app_config_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."update_app_config_updated_at"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."update_app_config_updated_at"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_app_config_updated_at"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."update_app_config_updated_at"() TO "postgres";
