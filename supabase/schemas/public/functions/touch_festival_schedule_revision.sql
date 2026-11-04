CREATE OR REPLACE FUNCTION public.touch_festival_schedule_revision()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
BEGIN
  INSERT INTO public.festival_schedule_revision (festival_id, updated_at)
  VALUES (COALESCE(NEW.festival_id, OLD.festival_id), timezone('utc'::text, now()))
  ON CONFLICT (festival_id) DO UPDATE
  SET updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."touch_festival_schedule_revision"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."touch_festival_schedule_revision"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."touch_festival_schedule_revision"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."touch_festival_schedule_revision"() TO "postgres";
