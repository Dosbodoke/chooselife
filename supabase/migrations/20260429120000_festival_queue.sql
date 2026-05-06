CREATE TYPE public.festival_schedule_slot_status_enum AS ENUM (
  'available',
  'blocked',
  'expired'
);

CREATE TYPE public.festival_schedule_booking_status_enum AS ENUM (
  'booked',
  'cancelled',
  'completed'
);

CREATE TYPE public.festival_schedule_booking_cancellation_source_enum AS ENUM (
  'user',
  'staff',
  'slot_blocked'
);

CREATE TABLE public.festival (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.festival_highline (
  festival_id UUID NOT NULL REFERENCES public.festival(id) ON DELETE CASCADE,
  highline_id UUID NOT NULL REFERENCES public.highline(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (slot_duration_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (festival_id, highline_id)
);

CREATE TABLE public.festival_staff (
  festival_id UUID NOT NULL REFERENCES public.festival(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (festival_id, profile_id)
);

CREATE TABLE public.festival_schedule_window (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID NOT NULL REFERENCES public.festival(id) ON DELETE CASCADE,
  highline_id UUID NOT NULL REFERENCES public.highline(id) ON DELETE CASCADE,
  scheduling_opens_at TIMESTAMPTZ NOT NULL,
  window_start_at TIMESTAMPTZ NOT NULL,
  window_end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (window_end_at > window_start_at),
  CHECK (scheduling_opens_at < window_end_at),
  CHECK (
    extract(second FROM scheduling_opens_at) = 0
    AND extract(minute FROM scheduling_opens_at) IN (0, 30)
  ),
  FOREIGN KEY (festival_id, highline_id)
    REFERENCES public.festival_highline(festival_id, highline_id)
    ON DELETE CASCADE
);

CREATE TABLE public.festival_schedule_slot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID NOT NULL REFERENCES public.festival(id) ON DELETE CASCADE,
  highline_id UUID NOT NULL REFERENCES public.highline(id) ON DELETE CASCADE,
  window_id UUID NOT NULL REFERENCES public.festival_schedule_window(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status public.festival_schedule_slot_status_enum NOT NULL DEFAULT 'available',
  block_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (end_at > start_at),
  CHECK (status <> 'blocked' OR block_reason IS NOT NULL),
  FOREIGN KEY (festival_id, highline_id)
    REFERENCES public.festival_highline(festival_id, highline_id)
    ON DELETE CASCADE
);

CREATE TABLE public.festival_schedule_booking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.festival_schedule_slot(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES public.festival(id) ON DELETE CASCADE,
  highline_id UUID NOT NULL REFERENCES public.highline(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  instagram_username TEXT,
  display_name TEXT,
  status public.festival_schedule_booking_status_enum NOT NULL DEFAULT 'booked',
  cancellation_reason TEXT,
  cancellation_source public.festival_schedule_booking_cancellation_source_enum,
  cancelled_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CHECK (
    (
      profile_id IS NOT NULL
      AND instagram_username IS NULL
    )
    OR (
      profile_id IS NULL
      AND instagram_username IS NOT NULL
      AND display_name IS NOT NULL
    )
  ),
  CHECK (
    instagram_username IS NULL
    OR (
      instagram_username = lower(btrim(instagram_username))
      AND instagram_username LIKE '@%'
    )
  ),
  CHECK (status <> 'cancelled' OR cancellation_reason IS NOT NULL)
);

CREATE INDEX festival_highline_sort_order_idx
  ON public.festival_highline (festival_id, sort_order, highline_id);

CREATE INDEX festival_schedule_window_lookup_idx
  ON public.festival_schedule_window (festival_id, highline_id, window_start_at);

CREATE UNIQUE INDEX festival_schedule_window_unique_idx
  ON public.festival_schedule_window (festival_id, highline_id, window_start_at);

CREATE INDEX festival_schedule_window_opens_at_idx
  ON public.festival_schedule_window (scheduling_opens_at);

CREATE INDEX festival_schedule_slot_lookup_idx
  ON public.festival_schedule_slot (festival_id, highline_id, start_at);

CREATE UNIQUE INDEX festival_schedule_slot_unique_start_idx
  ON public.festival_schedule_slot (festival_id, highline_id, start_at);

CREATE UNIQUE INDEX festival_schedule_booking_active_slot_unique_idx
  ON public.festival_schedule_booking (slot_id)
  WHERE status = 'booked';

CREATE INDEX festival_schedule_booking_profile_active_idx
  ON public.festival_schedule_booking (festival_id, profile_id)
  WHERE status = 'booked' AND profile_id IS NOT NULL;

CREATE INDEX festival_schedule_booking_instagram_active_idx
  ON public.festival_schedule_booking (festival_id, instagram_username)
  WHERE status = 'booked' AND instagram_username IS NOT NULL;

ALTER TABLE public.festival ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_highline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_schedule_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_schedule_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_schedule_booking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Festival rows are viewable by everyone."
ON public.festival
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Festival highlines are viewable by everyone."
ON public.festival_highline
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Users can view their own festival staff memberships."
ON public.festival_staff
FOR SELECT
TO authenticated
USING (auth.uid() = profile_id);

CREATE POLICY "Festival schedule windows are viewable by everyone."
ON public.festival_schedule_window
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Festival schedule slots are viewable by everyone."
ON public.festival_schedule_slot
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Festival booking reads"
ON public.festival_schedule_booking
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.festival_staff AS festival_staff
    WHERE festival_staff.festival_id = festival_schedule_booking.festival_id
      AND festival_staff.profile_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.normalize_festival_instagram_username(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    ELSE lower(
      CASE
        WHEN left(btrim(value), 1) = '@' THEN btrim(value)
        ELSE '@' || btrim(value)
      END
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_festival_staff(
  target_festival_id UUID,
  target_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.festival_staff
    WHERE festival_id = target_festival_id
      AND profile_id = target_profile_id
  );
$$;

CREATE OR REPLACE FUNCTION public.reconcile_festival_schedule_by_id(
  target_festival_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.reconcile_festival_schedule(
  festival_slug TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_festival_id UUID;
BEGIN
  IF festival_slug IS NOT NULL THEN
    SELECT id
    INTO target_festival_id
    FROM public.festival
    WHERE slug = festival_slug
    LIMIT 1;
  END IF;

  PERFORM public.reconcile_festival_schedule_by_id(target_festival_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_festival_schedule_window(
  target_window_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.handle_festival_schedule_window_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.regenerate_festival_schedule_window(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER festival_schedule_window_regenerate_trigger
AFTER INSERT OR UPDATE OF window_start_at, window_end_at
ON public.festival_schedule_window
FOR EACH ROW
EXECUTE FUNCTION public.handle_festival_schedule_window_change();

CREATE OR REPLACE FUNCTION public.handle_festival_highline_duration_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_window RECORD;
BEGIN
  FOR target_window IN
    SELECT id
    FROM public.festival_schedule_window
    WHERE festival_id = NEW.festival_id
      AND highline_id = NEW.highline_id
  LOOP
    PERFORM public.regenerate_festival_schedule_window(target_window.id);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER festival_highline_duration_regenerate_trigger
AFTER UPDATE OF slot_duration_minutes
ON public.festival_highline
FOR EACH ROW
WHEN (OLD.slot_duration_minutes IS DISTINCT FROM NEW.slot_duration_minutes)
EXECUTE FUNCTION public.handle_festival_highline_duration_change();

CREATE OR REPLACE FUNCTION public.handle_blocked_festival_schedule_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER festival_schedule_slot_blocked_trigger
AFTER INSERT OR UPDATE OF status, block_reason
ON public.festival_schedule_slot
FOR EACH ROW
WHEN (NEW.status = 'blocked')
EXECUTE FUNCTION public.handle_blocked_festival_schedule_slot();

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

  IF resolved_profile_id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO active_booking_count
    FROM public.festival_schedule_booking AS booking
    JOIN public.festival_schedule_slot AS slot
      ON slot.id = booking.slot_id
    WHERE booking.festival_id = slot_row.festival_id
      AND booking.profile_id = resolved_profile_id
      AND booking.status = 'booked';

    IF active_booking_count >= 2 THEN
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

    IF active_booking_count >= 2 THEN
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
    status
  )
  VALUES (
    slot_row.id,
    slot_row.festival_id,
    slot_row.highline_id,
    resolved_profile_id,
    CASE WHEN resolved_profile_id IS NULL THEN normalized_instagram_username ELSE NULL END,
    CASE WHEN resolved_profile_id IS NULL THEN btrim(target_display_name) ELSE NULL END,
    'booked'
  )
  RETURNING *
  INTO created_booking;

  RETURN created_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_schedule_bookings(
  target_festival_id UUID
)
RETURNS TABLE (
  id UUID,
  slot_id UUID,
  festival_id UUID,
  highline_id UUID,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status public.festival_schedule_booking_status_enum,
  participant_display_name TEXT,
  participant_secondary_text TEXT,
  is_viewer BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.cancel_festival_schedule_booking(
  target_booking_id UUID,
  cancellation_reason_input TEXT
)
RETURNS public.festival_schedule_booking
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.enqueue_festival_schedule_open_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
          WHEN opening.opened_day_count = 1 THEN 'Programação liberada'
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
$$;

CREATE OR REPLACE FUNCTION public.enqueue_festival_schedule_reminder_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  WITH reminder_candidates AS (
    SELECT
      booking.id AS booking_id,
      booking.profile_id,
      slot.id AS slot_id,
      slot.highline_id,
      slot.start_at,
      festival.slug AS festival_slug,
      festival.timezone AS festival_timezone,
      highline.name AS highline_name,
      slot.start_at - interval '30 minutes' AS remind_at,
      to_char(
        (slot.start_at AT TIME ZONE festival.timezone)::date,
        'YYYY-MM-DD'
      ) AS day_key
    FROM public.festival_schedule_booking AS booking
    INNER JOIN public.festival_schedule_slot AS slot
      ON slot.id = booking.slot_id
    INNER JOIN public.festival AS festival
      ON festival.id = booking.festival_id
    INNER JOIN public.highline AS highline
      ON highline.id = booking.highline_id
    WHERE booking.status = 'booked'
      AND booking.profile_id IS NOT NULL
      AND slot.start_at > timezone('utc'::text, now())
      AND slot.start_at - interval '30 minutes' <= timezone('utc'::text, now())
      AND slot.start_at - interval '30 minutes' >
        timezone('utc'::text, now()) - interval '5 minutes'
  ),
  inserted_rows AS (
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      data
    )
    SELECT
      reminder.profile_id,
      jsonb_build_object(
        'pt', 'Seu horario esta chegando',
        'en', 'Your schedule is near'
      ),
      jsonb_build_object(
        'pt',
        format(
          'Seu horario na highline %s comeca as %s.',
          reminder.highline_name,
          to_char(reminder.start_at AT TIME ZONE reminder.festival_timezone, 'HH24:MI')
        ),
        'en',
        format(
          'Your slot on %s starts at %s.',
          reminder.highline_name,
          to_char(reminder.start_at AT TIME ZONE reminder.festival_timezone, 'HH24:MI')
        )
      ),
      jsonb_build_object(
        'type', 'festival_schedule_reminder',
        'booking_id', reminder.booking_id,
        'slot_id', reminder.slot_id,
        'remind_at',
          to_char(
            reminder.remind_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS"Z"'
          ),
        'url',
          format(
            '/festival?highline=%s&day=%s',
            reminder.highline_id,
            reminder.day_key
          )
      )
    FROM reminder_candidates AS reminder
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications AS notification
      WHERE notification.data->>'type' = 'festival_schedule_reminder'
        AND notification.data->>'booking_id' = reminder.booking_id::text
        AND notification.data->>'remind_at' = to_char(
          reminder.remind_at AT TIME ZONE 'UTC',
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
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_festival_schedule_by_id(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_festival_schedule_slot(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_festival_schedule_booking(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_schedule_bookings(UUID) TO anon, authenticated;

SELECT cron.schedule(
  'festival-schedule-reconcile-every-minute',
  '* * * * *',
  $$
  SELECT public.reconcile_festival_schedule();
  $$
);

SELECT cron.schedule(
  'festival-schedule-open-notifications-every-30-minutes',
  '*/30 * * * *',
  $$
  SELECT public.enqueue_festival_schedule_open_notifications();
  $$
);

SELECT cron.schedule(
  'festival-schedule-reminder-notifications-every-minute',
  '* * * * *',
  $$
  SELECT public.enqueue_festival_schedule_reminder_notifications();
  $$
);

ALTER TABLE public.festival_schedule_window REPLICA IDENTITY FULL;
ALTER TABLE public.festival_schedule_slot REPLICA IDENTITY FULL;
ALTER TABLE public.festival_schedule_booking REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.festival_schedule_window;
ALTER PUBLICATION supabase_realtime ADD TABLE public.festival_schedule_slot;
ALTER PUBLICATION supabase_realtime ADD TABLE public.festival_schedule_booking;
