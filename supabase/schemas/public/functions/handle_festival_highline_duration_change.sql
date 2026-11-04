CREATE OR REPLACE FUNCTION public.handle_festival_highline_duration_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  target_window RECORD;
BEGIN
  FOR target_window IN
    SELECT id
    FROM public.festival_schedule_window
    WHERE festival_id = NEW.festival_id
      AND highline_id = NEW.highline_id
  LOOP
    PERFORM public.regenerate_festival_schedule_window(target_window.id);
  END LOOP;

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."handle_festival_highline_duration_change"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."handle_festival_highline_duration_change"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."handle_festival_highline_duration_change"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_festival_highline_duration_change"() TO "postgres";
