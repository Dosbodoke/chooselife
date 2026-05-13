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
