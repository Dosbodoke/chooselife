CREATE OR REPLACE FUNCTION public.get_initial_payment_claim_queue()
  RETURNS TABLE (
    claim_id                  uuid,
    obligation_id             uuid,
    application_revision_id   uuid,
    organization_id           uuid,
    organization_name         text,
    claimant_user_id          uuid,
    applicant_name            text,
    applicant_handle          text,
    applicant_profile_picture text,
    payer_type                public.payment_claim_payer_type_enum,
    payer_name                text,
    plan_type                 public.subscription_plan_type_enum,
    amount                    integer,
    currency                  text,
    claim_created_at          timestamp with time zone,
    attempt_count             bigint,
    claim_status              public.payment_claim_status_enum
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    pc.id,
    po.id,
    po.application_revision_id,
    pc.organization_id,
    o.name,
    pc.claimant_user_id,
    p.name,
    p.username,
    p.profile_picture,
    pc.payer_type,
    pc.payer_name,
    po.plan_type,
    po.amount,
    po.currency,
    pc.created_at,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    pc.status
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  join public.membership_applications ma on ma.id = mar.application_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles p on p.id = pc.claimant_user_id
  where pc.status = 'under_review'::public.payment_claim_status_enum
    and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    and po.status = 'available'::public.payment_obligation_status_enum
    and pc.organization_id = po.organization_id
    and po.organization_id = mar.organization_id
    and po.user_id = mar.user_id
    and ma.organization_id = mar.organization_id
    and ma.user_id = mar.user_id
    and ma.status = 'submitted'::public.membership_application_status_enum
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by pc.created_at asc, pc.id asc;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_initial_payment_claim_queue"() TO "authenticated";

COMMENT ON FUNCTION "public"."get_initial_payment_claim_queue"() IS 'Returns a privacy-preserving queue of current initial claims for associations where the caller is an admin.';

REVOKE ALL ON FUNCTION "public"."get_initial_payment_claim_queue"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_initial_payment_claim_queue"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_initial_payment_claim_queue"() FROM PUBLIC, "anon", "service_role";
