-- Keep BETWEEN as authored in the historical migration: expanding it changes
-- the parsed constraint tree and causes a spurious drop/recreate in pg-delta.
CREATE TABLE "public"."payment_obligation_waivers" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "obligation_id"         uuid                     NOT NULL,
  "organization_id"       uuid                     NOT NULL,
  "association_person_id" uuid                     NOT NULL,
  "actor_user_id"         uuid,
  "reason"                text                     NOT NULL,
  "created_at"            timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "payment_obligation_waivers_association_person_id_fkey" FOREIGN KEY (association_person_id) REFERENCES public.association_people(id),
  CONSTRAINT "payment_obligation_waivers_obligation_id_key" UNIQUE (obligation_id),
  CONSTRAINT "payment_obligation_waivers_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT "payment_obligation_waivers_pkey" PRIMARY KEY (id),
  CONSTRAINT "payment_obligation_waivers_reason_check" CHECK (char_length(reason) BETWEEN 1 AND 500 AND reason = btrim(reason)),
  CONSTRAINT "payment_obligation_waivers_obligation_id_fkey" FOREIGN KEY (obligation_id) REFERENCES public.payment_obligations(id),
  CONSTRAINT "payment_obligation_waivers_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."payment_obligation_waivers"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX payment_obligation_waivers_actor_idx ON public.payment_obligation_waivers USING btree (actor_user_id)
  WHERE (actor_user_id IS NOT NULL);

CREATE INDEX payment_obligation_waivers_organization_idx ON public.payment_obligation_waivers USING btree (organization_id);

CREATE INDEX payment_obligation_waivers_person_idx ON public.payment_obligation_waivers USING btree (association_person_id);

CREATE TRIGGER payment_obligation_waivers_immutable
  BEFORE DELETE OR UPDATE ON public.payment_obligation_waivers
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_payment_obligation_waiver_mutation();

CREATE TRIGGER payment_obligation_waivers_set_association_person
  BEFORE INSERT ON public.payment_obligation_waivers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_association_person_from_obligation();

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_obligation_waivers" TO "service_role";

COMMENT ON TABLE "public"."payment_obligation_waivers" IS 'Audit trail of recurring contributions an association admin waived. One immutable row per obligation. Written only by waive_recurring_contributions.';

REVOKE ALL ON TABLE "public"."payment_obligation_waivers" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_obligation_waivers" TO "postgres";

REVOKE ALL ON TABLE "public"."payment_obligation_waivers" FROM "anon", "authenticated";
