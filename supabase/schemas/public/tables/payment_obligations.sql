CREATE TABLE "public"."payment_obligations" (
  "id"                         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"            uuid                     NOT NULL,
  "user_id"                    uuid,
  "application_revision_id"    uuid,
  "purpose" public.payment_obligation_purpose_enum NOT NULL DEFAULT 'initial_admission'::public.payment_obligation_purpose_enum,
  "status" public.payment_obligation_status_enum NOT NULL DEFAULT 'available'::public.payment_obligation_status_enum,
  "plan_type" public.subscription_plan_type_enum NOT NULL,
  "amount"                     integer                  NOT NULL,
  "currency"                   text                     NOT NULL,
  "payment_method"             text                     NOT NULL DEFAULT 'manual_pix'::text,
  "pix_copy_paste"             text                     NOT NULL,
  "available_at"               timestamp with time zone NOT NULL,
  "settled_at"                 timestamp with time zone,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "schedule_id"                uuid,
  "period_key"                 text                     NOT NULL DEFAULT 'initial'::text,
  "period_start"               date                     NOT NULL DEFAULT CURRENT_DATE,
  "period_end"                 date                     NOT NULL DEFAULT CURRENT_DATE,
  "available_on"               date                     NOT NULL DEFAULT CURRENT_DATE,
  "due_on"                     date                     NOT NULL DEFAULT CURRENT_DATE,
  "schedule_term_id"           uuid,
  "billing_timezone"           text,
  "billing_due_day"            smallint,
  "billing_lead_days"          smallint,
  "organization_name_snapshot" text,
  "organization_slug_snapshot" text,
  "association_person_id"      uuid                     NOT NULL,
  CONSTRAINT "payment_obligations_amount_check" CHECK ((amount > 0)),
  CONSTRAINT "payment_obligations_application_revision_id_fkey" FOREIGN KEY (application_revision_id) REFERENCES public.membership_application_revisions(id),
  CONSTRAINT "payment_obligations_association_person_id_fkey" FOREIGN KEY (association_person_id) REFERENCES public.association_people(id),
  CONSTRAINT "payment_obligations_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "payment_obligations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT "payment_obligations_payment_method_check" CHECK ((payment_method = 'manual_pix'::text)),
  CONSTRAINT "payment_obligations_pix_copy_paste_check" CHECK ((NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL)),
  CONSTRAINT "payment_obligations_pkey" PRIMARY KEY (id),
  CONSTRAINT "payment_obligations_schedule_id_fkey" FOREIGN KEY (schedule_id) REFERENCES public.contribution_schedules(id),
  CONSTRAINT "payment_obligations_schedule_period_key" UNIQUE (schedule_id, period_key),
  CONSTRAINT "payment_obligations_schedule_term_id_fkey" FOREIGN KEY (schedule_term_id) REFERENCES public.contribution_plan_assignments(id),
  CONSTRAINT "payment_obligations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."payment_obligations"
  ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."payment_obligations"
  ADD CONSTRAINT "payment_obligations_application_revision_id_purpose_key" UNIQUE (application_revision_id, purpose);

ALTER TABLE "public"."payment_obligations"
  ADD CONSTRAINT "payment_obligations_scope_check" CHECK ((((purpose = 'initial_admission'::public.payment_obligation_purpose_enum) AND (application_revision_id IS
    NOT NULL) AND (schedule_id IS NULL)) OR ((purpose = 'recurring'::public.payment_obligation_purpose_enum) AND (application_revision_id IS NULL) AND (schedule_id IS NOT NULL))));

CREATE INDEX payment_obligations_actionable_idx ON public.payment_obligations USING btree (organization_id, user_id, available_on, due_on, created_at, id)
  WHERE (status <> ALL (ARRAY['settled'::public.payment_obligation_status_enum, 'void'::public.payment_obligation_status_enum]));

CREATE INDEX payment_obligations_association_person_idx ON public.payment_obligations USING btree (association_person_id);

CREATE INDEX payment_obligations_billing_workspace_idx ON public.payment_obligations USING btree (organization_id, purpose, status, due_on, available_on, created_at, id);

CREATE INDEX payment_obligations_initial_queue_idx ON public.payment_obligations USING btree (organization_id, status, application_revision_id)
  WHERE (purpose = 'initial_admission'::public.payment_obligation_purpose_enum);

CREATE INDEX payment_obligations_member_due_idx ON public.payment_obligations USING btree (organization_id, user_id, due_on DESC, created_at DESC, id DESC);

CREATE INDEX payment_obligations_recurring_term_idx ON public.payment_obligations USING btree (schedule_term_id, due_on, id)
  WHERE (purpose = 'recurring'::public.payment_obligation_purpose_enum);

CREATE INDEX payment_obligations_user_organization_idx ON public.payment_obligations USING btree (user_id, organization_id, status);

CREATE TRIGGER payment_obligations_immutable_context
  BEFORE UPDATE ON public.payment_obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_payment_obligation_context_mutation();

CREATE TRIGGER payment_obligations_set_association_person
  BEFORE INSERT ON public.payment_obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_association_person_from_subject('user_id');

CREATE TRIGGER payment_obligations_snapshot_context
  BEFORE INSERT ON public.payment_obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_payment_obligation_context();

CREATE POLICY "Owners and association admins can read payment obligations" ON "public"."payment_obligations"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.association_people ap
  WHERE ((ap.id = payment_obligations.association_person_id) AND (ap.account_user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (public.organization_members om
     JOIN public.organizations o ON ((o.id = om.organization_id)))
  WHERE
    ((om.organization_id = payment_obligations.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum) AND
    (o.organization_type = 'association'::public.organization_type_enum))))));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_obligations" TO "service_role";

COMMENT ON COLUMN "public"."payment_obligations"."billing_due_day" IS 'Due-day policy snapshot used to produce this obligation.';

COMMENT ON COLUMN "public"."payment_obligations"."billing_lead_days" IS 'Lead-day policy snapshot used to produce this obligation.';

COMMENT ON COLUMN "public"."payment_obligations"."billing_timezone" IS 'Timezone snapshot used to evaluate this obligation; never read from live policy for history.';

COMMENT ON COLUMN "public"."payment_obligations"."schedule_term_id" IS 'Immutable effective-dated contribution term that produced this obligation.';

COMMENT ON TABLE "public"."payment_obligations" IS 'Server-authoritative, independently payable billing obligations. Claims and admission decisions are separate workflows.';

REVOKE ALL ON TABLE "public"."payment_obligations" FROM "authenticated";

GRANT SELECT ON TABLE "public"."payment_obligations" TO "authenticated";

REVOKE ALL ON TABLE "public"."payment_obligations" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_obligations" TO "postgres";

REVOKE ALL ON TABLE "public"."payment_obligations" FROM "anon";
