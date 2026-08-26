-- Member detail for the admin ledger drawer.
--
-- Until now the only way to read the form somebody filled in was
-- get_initial_payment_claim_detail, which is addressed by *claim* id. That is
-- fine for the review queue, but the ledger drawer opens on a *person* -- and
-- the people who most need looking up (a long-standing member, an ex-member,
-- anyone whose claim was already decided) have no claim to address.
--
-- The revision columns deliberately carry the same names as
-- get_initial_payment_claim_detail so one presentation component can render
-- either result.

create function public.get_association_member_detail(
  p_organization_id uuid,
  p_user_id uuid
)
returns table (
  member_user_id uuid,
  member_name text,
  member_handle text,
  member_profile_picture text,
  member_role public.organization_role_enum,
  lifecycle_status text,
  joined_at timestamp with time zone,
  departed_at timestamp with time zone,
  departure_reason text,
  application_id uuid,
  application_revision_id uuid,
  revision_number integer,
  submitted_at timestamp with time zone,
  plan_type public.subscription_plan_type_enum,
  terms_version text,
  accepted_terms_at timestamp with time zone,
  full_name text,
  birth_date date,
  nationality text,
  marital_status public.marital_status_enum,
  profession text,
  birthplace text,
  cpf text,
  id_document_number text,
  id_document_issuer text,
  postal_code text,
  address_line text,
  city text,
  state text,
  email text,
  phone text,
  blood_type public.blood_type_enum,
  has_allergies boolean,
  allergies text,
  has_dietary_restrictions boolean,
  dietary_restrictions text,
  highline_experience public.highline_experience_enum,
  has_rescue_course boolean,
  first_aid_course public.first_aid_course_enum,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  next_charge_period_key text,
  next_charge_due_on date,
  next_charge_amount integer,
  next_charge_currency text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_organization_id is null or p_user_id is null then
    raise exception 'Organization and person are required.' using errcode = '22023';
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
  select
    profile.id,
    profile.name::text,
    profile.username::text,
    profile.profile_picture,
    membership.role,
    case
      when membership.user_id is not null then 'active'
      when submitted_application.id is not null then 'pending'
      when departure.id is not null then 'inactive'
      else 'unknown'
    end::text,
    -- "Member since" reads from whichever record actually starts the
    -- relationship: the live membership, the membership that ended, or -- for
    -- somebody still waiting -- the day they applied.
    coalesce(
      membership.joined_at,
      departure.joined_at,
      submitted_application.created_at
    ),
    departure.departed_at,
    departure.reason,
    revision.application_id,
    revision.id,
    revision.revision_number,
    revision.submitted_at,
    revision.plan_type,
    revision.terms_version,
    revision.accepted_terms_at,
    revision.full_name,
    revision.birth_date,
    revision.nationality,
    revision.marital_status,
    revision.profession,
    revision.birthplace,
    revision.cpf,
    revision.id_document_number,
    revision.id_document_issuer,
    revision.postal_code,
    revision.address_line,
    revision.city,
    revision.state,
    revision.email,
    revision.phone,
    revision.blood_type,
    revision.has_allergies,
    revision.allergies,
    revision.has_dietary_restrictions,
    revision.dietary_restrictions,
    revision.highline_experience,
    revision.has_rescue_course,
    revision.first_aid_course,
    revision.emergency_contact_name,
    revision.emergency_contact_relationship,
    revision.emergency_contact_phone,
    next_charge.period_key,
    next_charge.due_on,
    next_charge.amount,
    next_charge.currency
  from public.profiles profile
  left join public.organization_members membership
    on membership.organization_id = p_organization_id
    and membership.user_id = profile.id
    and membership.role in (
      'admin'::public.organization_role_enum,
      'member'::public.organization_role_enum
    )
  left join lateral (
    select ma.id, ma.created_at
    from public.membership_applications ma
    where ma.organization_id = p_organization_id
      and ma.user_id = profile.id
      and ma.status = 'submitted'::public.membership_application_status_enum
    order by ma.created_at desc, ma.id desc
    limit 1
  ) submitted_application on true
  left join lateral (
    select d.id, d.joined_at, d.departed_at, d.reason
    from public.organization_membership_departures d
    where d.organization_id = p_organization_id
      and d.user_id = profile.id
    order by d.departed_at desc, d.id desc
    limit 1
  ) departure on true
  -- The newest *submitted* snapshot. Never the live application row: an
  -- applicant can keep editing a draft, and the revision is the immutable
  -- record of what they actually attested to.
  left join lateral (
    select rev.*
    from public.membership_application_revisions rev
    where rev.organization_id = p_organization_id
      and rev.user_id = profile.id
    order by rev.revision_number desc, rev.id desc
    limit 1
  ) revision on true
  -- The next charge the member will owe, derived rather than stored: the
  -- obligation generator runs on cron, so for most of a billing cycle the
  -- upcoming period has no row yet -- and "when is my next payment due" is
  -- exactly what an admin is asked on the phone.
  --
  -- Anchored on the newest existing obligation so the derived period can never
  -- collide with a real one. A departure deactivates the schedule, so an
  -- ex-member correctly has no next charge.
  left join lateral (
    select
      public.recurring_period_key(schedule.cadence, upcoming.due_on) as period_key,
      upcoming.due_on,
      term.amount,
      term.currency
    from public.contribution_schedules schedule
    left join lateral (
      select po.due_on
      from public.payment_obligations po
      where po.organization_id = p_organization_id
        and po.user_id = profile.id
        and po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      order by po.due_on desc, po.id desc
      limit 1
    ) last_obligation on true
    left join lateral (
      select a.amount, a.currency
      from public.contribution_plan_assignments a
      where a.schedule_id = schedule.id
      order by a.effective_period_start desc, a.id desc
      limit 1
    ) term on true
    cross join lateral (
      select case
        when last_obligation.due_on is not null then
          public.next_recurring_due_date(
            last_obligation.due_on,
            schedule.cadence,
            schedule.due_day
          )
        else
          public.recurring_due_date_on_or_after(
            schedule.admission_date,
            schedule.cadence,
            schedule.due_day,
            timezone(schedule.billing_timezone, clock_timestamp())::date
          )
      end as due_on
    ) upcoming
    where schedule.organization_id = p_organization_id
      and schedule.user_id = profile.id
      and schedule.active
    limit 1
  ) next_charge on true
  where profile.id = p_user_id;
end;
$function$;

comment on function public.get_association_member_detail(uuid, uuid) is
  'Admin-only person-addressed detail for the ledger drawer: relationship dates plus the newest submitted application snapshot. Returns null revision columns for a member who never filed an application.';

revoke all on function public.get_association_member_detail(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_association_member_detail(uuid, uuid)
to authenticated;
