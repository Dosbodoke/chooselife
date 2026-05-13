CREATE OR REPLACE FUNCTION public.normalize_profile_username(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    ELSE '@' || regexp_replace(lower(btrim(value)), '^@+', '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_legacy_profile_username(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  WITH cleaned AS (
    SELECT regexp_replace(
      regexp_replace(
        regexp_replace(lower(btrim(value)), '^@+', ''),
        '\s+',
        '',
        'g'
      ),
      '[^a-z0-9._]',
      '',
      'g'
    ) AS username
  ),
  collapsed AS (
    SELECT btrim(regexp_replace(username, '\.{2,}', '.', 'g'), '.') AS username
    FROM cleaned
  ),
  truncated AS (
    SELECT btrim(left(username, 30), '.') AS username
    FROM collapsed
  )
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN length(username) < 3 THEN NULL
    ELSE '@' || username
  END
  FROM truncated;
$$;

CREATE OR REPLACE FUNCTION public.profile_username_disambiguated(
  normalized_username TEXT,
  profile_id UUID
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  WITH parts AS (
    SELECT
      regexp_replace(normalized_username, '^@', '') AS username,
      '_' || substr(md5(profile_id::TEXT), 1, 6) AS suffix
  )
  SELECT '@' || btrim(left(username, 30 - length(suffix)), '.') || suffix
  FROM parts;
$$;

WITH normalized_profiles AS (
  SELECT
    id,
    public.sanitize_legacy_profile_username(username::TEXT) AS normalized_username
  FROM public.profiles
  WHERE username IS NOT NULL
),
ranked_profiles AS (
  SELECT
    id,
    normalized_username,
    row_number() OVER (
      PARTITION BY normalized_username
      ORDER BY id
    ) AS username_rank
  FROM normalized_profiles
)
UPDATE public.profiles AS profile
SET username = CASE
  WHEN ranked.normalized_username IS NULL THEN NULL
  WHEN ranked.username_rank = 1 THEN ranked.normalized_username
  ELSE public.profile_username_disambiguated(
    ranked.normalized_username,
    profile.id
  )
END
FROM ranked_profiles AS ranked
WHERE profile.id = ranked.id;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_username_key;

CREATE UNIQUE INDEX profiles_username_unique_idx
ON public.profiles (lower(username))
WHERE username IS NOT NULL;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_canonical_check
CHECK (
  username IS NULL
  OR (
    username = public.normalize_profile_username(username)
    AND username ~ '^@[a-z0-9._]{3,30}$'
    AND username !~ '^@\.'
    AND username !~ '\.$'
    AND username !~ '\.\.'
  )
);

CREATE OR REPLACE FUNCTION public.set_normalized_profile_username()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.username := public.normalize_profile_username(NEW.username);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_profile_username_before_write ON public.profiles;

CREATE TRIGGER normalize_profile_username_before_write
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_normalized_profile_username();
