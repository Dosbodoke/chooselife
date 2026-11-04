CREATE TABLE "public"."membership_applications" (
  "id"                             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"                uuid                     NOT NULL,
  "user_id"                        uuid,
  "status" public.membership_application_status_enum NOT NULL DEFAULT 'draft'::public.membership_application_status_enum,
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
  "allergies"                      text,
  "dietary_restrictions"           text,
  "highline_experience" public.highline_experience_enum,
  "has_rescue_course"              boolean,
  "first_aid_course" public.first_aid_course_enum,
  "emergency_contact_name"         text,
  "emergency_contact_relationship" text,
  "emergency_contact_phone"        text,
  "accepted_terms_at"              timestamp with time zone,
  "submitted_at"                   timestamp with time zone,
  "created_at"                     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"                     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "draft_version"                  bigint                   NOT NULL DEFAULT 1,
  "has_allergies"                  boolean                  NOT NULL DEFAULT false,
  "has_dietary_restrictions"       boolean                  NOT NULL DEFAULT false,
  "association_person_id"          uuid                     NOT NULL,
  CONSTRAINT "membership_applications_association_person_id_fkey" FOREIGN KEY (association_person_id) REFERENCES public.association_people(id),
  CONSTRAINT "membership_applications_draft_version_check" CHECK ((draft_version > 0)),
  CONSTRAINT "membership_applications_pkey" PRIMARY KEY (id),
  CONSTRAINT "membership_applications_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT "membership_applications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."membership_applications"
  ENABLE ROW LEVEL SECURITY;






CREATE INDEX membership_applications_association_person_idx ON public.membership_applications USING btree (association_person_id);

CREATE UNIQUE INDEX membership_applications_one_open_per_person_idx ON public.membership_applications USING btree (organization_id, association_person_id)
  WHERE (status = ANY (ARRAY['draft'::public.membership_application_status_enum, 'submitted'::public.membership_application_status_enum]));

CREATE INDEX membership_applications_person_history_idx ON public.membership_applications USING btree (organization_id, association_person_id, created_at DESC);

CREATE TRIGGER membership_applications_set_association_person
  BEFORE INSERT ON public.membership_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_association_person_from_subject('user_id');

CREATE TRIGGER membership_applications_updated_at
  BEFORE UPDATE ON public.membership_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_membership_applications_updated_at();

CREATE POLICY "Membership application owners can insert drafts" ON "public"."membership_applications"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (status = 'draft'::public.membership_application_status_enum)));

CREATE POLICY "Membership application owners can select" ON "public"."membership_applications"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Membership application owners can update drafts" ON "public"."membership_applications"
  FOR UPDATE
  TO "authenticated"
  USING (((( SELECT auth.uid() AS uid) = user_id) AND (status = 'draft'::public.membership_application_status_enum)))
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (status = 'draft'::public.membership_application_status_enum)));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."membership_applications" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."membership_applications" TO "service_role";

COMMENT ON COLUMN "public"."membership_applications"."accepted_terms_at" IS 'When the user accepted the membership terms before entering onboarding.';

COMMENT ON COLUMN "public"."membership_applications"."submitted_at" IS 'When the user completed and submitted the onboarding application.';

COMMENT ON TABLE "public"."membership_applications" IS 'In-app membership onboarding applications keyed to an organization and signed-in user.';

REVOKE ALL ON TABLE "public"."membership_applications" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."membership_applications" TO "postgres";

REVOKE ALL ON TABLE "public"."membership_applications" FROM "anon";
