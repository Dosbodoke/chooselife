CREATE TABLE "public"."contribution_plan_assignments" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "schedule_id"            uuid                     NOT NULL,
  "effective_period_start" date                     NOT NULL,
  "plan_type" public.subscription_plan_type_enum NOT NULL,
  "amount"                 integer                  NOT NULL,
  "currency"               text                     NOT NULL,
  "created_at"             timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "due_day"                smallint,
  "lead_days"              smallint,
  "billing_timezone"       text,
  "pix_copy_paste"         text,
  CONSTRAINT "contribution_plan_assignments_amount_check" CHECK ((amount > 0)),
  CONSTRAINT "contribution_plan_assignments_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "contribution_plan_assignments_due_day_check" CHECK (((due_day IS NULL) OR ((due_day >= 1) AND (due_day <= 31)))),
  CONSTRAINT "contribution_plan_assignments_lead_days_check" CHECK (((lead_days IS NULL) OR ((lead_days >= 0) AND (lead_days <= 31)))),
  CONSTRAINT "contribution_plan_assignments_pix_check" CHECK (((pix_copy_paste IS NULL) OR (NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL))),
  CONSTRAINT "contribution_plan_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "contribution_plan_assignments_schedule_id_effective_period__key" UNIQUE (schedule_id, effective_period_start),
  CONSTRAINT "contribution_plan_assignments_timezone_check" CHECK (((billing_timezone IS NULL) OR (NULLIF(btrim(billing_timezone), ''::text) IS NOT NULL))),
  CONSTRAINT "contribution_plan_assignments_schedule_id_fkey" FOREIGN KEY (schedule_id) REFERENCES public.contribution_schedules(id) ON DELETE CASCADE
);

ALTER TABLE "public"."contribution_plan_assignments"
  ENABLE ROW LEVEL SECURITY;


CREATE INDEX contribution_plan_assignments_schedule_effective_idx ON public.contribution_plan_assignments USING btree (schedule_id, effective_period_start DESC);

CREATE INDEX contribution_plan_assignments_schedule_period_idx ON public.contribution_plan_assignments USING btree (schedule_id, effective_period_start, id);

CREATE TRIGGER contribution_plan_assignments_immutable
  BEFORE UPDATE ON public.contribution_plan_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_contribution_plan_assignment_mutation();

CREATE TRIGGER contribution_plan_assignments_validate_timezone
  BEFORE INSERT OR UPDATE OF billing_timezone ON public.contribution_plan_assignments
  FOR EACH ROW
  WHEN ((new.billing_timezone IS NOT NULL))
  EXECUTE FUNCTION public.validate_billing_policy_timezone();

CREATE POLICY "Members and association admins can read plan snapshots" ON "public"."contribution_plan_assignments"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.contribution_schedules cs
  WHERE ((cs.id = contribution_plan_assignments.schedule_id) AND ((EXISTS ( SELECT 1
           FROM public.association_people ap
          WHERE ((ap.id = cs.association_person_id) AND (ap.account_user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM public.organization_members om
          WHERE ((om.organization_id = cs.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum)))))))));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."contribution_plan_assignments" TO "service_role";

REVOKE ALL ON TABLE "public"."contribution_plan_assignments" FROM "authenticated";

GRANT SELECT ON TABLE "public"."contribution_plan_assignments" TO "authenticated";

REVOKE ALL ON TABLE "public"."contribution_plan_assignments" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."contribution_plan_assignments" TO "postgres";

REVOKE ALL ON TABLE "public"."contribution_plan_assignments" FROM "anon";
