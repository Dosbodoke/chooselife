CREATE OR REPLACE FUNCTION public.normalize_profile_username_value(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(regexp_replace(btrim(value), '^@+', ''), '') IS NULL THEN NULL    ELSE '@' || lower(regexp_replace(btrim(value), '^@+', ''))
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.username := public.normalize_profile_username_value(NEW.username::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_profiles_username ON public.profiles;
DROP TRIGGER IF EXISTS normalize_profile_username_before_write ON public.profiles;

CREATE TRIGGER normalize_profile_username_before_write
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_profile_username();

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_normalized_check;

DROP INDEX IF EXISTS public.profiles_username_normalized_unique_idx;
DROP INDEX IF EXISTS public.profiles_username_unique_ci;

CREATE OR REPLACE FUNCTION public.profile_stats(username TEXT)
RETURNS TABLE(
  total_distance_walked NUMERIC,
  total_cadenas INTEGER,
  total_full_lines INTEGER
)
LANGUAGE sql
AS $$
  SELECT
    sum(distance_walked) AS total_distance_walked,
    sum(cadenas)::integer AS total_cadenas,
    sum(full_lines)::integer AS total_full_lines
  FROM public.entry
  WHERE public.normalize_profile_username_value(instagram) =
    public.normalize_profile_username_value(username);
$$;

CREATE OR REPLACE FUNCTION public.get_crossing_time(
  highline_id UUID,
  page_number INTEGER,
  page_size INTEGER
)
RETURNS TABLE(
  instagram TEXT,
  crossing_time INTEGER,
  profile_picture TEXT
)
LANGUAGE sql
AS $$
  SELECT
    e.instagram,
    e.crossing_time,
    COALESCE(p.profile_picture, '') AS profile_picture
  FROM public.entry AS e
  LEFT JOIN public.profiles AS p
    ON public.normalize_profile_username_value(e.instagram) =
      public.normalize_profile_username_value(p.username::text)
  WHERE e.highline_id = get_crossing_time.highline_id
  ORDER BY e.crossing_time ASC
  OFFSET (get_crossing_time.page_number - 1) * get_crossing_time.page_size
  LIMIT get_crossing_time.page_size;
$$;

CREATE OR REPLACE FUNCTION public.get_total_cadenas(
  highline_ids UUID[],
  page_number INTEGER,
  page_size INTEGER,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  instagram TEXT,
  total_cadenas INTEGER,
  profile_picture TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.instagram,
    SUM(e.cadenas)::integer AS total_cadenas,
    COALESCE(p.profile_picture, '') AS profile_picture
  FROM public.entry AS e
  LEFT JOIN public.profiles AS p
    ON public.normalize_profile_username_value(e.instagram) =
      public.normalize_profile_username_value(p.username::text)
  WHERE e.highline_id = ANY(get_total_cadenas.highline_ids)
    AND (e.created_at >= COALESCE(start_date, '1970-01-01'::timestamp) OR start_date IS NULL)
    AND (e.created_at <= COALESCE(end_date, now()) OR end_date IS NULL)
  GROUP BY e.instagram, p.profile_picture
  HAVING SUM(e.cadenas) > 0
  ORDER BY total_cadenas DESC
  OFFSET (get_total_cadenas.page_number - 1) * get_total_cadenas.page_size
  LIMIT get_total_cadenas.page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_total_full_lines(
  highline_ids UUID[],
  page_number INTEGER,
  page_size INTEGER,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  instagram TEXT,
  total_full_lines INTEGER,
  profile_picture TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.instagram,
    SUM(e.full_lines)::integer AS total_full_lines,
    COALESCE(p.profile_picture, '') AS profile_picture
  FROM public.entry AS e
  LEFT JOIN public.profiles AS p
    ON public.normalize_profile_username_value(e.instagram) =
      public.normalize_profile_username_value(p.username::text)
  WHERE e.highline_id = ANY(get_total_full_lines.highline_ids)
    AND (e.created_at >= COALESCE(start_date, '1970-01-01'::timestamp) OR start_date IS NULL)
    AND (e.created_at <= COALESCE(end_date, now()) OR end_date IS NULL)
  GROUP BY e.instagram, p.profile_picture
  HAVING SUM(e.full_lines) > 0
  ORDER BY total_full_lines DESC
  OFFSET (get_total_full_lines.page_number - 1) * get_total_full_lines.page_size
  LIMIT get_total_full_lines.page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_total_walked(
  highline_ids UUID[],
  page_number INTEGER,
  page_size INTEGER,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  instagram TEXT,
  total_distance_walked INTEGER,
  profile_picture TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.instagram,
    SUM(e.distance_walked)::integer AS total_distance_walked,
    COALESCE(p.profile_picture, '') AS profile_picture
  FROM public.entry AS e
  LEFT JOIN public.profiles AS p
    ON public.normalize_profile_username_value(e.instagram) =
      public.normalize_profile_username_value(p.username::text)
  WHERE e.highline_id = ANY(get_total_walked.highline_ids)
    AND (e.created_at >= COALESCE(start_date, '1970-01-01'::timestamp) OR start_date IS NULL)
    AND (e.created_at <= COALESCE(end_date, now()) OR end_date IS NULL)
    AND e.distance_walked IS NOT NULL
  GROUP BY e.instagram, p.profile_picture
  ORDER BY total_distance_walked DESC
  OFFSET (get_total_walked.page_number - 1) * get_total_walked.page_size
  LIMIT get_total_walked.page_size;
END;
$$;
