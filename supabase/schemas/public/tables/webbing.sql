CREATE TABLE "public"."webbing" (
  "id"                    bigint  GENERATED ALWAYS AS IDENTITY NOT NULL,
  "user_id"               uuid    NOT NULL,
  "length"                numeric NOT NULL,
  "left_loop"             boolean NOT NULL,
  "right_loop"            boolean NOT NULL,
  "model"                 bigint,
  "tag_name"              text,
  "description"           text,
  "strength_class" public.strength_class_enum,
  "image_path"            text,
  "catalog_snapshot"      jsonb,
  "registration_key"      uuid,
  "legacy_model_snapshot" jsonb,
  CONSTRAINT "webbing_catalog_snapshot_valid"
    CHECK
    (((catalog_snapshot IS NULL) OR COALESCE(((jsonb_typeof(catalog_snapshot) = 'object'::text) AND (octet_length((catalog_snapshot)::text) <= 65536) AND (model IS NULL) AND
    (jsonb_typeof((catalog_snapshot -> 'schemaVersion'::text)) = 'number'::text) AND ((catalog_snapshot ->> 'schemaVersion'::text) = '1'::text) AND
    (jsonb_typeof((catalog_snapshot -> 'source'::text)) = 'string'::text) AND ((catalog_snapshot ->> 'source'::text) = 'slackdata'::text) AND
    (jsonb_typeof((catalog_snapshot -> 'gearType'::text)) = 'string'::text) AND ((catalog_snapshot ->> 'gearType'::text) = 'webbing'::text) AND
    (jsonb_typeof((catalog_snapshot -> 'sourceId'::text)) = 'number'::text) AND ((catalog_snapshot ->> 'sourceId'::text) ~ '^[1-9][0-9]{0,15}$'::text) AND
    (jsonb_typeof((catalog_snapshot -> 'name'::text)) = 'string'::text) AND (length(btrim((catalog_snapshot ->> 'name'::text))) > 0)), false))),
  CONSTRAINT "webbing_legacy_model_snapshot_valid"
    CHECK
    (((legacy_model_snapshot IS NULL) OR COALESCE(((jsonb_typeof(legacy_model_snapshot) = 'object'::text) AND ((legacy_model_snapshot ->> 'schemaVersion'::text) = '1'::text) AND
    ((legacy_model_snapshot ->> 'source'::text) = 'chooselife'::text) AND (jsonb_typeof((legacy_model_snapshot -> 'modelId'::text)) = 'number'::text) AND
    (jsonb_typeof((legacy_model_snapshot -> 'name'::text)) = 'string'::text) AND (length(btrim((legacy_model_snapshot ->> 'name'::text))) > 0) AND
    ((legacy_model_snapshot ->> 'capturedBy'::text) = ANY (ARRAY['backfill'::text, 'legacy-client'::text]))), false))),
  CONSTRAINT "webbing_pkey" PRIMARY KEY (id),
  CONSTRAINT "webbing_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "webbing_model_fkey" FOREIGN KEY (model) REFERENCES public.webbing_model(id) ON DELETE SET NULL
);

ALTER TABLE "public"."webbing"
  ENABLE ROW LEVEL SECURITY;


CREATE INDEX idx_webbings_model ON public.webbing USING btree (model);

CREATE INDEX idx_webbings_user_id ON public.webbing USING btree (user_id);

CREATE UNIQUE INDEX webbing_user_id_registration_key_idx ON public.webbing USING btree (user_id, registration_key)
  WHERE (registration_key IS NOT NULL);

CREATE TRIGGER webbing_capture_legacy_model
  BEFORE INSERT OR UPDATE ON public.webbing
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_webbing_legacy_model();

CREATE POLICY "Allow authenticated users to insert webbing" ON "public"."webbing"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Allow users to delete their own webbing" ON "public"."webbing"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Allow users to read their own webbing" ON "public"."webbing"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow users to update their own webbing" ON "public"."webbing"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

REVOKE ALL ON SEQUENCE "public"."webbing_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."webbing_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."webbing_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."webbing_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."webbing_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."webbing_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."webbing_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."webbing_id_seq" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."webbing" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."webbing" TO "service_role";

COMMENT ON COLUMN "public"."webbing"."catalog_snapshot" IS 'SlackData model details the owner selected at registration, with source attribution and retrieval time. Saved upstream metadata, not personal data and not current certification or recall status; never refreshed automatically.';

COMMENT ON COLUMN "public"."webbing"."image_path" IS 'Personal photo key in the R2 webbings bucket, including the owner UUID prefix.';

COMMENT ON COLUMN "public"."webbing"."legacy_model_snapshot" IS 'Frozen copy of the retired Choose Life model this webbing was registered with. Server-owned; kept after webbing_model is dropped. capturedBy=legacy-client marks writes from app builds that still send model ids.';

COMMENT ON COLUMN "public"."webbing"."model" IS 'Deprecated. Written only by app builds up to 1.9.5. Read legacy_model_snapshot instead. Dropped by GitHub issue #286.';

COMMENT ON COLUMN "public"."webbing"."registration_key" IS 'Client-generated registration draft key used to recover a retried insert. Not a catalog identifier.';

REVOKE ALL ON TABLE "public"."webbing" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."webbing" TO "postgres";
