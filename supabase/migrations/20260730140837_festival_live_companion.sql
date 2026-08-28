ALTER TABLE public.push_tokens
ADD COLUMN platform TEXT
CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web'));
CREATE TABLE public.festival_companion_config (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  lead_minutes INTEGER NOT NULL DEFAULT 60 CHECK (lead_minutes BETWEEN 5 AND 240),
  completion_grace_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (completion_grace_minutes BETWEEN 0 AND 60),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
INSERT INTO public.festival_companion_config (singleton)
VALUES (true);
ALTER TABLE public.festival_companion_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Festival companion configuration is readable."
ON public.festival_companion_config
FOR SELECT
TO authenticated
USING (true);
GRANT SELECT ON TABLE public.festival_companion_config TO authenticated;
GRANT ALL ON TABLE public.festival_companion_config TO service_role;
CREATE TABLE public.festival_companion_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  installation_id UUID NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios' CHECK (platform = 'ios'),
  token_type TEXT NOT NULL
    CHECK (token_type IN ('push_to_start', 'activity_update')),
  activity_name TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  language public.language,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (profile_id, installation_id, token_type, activity_name)
);
CREATE INDEX festival_companion_tokens_profile_idx
ON public.festival_companion_tokens (profile_id, token_type);
ALTER TABLE public.festival_companion_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own festival companion tokens."
ON public.festival_companion_tokens
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = profile_id);
CREATE POLICY "Users can register their own festival companion tokens."
ON public.festival_companion_tokens
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = profile_id);
CREATE POLICY "Users can update their own festival companion tokens."
ON public.festival_companion_tokens
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = profile_id)
WITH CHECK ((SELECT auth.uid()) = profile_id);
CREATE POLICY "Users can remove their own festival companion tokens."
ON public.festival_companion_tokens
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.festival_companion_tokens
TO authenticated;
GRANT ALL
ON TABLE public.festival_companion_tokens
TO service_role;
CREATE OR REPLACE FUNCTION public.register_festival_companion_token(
  installation_id_input UUID,
  token_type_input TEXT,
  activity_name_input TEXT,
  token_input TEXT,
  language_input public.language
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id UUID := auth.uid();
BEGIN
  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF token_type_input NOT IN ('push_to_start', 'activity_update') THEN
    RAISE EXCEPTION 'Unsupported festival companion token type';
  END IF;

  IF nullif(btrim(token_input), '') IS NULL THEN
    RAISE EXCEPTION 'Festival companion token is required';
  END IF;

  DELETE FROM public.festival_companion_tokens
  WHERE token = token_input
    OR (
      profile_id = actor_profile_id
      AND installation_id = installation_id_input
      AND token_type = token_type_input
      AND activity_name = coalesce(activity_name_input, '')
    );

  INSERT INTO public.festival_companion_tokens (
    profile_id,
    installation_id,
    token_type,
    activity_name,
    token,
    language,
    updated_at
  )
  VALUES (
    actor_profile_id,
    installation_id_input,
    token_type_input,
    coalesce(activity_name_input, ''),
    btrim(token_input),
    language_input,
    timezone('utc'::text, now())
  );
END;
$$;
REVOKE ALL
ON FUNCTION public.register_festival_companion_token(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  public.language
)
FROM PUBLIC, anon;
GRANT EXECUTE
ON FUNCTION public.register_festival_companion_token(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  public.language
)
TO authenticated;
CREATE OR REPLACE FUNCTION public.unregister_festival_companion_installation(
  installation_id_input UUID
)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  DELETE FROM public.festival_companion_tokens
  WHERE profile_id = auth.uid()
    AND installation_id = installation_id_input;
$$;
REVOKE ALL
ON FUNCTION public.unregister_festival_companion_installation(UUID)
FROM PUBLIC, anon;
GRANT EXECUTE
ON FUNCTION public.unregister_festival_companion_installation(UUID)
TO authenticated;
CREATE OR REPLACE FUNCTION public.enqueue_festival_companion_after_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
REVOKE ALL
ON FUNCTION public.enqueue_festival_companion_after_booking()
FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enqueue_festival_companion_after_booking_insert
AFTER INSERT
ON public.festival_schedule_booking
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_festival_companion_after_booking();
CREATE TRIGGER enqueue_festival_companion_after_booking_cancel
AFTER UPDATE OF status
ON public.festival_schedule_booking
FOR EACH ROW
WHEN (OLD.status = 'booked' AND NEW.status = 'cancelled')
EXECUTE FUNCTION public.enqueue_festival_companion_after_booking();
CREATE OR REPLACE FUNCTION public.enqueue_festival_companion_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
REVOKE ALL
ON FUNCTION public.enqueue_festival_companion_notifications()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
ON FUNCTION public.enqueue_festival_companion_notifications()
TO service_role;
SELECT cron.schedule(
  'festival-companion-notifications-every-minute',
  '* * * * *',
  $$
  SELECT public.enqueue_festival_companion_notifications();
  $$
);
