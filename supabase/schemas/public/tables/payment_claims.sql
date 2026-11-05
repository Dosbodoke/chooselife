CREATE TABLE "public"."payment_claims" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "obligation_id"         uuid                     NOT NULL,
  "organization_id"       uuid                     NOT NULL,
  "claimant_user_id"      uuid,
  "payer_type" public.payment_claim_payer_type_enum NOT NULL,
  "payer_name"            text,
  "status" public.payment_claim_status_enum NOT NULL DEFAULT 'under_review'::public.payment_claim_status_enum,
  "created_at"            timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "decided_at"            timestamp with time zone,
  "decision_reason"       text,
  "association_person_id" uuid                     NOT NULL,
  CONSTRAINT "payment_claims_association_person_id_fkey" FOREIGN KEY (association_person_id) REFERENCES public.association_people(id),
  CONSTRAINT "payment_claims_decision_reason_check" CHECK (((decision_reason IS NULL) OR (char_length(decision_reason) <= 500))),
  CONSTRAINT "payment_claims_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT "payment_claims_pkey" PRIMARY KEY (id),
  CONSTRAINT "payment_claims_obligation_id_fkey" FOREIGN KEY (obligation_id) REFERENCES public.payment_obligations(id),
  CONSTRAINT "payment_claims_claimant_user_id_fkey" FOREIGN KEY (claimant_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."payment_claims"
  ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."payment_claims"
  ADD CONSTRAINT "payment_claims_check1" CHECK (((status <> 'under_review'::public.payment_claim_status_enum) OR ((decided_at IS NULL) AND (decision_reason IS NULL))));

ALTER TABLE "public"."payment_claims"
  ADD CONSTRAINT "payment_claims_check"
    CHECK
    ((((payer_type = 'applicant'::public.payment_claim_payer_type_enum) AND (payer_name IS NULL)) OR ((payer_type = 'other'::public.payment_claim_payer_type_enum) AND
    (NULLIF(btrim(payer_name), ''::text) IS NOT NULL) AND (char_length(payer_name) <= 120))));

ALTER TABLE "public"."payment_claims"
  ADD CONSTRAINT "payment_claims_terminal_decided_at_check" CHECK (((status = 'under_review'::public.payment_claim_status_enum) OR (decided_at IS NOT NULL)));

CREATE INDEX payment_claims_association_person_idx ON public.payment_claims USING btree (association_person_id);

CREATE INDEX payment_claims_billing_workspace_queue_idx ON public.payment_claims USING btree (organization_id, created_at, id, obligation_id)
  WHERE (status = 'under_review'::public.payment_claim_status_enum);

CREATE INDEX payment_claims_claimant_created_at_idx ON public.payment_claims USING btree (claimant_user_id, created_at DESC);

CREATE INDEX payment_claims_current_queue_idx ON public.payment_claims USING btree (organization_id, created_at, id)
  WHERE (status = 'under_review'::public.payment_claim_status_enum);

CREATE INDEX payment_claims_obligation_claimant_created_at_idx ON public.payment_claims USING btree (obligation_id, claimant_user_id, created_at DESC, id DESC);

CREATE INDEX payment_claims_obligation_status_idx ON public.payment_claims USING btree (obligation_id, status, created_at DESC, id DESC);

CREATE UNIQUE INDEX payment_claims_one_under_review_per_obligation_idx ON public.payment_claims USING btree (obligation_id)
  WHERE (status = 'under_review'::public.payment_claim_status_enum);

CREATE INDEX payment_claims_organization_status_idx ON public.payment_claims USING btree (organization_id, status, created_at DESC);

CREATE TRIGGER payment_claims_evidence_immutable
  BEFORE DELETE OR UPDATE ON public.payment_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_payment_claim_evidence_mutation();

CREATE TRIGGER payment_claims_set_association_person
  BEFORE INSERT ON public.payment_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.set_association_person_from_subject('claimant_user_id');

CREATE POLICY "Claimants and organization admins can read payment claims" ON "public"."payment_claims"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.association_people ap
  WHERE ((ap.id = payment_claims.association_person_id) AND (ap.account_user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = payment_claims.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum))))));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_claims" TO "service_role";

COMMENT ON COLUMN "public"."payment_claims"."payer_name" IS 'Normalized payer name when another person made the deposit. No receipt or banking metadata is stored.';

COMMENT ON COLUMN "public"."payment_claims"."status" IS 'Current server-controlled decision state. Submission evidence remains immutable; transitions are appended to payment_claim_audit_events.';

COMMENT ON TABLE "public"."payment_claims" IS 'Immutable payment-claim submissions. Claim decisions are server-controlled and never settle the obligation by themselves.';

REVOKE ALL ON TABLE "public"."payment_claims" FROM "authenticated";

GRANT SELECT ON TABLE "public"."payment_claims" TO "authenticated";

REVOKE ALL ON TABLE "public"."payment_claims" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_claims" TO "postgres";

REVOKE ALL ON TABLE "public"."payment_claims" FROM "anon";
