create or replace function public.get_billing_workspace_people(
  p_organization_id uuid
)
returns table (
  member_user_id uuid,
  member_name text,
  member_handle text,
  member_profile_picture text,
  member_role public.organization_role_enum,
  lifecycle_status text,
  application_status public.membership_application_status_enum,
  joined_at timestamp with time zone,
  plan_type public.subscription_plan_type_enum,
  last_verified_contribution_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_organization_id is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.organization_type = 'association'::public.organization_type_enum
  ) then
    raise exception 'Association was not found.' using errcode = '40400';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to view this association.'
      using errcode = '42501';
  end if;

  return query
  with eligible_people as (
    select
      om.user_id,
      om.role,
      'active'::text as lifecycle_status,
      null::public.membership_application_status_enum as application_status,
      om.joined_at
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )

    union all

    select
      ma.user_id,
      null::public.organization_role_enum,
      case
        when ma.status = 'submitted'::public.membership_application_status_enum
          then 'applicant'
        else 'draft'
      end,
      ma.status,
      ma.created_at
    from public.membership_applications ma
    where ma.organization_id = p_organization_id
      and not exists (
        select 1
        from public.organization_members active_member
        where active_member.organization_id = ma.organization_id
          and active_member.user_id = ma.user_id
          and active_member.role in (
            'admin'::public.organization_role_enum,
            'member'::public.organization_role_enum
          )
      )
  ),
  people as (
    select distinct on (eligible.user_id)
      eligible.user_id,
      eligible.role,
      eligible.lifecycle_status,
      eligible.application_status,
      eligible.joined_at
    from eligible_people eligible
    order by
      eligible.user_id,
      case eligible.lifecycle_status
        when 'active' then 0
        when 'applicant' then 1
        else 2
      end,
      eligible.joined_at desc
  )
  select
    people.user_id,
    profile.name,
    profile.username,
    profile.profile_picture,
    people.role,
    people.lifecycle_status,
    coalesce(people.application_status, latest_application.status),
    people.joined_at,
    coalesce(
      current_term.plan_type,
      active_subscription.plan_type,
      latest_revision.plan_type
    ),
    contribution_history.last_verified_contribution_at
  from people
  join public.profiles profile on profile.id = people.user_id
  left join lateral (
    select ma.status
    from public.membership_applications ma
    where ma.organization_id = p_organization_id
      and ma.user_id = people.user_id
    order by ma.updated_at desc, ma.id desc
    limit 1
  ) latest_application on true
  left join lateral (
    select assignment.plan_type
    from public.contribution_schedules schedule
    join public.contribution_plan_assignments assignment
      on assignment.schedule_id = schedule.id
    join public.organizations organization_record
      on organization_record.id = schedule.organization_id
    where schedule.organization_id = p_organization_id
      and schedule.user_id = people.user_id
      and schedule.active
      and assignment.effective_period_start <= timezone(
        organization_record.billing_timezone,
        clock_timestamp()
      )::date
    order by assignment.effective_period_start desc, assignment.id desc
    limit 1
  ) current_term on true
  left join lateral (
    select subscription.plan_type
    from public.subscriptions subscription
    where subscription.organization_id = p_organization_id
      and subscription.user_id = people.user_id
      and subscription.status = 'active'::public.subscription_status_enum
    limit 1
  ) active_subscription on true
  left join lateral (
    select revision.plan_type
    from public.membership_applications application_record
    join public.membership_application_revisions revision
      on revision.application_id = application_record.id
    where application_record.organization_id = p_organization_id
      and application_record.user_id = people.user_id
    order by revision.revision_number desc, revision.id desc
    limit 1
  ) latest_revision on true
  left join lateral (
    select max(obligation.settled_at) as last_verified_contribution_at
    from public.payment_obligations obligation
    where obligation.organization_id = p_organization_id
      and obligation.user_id = people.user_id
      and obligation.status = 'settled'::public.payment_obligation_status_enum
  ) contribution_history on true
  order by profile.name, profile.username, people.user_id;
end;
$function$;

comment on function public.get_billing_workspace_people(uuid) is
  'Returns the organization-scoped people ledger base, including active members, submitted applicants, and drafts.';

revoke all on function public.get_billing_workspace_people(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_billing_workspace_people(uuid)
to authenticated;
