CREATE OR REPLACE FUNCTION public.regenerate_festival_schedule_window (
  target_window_id uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  target_window public.festival_schedule_window%ROWTYPE;
  duration_minutes INTEGER;
  slot_start TIMESTAMPTZ;
  generated_count INTEGER := 0;
BEGIN
  SELECT schedule_window.*
  INTO target_window
  FROM public.festival_schedule_window AS schedule_window
  WHERE schedule_window.id = target_window_id
  LIMIT 1;

  IF target_window.id IS NULL THEN
    RAISE EXCEPTION 'Festival schedule window not found';
  END IF;

  SELECT festival_highline.slot_duration_minutes
  INTO duration_minutes
  FROM public.festival_highline
  WHERE festival_id = target_window.festival_id
    AND highline_id = target_window.highline_id
  LIMIT 1;

  IF duration_minutes IS NULL THEN
    RAISE EXCEPTION 'Festival highline config not found';
  END IF;

  DELETE FROM public.festival_schedule_slot AS slot
  WHERE slot.window_id = target_window_id
    AND slot.start_at >= timezone('utc'::text, now())
    AND slot.status <> 'blocked'
    AND NOT EXISTS (
      SELECT 1
      FROM public.festival_schedule_booking AS booking
      WHERE booking.slot_id = slot.id
    );

  slot_start := target_window.window_start_at;

  WHILE slot_start < target_window.window_end_at LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.festival_schedule_slot
      WHERE window_id = target_window.id
        AND start_at = slot_start
    ) THEN
      INSERT INTO public.festival_schedule_slot (
        festival_id,
        highline_id,
        window_id,
        start_at,
        end_at,
        status
      )
      VALUES (
        target_window.festival_id,
        target_window.highline_id,
        target_window.id,
        slot_start,
        slot_start + make_interval(mins => duration_minutes),
        'available'
      );

      generated_count := generated_count + 1;
    END IF;

    slot_start := slot_start + make_interval(mins => duration_minutes);
  END LOOP;

  RETURN generated_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."regenerate_festival_schedule_window"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."regenerate_festival_schedule_window"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."regenerate_festival_schedule_window"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."regenerate_festival_schedule_window"(uuid) TO "postgres";
