CREATE TYPE public.festival_queue_status_enum AS ENUM (
  'waiting',
  'called',
  'completed',
  'removed'
);

CREATE TABLE public.festival (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.festival_highline (
  festival_id UUID NOT NULL REFERENCES public.festival(id) ON DELETE CASCADE,
  highline_id UUID NOT NULL REFERENCES public.highline(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (festival_id, highline_id)
);

CREATE TABLE public.festival_staff (
  festival_id UUID NOT NULL REFERENCES public.festival(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (festival_id, profile_id)
);

CREATE TABLE public.festival_queue_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID NOT NULL REFERENCES public.festival(id) ON DELETE CASCADE,
  highline_id UUID NOT NULL REFERENCES public.highline(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  status public.festival_queue_status_enum NOT NULL DEFAULT 'waiting',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX festival_highline_sort_order_idx
  ON public.festival_highline (festival_id, sort_order, highline_id);

CREATE INDEX festival_queue_active_order_idx
  ON public.festival_queue_entry (festival_id, highline_id, joined_at)
  WHERE status IN ('waiting', 'called');

CREATE UNIQUE INDEX festival_queue_called_unique_idx
  ON public.festival_queue_entry (festival_id, highline_id)
  WHERE status = 'called';

CREATE UNIQUE INDEX festival_queue_active_profile_unique_idx
  ON public.festival_queue_entry (festival_id, highline_id, profile_id)
  WHERE profile_id IS NOT NULL AND status IN ('waiting', 'called');

ALTER TABLE public.festival ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_highline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_queue_entry ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Active festival queue entries are viewable by everyone."
ON public.festival_queue_entry
FOR SELECT
TO anon, authenticated
USING (status IN ('waiting', 'called'));

CREATE POLICY "Festival staff can create manual festival queue entries."
ON public.festival_queue_entry
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id IS NULL
  AND status = 'waiting'
  AND called_at IS NULL
  AND completed_at IS NULL
  AND removed_at IS NULL
  AND removed_by IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.festival_highline
    WHERE festival_id = festival_queue_entry.festival_id
      AND highline_id = festival_queue_entry.highline_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.festival_staff
    WHERE festival_staff.festival_id = festival_queue_entry.festival_id
      AND festival_staff.profile_id = auth.uid()
  )
);


CREATE POLICY "Users can leave their own active festival queue entries."
ON public.festival_queue_entry
FOR UPDATE
TO authenticated
USING (
  auth.uid() = profile_id
  AND status IN ('waiting', 'called')
)
WITH CHECK (
  auth.uid() = profile_id
  AND status = 'removed'
  AND removed_by = auth.uid()
  AND removed_at IS NOT NULL
);

CREATE POLICY "Festival staff can manage festival queue entries."
ON public.festival_queue_entry
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.festival_staff
    WHERE festival_staff.festival_id = festival_queue_entry.festival_id
      AND festival_staff.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.festival_staff
    WHERE festival_staff.festival_id = festival_queue_entry.festival_id
      AND festival_staff.profile_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create their own festival queue entries."
ON public.festival_queue_entry
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = profile_id
  AND status = 'waiting'
  AND called_at IS NULL
  AND completed_at IS NULL
  AND removed_at IS NULL
  AND removed_by IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.festival_highline
    WHERE festival_id = festival_queue_entry.festival_id
      AND highline_id = festival_queue_entry.highline_id
  )
);


CREATE OR REPLACE FUNCTION public.call_next_festival_queue(
  festival_slug TEXT,
  target_highline_id UUID
)
RETURNS public.festival_queue_entry
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_festival_id UUID;
  next_entry public.festival_queue_entry;
BEGIN
  SELECT id
  INTO target_festival_id
  FROM public.festival
  WHERE slug = festival_slug
  LIMIT 1;

  IF target_festival_id IS NULL THEN
    RAISE EXCEPTION 'Festival not found';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_staff
    WHERE festival_id = target_festival_id
      AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.festival_queue_entry
  SET
    status = 'completed',
    completed_at = timezone('utc'::text, now())
  WHERE id IN (
    SELECT id
    FROM public.festival_queue_entry
    WHERE festival_id = target_festival_id
      AND highline_id = target_highline_id
      AND status = 'called'
    LIMIT 1
  );

  UPDATE public.festival_queue_entry
  SET
    status = 'called',
    called_at = timezone('utc'::text, now())
  WHERE id = (
    SELECT id
    FROM public.festival_queue_entry
    WHERE festival_id = target_festival_id
      AND highline_id = target_highline_id
      AND status = 'waiting'
    ORDER BY joined_at ASC
    LIMIT 1
  )
  RETURNING *
  INTO next_entry;

  RETURN next_entry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.call_next_festival_queue(TEXT, UUID) TO authenticated;

ALTER TABLE public.festival_queue_entry REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.festival_queue_entry;
