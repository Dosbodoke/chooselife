CREATE TABLE "public"."association_people" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid                     NOT NULL,
  "account_user_id" uuid,
  "created_at"      timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "anonymized_at"   timestamp with time zone,
  CONSTRAINT "association_people_pkey" PRIMARY KEY (id),
  CONSTRAINT "association_people_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT "association_people_account_user_id_fkey" FOREIGN KEY (account_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."association_people"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX association_people_account_idx ON public.association_people USING btree (organization_id, account_user_id)
  WHERE (account_user_id IS NOT NULL);

CREATE INDEX association_people_organization_idx ON public.association_people USING btree (organization_id, created_at DESC);

CREATE POLICY "Association admins can read association subjects" ON "public"."association_people"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = association_people.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum)))));

CREATE POLICY "People can read their own association subject" ON "public"."association_people"
  FOR SELECT
  TO "authenticated"
  USING ((account_user_id = ( SELECT auth.uid() AS uid)));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."association_people" TO "service_role";

COMMENT ON COLUMN "public"."association_people"."account_user_id" IS 'The linked Choose Life account while one exists. Null once the account has been deleted.';

COMMENT ON COLUMN "public"."association_people"."anonymized_at" IS 'When the linked account was prepared for deletion. Null while the account exists.';

COMMENT ON TABLE "public"."association_people" IS 'One formal association subject. Holds no personal data: the submitted application revision is the retained form. Survives deletion of the linked Choose Life account with account_user_id null, after which only association admins can read the linked formal records.';

REVOKE ALL ON TABLE "public"."association_people" FROM "authenticated";

GRANT SELECT ON TABLE "public"."association_people" TO "authenticated";

REVOKE ALL ON TABLE "public"."association_people" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."association_people" TO "postgres";

REVOKE ALL ON TABLE "public"."association_people" FROM "anon";
