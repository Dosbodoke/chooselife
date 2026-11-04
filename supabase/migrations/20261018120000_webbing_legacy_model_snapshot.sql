-- Freeze legacy Choose Life model details onto each physical webbing.
--
-- Expand step of retiring `webbing_model`. New app builds read only
-- `legacy_model_snapshot` and never write `model`. Released builds up to
-- 1.9.5 still insert `model` ids and join `webbing_model`, so the table,
-- the column and its foreign key stay until those builds are gone. The
-- trigger below captures their writes so no new row depends on the join.
--
-- Contract step (drop the trigger, `webbing.model` and `webbing_model`) is
-- tracked in GitHub issue #286.

ALTER TABLE public.webbing ADD COLUMN legacy_model_snapshot jsonb;

CREATE FUNCTION public.webbing_legacy_model_snapshot(
  model_id bigint,
  captured_by text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'schemaVersion', 1,
    'source', 'chooselife',
    'modelId', m.id,
    'name', m.name,
    'material', m.material::text,
    'weave', m.weave::text,
    'strengthClass', m.strength_class::text,
    'recommendedLifetimeDays', m.recommended_lifetime_days,
    'imagePath', m.image_url,
    'capturedAt', to_jsonb(now()),
    'capturedBy', captured_by
  ))
  FROM public.webbing_model AS m
  WHERE m.id = model_id;
$$;

UPDATE public.webbing
SET legacy_model_snapshot =
  public.webbing_legacy_model_snapshot(model, 'backfill')
WHERE model IS NOT NULL;

ALTER TABLE public.webbing
  ADD CONSTRAINT webbing_legacy_model_snapshot_valid CHECK (
    legacy_model_snapshot IS NULL
    OR coalesce(
      jsonb_typeof(legacy_model_snapshot) = 'object'
      AND legacy_model_snapshot ->> 'schemaVersion' = '1'
      AND legacy_model_snapshot ->> 'source' = 'chooselife'
      AND jsonb_typeof(legacy_model_snapshot -> 'modelId') = 'number'
      AND jsonb_typeof(legacy_model_snapshot -> 'name') = 'string'
      AND length(btrim(legacy_model_snapshot ->> 'name')) > 0
      AND legacy_model_snapshot ->> 'capturedBy' IN ('backfill', 'legacy-client'),
      false
    )
  );

-- Server-owned: clients never write the snapshot. A `model` change from a
-- released build re-captures it; anything else keeps the stored value, so
-- `ON DELETE SET NULL` on the old foreign key can no longer erase details.
CREATE FUNCTION public.capture_webbing_legacy_model()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.model IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.model IS DISTINCT FROM OLD.model) THEN
    NEW.legacy_model_snapshot :=
      public.webbing_legacy_model_snapshot(NEW.model, 'legacy-client');
  ELSIF TG_OP = 'INSERT' THEN
    NEW.legacy_model_snapshot := NULL;
  ELSE
    NEW.legacy_model_snapshot := OLD.legacy_model_snapshot;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER webbing_capture_legacy_model
  BEFORE INSERT OR UPDATE ON public.webbing
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_webbing_legacy_model();

COMMENT ON COLUMN public.webbing.legacy_model_snapshot IS
  'Frozen copy of the retired Choose Life model this webbing was registered with. Server-owned; kept after webbing_model is dropped. capturedBy=legacy-client marks writes from app builds that still send model ids.';
COMMENT ON COLUMN public.webbing.model IS
  'Deprecated. Written only by app builds up to 1.9.5. Read legacy_model_snapshot instead. Dropped by GitHub issue #286.';
COMMENT ON TABLE public.webbing_model IS
  'Deprecated catalog kept for app builds up to 1.9.5. New builds use SlackData. Dropped by GitHub issue #286.';
