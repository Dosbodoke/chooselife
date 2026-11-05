CREATE TABLE "public"."push_tokens" (
  "id"         bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "token"      text                     NOT NULL,
  "profile_id" uuid,
  "language" public.language,
  "created_at" timestamp with time zone DEFAULT now(),
  "platform"   text,
  CONSTRAINT "push_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "push_tokens_platform_check" CHECK (((platform IS NULL) OR (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))),
  CONSTRAINT "push_tokens_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT "push_tokens_token_key" UNIQUE (token)
);

ALTER TABLE "public"."push_tokens"
  ENABLE ROW LEVEL SECURITY;


CREATE INDEX push_tokens_profile_id_idx ON public.push_tokens USING btree (profile_id)
  WHERE (profile_id IS NOT NULL);

REVOKE ALL ON SEQUENCE "public"."push_tokens_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."push_tokens_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."push_tokens_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."push_tokens_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."push_tokens_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."push_tokens_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."push_tokens_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."push_tokens_id_seq" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_tokens" TO "service_role";

REVOKE ALL ON TABLE "public"."push_tokens" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_tokens" TO "postgres";

REVOKE ALL ON TABLE "public"."push_tokens" FROM "anon", "authenticated";
