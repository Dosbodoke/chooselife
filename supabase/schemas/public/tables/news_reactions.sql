CREATE TABLE "public"."news_reactions" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "news_id"    uuid,
  "user_id"    uuid,
  "reaction"   text                     NOT NULL,
  CONSTRAINT "news_reactions_news_id_fkey" FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE,
  CONSTRAINT "news_reactions_news_id_user_id_reaction_key" UNIQUE (news_id, user_id, reaction),
  CONSTRAINT "news_reactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "news_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

ALTER TABLE "public"."news_reactions"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can add reactions." ON "public"."news_reactions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can delete their own reactions." ON "public"."news_reactions"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can see all reactions." ON "public"."news_reactions"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news_reactions" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news_reactions" TO "service_role";

REVOKE ALL ON TABLE "public"."news_reactions" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news_reactions" TO "postgres";
