CREATE TABLE "public"."organizations" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                     text                     NOT NULL,
  "slug"                     text                     NOT NULL,
  "created_at"               timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "monthly_price_amount"     integer,
  "annual_price_amount"      integer,
  "monthly_pix_copy_paste"   text,
  "annual_pix_copy_paste"    text,
  "organization_type" public.organization_type_enum NOT NULL DEFAULT 'association'::public.organization_type_enum,
  "billing_currency"         text                     NOT NULL DEFAULT 'BRL'::text,
  "membership_terms_version" text                     NOT NULL DEFAULT 'estatuto-v1'::text,
  "billing_timezone"         text                     NOT NULL DEFAULT 'America/Sao_Paulo'::text,
  "billing_due_day"          smallint                 NOT NULL DEFAULT 10,
  "billing_lead_days"        smallint                 NOT NULL DEFAULT 7,
  CONSTRAINT "organizations_billing_currency_format_check" CHECK ((billing_currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "organizations_billing_due_day_check" CHECK (((billing_due_day >= 1) AND (billing_due_day <= 31))),
  CONSTRAINT "organizations_billing_lead_days_check" CHECK (((billing_lead_days >= 0) AND (billing_lead_days <= 31))),
  CONSTRAINT "organizations_billing_timezone_check" CHECK ((NULLIF(btrim(billing_timezone), ''::text) IS NOT NULL)),
  CONSTRAINT "organizations_membership_terms_version_check" CHECK ((NULLIF(btrim(membership_terms_version), ''::text) IS NOT NULL)),
  CONSTRAINT "organizations_pkey" PRIMARY KEY (id),
  CONSTRAINT "organizations_slug_key" UNIQUE (slug)
);

ALTER TABLE "public"."organizations"
  ENABLE ROW LEVEL SECURITY;


CREATE TRIGGER organizations_validate_billing_policy_timezone
  BEFORE INSERT OR UPDATE OF billing_timezone ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_billing_policy_timezone();

CREATE POLICY "Admins can manage their organization." ON "public"."organizations"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.organization_members
  WHERE
    ((organization_members.organization_id = organizations.id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role =
    'admin'::public.organization_role_enum)))));

CREATE POLICY "All users can view organizations." ON "public"."organizations"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organizations" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organizations" TO "service_role";

COMMENT ON COLUMN "public"."organizations"."annual_pix_copy_paste" IS 'Fixed PIX copy-paste payload used for annual membership payments.';

COMMENT ON COLUMN "public"."organizations"."billing_currency" IS 'ISO 4217 currency used for new association obligations.';

COMMENT ON COLUMN "public"."organizations"."billing_due_day" IS 'Calendar day used for recurring contributions; initially 10 for SL.A.C.';

COMMENT ON COLUMN "public"."organizations"."billing_lead_days" IS 'Number of calendar days before due_on when a recurring obligation becomes available.';

COMMENT ON COLUMN "public"."organizations"."billing_timezone" IS 'IANA timezone used when evaluating contribution calendar dates.';

COMMENT ON COLUMN "public"."organizations"."membership_terms_version" IS 'Exact terms version accepted by new association applicants.';

COMMENT ON COLUMN "public"."organizations"."monthly_pix_copy_paste" IS 'Fixed PIX copy-paste payload used for monthly membership payments.';

COMMENT ON COLUMN "public"."organizations"."organization_type" IS 'Immutable organization classification. Formal membership applications are allowed only for associations.';

COMMENT ON TABLE "public"."organizations" IS 'Stores information about each team or association.';

REVOKE ALL ON TABLE "public"."organizations" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organizations" TO "postgres";
