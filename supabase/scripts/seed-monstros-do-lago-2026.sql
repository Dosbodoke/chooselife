-- Seed the "Monstros do Lago 2026" festival on stage.
-- Run manually (SQL editor or psql). Idempotent — safe to re-run.
--
-- EDIT BEFORE RUNNING if needed:
--   * festival dates (start_at / end_at, currently 2026-09-04 → 2026-09-08)
--   * sector/highline names, heights and lengths
--   * daily window hours (currently 09:00–18:00, scheduling opens 08:30)

-- 1. Festival row.
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
  'monstros-do-lago-2026',
  'Monstros do Lago 2026',
  'Festival de Highline',
  '2026-09-04 00:00 America/Sao_Paulo'::timestamptz,
  '2026-09-08 00:00 America/Sao_Paulo'::timestamptz,
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

-- 2. Sector for the festival highlines.
INSERT INTO public.sector (id, name, description)
VALUES
  (2001, 'Lago', 'Setor principal do Monstros do Lago.')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 3. Highlines (stable ids so this script stays idempotent).
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
    '55555555-5555-4555-8555-555555555551',
    'Monstro 1',
    30,
    80,
    'Linha de aquecimento sobre o lago.',
    2001,
    NULL
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    'Monstro 2',
    45,
    120,
    'Linha intermediária com vista para o lago.',
    2001,
    NULL
  ),
  (
    '55555555-5555-4555-8555-555555555553',
    'Monstro 3',
    60,
    180,
    'Linha longa principal do festival.',
    2001,
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  height = EXCLUDED.height,
  length = EXCLUDED.length,
  description = EXCLUDED.description,
  sector_id = EXCLUDED.sector_id;

-- 4. Link highlines to the festival.
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
    ('55555555-5555-4555-8555-555555555551'::uuid, 0, 45),
    ('55555555-5555-4555-8555-555555555552'::uuid, 1, 45),
    ('55555555-5555-4555-8555-555555555553'::uuid, 2, 60)
) AS seeded(highline_id, sort_order, slot_duration_minutes)
  ON TRUE
WHERE festival.slug = 'monstros-do-lago-2026'
ON CONFLICT (festival_id, highline_id) DO UPDATE
SET
  sort_order = EXCLUDED.sort_order,
  slot_duration_minutes = EXCLUDED.slot_duration_minutes;

-- 5. One continuous daily window per highline for each festival day.
WITH festival_target AS (
  SELECT
    festival.id,
    festival.timezone,
    (festival.start_at AT TIME ZONE festival.timezone)::date AS local_start_date,
    ((festival.end_at AT TIME ZONE festival.timezone)::date
      - (festival.start_at AT TIME ZONE festival.timezone)::date) AS day_count
  FROM public.festival AS festival
  WHERE festival.slug = 'monstros-do-lago-2026'
)
INSERT INTO public.festival_schedule_window (
  festival_id,
  highline_id,
  scheduling_opens_at,
  window_start_at,
  window_end_at
)
SELECT
  festival.id,
  linked.highline_id,
  ((festival.local_start_date + day_offset) + time '08:30') AT TIME ZONE festival.timezone,
  ((festival.local_start_date + day_offset) + time '09:00') AT TIME ZONE festival.timezone,
  ((festival.local_start_date + day_offset) + time '18:00') AT TIME ZONE festival.timezone
FROM festival_target AS festival
INNER JOIN public.festival_highline AS linked
  ON linked.festival_id = festival.id
CROSS JOIN generate_series(0, (SELECT day_count FROM festival_target)) AS day_offset
ON CONFLICT (festival_id, highline_id, window_start_at) DO UPDATE
SET
  scheduling_opens_at = EXCLUDED.scheduling_opens_at,
  window_end_at = EXCLUDED.window_end_at;

-- 6. Optionally register festival staff when these usernames exist.
INSERT INTO public.festival_staff (festival_id, profile_id)
SELECT festival.id, profile.id
FROM public.festival AS festival
INNER JOIN public.profiles AS profile
  ON profile.username IN ('@festivalchooselife', '@juangsandrade')
WHERE festival.slug = 'monstros-do-lago-2026'
ON CONFLICT (festival_id, profile_id) DO NOTHING;

-- 7. Generate the bookable slots from the windows above.
SELECT public.reconcile_festival_schedule('monstros-do-lago-2026');
