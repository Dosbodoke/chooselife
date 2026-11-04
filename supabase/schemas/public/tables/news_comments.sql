CREATE TABLE "public"."news_comments" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "news_id"    uuid,
  "user_id"    uuid,
  "comment"    text                     NOT NULL,
  CONSTRAINT "news_comments_news_id_fkey" FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE,
  CONSTRAINT "news_comments_pkey" PRIMARY KEY (id),
  CONSTRAINT "news_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

ALTER TABLE "public"."news_comments"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can add comments." ON "public"."news_comments"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can delete their own comments." ON "public"."news_comments"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can see all comments." ON "public"."news_comments"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Users can update their own comments." ON "public"."news_comments"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news_comments" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news_comments" TO "service_role";

REVOKE ALL ON TABLE "public"."news_comments" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."news_comments" TO "postgres";
