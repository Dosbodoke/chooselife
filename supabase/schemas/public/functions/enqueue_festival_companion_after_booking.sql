CREATE OR REPLACE FUNCTION public.enqueue_festival_companion_after_booking()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  config_row public.festival_companion_config;
  festival_row public.festival;
  slot_row public.festival_schedule_slot;
  day_key_value TEXT;
  event_key_value TEXT;
  companion_is_active BOOLEAN := false;
BEGIN
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO config_row
  FROM public.festival_companion_config
  WHERE singleton;

  SELECT *
  INTO festival_row
  FROM public.festival
  WHERE id = NEW.festival_id;

  SELECT *
  INTO slot_row
  FROM public.festival_schedule_slot
  WHERE id = NEW.slot_id;

  day_key_value := to_char(
    (slot_row.start_at AT TIME ZONE festival_row.timezone)::date,
    'YYYY-MM-DD'
  );

  IF TG_OP = 'INSERT' THEN
    companion_is_active :=
      NEW.status = 'booked'
      AND slot_row.end_at > timezone('utc'::text, now())
      AND slot_row.start_at
        - make_interval(mins => config_row.lead_minutes)
        <= timezone('utc'::text, now());
    event_key_value := format('late-booking:%s', NEW.id);
  ELSE
    companion_is_active :=
      OLD.status = 'booked'
      AND NEW.status = 'cancelled'
      AND EXISTS (
        SELECT 1
        FROM public.festival_schedule_booking AS day_booking
        INNER JOIN public.festival_schedule_slot AS day_slot
          ON day_slot.id = day_booking.slot_id
        WHERE day_booking.profile_id = NEW.profile_id
          AND day_booking.festival_id = NEW.festival_id
          AND day_booking.status IN ('booked', 'completed')
          AND (day_slot.start_at AT TIME ZONE festival_row.timezone)::date =
            (slot_row.start_at AT TIME ZONE festival_row.timezone)::date
          AND timezone('utc'::text, now()) >=
            day_slot.start_at
              - make_interval(mins => config_row.lead_minutes)
          AND timezone('utc'::text, now()) <=
            day_slot.end_at
              + make_interval(mins => config_row.completion_grace_minutes)
      );
    event_key_value := format(
      'booking-cancel:%s:%s',
      NEW.id,
      extract(epoch FROM NEW.cancelled_at)::bigint
    );
  END IF;

  IF companion_is_active THEN
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (
      NEW.profile_id,
      jsonb_build_object('pt', festival_row.name, 'en', festival_row.name),
      jsonb_build_object(
        'pt', 'Sua programação do festival foi atualizada.',
        'en', 'Your festival schedule was updated.'
      ),
      jsonb_build_object(
        'type', 'festival_companion',
        'operation', 'upsert',
        'festival_id', NEW.festival_id,
        'festival_slug', festival_row.slug,
        'day_key', day_key_value,
        'event_key', event_key_value,
        'event_at',
          to_char(
            timezone('utc'::text, now()) AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS"Z"'
          ),
        'url',
          format(
            '/festival?highline=%s&day=%s',
            NEW.highline_id,
            day_key_value
          )
      )
    );
  END IF;

  IF (
    TG_OP = 'UPDATE'
    AND OLD.status = 'booked'
    AND NEW.status = 'cancelled'
    AND NEW.cancellation_source IN ('staff', 'slot_blocked')
  ) THEN
    INSERT INTO public.notifications (user_id, title, body, data)
    SELECT
      NEW.profile_id,
      jsonb_build_object(
        'pt', 'Horário cancelado',
        'en', 'Booking cancelled'
      ),
      jsonb_build_object(
        'pt',
          format(
            'Seu horário no highline %s foi cancelado pela organização.',
            highline.name
          ),
        'en',
          format(
            'Your booking on %s was cancelled by the organizers.',
            highline.name
          )
      ),
      jsonb_build_object(
        'type', 'festival_schedule_cancelled',
        'booking_id', NEW.id,
        'festival_slug', festival_row.slug,
        'day_key', day_key_value,
        'url', format('/festival?day=%s', day_key_value)
      )
    FROM public.highline
    WHERE highline.id = NEW.highline_id;
  END IF;

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."enqueue_festival_companion_after_booking"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."enqueue_festival_companion_after_booking"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."enqueue_festival_companion_after_booking"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."enqueue_festival_companion_after_booking"() FROM PUBLIC, "anon", "authenticated";
