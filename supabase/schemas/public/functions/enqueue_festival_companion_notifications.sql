CREATE OR REPLACE FUNCTION public.enqueue_festival_companion_notifications()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  WITH config AS (
    SELECT lead_minutes, completion_grace_minutes
    FROM public.festival_companion_config
    WHERE singleton
  ),
  schedule AS (
    SELECT
      booking.id AS booking_id,
      booking.profile_id,
      booking.festival_id,
      festival.slug AS festival_slug,
      festival.name AS festival_name,
      festival.timezone AS festival_timezone,
      slot.id AS slot_id,
      slot.start_at,
      slot.end_at,
      booking.highline_id,
      highline.name AS highline_name,
      to_char(
        (slot.start_at AT TIME ZONE festival.timezone)::date,
        'YYYY-MM-DD'
      ) AS day_key,
      row_number() OVER (
        PARTITION BY
          booking.profile_id,
          booking.festival_id,
          (slot.start_at AT TIME ZONE festival.timezone)::date
        ORDER BY slot.start_at, slot.id
      ) AS day_position,
      row_number() OVER (
        PARTITION BY
          booking.profile_id,
          booking.festival_id,
          (slot.start_at AT TIME ZONE festival.timezone)::date
        ORDER BY slot.start_at DESC, slot.id DESC
      ) AS reverse_day_position
    FROM public.festival_schedule_booking AS booking
    INNER JOIN public.festival_schedule_slot AS slot
      ON slot.id = booking.slot_id
    INNER JOIN public.festival AS festival
      ON festival.id = booking.festival_id
    INNER JOIN public.highline AS highline
      ON highline.id = booking.highline_id
    WHERE booking.status IN ('booked', 'completed')
      AND booking.profile_id IS NOT NULL
  ),
  candidate_events AS (
    SELECT
      schedule.*,
      'upsert'::TEXT AS operation,
      schedule.start_at - make_interval(mins => config.lead_minutes) AS event_at,
      format('start:%s:%s', schedule.festival_id, schedule.day_key) AS event_key
    FROM schedule
    CROSS JOIN config
    WHERE schedule.day_position = 1

    UNION ALL

    SELECT
      schedule.*,
      'upsert'::TEXT AS operation,
      schedule.start_at AS event_at,
      format('booking-start:%s', schedule.booking_id) AS event_key
    FROM schedule

    UNION ALL

    SELECT
      schedule.*,
      'upsert'::TEXT AS operation,
      schedule.end_at AS event_at,
      format('booking-end:%s', schedule.booking_id) AS event_key
    FROM schedule

    UNION ALL

    SELECT
      schedule.*,
      'stop'::TEXT AS operation,
      schedule.end_at
        + make_interval(mins => config.completion_grace_minutes) AS event_at,
      format('day-end:%s:%s', schedule.festival_id, schedule.day_key) AS event_key
    FROM schedule
    CROSS JOIN config
    WHERE schedule.reverse_day_position = 1
  ),
  due_events AS (
    SELECT DISTINCT ON (profile_id, event_key)
      *
    FROM candidate_events
    WHERE event_at <= timezone('utc'::text, now())
      AND event_at > timezone('utc'::text, now()) - interval '5 minutes'
    ORDER BY profile_id, event_key, event_at DESC
  ),
  inserted_rows AS (
    INSERT INTO public.notifications (user_id, title, body, data)
    SELECT
      event.profile_id,
      jsonb_build_object(
        'pt', event.festival_name,
        'en', event.festival_name
      ),
      jsonb_build_object(
        'pt',
        CASE
          WHEN event.operation = 'stop' THEN 'Sua programação de hoje terminou.'
          ELSE format('Próximo horário: %s.', event.highline_name)
        END,
        'en',
        CASE
          WHEN event.operation = 'stop' THEN 'Your schedule for today is complete.'
          ELSE format('Next booking: %s.', event.highline_name)
        END
      ),
      jsonb_build_object(
        'type', 'festival_companion',
        'operation', event.operation,
        'festival_id', event.festival_id,
        'festival_slug', event.festival_slug,
        'day_key', event.day_key,
        'event_key', event.event_key,
        'event_at',
          to_char(
            event.event_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS"Z"'
          ),
        'url',
          format(
            '/festival?highline=%s&day=%s',
            event.highline_id,
            event.day_key
          )
      )
    FROM due_events AS event
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications AS notification
      WHERE notification.user_id = event.profile_id
        AND notification.data->>'type' = 'festival_companion'
        AND notification.data->>'event_key' = event.event_key
    )
    RETURNING 1
  )
  SELECT COUNT(*)
  INTO inserted_count
  FROM inserted_rows;

  RETURN inserted_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."enqueue_festival_companion_notifications"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."enqueue_festival_companion_notifications"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."enqueue_festival_companion_notifications"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."enqueue_festival_companion_notifications"() FROM PUBLIC, "anon", "authenticated";
