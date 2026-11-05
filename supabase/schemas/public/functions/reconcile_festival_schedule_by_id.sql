CREATE OR REPLACE FUNCTION public.reconcile_festival_schedule_by_id (
  target_festival_id uuid DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  UPDATE public.festival_schedule_booking AS booking
  SET
    status = 'cancelled',
    cancellation_reason = slot.block_reason,
    cancellation_source = 'slot_blocked'::public.festival_schedule_booking_cancellation_source_enum,
    cancelled_at = timezone('utc'::text, now()),
    cancelled_by_profile_id = NULL
  FROM public.festival_schedule_slot AS slot
  WHERE booking.slot_id = slot.id
    AND booking.status = 'booked'
    AND slot.status = 'blocked'
    AND booking.festival_id = COALESCE(target_festival_id, booking.festival_id);

  UPDATE public.festival_schedule_booking AS booking
  SET
    status = 'completed',
    completed_at = COALESCE(booking.completed_at, timezone('utc'::text, now()))
  FROM public.festival_schedule_slot AS slot
  WHERE booking.slot_id = slot.id
    AND booking.status = 'booked'
    AND slot.end_at <= timezone('utc'::text, now())
    AND booking.festival_id = COALESCE(target_festival_id, booking.festival_id);

  UPDATE public.festival_schedule_slot AS slot
  SET status = 'expired'
  WHERE slot.status = 'available'
    AND slot.end_at <= timezone('utc'::text, now())
    AND slot.festival_id = COALESCE(target_festival_id, slot.festival_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reconcile_festival_schedule_by_id"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."reconcile_festival_schedule_by_id"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reconcile_festival_schedule_by_id"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reconcile_festival_schedule_by_id"(uuid) TO "postgres";
