CREATE OR REPLACE FUNCTION public.normalize_profile_username_value(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(value), '') IS NULL THEN NULL
    ELSE lower(
      CASE
        WHEN left(btrim(value), 1) = '@' THEN btrim(value)
        ELSE '@' || btrim(value)
      END
    )
  END;
$$;

WITH ranked_profiles AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY public.normalize_profile_username_value(username::text)
      ORDER BY
        (profile_picture IS NOT NULL) DESC,
        (name IS NOT NULL) DESC,
        (birthday IS NOT NULL) DESC,
        (description IS NOT NULL) DESC,
        (username::text = public.normalize_profile_username_value(username::text)) DESC,
        id
    ) AS duplicate_rank
  FROM public.profiles
  WHERE public.normalize_profile_username_value(username::text) IS NOT NULL
)
UPDATE public.profiles AS profile
SET username = NULL
FROM ranked_profiles AS ranked
WHERE profile.id = ranked.id
  AND ranked.duplicate_rank > 1;

UPDATE public.profiles
SET username = public.normalize_profile_username_value(username::text)
WHERE username IS NOT NULL
  AND username::text IS DISTINCT FROM public.normalize_profile_username_value(username::text);

CREATE OR REPLACE FUNCTION public.set_normalized_profile_username()
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

CREATE TRIGGER normalize_profiles_username
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_normalized_profile_username();

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_normalized_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_normalized_check
  CHECK (
    username IS NULL
    OR username IS NOT DISTINCT FROM public.normalize_profile_username_value(username::text)
  );
