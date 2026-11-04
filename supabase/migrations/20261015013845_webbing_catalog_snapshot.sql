-- Selected SlackData catalog details saved with one physical webbing.
--
-- Imported selections leave the legacy `model` foreign key null and store the
-- user-selected, normalized model details here. Full optional-field validation
-- lives in the app's Zod schema; this CHECK pins identity and shape only.
-- PostgreSQL CHECK passes on NULL, so every key test is coalesced to false.
ALTER TABLE public.webbing
  ADD COLUMN catalog_snapshot jsonb,
  ADD COLUMN registration_key uuid;

ALTER TABLE public.webbing
  ADD CONSTRAINT webbing_catalog_snapshot_valid CHECK (
    catalog_snapshot IS NULL
    OR coalesce(
      jsonb_typeof(catalog_snapshot) = 'object'
      AND octet_length(catalog_snapshot::text) <= 65536
      AND model IS NULL
      AND jsonb_typeof(catalog_snapshot -> 'schemaVersion') = 'number'
      AND catalog_snapshot ->> 'schemaVersion' = '1'
      AND jsonb_typeof(catalog_snapshot -> 'source') = 'string'
      AND catalog_snapshot ->> 'source' = 'slackdata'
      AND jsonb_typeof(catalog_snapshot -> 'gearType') = 'string'
      AND catalog_snapshot ->> 'gearType' = 'webbing'
      AND jsonb_typeof(catalog_snapshot -> 'sourceId') = 'number'
      AND catalog_snapshot ->> 'sourceId' ~ '^[1-9][0-9]{0,15}$'
      AND jsonb_typeof(catalog_snapshot -> 'name') = 'string'
      AND length(btrim(catalog_snapshot ->> 'name')) > 0,
      false
    )
  );

-- One registration draft creates at most one physical item per owner. This is
-- retry idempotency, not catalog identity: many items may share a source id.
CREATE UNIQUE INDEX webbing_user_id_registration_key_idx
  ON public.webbing (user_id, registration_key)
  WHERE registration_key IS NOT NULL;

COMMENT ON COLUMN public.webbing.catalog_snapshot IS
  'SlackData model details the owner selected at registration, with source attribution and retrieval time. Saved upstream metadata, not personal data and not current certification or recall status; never refreshed automatically.';
COMMENT ON COLUMN public.webbing.registration_key IS
  'Client-generated registration draft key used to recover a retried insert. Not a catalog identifier.';

-- Inserts must belong to the caller. SELECT, UPDATE and DELETE are unchanged.
ALTER POLICY "Allow authenticated users to insert webbing" ON public.webbing
  WITH CHECK ((SELECT auth.uid()) = user_id);
