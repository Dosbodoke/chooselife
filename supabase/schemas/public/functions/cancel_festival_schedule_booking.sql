CREATE OR REPLACE FUNCTION public.cancel_festival_schedule_booking (
  target_booking_id         uuid,
  cancellation_reason_input text
)
  RETURNS public.festival_schedule_booking
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  actor_profile_id UUID := auth.uid();
  actor_is_staff BOOLEAN := false;
  booking_row public.festival_schedule_booking;
  updated_booking public.festival_schedule_booking;
BEGIN
  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT booking.*
  INTO booking_row
  FROM public.festival_schedule_booking AS booking
  WHERE booking.id = target_booking_id
  FOR UPDATE;

  IF booking_row.id IS NULL THEN
    RAISE EXCEPTION 'Schedule booking not found';
  END IF;

  PERFORM public.reconcile_festival_schedule_by_id(booking_row.festival_id);

  SELECT booking.*
  INTO booking_row
  FROM public.festival_schedule_booking AS booking
  WHERE booking.id = target_booking_id
  FOR UPDATE;

  IF booking_row.status <> 'booked' THEN
    RAISE EXCEPTION 'Only active bookings can be cancelled';
  END IF;

  actor_is_staff := public.is_festival_staff(booking_row.festival_id, actor_profile_id);

  IF booking_row.profile_id IS DISTINCT FROM actor_profile_id AND NOT actor_is_staff THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF coalesce(nullif(btrim(cancellation_reason_input), ''), '') = '' THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  UPDATE public.festival_schedule_booking
  SET
    status = 'cancelled',
    cancellation_reason = btrim(cancellation_reason_input),
    cancellation_source = (
      CASE
        WHEN booking_row.profile_id = actor_profile_id THEN 'user'
        ELSE 'staff'
      END
    )::public.festival_schedule_booking_cancellation_source_enum,
    cancelled_at = timezone('utc'::text, now()),
    cancelled_by_profile_id = actor_profile_id
  WHERE id = booking_row.id
  RETURNING *
  INTO updated_booking;

  RETURN updated_booking;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."cancel_festival_schedule_booking"(uuid, text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."cancel_festival_schedule_booking"(uuid, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."cancel_festival_schedule_booking"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."cancel_festival_schedule_booking"(uuid, text) TO "postgres";
