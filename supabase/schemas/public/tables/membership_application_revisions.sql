CREATE TABLE "public"."membership_application_revisions" (
  "id"                             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "application_id"                 uuid                     NOT NULL,
  "organization_id"                uuid                     NOT NULL,
  "user_id"                        uuid,
  "revision_number"                integer                  NOT NULL,
  "draft_version"                  bigint                   NOT NULL,
  "plan_type" public.subscription_plan_type_enum NOT NULL,
  "terms_version"                  text                     NOT NULL,
  "accepted_terms_at"              timestamp with time zone NOT NULL,
  "submitted_at"                   timestamp with time zone NOT NULL,
  "full_name"                      text,
  "birth_date"                     date,
  "nationality"                    text,
  "marital_status" public.marital_status_enum,
  "profession"                     text,
  "birthplace"                     text,
  "cpf"                            text,
  "id_document_number"             text,
  "id_document_issuer"             text,
  "postal_code"                    text,
  "address_line"                   text,
  "city"                           text,
  "state"                          text,
  "email"                          text,
  "phone"                          text,
  "blood_type" public.blood_type_enum,
  "has_allergies"                  boolean                  NOT NULL,
  "allergies"                      text,
  "has_dietary_restrictions"       boolean                  NOT NULL,
  "dietary_restrictions"           text,
  "highline_experience" public.highline_experience_enum,
  "has_rescue_course"              boolean,
  "first_aid_course" public.first_aid_course_enum,
  "emergency_contact_name"         text,
  "emergency_contact_relationship" text,
  "emergency_contact_phone"        text,
  "plan_amount"                    integer                  NOT NULL,
  "currency"                       text                     NOT NULL,
  "pix_copy_paste"                 text                     NOT NULL,
  "created_at"                     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "association_person_id"          uuid                     NOT NULL,
  CONSTRAINT "membership_application_revisi_application_id_revision_numbe_key" UNIQUE (application_id, revision_number),
  CONSTRAINT "membership_application_revisio_application_id_draft_version_key" UNIQUE (application_id, draft_version),
  CONSTRAINT "membership_application_revisions_association_person_id_fkey" FOREIGN KEY (association_person_id) REFERENCES public.association_people(id),
  CONSTRAINT "membership_application_revisions_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "membership_application_revisions_draft_version_check" CHECK ((draft_version > 0)),
  CONSTRAINT "membership_application_revisions_pix_copy_paste_check" CHECK ((NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL)),
  CONSTRAINT "membership_application_revisions_pkey" PRIMARY KEY (id),
  CONSTRAINT "membership_application_revisions_plan_amount_check" CHECK ((plan_amount > 0)),
  CONSTRAINT "membership_application_revisions_terms_version_check" CHECK ((NULLIF(btrim(terms_version), ''::text) IS NOT NULL)),
  CONSTRAINT "membership_application_revisions_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.membership_applications(id),
  CONSTRAINT "membership_application_revisions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT "membership_application_revisions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."membership_application_revisions"
  ENABLE ROW LEVEL SECURITY;






CREATE INDEX membership_application_revisions_association_person_idx ON public.membership_application_revisions USING btree (association_person_id);

CREATE INDEX membership_application_revisions_organization_idx ON public.membership_application_revisions USING btree (organization_id);

CREATE INDEX membership_application_revisions_user_idx ON public.membership_application_revisions USING btree (user_id);

CREATE TRIGGER membership_application_revisions_immutable
  BEFORE DELETE OR UPDATE ON public.membership_application_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_membership_application_revision_mutation();

CREATE TRIGGER membership_application_revisions_set_association_person
  BEFORE INSERT ON public.membership_application_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_association_person_from_subject('user_id');

CREATE POLICY "Owners and association admins can read submitted revisions" ON "public"."membership_application_revisions"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.association_people ap
  WHERE ((ap.id = membership_application_revisions.association_person_id) AND (ap.account_user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE
    ((om.organization_id = membership_application_revisions.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role =
    'admin'::public.organization_role_enum))))));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."membership_application_revisions" TO "service_role";

COMMENT ON COLUMN "public"."membership_application_revisions"."pix_copy_paste" IS 'Server-snapshotted static manual-PIX payload for the selected association plan.';

COMMENT ON COLUMN "public"."membership_application_revisions"."plan_amount" IS 'Server-snapshotted price in the smallest currency unit at submission time.';

COMMENT ON TABLE "public"."membership_application_revisions" IS 'Immutable, revisionable snapshots of submitted association applications. Never use live profile data for admission review.';

REVOKE ALL ON TABLE "public"."membership_application_revisions" FROM "authenticated";

GRANT SELECT ON TABLE "public"."membership_application_revisions" TO "authenticated";

REVOKE ALL ON TABLE "public"."membership_application_revisions" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."membership_application_revisions" TO "postgres";

REVOKE ALL ON TABLE "public"."membership_application_revisions" FROM "anon";
