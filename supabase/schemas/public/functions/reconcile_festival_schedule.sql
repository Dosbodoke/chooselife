CREATE OR REPLACE FUNCTION public.reconcile_festival_schedule (
  festival_slug text DEFAULT NULL::text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  target_festival_id UUID;
BEGIN
  IF festival_slug IS NOT NULL THEN
    SELECT id
    INTO target_festival_id
    FROM public.festival
    WHERE slug = festival_slug
    LIMIT 1;
  END IF;

  PERFORM public.reconcile_festival_schedule_by_id(target_festival_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reconcile_festival_schedule"(text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."reconcile_festival_schedule"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reconcile_festival_schedule"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reconcile_festival_schedule"(text) TO "postgres";
