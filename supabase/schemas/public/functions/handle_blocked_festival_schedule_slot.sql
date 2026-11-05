CREATE OR REPLACE FUNCTION public.handle_blocked_festival_schedule_slot()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF NEW.status = 'blocked' THEN
    UPDATE public.festival_schedule_booking
    SET
      status = 'cancelled',
      cancellation_reason = NEW.block_reason,
      cancellation_source = 'slot_blocked'::public.festival_schedule_booking_cancellation_source_enum,
      cancelled_at = timezone('utc'::text, now()),
      cancelled_by_profile_id = NULL
    WHERE slot_id = NEW.id
      AND status = 'booked';
  END IF;

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."handle_blocked_festival_schedule_slot"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."handle_blocked_festival_schedule_slot"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."handle_blocked_festival_schedule_slot"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_blocked_festival_schedule_slot"() TO "postgres";
