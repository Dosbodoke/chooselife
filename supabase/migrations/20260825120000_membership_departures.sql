-- Membership departures.
--
-- Until now "member" was a binary: a row in public.organization_members meant
-- active, and its absence meant nothing at all. A person who leaves the
-- association therefore disappeared from the admin ledger while their historical
-- obligations stayed behind, orphaned.
--
-- Departures are recorded in an append-only side table rather than as a status
-- column on public.organization_members. Every authorization check in the schema
-- already reads "row exists" as "is a member"; keeping the row and adding a flag
-- would have made each of those checks silently wrong. Deleting the membership
-- row and journalling the departure keeps them correct as written.

create table public.organization_membership_departures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  departed_role public.organization_role_enum not null,
  joined_at timestamp with time zone not null,
  departed_at timestamp with time zone not null default timezone('utc'::text, now()),
  actor_user_id uuid not null references public.profiles(id),
  reason text
);

comment on table public.organization_membership_departures is
  'Append-only journal of memberships that ended. A user with a departure row and no current organization_members row reads as an inactive member.';
comment on column public.organization_membership_departures.actor_user_id is
  'Who ended the membership -- the member themselves, or an association admin.';

alter table public.organization_membership_departures enable row level security;

create index organization_membership_departures_org_user_idx
  on public.organization_membership_departures (organization_id, user_id, departed_at desc);

create function public.reject_membership_departure_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'Membership departures are append-only.' using errcode = '55000';
end;
$function$;

revoke all on function public.reject_membership_departure_mutation() from public, anon, authenticated, service_role;

create trigger organization_membership_departures_append_only
before update or delete on public.organization_membership_departures
for each row execute function public.reject_membership_departure_mutation();

create policy "Departed members can read their own departures"
  on public.organization_membership_departures
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Association admins can read departures"
  on public.organization_membership_departures
  for select to authenticated
  using (exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_membership_departures.organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'::public.organization_role_enum
  ));

revoke all on public.organization_membership_departures from anon;
revoke delete, insert, references, trigger, truncate, update
  on public.organization_membership_departures from authenticated;

-- Ending a membership.
--
-- The membership row, the contribution schedule and the subscription are three
-- separate facts about the same relationship, so they are retired together in
-- one transaction. Obligations already generated are deliberately left alone:
-- an unpaid month does not stop being owed because someone walked away, and the
-- ledger still needs to show it.
create function public.end_association_membership(
  p_organization_id uuid,
  p_user_id uuid default null,
  p_reason text default null
)
returns table (
  departure_id uuid,
  organization_id uuid,
  user_id uuid,
  departed_role public.organization_role_enum,
  departed_at timestamp with time zone
)
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  target_id uuid := coalesce(p_user_id, (select auth.uid()));
  membership public.organization_members%rowtype;
  remaining_admins integer;
  inserted public.organization_membership_departures%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

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

  -- A member may end their own membership; anyone else must be an admin of the
  -- same association.
  if target_id <> actor_id and not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to end this membership.'
      using errcode = '42501';
  end if;

  select * into membership
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = target_id
  for update;

  if not found then
    raise exception 'This person is not a current member of the association.'
      using errcode = 'P0002';
  end if;

  -- An association with no admin left has no one who can review claims, so the
  -- last admin cannot walk out without handing the role over first.
  if membership.role = 'admin'::public.organization_role_enum then
    select count(*)::integer into remaining_admins
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.role = 'admin'::public.organization_role_enum
      and om.user_id <> target_id;

    if remaining_admins = 0 then
      raise exception 'Promote another admin before ending the last admin membership.'
        using errcode = '23514';
    end if;
  end if;

  insert into public.organization_membership_departures (
    organization_id,
    user_id,
    departed_role,
    joined_at,
    actor_user_id,
    reason
  )
  values (
    p_organization_id,
    target_id,
    membership.role,
    membership.joined_at,
    actor_id,
    nullif(btrim(p_reason), '')
  )
  returning * into inserted;

  delete from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = target_id;

  -- Stops generate_membership_billing_obligations from minting new periods.
  update public.contribution_schedules cs
  set active = false
  where cs.organization_id = p_organization_id
    and cs.user_id = target_id
    and cs.active;

  update public.subscriptions s
  set status = 'canceled'::public.subscription_status_enum
  where s.organization_id = p_organization_id
    and s.user_id = target_id
    and s.status <> 'canceled'::public.subscription_status_enum;

  return query
  select
    inserted.id,
    inserted.organization_id,
    inserted.user_id,
    inserted.departed_role,
    inserted.departed_at;
end;
$function$;

comment on function public.end_association_membership(uuid, uuid, text) is
  'Ends a current association membership, journalling it as a departure and retiring the contribution schedule and subscription. Callable by the member or by an association admin.';

revoke all on function public.end_association_membership(uuid, uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.end_association_membership(uuid, uuid, text)
to authenticated;

-- The people ledger now reports three registration states instead of three
-- half-states. Drafts are gone: a half-filled form is not a person the
-- association has any relationship with yet, and every draft row pushed a real
-- member further down the table.
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
      'pending'::text,
      ma.status,
      ma.created_at
    from public.membership_applications ma
    where ma.organization_id = p_organization_id
      and ma.status = 'submitted'::public.membership_application_status_enum
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

    union all

    select
      departure.user_id,
      departure.departed_role,
      'inactive'::text,
      null::public.membership_application_status_enum,
      departure.joined_at
    from public.organization_membership_departures departure
    where departure.organization_id = p_organization_id
      and not exists (
        select 1
        from public.organization_members active_member
        where active_member.organization_id = departure.organization_id
          and active_member.user_id = departure.user_id
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
      -- A person who left and re-applied reads as pending, not as an ex-member.
      case eligible.lifecycle_status
        when 'active' then 0
        when 'pending' then 1
        else 2
      end,
      eligible.joined_at desc
  )
  select
    people.user_id,
    profile.name::text,
    profile.username::text,
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
  'Returns the organization-scoped people ledger base: active members, pending applicants, and inactive ex-members. Unsubmitted drafts are excluded.';

revoke all on function public.get_billing_workspace_people(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_billing_workspace_people(uuid)
to authenticated;
