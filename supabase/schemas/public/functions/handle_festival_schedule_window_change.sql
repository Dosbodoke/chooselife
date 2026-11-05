CREATE OR REPLACE FUNCTION public.handle_festival_schedule_window_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  PERFORM public.regenerate_festival_schedule_window(NEW.id);
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."handle_festival_schedule_window_change"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."handle_festival_schedule_window_change"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."handle_festival_schedule_window_change"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_festival_schedule_window_change"() TO "postgres";
