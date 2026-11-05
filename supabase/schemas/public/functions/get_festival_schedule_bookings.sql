CREATE OR REPLACE FUNCTION public.get_festival_schedule_bookings (
  target_festival_id uuid
)
  RETURNS TABLE (
    id                         uuid,
    slot_id                    uuid,
    festival_id                uuid,
    highline_id                uuid,
    created_at                 timestamp with time zone,
    completed_at               timestamp with time zone,
    status                     public.festival_schedule_booking_status_enum,
    participant_display_name   text,
    participant_secondary_text text,
    is_viewer                  boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  actor_profile_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    booking.id,
    booking.slot_id,
    booking.festival_id,
    booking.highline_id,
    booking.created_at,
    booking.completed_at,
    booking.status,
    (
      CASE
        WHEN booking.profile_id IS NOT NULL THEN COALESCE(
          NULLIF(btrim(profile.name::text), ''),
          NULLIF(btrim(profile.username::text), ''),
          'Participant'
        )
        ELSE COALESCE(NULLIF(btrim(booking.display_name::text), ''), 'Guest')
      END
    )::text AS participant_display_name,
    (
      CASE
        WHEN booking.profile_id IS NOT NULL
          AND NULLIF(btrim(profile.name::text), '') IS NOT NULL
          AND NULLIF(btrim(profile.username::text), '') IS NOT NULL
          THEN profile.username::text
        ELSE NULL
      END
    )::text AS participant_secondary_text,
    (booking.profile_id = actor_profile_id)::boolean AS is_viewer
  FROM public.festival_schedule_booking AS booking
  LEFT JOIN public.profiles AS profile
    ON profile.id = booking.profile_id
  WHERE booking.festival_id = target_festival_id
    AND booking.status IN ('booked', 'completed');
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_bookings"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_bookings"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_festival_schedule_bookings"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_festival_schedule_bookings"(uuid) TO "postgres";
