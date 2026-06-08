INSERT INTO public.app_config (key, value)
VALUES ('festival_schedule_booking_limit', '2'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value)
VALUES ('festival_schedule_booking_cooldown_seconds', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.festival_schedule_booking
ADD COLUMN booking_source TEXT NOT NULL DEFAULT 'participant'
CHECK (booking_source IN ('participant', 'staff'));

CREATE TABLE public.festival_schedule_revision (
  festival_id UUID PRIMARY KEY REFERENCES public.festival(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.festival_schedule_revision ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Festival schedule revisions are viewable by everyone."
ON public.festival_schedule_revision
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON TABLE public.festival_schedule_revision TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_festival_schedule_booking_limit()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  configured_limit INTEGER;
BEGIN
  SELECT CASE
    WHEN config.value #>> '{}' ~ '^[1-9][0-9]*$'
      THEN (config.value #>> '{}')::integer
    ELSE NULL
  END
  INTO configured_limit
  FROM public.app_config AS config
  WHERE config.key = 'festival_schedule_booking_limit';

  IF configured_limit IS NULL OR configured_limit < 1 THEN
    RAISE EXCEPTION 'Festival schedule booking limit is not configured';
  END IF;

  RETURN configured_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_schedule_booking_cooldown_seconds()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  configured_seconds INTEGER;
BEGIN
  SELECT CASE
    WHEN config.value #>> '{}' ~ '^[0-9]+$'
      THEN (config.value #>> '{}')::integer
    ELSE NULL
  END
  INTO configured_seconds
  FROM public.app_config AS config
  WHERE config.key = 'festival_schedule_booking_cooldown_seconds';

  IF configured_seconds IS NULL OR configured_seconds < 0 THEN
    RAISE EXCEPTION 'Festival schedule booking cooldown is not configured';
  END IF;

  RETURN configured_seconds;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_schedule_booking_cooldown_ends_at(
  target_festival_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.book_festival_schedule_slot(
  target_slot_id UUID,
  target_profile_id UUID DEFAULT NULL,
  target_instagram_username TEXT DEFAULT NULL,
  target_display_name TEXT DEFAULT NULL
)
RETURNS public.festival_schedule_booking
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id UUID := auth.uid();
  actor_is_staff BOOLEAN := false;
  slot_row public.festival_schedule_slot;
  window_row public.festival_schedule_window;
  resolved_profile_id UUID := target_profile_id;
  normalized_instagram_username TEXT := public.normalize_festival_instagram_username(target_instagram_username);
  participant_lock_key TEXT;
  active_booking_count INTEGER := 0;
  cooldown_seconds INTEGER := public.get_festival_schedule_booking_cooldown_seconds();
  created_booking public.festival_schedule_booking;
BEGIN
  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT slot.*
  INTO slot_row
  FROM public.festival_schedule_slot AS slot
  WHERE slot.id = target_slot_id
  FOR UPDATE;

  IF slot_row.id IS NULL THEN
    RAISE EXCEPTION 'Schedule slot not found';
  END IF;

  PERFORM public.reconcile_festival_schedule_by_id(slot_row.festival_id);

  SELECT slot.*
  INTO slot_row
  FROM public.festival_schedule_slot AS slot
  WHERE slot.id = target_slot_id
  FOR UPDATE;

  actor_is_staff := public.is_festival_staff(slot_row.festival_id, actor_profile_id);

  SELECT schedule_window.*
  INTO window_row
  FROM public.festival_schedule_window AS schedule_window
  WHERE schedule_window.id = slot_row.window_id
  LIMIT 1;

  IF window_row.id IS NULL THEN
    RAISE EXCEPTION 'Schedule window not found';
  END IF;

  IF resolved_profile_id IS NULL AND normalized_instagram_username IS NULL THEN
    resolved_profile_id := actor_profile_id;
  END IF;

  IF resolved_profile_id IS NULL AND normalized_instagram_username IS NOT NULL THEN
    SELECT profile.id
    INTO resolved_profile_id
    FROM public.profiles AS profile
    WHERE profile.username = normalized_instagram_username
    LIMIT 1;
  END IF;

  IF NOT actor_is_staff THEN
    IF resolved_profile_id IS DISTINCT FROM actor_profile_id OR normalized_instagram_username IS NOT NULL THEN
      RAISE EXCEPTION 'Not authorized to book for another participant';
    END IF;
  END IF;

  IF slot_row.status <> 'available' THEN
    RAISE EXCEPTION 'Schedule slot is not available';
  END IF;

  IF slot_row.end_at <= timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'Schedule slot has already ended';
  END IF;

  IF NOT actor_is_staff
    AND window_row.scheduling_opens_at > timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'Schedule booking is not open yet';
  END IF;

  IF resolved_profile_id IS NULL THEN
    IF normalized_instagram_username IS NULL THEN
      RAISE EXCEPTION 'Instagram username is required for guest bookings';
    END IF;

    IF coalesce(nullif(btrim(target_display_name), ''), '') = '' THEN
      RAISE EXCEPTION 'Display name is required for guest bookings';
    END IF;
  END IF;

  participant_lock_key := COALESCE(
    resolved_profile_id::text,
    normalized_instagram_username
  );

  PERFORM pg_advisory_xact_lock(
    hashtext(slot_row.festival_id::text),
    hashtext(participant_lock_key)
  );

  IF NOT actor_is_staff
    AND cooldown_seconds > 0
    AND EXISTS (
      SELECT 1
      FROM public.festival_schedule_booking AS booking
      WHERE booking.festival_id = slot_row.festival_id
        AND booking.profile_id = resolved_profile_id
        AND booking.booking_source = 'participant'
        AND booking.created_at
          > timezone('utc'::text, now()) - make_interval(secs => cooldown_seconds)
    ) THEN
    RAISE EXCEPTION 'Participant festival schedule booking cooldown is active';
  END IF;

  IF resolved_profile_id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO active_booking_count
    FROM public.festival_schedule_booking AS booking
    JOIN public.festival_schedule_slot AS slot
      ON slot.id = booking.slot_id
    WHERE booking.festival_id = slot_row.festival_id
      AND booking.profile_id = resolved_profile_id
      AND booking.status = 'booked';

    IF active_booking_count >= public.get_festival_schedule_booking_limit() THEN
      -- Published clients classify this error by matching the legacy text.
      RAISE EXCEPTION 'Participant already has two active schedule bookings';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.festival_schedule_booking AS booking
      JOIN public.festival_schedule_slot AS slot
        ON slot.id = booking.slot_id
      WHERE booking.festival_id = slot_row.festival_id
        AND booking.profile_id = resolved_profile_id
        AND booking.status = 'booked'
        AND slot.start_at < slot_row.end_at
        AND slot.end_at > slot_row.start_at
    ) THEN
      RAISE EXCEPTION 'Participant already has a concurrent schedule booking';
    END IF;
  ELSE
    SELECT COUNT(*)
    INTO active_booking_count
    FROM public.festival_schedule_booking AS booking
    JOIN public.festival_schedule_slot AS slot
      ON slot.id = booking.slot_id
    WHERE booking.festival_id = slot_row.festival_id
      AND booking.instagram_username = normalized_instagram_username
      AND booking.status = 'booked';

    IF active_booking_count >= public.get_festival_schedule_booking_limit() THEN
      -- Published clients classify this error by matching the legacy text.
      RAISE EXCEPTION 'Participant already has two active schedule bookings';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.festival_schedule_booking AS booking
      JOIN public.festival_schedule_slot AS slot
        ON slot.id = booking.slot_id
      WHERE booking.festival_id = slot_row.festival_id
        AND booking.instagram_username = normalized_instagram_username
        AND booking.status = 'booked'
        AND slot.start_at < slot_row.end_at
        AND slot.end_at > slot_row.start_at
    ) THEN
      RAISE EXCEPTION 'Participant already has a concurrent schedule booking';
    END IF;
  END IF;

  INSERT INTO public.festival_schedule_booking (
    slot_id,
    festival_id,
    highline_id,
    profile_id,
    instagram_username,
    display_name,
    status,
    booking_source
  )
  VALUES (
    slot_row.id,
    slot_row.festival_id,
    slot_row.highline_id,
    resolved_profile_id,
    CASE WHEN resolved_profile_id IS NULL THEN normalized_instagram_username ELSE NULL END,
    CASE WHEN resolved_profile_id IS NULL THEN btrim(target_display_name) ELSE NULL END,
    'booked',
    CASE WHEN actor_is_staff THEN 'staff' ELSE 'participant' END
  )
  RETURNING *
  INTO created_booking;

  RETURN created_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_festival_schedule_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.festival_schedule_revision (festival_id, updated_at)
  VALUES (COALESCE(NEW.festival_id, OLD.festival_id), timezone('utc'::text, now()))
  ON CONFLICT (festival_id) DO UPDATE
  SET updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER festival_schedule_booking_touch_revision_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.festival_schedule_booking
FOR EACH ROW
EXECUTE FUNCTION public.touch_festival_schedule_revision();

REVOKE EXECUTE ON FUNCTION public.get_festival_schedule_booking_cooldown_ends_at(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_schedule_booking_cooldown_ends_at(UUID) TO authenticated;

ALTER TABLE public.festival_schedule_revision REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.festival_schedule_revision;
