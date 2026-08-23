-- Issue #210: expose one organization-scoped billing workspace for
-- recurring and initial payment review without exposing raw member data.

create index if not exists payment_claims_billing_workspace_queue_idx
  on public.payment_claims (organization_id, created_at, id, obligation_id)
  where status = 'under_review'::public.payment_claim_status_enum;

create index if not exists payment_obligations_billing_workspace_idx
  on public.payment_obligations (
    organization_id,
    purpose,
    status,
    due_on,
    available_on,
    created_at,
    id
  );

create index if not exists payment_claim_audit_events_claim_history_idx
  on public.payment_claim_audit_events (claim_id, created_at, id);

create index if not exists organization_members_billing_workspace_idx
  on public.organization_members (organization_id, role, user_id);

create or replace function public.get_billing_workspace_organizations()
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.name,
    o.slug
  from public.organizations o
  where o.organization_type = 'association'::public.organization_type_enum
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = o.id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  order by o.name, o.id;
$$;

comment on function public.get_billing_workspace_organizations() is
  'Returns the associations where the signed-in person may open the billing workspace.';

revoke all on function public.get_billing_workspace_organizations()
  from public, anon;
grant execute on function public.get_billing_workspace_organizations()
  to authenticated;

create or replace function public.get_billing_workspace_queue(
  p_organization_id uuid
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  organization_id uuid,
  purpose public.payment_obligation_purpose_enum,
  member_user_id uuid,
  member_name text,
  member_handle text,
  member_profile_picture text,
  payer_type public.payment_claim_payer_type_enum,
  payer_name text,
  plan_type public.subscription_plan_type_enum,
  amount integer,
  currency text,
  period_key text,
  period_start date,
  period_end date,
  available_on date,
  due_on date,
  claim_created_at timestamp with time zone,
  claim_decided_at timestamp with time zone,
  claim_decision_reason text,
  claim_status public.payment_claim_status_enum,
  attempt_count bigint,
  approve_command text,
  reject_command text
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

comment on function public.get_billing_workspace_queue(uuid) is
  'Returns organization-scoped claim history with safe member summaries and purpose-specific decision commands.';

revoke all on function public.get_billing_workspace_queue(uuid)
  from public, anon;
grant execute on function public.get_billing_workspace_queue(uuid)
  to authenticated;

create or replace function public.get_billing_workspace_claim_detail(
  p_claim_id uuid
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  purpose public.payment_obligation_purpose_enum,
  member_user_id uuid,
  member_name text,
  member_handle text,
  member_profile_picture text,
  claim_status public.payment_claim_status_enum,
  payer_type public.payment_claim_payer_type_enum,
  payer_name text,
  claim_created_at timestamp with time zone,
  claim_decided_at timestamp with time zone,
  claim_decision_reason text,
  plan_type public.subscription_plan_type_enum,
  amount integer,
  currency text,
  period_key text,
  period_start date,
  period_end date,
  available_on date,
  due_on date,
  attempt_count bigint,
  claim_history jsonb,
  audit_history jsonb,
  approve_command text,
  reject_command text
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

comment on function public.get_billing_workspace_claim_detail(uuid) is
  'Returns authorized common claim detail and immutable chronology for either payment purpose without application-private fields.';

revoke all on function public.get_billing_workspace_claim_detail(uuid)
  from public, anon;
grant execute on function public.get_billing_workspace_claim_detail(uuid)
  to authenticated;

create or replace function public.get_billing_workspace_payments(
  p_organization_id uuid
)
returns table (
  obligation_id uuid,
  organization_id uuid,
  purpose public.payment_obligation_purpose_enum,
  member_user_id uuid,
  member_name text,
  member_handle text,
  plan_type public.subscription_plan_type_enum,
  amount integer,
  currency text,
  period_key text,
  period_start date,
  period_end date,
  available_on date,
  due_on date,
  obligation_status public.payment_obligation_status_enum,
  effective_payment_state text,
  settled_at timestamp with time zone,
  latest_claim_id uuid,
  latest_claim_status public.payment_claim_status_enum,
  latest_claim_created_at timestamp with time zone,
  latest_claim_decided_at timestamp with time zone,
  latest_claim_decision_reason text,
  last_decision_actor_user_id uuid,
  last_decision_actor_name text,
  last_decision_at timestamp with time zone,
  claim_history jsonb,
  audit_history jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

comment on function public.get_billing_workspace_payments(uuid) is
  'Returns private organization-scoped obligation history with immutable claim decisions and server-derived actors.';

revoke all on function public.get_billing_workspace_payments(uuid)
  from public, anon;
grant execute on function public.get_billing_workspace_payments(uuid)
  to authenticated;

create or replace function public.get_billing_workspace_members(
  p_organization_id uuid
)
returns table (
  member_user_id uuid,
  member_name text,
  member_handle text,
  member_profile_picture text,
  member_role public.organization_role_enum,
  joined_at timestamp with time zone,
  financial_standing text,
  overdue_count bigint,
  oldest_attention_due_on date,
  plan_type public.subscription_plan_type_enum,
  last_verified_contribution_at timestamp with time zone,
  next_due_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    om.user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    om.role,
    om.joined_at,
    case
      when coalesce(financial.overdue_count, 0) > 0 then 'overdue'
      when coalesce(financial.payment_available_count, 0) > 0 then 'payment_available'
      when coalesce(financial.under_review_count, 0) > 0 then 'under_review'
      else 'up_to_date'
    end,
    coalesce(financial.overdue_count, 0),
    financial.oldest_attention_due_on,
    coalesce(current_term.plan_type, active_subscription.plan_type),
    financial.last_verified_contribution_at,
    financial.next_due_on
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  join public.profiles member_profile on member_profile.id = om.user_id
  left join public.subscriptions active_subscription
    on active_subscription.organization_id = om.organization_id
    and active_subscription.user_id = om.user_id
    and active_subscription.status = 'active'::public.subscription_status_enum
  left join lateral (
    select cpa.plan_type
    from public.contribution_plan_assignments cpa
    join public.contribution_schedules cs on cs.id = cpa.schedule_id
    where cs.organization_id = om.organization_id
      and cs.user_id = om.user_id
      and cs.active
      and cpa.effective_period_start <= timezone(o.billing_timezone, clock_timestamp())::date
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1
  ) current_term on true
  left join lateral (
    select
      count(*) filter (
        where po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and po.due_on < timezone(
            coalesce(po.billing_timezone, o.billing_timezone),
            clock_timestamp()
          )::date
      ) as overdue_count,
      count(*) filter (
        where po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and not exists (
            select 1
            from public.payment_claims pc
            where pc.obligation_id = po.id
              and pc.status = 'under_review'::public.payment_claim_status_enum
          )
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
      ) as payment_available_count,
      count(*) filter (
        where po.status not in (
          'settled'::public.payment_obligation_status_enum,
          'void'::public.payment_obligation_status_enum
        )
        and exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        )
      ) as under_review_count,
      min(
        case
          when po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and (
            po.due_on < timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            or po.available_at <= clock_timestamp()
            or po.available_on <= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            or exists (
              select 1
              from public.payment_claims pc
              where pc.obligation_id = po.id
                and pc.status = 'under_review'::public.payment_claim_status_enum
            )
          ) then po.due_on
        end
      ) as oldest_attention_due_on,
      max(
        case
          when po.status = 'settled'::public.payment_obligation_status_enum
            then po.settled_at
        end
      ) as last_verified_contribution_at,
      min(
        case
          when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
            and po.status not in (
              'settled'::public.payment_obligation_status_enum,
              'void'::public.payment_obligation_status_enum
            )
            and po.due_on >= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            then po.due_on
        end
      ) as next_due_on
    from public.payment_obligations po
    where po.organization_id = om.organization_id
      and po.user_id = om.user_id
  ) financial on true
  where p_organization_id is not null
    and om.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and om.role in (
      'admin'::public.organization_role_enum,
      'member'::public.organization_role_enum
    )
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = om.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by member_profile.name, member_profile.username, om.user_id;
$$;

comment on function public.get_billing_workspace_members(uuid) is
  'Returns the active association roster with server-derived financial standing and obligation attention.';

revoke all on function public.get_billing_workspace_members(uuid)
  from public, anon;
grant execute on function public.get_billing_workspace_members(uuid)
  to authenticated;
