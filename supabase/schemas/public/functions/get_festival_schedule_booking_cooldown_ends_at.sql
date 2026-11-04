CREATE OR REPLACE FUNCTION public.get_festival_schedule_booking_cooldown_ends_at (
  target_festival_id uuid
)
  RETURNS timestamp WITH time zone
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  actor_profile_id UUID := auth.uid();
  cooldown_seconds INTEGER := public.get_festival_schedule_booking_cooldown_seconds();
  cooldown_ends_at TIMESTAMPTZ;
BEGIN
  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_festival_staff(target_festival_id, actor_profile_id)
    OR cooldown_seconds = 0 THEN
    RETURN NULL;
  END IF;

  SELECT MAX(booking.created_at) + make_interval(secs => cooldown_seconds)
  INTO cooldown_ends_at
  FROM public.festival_schedule_booking AS booking
  WHERE booking.festival_id = target_festival_id
    AND booking.profile_id = actor_profile_id
    AND booking.booking_source = 'participant';

  IF cooldown_ends_at <= timezone('utc'::text, now()) THEN
    RETURN NULL;
  END IF;

  RETURN cooldown_ends_at;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_cooldown_ends_at"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_cooldown_ends_at"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_festival_schedule_booking_cooldown_ends_at"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_booking_cooldown_ends_at"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_festival_schedule_booking_cooldown_ends_at"(uuid) FROM PUBLIC, "anon";
