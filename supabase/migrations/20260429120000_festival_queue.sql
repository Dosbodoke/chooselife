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
  window_start_at TIMESTAMPTZ NOT NULL,
  window_end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (window_end_at > window_start_at),
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

CREATE POLICY "Visible festival schedule bookings are viewable by everyone."
ON public.festival_schedule_booking
FOR SELECT
TO anon, authenticated
USING (status IN ('booked', 'completed'));

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
  resolved_profile_id UUID := target_profile_id;
  normalized_instagram_username TEXT := public.normalize_festival_instagram_username(target_instagram_username);
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

  IF resolved_profile_id IS NULL THEN
    IF normalized_instagram_username IS NULL THEN
      RAISE EXCEPTION 'Instagram username is required for guest bookings';
    END IF;

    IF coalesce(nullif(btrim(target_display_name), ''), '') = '' THEN
      RAISE EXCEPTION 'Display name is required for guest bookings';
    END IF;
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
  slot_row public.festival_schedule_slot;
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

  SELECT slot.*
  INTO slot_row
  FROM public.festival_schedule_slot AS slot
  WHERE slot.id = booking_row.slot_id
  LIMIT 1;

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

GRANT EXECUTE ON FUNCTION public.reconcile_festival_schedule(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_festival_schedule_slot(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_festival_schedule_booking(UUID, TEXT) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA "extensions";
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule(
  'festival-schedule-reconcile-every-minute',
  '* * * * *',
  $$
  SELECT public.reconcile_festival_schedule();
  $$
);

ALTER TABLE public.festival_schedule_slot REPLICA IDENTITY FULL;
ALTER TABLE public.festival_schedule_booking REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.festival_schedule_slot;
ALTER PUBLICATION supabase_realtime ADD TABLE public.festival_schedule_booking;
