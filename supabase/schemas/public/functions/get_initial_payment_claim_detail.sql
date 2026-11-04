CREATE OR REPLACE FUNCTION public.get_initial_payment_claim_detail (
  p_claim_id uuid
)
  RETURNS TABLE (
    claim_id                       uuid,
    obligation_id                  uuid,
    application_id                 uuid,
    application_revision_id        uuid,
    revision_number                integer,
    draft_version                  bigint,
    organization_id                uuid,
    organization_name              text,
    organization_slug              text,
    claimant_user_id               uuid,
    applicant_name                 text,
    applicant_handle               text,
    applicant_profile_picture      text,
    claim_status                   public.payment_claim_status_enum,
    payer_type                     public.payment_claim_payer_type_enum,
    payer_name                     text,
    claim_created_at               timestamp with time zone,
    decided_at                     timestamp with time zone,
    decision_reason                text,
    attempt_count                  bigint,
    plan_type                      public.subscription_plan_type_enum,
    amount                         integer,
    currency                       text,
    terms_version                  text,
    accepted_terms_at              timestamp with time zone,
    submitted_at                   timestamp with time zone,
    full_name                      text,
    birth_date                     date,
    nationality                    text,
    marital_status                 public.marital_status_enum,
    profession                     text,
    birthplace                     text,
    cpf                            text,
    id_document_number             text,
    id_document_issuer             text,
    postal_code                    text,
    address_line                   text,
    city                           text,
    state                          text,
    email                          text,
    phone                          text,
    blood_type                     public.blood_type_enum,
    has_allergies                  boolean,
    allergies                      text,
    has_dietary_restrictions       boolean,
    dietary_restrictions           text,
    highline_experience            public.highline_experience_enum,
    has_rescue_course              boolean,
    first_aid_course               public.first_aid_course_enum,
    emergency_contact_name         text,
    emergency_contact_relationship text,
    emergency_contact_phone        text,
    claim_history                  jsonb,
    audit_history                  jsonb
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    pc.id,
    po.id,
    mar.application_id,
    mar.id,
    mar.revision_number,
    mar.draft_version,
    pc.organization_id,
    o.name,
    o.slug,
    pc.claimant_user_id,
    p.name,
    p.username,
    p.profile_picture,
    pc.status,
    pc.payer_type,
    pc.payer_name,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    mar.plan_type,
    mar.plan_amount,
    mar.currency,
    mar.terms_version,
    mar.accepted_terms_at,
    mar.submitted_at,
    mar.full_name,
    mar.birth_date,
    mar.nationality,
    mar.marital_status,
    mar.profession,
    mar.birthplace,
    mar.cpf,
    mar.id_document_number,
    mar.id_document_issuer,
    mar.postal_code,
    mar.address_line,
    mar.city,
    mar.state,
    mar.email,
    mar.phone,
    mar.blood_type,
    mar.has_allergies,
    mar.allergies,
    mar.has_dietary_restrictions,
    mar.dietary_restrictions,
    mar.highline_experience,
    mar.has_rescue_course,
    mar.first_aid_course,
    mar.emergency_contact_name,
    mar.emergency_contact_relationship,
    mar.emergency_contact_phone,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'claim_id', history.id,
            'status', history.status,
            'payer_type', history.payer_type,
            'payer_name', history.payer_name,
            'created_at', history.created_at,
            'decided_at', history.decided_at,
            'decision_reason', history.decision_reason
          )
          order by history.created_at asc, history.id asc
        )
        from public.payment_claims history
        where history.obligation_id = po.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', audit.id,
            'claim_id', audit.claim_id,
            'actor_user_id', audit.actor_user_id,
            'previous_state', audit.previous_state,
            'next_state', audit.next_state,
            'reason', audit.reason,
            'created_at', audit.created_at
          )
          order by audit.created_at asc, audit.id asc
        )
        from public.payment_claim_audit_events audit
        where audit.obligation_id = po.id
      ),
      '[]'::jsonb
    )
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  join public.membership_applications ma on ma.id = mar.application_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles p on p.id = pc.claimant_user_id
  where pc.id = p_claim_id
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
    );
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_initial_payment_claim_detail"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."get_initial_payment_claim_detail"(uuid) IS 'Returns the exact immutable submitted application revision and authorized claim history for an association admin.';

REVOKE ALL ON FUNCTION "public"."get_initial_payment_claim_detail"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_initial_payment_claim_detail"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_initial_payment_claim_detail"(uuid) FROM PUBLIC, "anon", "service_role";
