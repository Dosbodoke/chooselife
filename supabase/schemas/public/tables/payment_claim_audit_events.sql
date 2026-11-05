CREATE TABLE "public"."payment_claim_audit_events" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"       uuid                     NOT NULL,
  "obligation_id"         uuid                     NOT NULL,
  "claim_id"              uuid                     NOT NULL,
  "actor_user_id"         uuid,
  "previous_state"        text                     NOT NULL,
  "next_state"            text                     NOT NULL,
  "reason"                text,
  "created_at"            timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "association_person_id" uuid                     NOT NULL,
  CONSTRAINT "payment_claim_audit_events_association_person_id_fkey" FOREIGN KEY (association_person_id) REFERENCES public.association_people(id),
  CONSTRAINT "payment_claim_audit_events_claim_id_next_state_key" UNIQUE (claim_id, next_state),
  CONSTRAINT "payment_claim_audit_events_next_state_check" CHECK ((next_state = ANY (ARRAY['payment_available'::text, 'under_review'::text, 'payment_settled'::text]))),
  CONSTRAINT "payment_claim_audit_events_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT "payment_claim_audit_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "payment_claim_audit_events_previous_state_check" CHECK ((previous_state = ANY (ARRAY['payment_available'::text, 'under_review'::text, 'payment_settled'::text]))),
  CONSTRAINT "payment_claim_audit_events_reason_check" CHECK (((reason IS NULL) OR (char_length(reason) <= 500))),
  CONSTRAINT "payment_claim_audit_events_transition_check"
    CHECK
    ((((previous_state = 'payment_available'::text) AND (next_state = 'under_review'::text)) OR ((previous_state = 'under_review'::text) AND (next_state = ANY
    (ARRAY['payment_available'::text, 'payment_settled'::text]))))),
  CONSTRAINT "payment_claim_audit_events_claim_id_fkey" FOREIGN KEY (claim_id) REFERENCES public.payment_claims(id),
  CONSTRAINT "payment_claim_audit_events_obligation_id_fkey" FOREIGN KEY (obligation_id) REFERENCES public.payment_obligations(id),
  CONSTRAINT "payment_claim_audit_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."payment_claim_audit_events"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX payment_claim_audit_events_actor_created_at_idx ON public.payment_claim_audit_events USING btree (actor_user_id, created_at DESC);

CREATE INDEX payment_claim_audit_events_association_person_idx ON public.payment_claim_audit_events USING btree (association_person_id);

CREATE INDEX payment_claim_audit_events_claim_history_idx ON public.payment_claim_audit_events USING btree (claim_id, created_at, id);

CREATE INDEX payment_claim_audit_events_obligation_created_at_idx ON public.payment_claim_audit_events USING btree (obligation_id, created_at DESC);

CREATE INDEX payment_claim_audit_events_organization_created_at_idx ON public.payment_claim_audit_events USING btree (organization_id, created_at DESC);

CREATE TRIGGER payment_claim_audit_events_immutable
  BEFORE DELETE OR UPDATE ON public.payment_claim_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_payment_claim_audit_mutation();

CREATE TRIGGER payment_claim_audit_events_set_association_person
  BEFORE INSERT ON public.payment_claim_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_association_person_from_obligation();

CREATE POLICY "Claimants and admins can read claim audit" ON "public"."payment_claim_audit_events"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.association_people ap
  WHERE ((ap.id = payment_claim_audit_events.association_person_id) AND (ap.account_user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE
    ((om.organization_id = payment_claim_audit_events.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum))))));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_claim_audit_events" TO "service_role";

COMMENT ON TABLE "public"."payment_claim_audit_events" IS 'Append-only claim transition evidence containing server-derived actor, obligation, claim, state change, time, and optional reason.';

REVOKE ALL ON TABLE "public"."payment_claim_audit_events" FROM "authenticated";

GRANT SELECT ON TABLE "public"."payment_claim_audit_events" TO "authenticated";

REVOKE ALL ON TABLE "public"."payment_claim_audit_events" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_claim_audit_events" TO "postgres";

REVOKE ALL ON TABLE "public"."payment_claim_audit_events" FROM "anon";
