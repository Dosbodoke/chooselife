CREATE TABLE "public"."organization_membership_departures" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"       uuid                     NOT NULL,
  "user_id"               uuid,
  "departed_role" public.organization_role_enum NOT NULL,
  "joined_at"             timestamp with time zone NOT NULL,
  "departed_at"           timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "actor_user_id"         uuid,
  "reason"                text,
  "association_person_id" uuid                     NOT NULL,
  CONSTRAINT "organization_membership_departures_association_person_id_fkey" FOREIGN KEY (association_person_id) REFERENCES public.association_people(id),
  CONSTRAINT "organization_membership_departures_period_check" CHECK ((departed_at >= joined_at)),
  CONSTRAINT "organization_membership_departures_period_key" UNIQUE (organization_id, association_person_id, joined_at),
  CONSTRAINT "organization_membership_departures_pkey" PRIMARY KEY (id),
  CONSTRAINT "organization_membership_departures_reason_check" CHECK (((reason IS NULL) OR (char_length(reason) <= 500))),
  CONSTRAINT "organization_membership_departures_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT "organization_membership_departures_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "organization_membership_departures_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."organization_membership_departures"
  ENABLE ROW LEVEL SECURITY;


CREATE INDEX organization_membership_departures_actor_idx ON public.organization_membership_departures USING btree (actor_user_id, departed_at DESC)
  WHERE (actor_user_id IS NOT NULL);

CREATE INDEX organization_membership_departures_association_person_idx ON public.organization_membership_departures USING btree (association_person_id, departed_at DESC);

CREATE INDEX organization_membership_departures_org_user_idx ON public.organization_membership_departures USING btree (organization_id, user_id, departed_at DESC);

CREATE TRIGGER organization_membership_departures_append_only
  BEFORE DELETE OR UPDATE ON public.organization_membership_departures
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_membership_departure_mutation();

CREATE TRIGGER organization_membership_departures_set_association_person
  BEFORE INSERT ON public.organization_membership_departures
  FOR EACH ROW
  EXECUTE FUNCTION public.set_association_person_from_subject('user_id');

CREATE POLICY "Former members and admins can read membership periods" ON "public"."organization_membership_departures"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.association_people ap
  WHERE ((ap.id = organization_membership_departures.association_person_id) AND (ap.account_user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE
    ((om.organization_id = organization_membership_departures.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role =
    'admin'::public.organization_role_enum))))));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization_membership_departures" TO "service_role";

COMMENT ON COLUMN "public"."organization_membership_departures"."actor_user_id" IS 'The association admin who ended the membership. Null for a system closure, such as the one account deletion performs.';

COMMENT ON TABLE "public"."organization_membership_departures" IS 'Append-only journal of membership periods that ended. A person with a departure row and no current organization_members row reads as an inactive member.';

REVOKE ALL ON TABLE "public"."organization_membership_departures" FROM "authenticated";

GRANT SELECT ON TABLE "public"."organization_membership_departures" TO "authenticated";

REVOKE ALL ON TABLE "public"."organization_membership_departures" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization_membership_departures" TO "postgres";

REVOKE ALL ON TABLE "public"."organization_membership_departures" FROM "anon";
