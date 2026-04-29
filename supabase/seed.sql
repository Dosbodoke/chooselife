-- Local development seed for festival queue testing.
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

-- Create the local festival row used by the web and mobile queue feature.
-- start_at is inferred from the current UTC day.
-- end_at is 4 days after start_at.
INSERT INTO public.festival (
  slug,
  name,
  subtitle,
  start_at,
  end_at,
  is_active
)
VALUES (
  'chooselife-2026',
  'Festival Chooselife',
  'The biggest Highline festival in Brazil',
  date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc',
  (date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc') + interval '4 days',
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  subtitle = EXCLUDED.subtitle,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
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
INSERT INTO public.festival_highline (festival_id, highline_id, sort_order)
SELECT
  festival.id,
  seeded.highline_id,
  seeded.sort_order
FROM public.festival AS festival
INNER JOIN (
  VALUES
    ('11111111-1111-4111-8111-111111111111'::uuid, 0),
    ('22222222-2222-4222-8222-222222222222'::uuid, 1),
    ('33333333-3333-4333-8333-333333333333'::uuid, 2),
    ('44444444-4444-4444-8444-444444444444'::uuid, 3)
) AS seeded(highline_id, sort_order)
  ON TRUE
WHERE festival.slug = 'chooselife-2026'
ON CONFLICT (festival_id, highline_id) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Optionally link local test users as festival staff when these usernames exist.
INSERT INTO public.festival_staff (festival_id, profile_id)
SELECT festival.id, profile.id
FROM public.festival AS festival
INNER JOIN public.profiles AS profile
  ON profile.username IN ('@festivalchooselife', '@juangsandrade')
WHERE festival.slug = 'chooselife-2026'
ON CONFLICT (festival_id, profile_id) DO NOTHING;

-- Add queue entries for the first festival highline.
-- Entry 1:
--   joined now
--   called 1 minute after joining
--
-- Entry 2:
--   same queue
--   joined 1 minute after entry 1
--   not called yet
INSERT INTO public.festival_queue_entry (
  id,
  festival_id,
  highline_id,
  profile_id,
  display_name,
  status,
  joined_at,
  called_at
)
SELECT
  seeded.id,
  festival.id,
  seeded.highline_id,
  NULL,
  seeded.display_name,
  seeded.status,
  seeded.joined_at,
  seeded.called_at
FROM public.festival AS festival
INNER JOIN (
  VALUES
    (
      'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
      '11111111-1111-4111-8111-111111111111'::uuid,
      'Luna',
      'called'::public.festival_queue_status_enum,
      now(),
      now() + interval '1 minute'
    ),
    (
      'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
      '11111111-1111-4111-8111-111111111111'::uuid,
      'Nico',
      'waiting'::public.festival_queue_status_enum,
      now() + interval '1 minute',
      NULL::timestamptz
    )
) AS seeded(
  id,
  highline_id,
  display_name,
  status,
  joined_at,
  called_at
)
  ON TRUE
WHERE festival.slug = 'chooselife-2026'
ON CONFLICT (id) DO UPDATE
SET
  highline_id = EXCLUDED.highline_id,
  profile_id = EXCLUDED.profile_id,
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  joined_at = EXCLUDED.joined_at,
  called_at = EXCLUDED.called_at,
  completed_at = NULL,
  removed_at = NULL,
  removed_by = NULL;
