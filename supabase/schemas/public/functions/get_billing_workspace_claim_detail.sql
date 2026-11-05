CREATE OR REPLACE FUNCTION public.get_billing_workspace_claim_detail (
  p_claim_id uuid
)
  RETURNS TABLE (
    claim_id               uuid,
    obligation_id          uuid,
    organization_id        uuid,
    organization_name      text,
    organization_slug      text,
    purpose                public.payment_obligation_purpose_enum,
    member_user_id         uuid,
    member_name            text,
    member_handle          text,
    member_profile_picture text,
    claim_status           public.payment_claim_status_enum,
    payer_type             public.payment_claim_payer_type_enum,
    payer_name             text,
    claim_created_at       timestamp with time zone,
    claim_decided_at       timestamp with time zone,
    claim_decision_reason  text,
    plan_type              public.subscription_plan_type_enum,
    amount                 integer,
    currency               text,
    period_key             text,
    period_start           date,
    period_end             date,
    available_on           date,
    due_on                 date,
    attempt_count          bigint,
    claim_history          jsonb,
    audit_history          jsonb,
    approve_command        text,
    reject_command         text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    pc.id,
    po.id,
    pc.organization_id,
    o.name,
    o.slug,
    po.purpose,
    pc.claimant_user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    pc.status,
    pc.payer_type,
    pc.payer_name,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
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
            'actor_name', actor_profile.name,
            'actor_handle', actor_profile.username,
            'previous_state', audit.previous_state,
            'next_state', audit.next_state,
            'reason', audit.reason,
            'created_at', audit.created_at
          )
          order by audit.created_at asc, audit.id asc
        )
        from public.payment_claim_audit_events audit
        left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
        where audit.obligation_id = po.id
      ),
      '[]'::jsonb
    ),
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'approve_initial_claim'
          else 'approve_recurring_payment_claim'
        end
      else null
    end,
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'reject_initial_claim'
          else 'reject_recurring_payment_claim'
        end
      else null
    end
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles member_profile on member_profile.id = pc.claimant_user_id
  left join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  left join public.membership_applications ma
    on ma.id = mar.application_id
  where pc.id = p_claim_id
    and pc.organization_id = po.organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
    and (
      po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      or (
        po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.application_revision_id = mar.id
        and mar.organization_id = pc.organization_id
        and mar.user_id = pc.claimant_user_id
        and ma.organization_id = pc.organization_id
        and ma.user_id = pc.claimant_user_id
        and ma.status = 'submitted'::public.membership_application_status_enum
      )
    );
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_claim_detail"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."get_billing_workspace_claim_detail"(uuid) IS 'Returns authorized common claim detail and immutable chronology for either payment purpose without application-private fields.';

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_claim_detail"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_claim_detail"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_claim_detail"(uuid) FROM PUBLIC, "anon", "service_role";
