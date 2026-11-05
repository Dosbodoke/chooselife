CREATE OR REPLACE FUNCTION public.is_festival_staff (
  target_festival_id uuid,
  target_profile_id  uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.festival_staff
    WHERE festival_id = target_festival_id
      AND profile_id = target_profile_id
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."is_festival_staff"(uuid, uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_festival_staff"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_festival_staff"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_festival_staff"(uuid, uuid) TO "postgres";
