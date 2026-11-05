CREATE OR REPLACE FUNCTION public.get_festival_schedule_booking_cooldown_seconds()
  RETURNS integer
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public'
  AS $function$
DECLARE
  configured_seconds INTEGER;
BEGIN
  SELECT CASE
    WHEN config.value #>> '{}' ~ '^[0-9]+$'
      THEN (config.value #>> '{}')::integer
    ELSE NULL
  END
  INTO configured_seconds
  FROM public.app_config AS config
  WHERE config.key = 'festival_schedule_booking_cooldown_seconds';

  IF configured_seconds IS NULL OR configured_seconds < 0 THEN
    RAISE EXCEPTION 'Festival schedule booking cooldown is not configured';
  END IF;

  RETURN configured_seconds;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_cooldown_seconds"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_cooldown_seconds"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_festival_schedule_booking_cooldown_seconds"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_cooldown_seconds"() TO "postgres";
