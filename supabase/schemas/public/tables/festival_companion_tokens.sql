CREATE TABLE "public"."festival_companion_tokens" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "profile_id"      uuid                     NOT NULL,
  "installation_id" uuid                     NOT NULL,
  "platform"        text                     NOT NULL DEFAULT 'ios'::text,
  "token_type"      text                     NOT NULL,
  "activity_name"   text                     NOT NULL DEFAULT ''::text,
  "token"           text                     NOT NULL,
  "language" public.language,
  "created_at"      timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "festival_companion_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "festival_companion_tokens_platform_check" CHECK ((platform = 'ios'::text)),
  CONSTRAINT "festival_companion_tokens_profile_id_installation_id_token__key" UNIQUE (profile_id, installation_id, token_type, activity_name),
  CONSTRAINT "festival_companion_tokens_token_key" UNIQUE (token),
  CONSTRAINT "festival_companion_tokens_token_type_check" CHECK ((token_type = ANY (ARRAY['push_to_start'::text, 'activity_update'::text]))),
  CONSTRAINT "festival_companion_tokens_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

ALTER TABLE "public"."festival_companion_tokens"
  ENABLE ROW LEVEL SECURITY;


CREATE INDEX festival_companion_tokens_profile_idx ON public.festival_companion_tokens USING btree (profile_id, token_type);

CREATE POLICY "Users can read their own festival companion tokens." ON "public"."festival_companion_tokens"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can register their own festival companion tokens." ON "public"."festival_companion_tokens"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can remove their own festival companion tokens." ON "public"."festival_companion_tokens"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can update their own festival companion tokens." ON "public"."festival_companion_tokens"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_companion_tokens" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_companion_tokens" TO "service_role";

REVOKE ALL ON TABLE "public"."festival_companion_tokens" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_companion_tokens" TO "postgres";
