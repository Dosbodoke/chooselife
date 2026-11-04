CREATE OR REPLACE FUNCTION public.get_billing_workspace_queue (
  p_organization_id uuid
)
  RETURNS TABLE (
    claim_id               uuid,
    obligation_id          uuid,
    organization_id        uuid,
    purpose                public.payment_obligation_purpose_enum,
    member_user_id         uuid,
    member_name            text,
    member_handle          text,
    member_profile_picture text,
    payer_type             public.payment_claim_payer_type_enum,
    payer_name             text,
    plan_type              public.subscription_plan_type_enum,
    amount                 integer,
    currency               text,
    period_key             text,
    period_start           date,
    period_end             date,
    available_on           date,
    due_on                 date,
    claim_created_at       timestamp with time zone,
    claim_decided_at       timestamp with time zone,
    claim_decision_reason  text,
    claim_status           public.payment_claim_status_enum,
    attempt_count          bigint,
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
    po.purpose,
    pc.claimant_user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    pc.payer_type,
    pc.payer_name,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    pc.status,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        and (
          (
            po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
            and po.available_at <= clock_timestamp()
          )
          or (
            po.purpose = 'recurring'::public.payment_obligation_purpose_enum
            and po.available_on <= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
          )
        )
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
        and (
          (
            po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
            and po.available_at <= clock_timestamp()
          )
          or (
            po.purpose = 'recurring'::public.payment_obligation_purpose_enum
            and po.available_on <= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
          )
        )
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
  where p_organization_id is not null
    and pc.organization_id = p_organization_id
    and po.organization_id = pc.organization_id
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
      (
        po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.application_revision_id = mar.id
        and mar.organization_id = pc.organization_id
        and mar.user_id = pc.claimant_user_id
        and ma.organization_id = pc.organization_id
        and ma.user_id = pc.claimant_user_id
        and ma.status = 'submitted'::public.membership_application_status_enum
      )
      or (
        po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.schedule_id is not null
        and po.application_revision_id is null
        and po.user_id = pc.claimant_user_id
      )
    )
  order by pc.created_at asc, pc.id asc;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_queue"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."get_billing_workspace_queue"(uuid) IS 'Returns organization-scoped claim history with safe member summaries and purpose-specific decision commands.';

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_queue"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_queue"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_queue"(uuid) FROM PUBLIC, "anon", "service_role";
