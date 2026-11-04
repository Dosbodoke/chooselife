CREATE TABLE "public"."organization_members" (
  "organization_id" uuid                     NOT NULL,
  "user_id"         uuid                     NOT NULL,
  "role" public.organization_role_enum NOT NULL DEFAULT 'member'::public.organization_role_enum,
  "joined_at"       timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "organization_members_pkey" PRIMARY KEY (organization_id, user_id),
  CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

ALTER TABLE "public"."organization_members"
  ENABLE ROW LEVEL SECURITY;


CREATE INDEX organization_members_billing_workspace_idx ON public.organization_members USING btree (organization_id, ROLE, user_id);

CREATE POLICY "Authenticated users can view organization members." ON "public"."organization_members"
  FOR SELECT
  TO PUBLIC
  USING ((auth.role() = 'authenticated'::text));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization_members" TO "service_role";

COMMENT ON TABLE "public"."organization_members" IS 'Join table to link users to organizations with specific roles.';

REVOKE ALL ON TABLE "public"."organization_members" FROM "anon";

GRANT SELECT ON TABLE "public"."organization_members" TO "anon";

REVOKE ALL ON TABLE "public"."organization_members" FROM "authenticated";

GRANT SELECT ON TABLE "public"."organization_members" TO "authenticated";

REVOKE ALL ON TABLE "public"."organization_members" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization_members" TO "postgres";
