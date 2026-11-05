CREATE OR REPLACE FUNCTION public.enqueue_festival_schedule_open_notifications()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  WITH recent_openings AS (
    SELECT
      festival.id AS festival_id,
      festival.slug AS festival_slug,
      festival.name AS festival_name,
      festival.timezone AS festival_timezone,
      schedule_window.scheduling_opens_at,
      COUNT(DISTINCT (schedule_window.window_start_at AT TIME ZONE festival.timezone)::date)
        AS opened_day_count,
      MIN((schedule_window.window_start_at AT TIME ZONE festival.timezone)::date)
        AS opened_day
    FROM public.festival_schedule_window AS schedule_window
    INNER JOIN public.festival AS festival
      ON festival.id = schedule_window.festival_id
    WHERE schedule_window.scheduling_opens_at <= timezone('utc'::text, now())
      AND schedule_window.scheduling_opens_at >
        timezone('utc'::text, now()) - interval '60 minutes'
      AND EXISTS (
        SELECT 1
        FROM public.festival_schedule_slot AS slot
        WHERE slot.window_id = schedule_window.id
          AND slot.end_at > timezone('utc'::text, now())
      )
    GROUP BY
      festival.id,
      festival.slug,
      festival.name,
      festival.timezone,
      schedule_window.scheduling_opens_at
  ),
  inserted_rows AS (
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      data
    )
    SELECT
      NULL,
      jsonb_build_object(
        'pt',
        CASE
          WHEN opening.opened_day_count = 1 THEN 'Agendamento aberto'
          ELSE 'Reservas abertas'
        END,
        'en',
        CASE
          WHEN opening.opened_day_count = 1 THEN 'Schedule is open'
          ELSE 'Booking is open'
        END
      ),
      jsonb_build_object(
        'pt',
        CASE
          WHEN opening.opened_day_count = 1 THEN format(
            'As reservas de %s no festival %s já estão abertas.',
            to_char(opening.opened_day, 'DD/MM'),
            opening.festival_name
          )
          ELSE format(
            'As reservas da programação do festival %s já estão abertas.',
            opening.festival_name
          )
        END,
        'en',
        CASE
          WHEN opening.opened_day_count = 1 THEN format(
            'Booking for %s at %s is now open.',
            to_char(opening.opened_day, 'Mon DD'),
            opening.festival_name
          )
          ELSE format(
            'Festival booking for %s is now open.',
            opening.festival_name
          )
        END
      ),
      jsonb_build_object(
        'type', 'festival_schedule_open',
        'festival_slug', opening.festival_slug,
        'opens_at',
          to_char(
            opening.scheduling_opens_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS"Z"'
          ),
        'url', '/festival'
      )
    FROM recent_openings AS opening
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications AS notification
      WHERE notification.user_id IS NULL
        AND notification.data->>'type' = 'festival_schedule_open'
        AND notification.data->>'festival_slug' = opening.festival_slug
        AND notification.data->>'opens_at' = to_char(
          opening.scheduling_opens_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        )
    )
    RETURNING 1
  )
  SELECT COUNT(*)
  INTO inserted_count
  FROM inserted_rows;

  RETURN inserted_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."enqueue_festival_schedule_open_notifications"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."enqueue_festival_schedule_open_notifications"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."enqueue_festival_schedule_open_notifications"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."enqueue_festival_schedule_open_notifications"() TO "postgres";
