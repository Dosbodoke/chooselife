CREATE OR REPLACE FUNCTION public.get_festival_schedule_booking_limit()
  RETURNS integer
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public'
  AS $function$
DECLARE
  configured_limit INTEGER;
BEGIN
  SELECT CASE
    WHEN config.value #>> '{}' ~ '^[1-9][0-9]*$'
      THEN (config.value #>> '{}')::integer
    ELSE NULL
  END
  INTO configured_limit
  FROM public.app_config AS config
  WHERE config.key = 'festival_schedule_booking_limit';

  IF configured_limit IS NULL OR configured_limit < 1 THEN
    RAISE EXCEPTION 'Festival schedule booking limit is not configured';
  END IF;

  RETURN configured_limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_limit"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_limit"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_festival_schedule_booking_limit"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_limit"() TO "postgres";
