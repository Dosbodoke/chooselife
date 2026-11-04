CREATE TABLE "public"."contribution_schedules" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"       uuid                     NOT NULL,
  "user_id"               uuid,
  "cadence" public.contribution_cadence_enum NOT NULL,
  "admission_date"        date                     NOT NULL,
  "due_day"               smallint                 NOT NULL,
  "lead_days"             smallint                 NOT NULL,
  "billing_timezone"      text                     NOT NULL,
  "currency"              text                     NOT NULL,
  "active"                boolean                  NOT NULL DEFAULT true,
  "created_at"            timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "association_person_id" uuid                     NOT NULL,
  CONSTRAINT "contribution_schedules_association_person_id_fkey" FOREIGN KEY (association_person_id) REFERENCES public.association_people(id),
  CONSTRAINT "contribution_schedules_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "contribution_schedules_due_day_check" CHECK (((due_day >= 1) AND (due_day <= 31))),
  CONSTRAINT "contribution_schedules_lead_days_check" CHECK (((lead_days >= 0) AND (lead_days <= 31))),
  CONSTRAINT "contribution_schedules_pkey" PRIMARY KEY (id),
  CONSTRAINT "contribution_schedules_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT "contribution_schedules_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."contribution_schedules"
  ENABLE ROW LEVEL SECURITY;


CREATE INDEX contribution_schedules_active_user_idx ON public.contribution_schedules USING btree (user_id)
  WHERE active;

CREATE INDEX contribution_schedules_association_person_idx ON public.contribution_schedules USING btree (association_person_id);

CREATE UNIQUE INDEX contribution_schedules_one_active_per_person_idx ON public.contribution_schedules USING btree (organization_id, association_person_id)
  WHERE active;

CREATE INDEX contribution_schedules_org_user_idx ON public.contribution_schedules USING btree (organization_id, user_id)
  WHERE active;

CREATE TRIGGER contribution_schedules_immutable_anchor
  BEFORE UPDATE ON public.contribution_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_contribution_schedule_anchor_mutation();

CREATE TRIGGER contribution_schedules_set_association_person
  BEFORE INSERT ON public.contribution_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_association_person_from_subject('user_id');

CREATE TRIGGER contribution_schedules_validate_timezone
  BEFORE INSERT OR UPDATE OF billing_timezone ON public.contribution_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_billing_policy_timezone();

CREATE POLICY "Members and association admins can read schedules" ON "public"."contribution_schedules"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.association_people ap
  WHERE ((ap.id = contribution_schedules.association_person_id) AND (ap.account_user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = contribution_schedules.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum))))));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."contribution_schedules" TO "service_role";

REVOKE ALL ON TABLE "public"."contribution_schedules" FROM "authenticated";

GRANT SELECT ON TABLE "public"."contribution_schedules" TO "authenticated";

REVOKE ALL ON TABLE "public"."contribution_schedules" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."contribution_schedules" TO "postgres";

REVOKE ALL ON TABLE "public"."contribution_schedules" FROM "anon";
