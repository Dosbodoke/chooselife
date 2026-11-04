CREATE OR REPLACE FUNCTION public.capture_webbing_legacy_model()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
  IF NEW.model IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.model IS DISTINCT FROM OLD.model) THEN
    NEW.legacy_model_snapshot :=
      public.webbing_legacy_model_snapshot(NEW.model, 'legacy-client');
  ELSIF TG_OP = 'INSERT' THEN
    NEW.legacy_model_snapshot := NULL;
  ELSE
    NEW.legacy_model_snapshot := OLD.legacy_model_snapshot;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."capture_webbing_legacy_model"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."capture_webbing_legacy_model"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."capture_webbing_legacy_model"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."capture_webbing_legacy_model"() TO "postgres";
