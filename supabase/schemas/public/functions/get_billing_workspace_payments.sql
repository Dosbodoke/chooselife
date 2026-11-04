CREATE OR REPLACE FUNCTION public.get_billing_workspace_payments (
  p_organization_id uuid
)
  RETURNS TABLE (
    obligation_id                uuid,
    organization_id              uuid,
    purpose                      public.payment_obligation_purpose_enum,
    member_user_id               uuid,
    member_name                  text,
    member_handle                text,
    plan_type                    public.subscription_plan_type_enum,
    amount                       integer,
    currency                     text,
    period_key                   text,
    period_start                 date,
    period_end                   date,
    available_on                 date,
    due_on                       date,
    obligation_status            public.payment_obligation_status_enum,
    effective_payment_state      text,
    settled_at                   timestamp with time zone,
    latest_claim_id              uuid,
    latest_claim_status          public.payment_claim_status_enum,
    latest_claim_created_at      timestamp with time zone,
    latest_claim_decided_at      timestamp with time zone,
    latest_claim_decision_reason text,
    last_decision_actor_user_id  uuid,
    last_decision_actor_name     text,
    last_decision_at             timestamp with time zone,
    claim_history                jsonb,
    audit_history                jsonb
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    po.id,
    po.organization_id,
    po.purpose,
    po.user_id,
    member_profile.name,
    member_profile.username,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    po.status,
    case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when exists (
        select 1
        from public.payment_claims under_review
        where under_review.obligation_id = po.id
          and under_review.status = 'under_review'::public.payment_claim_status_enum
      ) then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= clock_timestamp() then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, o.billing_timezone),
          clock_timestamp()
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
          coalesce(po.billing_timezone, o.billing_timezone),
          clock_timestamp()
        )::date then 'available'
      else 'scheduled'
    end,
    po.settled_at,
    latest_claim.id,
    latest_claim.status,
    latest_claim.created_at,
    latest_claim.decided_at,
    latest_claim.decision_reason,
    last_decision.actor_user_id,
    last_decision.actor_name,
    last_decision.created_at,
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
    )
  from public.payment_obligations po
  join public.organizations o on o.id = po.organization_id
  join public.profiles member_profile on member_profile.id = po.user_id
  left join lateral (
    select pc.*
    from public.payment_claims pc
    where pc.obligation_id = po.id
    order by pc.created_at desc, pc.id desc
    limit 1
  ) latest_claim on true
  left join lateral (
    select
      audit.actor_user_id,
      actor_profile.name as actor_name,
      audit.created_at
    from public.payment_claim_audit_events audit
    left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
    where audit.obligation_id = po.id
      and audit.next_state in ('payment_available', 'payment_settled')
    order by audit.created_at desc, audit.id desc
    limit 1
  ) last_decision on true
  where p_organization_id is not null
    and po.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = po.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by po.due_on desc, po.created_at desc, po.id desc;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_payments"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."get_billing_workspace_payments"(uuid) IS 'Returns private organization-scoped obligation history with immutable claim decisions and server-derived actors.';

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_payments"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_payments"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_payments"(uuid) FROM PUBLIC, "anon", "service_role";
