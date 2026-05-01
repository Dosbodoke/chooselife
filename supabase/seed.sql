-- Local development seed for festival schedule testing.
-- This file is applied after all migrations during `supabase db reset`.

-- Create a few sectors with stable ids so highlines can reference them.
INSERT INTO public.sector (id, name, description)
VALUES
  (1001, 'Pedra Bonita', 'Sunset-friendly festival sector with shorter warm-up lines.'),
  (1002, 'Vale do Vento', 'Longer and higher lines for the main festival crowd.')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Create the local festival row used by the web and mobile festival feature.
-- Keep the festival active across past/current/future days for easier schedule testing.
INSERT INTO public.festival (
  slug,
  name,
  subtitle,
  start_at,
  end_at,
  timezone,
  is_active
)
VALUES (
  'chooselife-2026',
  'Festival Chooselife',
  'The biggest Highline festival in Brazil',
  (date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc') - interval '2 days',
  (date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc') + interval '2 days',
  'America/Sao_Paulo',
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  subtitle = EXCLUDED.subtitle,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  timezone = EXCLUDED.timezone,
  is_active = EXCLUDED.is_active;

-- Seed highlines that will be explicitly linked to the local festival below.
INSERT INTO public.highline (
  id,
  name,
  height,
  length,
  description,
  sector_id,
  cover_image
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'Warm Up Flow',
    28,
    65,
    'Shorter warm-up line near the main access trail.',
    1001,
    NULL
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Golden Hour',
    42,
    95,
    'Medium line with a clear sunset view over the valley.',
    1001,
    NULL
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Vale Express',
    58,
    120,
    'Fast, exposed line for experienced walkers.',
    1002,
    NULL
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Big Breeze',
    74,
    155,
    'Long festival line with steady afternoon wind.',
    1002,
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  height = EXCLUDED.height,
  length = EXCLUDED.length,
  description = EXCLUDED.description,
  sector_id = EXCLUDED.sector_id,
  cover_image = EXCLUDED.cover_image;

-- Keep the festival/highline mapping in sync in case the migration ran before
-- this seed inserted the local test highlines.
INSERT INTO public.festival_highline (
  festival_id,
  highline_id,
  sort_order,
  slot_duration_minutes
)
SELECT
  festival.id,
  seeded.highline_id,
  seeded.sort_order,
  seeded.slot_duration_minutes
FROM public.festival AS festival
INNER JOIN (
  VALUES
    ('11111111-1111-4111-8111-111111111111'::uuid, 0, 45),
    ('22222222-2222-4222-8222-222222222222'::uuid, 1, 45),
    ('33333333-3333-4333-8333-333333333333'::uuid, 2, 60),
    ('44444444-4444-4444-8444-444444444444'::uuid, 3, 45)
) AS seeded(highline_id, sort_order, slot_duration_minutes)
  ON TRUE
WHERE festival.slug = 'chooselife-2026'
ON CONFLICT (festival_id, highline_id) DO UPDATE
SET
  sort_order = EXCLUDED.sort_order,
  slot_duration_minutes = EXCLUDED.slot_duration_minutes;

-- Optionally link local test users as festival staff when these usernames exist.
INSERT INTO public.festival_staff (festival_id, profile_id)
SELECT festival.id, profile.id
FROM public.festival AS festival
INNER JOIN public.profiles AS profile
  ON profile.username IN ('@festivalchooselife', '@juangsandrade')
WHERE festival.slug = 'chooselife-2026'
ON CONFLICT (festival_id, profile_id) DO NOTHING;

-- Configure one continuous daily window per highline for each festival day.
WITH festival_target AS (
  SELECT
    festival.id,
    festival.timezone,
    (festival.start_at AT TIME ZONE festival.timezone)::date AS local_start_date
  FROM public.festival AS festival
  WHERE festival.slug = 'chooselife-2026'
)
INSERT INTO public.festival_schedule_window (
  festival_id,
  highline_id,
  window_start_at,
  window_end_at
)
SELECT
  festival.id,
  config.highline_id,
  ((festival.local_start_date + config.day_offset) + time '09:00') AT TIME ZONE festival.timezone,
  ((festival.local_start_date + config.day_offset) + time '18:00') AT TIME ZONE festival.timezone
FROM festival_target AS festival
INNER JOIN (
  SELECT
    seeded.highline_id,
    day_offset
  FROM (
    VALUES
      ('11111111-1111-4111-8111-111111111111'::uuid),
      ('22222222-2222-4222-8222-222222222222'::uuid),
      ('33333333-3333-4333-8333-333333333333'::uuid),
      ('44444444-4444-4444-8444-444444444444'::uuid)
  ) AS seeded(highline_id)
  CROSS JOIN generate_series(0, 4) AS day_offset
) AS config
  ON TRUE
ON CONFLICT (festival_id, highline_id, window_start_at) DO UPDATE
SET
  window_end_at = EXCLUDED.window_end_at;

-- Create a completed guest booking on the first festival day for history.
INSERT INTO public.festival_schedule_booking (
  id,
  slot_id,
  festival_id,
  highline_id,
  instagram_username,
  display_name,
  status,
  created_at,
  completed_at
)
SELECT
  'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
  slot.id,
  slot.festival_id,
  slot.highline_id,
  '@maya.guest',
  'Maya',
  'completed'::public.festival_schedule_booking_status_enum,
  slot.start_at,
  slot.end_at
FROM (
  SELECT slot.*
  FROM public.festival_schedule_slot AS slot
  INNER JOIN public.festival AS festival
    ON festival.id = slot.festival_id
  WHERE festival.slug = 'chooselife-2026'
    AND slot.highline_id = '11111111-1111-4111-8111-111111111111'::uuid
    AND (slot.start_at AT TIME ZONE festival.timezone)::date =
      ((festival.start_at AT TIME ZONE festival.timezone)::date)
  ORDER BY slot.start_at ASC
  LIMIT 1
) AS slot
ON CONFLICT (id) DO UPDATE
SET
  slot_id = EXCLUDED.slot_id,
  festival_id = EXCLUDED.festival_id,
  highline_id = EXCLUDED.highline_id,
  instagram_username = EXCLUDED.instagram_username,
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  created_at = EXCLUDED.created_at,
  completed_at = EXCLUDED.completed_at,
  cancellation_reason = NULL,
  cancellation_source = NULL,
  cancelled_by_profile_id = NULL,
  cancelled_at = NULL;

-- Create a current-or-next registered booking when a local profile exists.
INSERT INTO public.festival_schedule_booking (
  id,
  slot_id,
  festival_id,
  highline_id,
  profile_id,
  status
)
SELECT
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
  slot.id,
  slot.festival_id,
  slot.highline_id,
  profile.id,
  'booked'::public.festival_schedule_booking_status_enum
FROM public.profiles AS profile
INNER JOIN (
  SELECT slot.*
  FROM public.festival_schedule_slot AS slot
  INNER JOIN public.festival AS festival
    ON festival.id = slot.festival_id
  WHERE festival.slug = 'chooselife-2026'
    AND slot.highline_id = '11111111-1111-4111-8111-111111111111'::uuid
    AND (slot.start_at AT TIME ZONE festival.timezone)::date =
      (timezone(festival.timezone, now()))::date
    AND slot.status = 'available'
    AND slot.end_at > now()
  ORDER BY
    CASE
      WHEN slot.start_at <= now() AND slot.end_at > now() THEN 0
      ELSE 1
    END,
    slot.start_at ASC
  LIMIT 1
) AS slot
  ON TRUE
WHERE profile.username = '@festivalchooselife'
ON CONFLICT (id) DO UPDATE
SET
  slot_id = EXCLUDED.slot_id,
  festival_id = EXCLUDED.festival_id,
  highline_id = EXCLUDED.highline_id,
  profile_id = EXCLUDED.profile_id,
  status = EXCLUDED.status,
  instagram_username = NULL,
  display_name = NULL,
  cancellation_reason = NULL,
  cancellation_source = NULL,
  cancelled_by_profile_id = NULL,
  cancelled_at = NULL,
  completed_at = NULL;

-- Create a guest booking later in the current festival day.
INSERT INTO public.festival_schedule_booking (
  id,
  slot_id,
  festival_id,
  highline_id,
  instagram_username,
  display_name,
  status
)
SELECT
  'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid,
  slot.id,
  slot.festival_id,
  slot.highline_id,
  '@luna.guest',
  'Luna',
  'booked'::public.festival_schedule_booking_status_enum
FROM (
  SELECT slot.*
  FROM public.festival_schedule_slot AS slot
  INNER JOIN public.festival AS festival
    ON festival.id = slot.festival_id
  WHERE festival.slug = 'chooselife-2026'
    AND slot.highline_id = '22222222-2222-4222-8222-222222222222'::uuid
    AND (slot.start_at AT TIME ZONE festival.timezone)::date =
      (timezone(festival.timezone, now()))::date
    AND slot.status = 'available'
    AND slot.start_at > now()
  ORDER BY slot.start_at ASC
  OFFSET 1
  LIMIT 1
) AS slot
ON CONFLICT (id) DO UPDATE
SET
  slot_id = EXCLUDED.slot_id,
  festival_id = EXCLUDED.festival_id,
  highline_id = EXCLUDED.highline_id,
  instagram_username = EXCLUDED.instagram_username,
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  profile_id = NULL,
  cancellation_reason = NULL,
  cancellation_source = NULL,
  cancelled_by_profile_id = NULL,
  cancelled_at = NULL,
  completed_at = NULL;

-- Block a future slot to represent a competition reservation.
UPDATE public.festival_schedule_slot AS slot
SET
  status = 'blocked',
  block_reason = 'Competition'
FROM (
  SELECT blocked_slot.id
  FROM public.festival_schedule_slot AS blocked_slot
  INNER JOIN public.festival AS festival
    ON festival.id = blocked_slot.festival_id
  WHERE festival.slug = 'chooselife-2026'
    AND blocked_slot.highline_id = '22222222-2222-4222-8222-222222222222'::uuid
    AND (blocked_slot.start_at AT TIME ZONE festival.timezone)::date =
      (timezone(festival.timezone, now()))::date
    AND blocked_slot.status = 'available'
    AND blocked_slot.start_at > now()
  ORDER BY blocked_slot.start_at ASC
  OFFSET 2
  LIMIT 1
) AS target
WHERE slot.id = target.id;

SELECT public.reconcile_festival_schedule('chooselife-2026');
