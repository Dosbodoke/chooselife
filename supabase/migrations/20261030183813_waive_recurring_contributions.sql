-- ---------------------------------------------------------------------------
-- Waiving overdue recurring contributions.
--
-- An association can decide that somebody who fell behind does not have to
-- pay some past months. That is forgiveness, not payment: the obligation moves
-- to `void`, nothing is marked settled, and no claim or revenue is invented.
--
-- The row itself stays. Keeping it is what stops the billing generator from
-- recreating the month -- it inserts ON CONFLICT (schedule_id, period_key) DO
-- NOTHING -- and it keeps the snapshotted amount readable for the audit.
--
-- The command is deliberately narrow:
--   * only an admin of the association may waive, checked against
--     organization_members, never against user metadata,
--   * one person per call, and every selected obligation must be theirs in
--     this association -- otherwise nothing is waived,
--   * only recurring charges that are open and past due. A settled charge, the
--     first admission payment, a charge that is not yet due, or one with a
--     claim under review is refused, and the whole batch with it,
--   * it locks the obligations in id order before reading their claims, the
--     same obligation-first order claim_recurring_payment uses, so a waiver
--     and a claim or a decision on the same month serialize instead of both
--     winning,
--   * a repeat returns the waiver that already exists and never rewrites its
--     reason,
--   * it sends no notification.
--
-- payment_obligation_waivers is the audit trail: one immutable row per waived
-- obligation with who, when and why. It keeps association_person_id like the
-- other billing audit tables, so deleting an account leaves the history intact.
-- ---------------------------------------------------------------------------

create table public.payment_obligation_waivers (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null unique
    references public.payment_obligations (id),
  organization_id uuid not null
    references public.organizations (id),
  association_person_id uuid not null
    references public.association_people (id),
  actor_user_id uuid
    references public.profiles (id) on delete set null,
  reason text not null
    check (
      char_length(reason) between 1 and 500
      and reason = btrim(reason)
    ),
  created_at timestamp with time zone not null default clock_timestamp()
);

comment on table public.payment_obligation_waivers is
  'Audit trail of recurring contributions an association admin waived. One immutable row per obligation. Written only by waive_recurring_contributions.';

create index payment_obligation_waivers_organization_idx
  on public.payment_obligation_waivers (organization_id);

create index payment_obligation_waivers_person_idx
  on public.payment_obligation_waivers (association_person_id);

create index payment_obligation_waivers_actor_idx
  on public.payment_obligation_waivers (actor_user_id)
  where actor_user_id is not null;

alter table public.payment_obligation_waivers enable row level security;

revoke all on table public.payment_obligation_waivers
  from public, anon, authenticated;

-- Filled from the obligation, like payment_claim_audit_events.
create trigger payment_obligation_waivers_set_association_person
  before insert on public.payment_obligation_waivers
  for each row execute function public.set_association_person_from_obligation();

-- A waiver is never edited or removed. The one change allowed is the actor
-- link going NULL when that account is deleted (ON DELETE SET NULL).
create function public.reject_payment_obligation_waiver_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE'
    and public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  raise exception 'Payment obligation waivers are immutable.'
    using errcode = '55000';
end;
$function$;

revoke all on function public.reject_payment_obligation_waiver_mutation()
  from public, anon, authenticated, service_role;

create trigger payment_obligation_waivers_immutable
  before update or delete on public.payment_obligation_waivers
  for each row execute function public.reject_payment_obligation_waiver_mutation();

-- ---------------------------------------------------------------------------
-- Waive: void the selected overdue months of one person, all or none.
-- ---------------------------------------------------------------------------

create function public.waive_recurring_contributions(
  p_organization_id uuid,
  p_user_id uuid,
  p_obligation_ids uuid[],
  p_reason text
)
returns table (
  obligation_id uuid,
  waiver_id uuid,
  period_key text,
  due_on date,
  amount integer,
  currency text,
  reason text,
  waived_at timestamp with time zone,
  waived_by_user_id uuid,
  waived_now boolean
)
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  organization_timezone text;
  selected_ids uuid[];
  normalized_reason text := nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );
  locked_count integer;
  obligation_record record;
  to_waive uuid[] := '{}';
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null or p_user_id is null then
    raise exception 'Organization and person are required.' using errcode = '22023';
  end if;

  if p_obligation_ids is null or array_position(p_obligation_ids, null) is not null then
    raise exception 'Select the contributions to waive.'
      using errcode = '22023', hint = 'invalid_selection';
  end if;

  -- The same month sent twice is still one month.
  select coalesce(array_agg(distinct selected.id order by selected.id), '{}')
  into selected_ids
  from unnest(p_obligation_ids) as selected(id);

  if cardinality(selected_ids) = 0 then
    raise exception 'Select the contributions to waive.'
      using errcode = '22023', hint = 'invalid_selection';
  end if;

  -- Five years of monthly charges. Anything larger is a mistake, not arrears.
  if cardinality(selected_ids) > 60 then
    raise exception 'Waive at most 60 contributions at a time.'
      using errcode = '22023', hint = 'invalid_selection';
  end if;

  if normalized_reason is null then
    raise exception 'A reason is required to waive contributions.'
      using errcode = '22023', hint = 'reason_required';
  end if;

  if char_length(normalized_reason) > 500 then
    raise exception 'The reason must be 500 characters or fewer.'
      using errcode = '22023', hint = 'reason_too_long';
  end if;

  select o.billing_timezone
  into organization_timezone
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Association was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to waive contributions of this association.'
      using errcode = '42501';
  end if;

  -- Lock in id order, and only rows of this person in this association, so
  -- two admins waiving overlapping months queue rather than deadlock.
  perform 1
  from public.payment_obligations po
  where po.id = any(selected_ids)
    and po.organization_id = p_organization_id
    and po.user_id = p_user_id
  order by po.id
  for update;

  get diagnostics locked_count = row_count;

  if locked_count <> cardinality(selected_ids) then
    raise exception 'Some selected contributions do not belong to this person.'
      using errcode = '22023', hint = 'invalid_selection';
  end if;

  for obligation_record in
    select
      po.id,
      po.purpose,
      po.status,
      po.due_on,
      timezone(
        coalesce(po.billing_timezone, organization_timezone),
        clock_timestamp()
      )::date as local_today,
      exists (
        select 1
        from public.payment_obligation_waivers w
        where w.obligation_id = po.id
      ) as already_waived,
      -- Read, not locked: claim and decision commands take the obligation
      -- lock before committing a claim change, and this transaction holds it.
      exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) as has_claim_under_review
    from public.payment_obligations po
    where po.id = any(selected_ids)
    order by po.id
  loop
    if obligation_record.already_waived then
      continue;
    end if;

    if obligation_record.has_claim_under_review then
      raise exception 'A selected contribution has a payment under review. Decide it first.'
        using errcode = '40001', hint = 'under_review';
    end if;

    if obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum
      or obligation_record.status <> 'available'::public.payment_obligation_status_enum
      or obligation_record.due_on is null
      or obligation_record.due_on >= obligation_record.local_today then
      raise exception 'A selected contribution can no longer be waived. Refresh and review again.'
        using errcode = '40001', hint = 'not_waivable';
    end if;

    to_waive := to_waive || obligation_record.id;
  end loop;

  if cardinality(to_waive) > 0 then
    update public.payment_obligations po
    set status = 'void'::public.payment_obligation_status_enum
    where po.id = any(to_waive);

    insert into public.payment_obligation_waivers (
      obligation_id,
      organization_id,
      actor_user_id,
      reason
    )
    select waived.id, p_organization_id, actor_id, normalized_reason
    from unnest(to_waive) as waived(id);
  end if;

  return query
  select
    po.id,
    w.id,
    po.period_key,
    po.due_on,
    po.amount,
    po.currency,
    w.reason,
    w.created_at,
    w.actor_user_id,
    po.id = any(to_waive)
  from public.payment_obligations po
  join public.payment_obligation_waivers w on w.obligation_id = po.id
  where po.id = any(selected_ids)
  order by po.due_on asc, po.id asc;
end;
$function$;

comment on function public.waive_recurring_contributions(uuid, uuid, uuid[], text) is
  'Association admins only. Waives selected overdue recurring contributions of one person with a reason: the obligations become void, are never marked paid, and are not regenerated. All or nothing; a repeat returns the existing waiver.';

revoke all on function public.waive_recurring_contributions(uuid, uuid, uuid[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.waive_recurring_contributions(uuid, uuid, uuid[], text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Read: every waiver of an association, for the admin ledger and history.
-- Kept apart from get_billing_workspace_payments so that function's shape does
-- not change; the client joins the two by obligation id.
-- ---------------------------------------------------------------------------

create function public.get_billing_workspace_waivers(p_organization_id uuid)
returns table (
  obligation_id uuid,
  member_user_id uuid,
  reason text,
  waived_at timestamp with time zone,
  waived_by_user_id uuid,
  waived_by_name text,
  waived_by_handle text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    w.obligation_id,
    po.user_id,
    w.reason,
    w.created_at,
    w.actor_user_id,
    actor_profile.name::text,
    actor_profile.username::text
  from public.payment_obligation_waivers w
  join public.payment_obligations po on po.id = w.obligation_id
  join public.organizations o on o.id = w.organization_id
  left join public.profiles actor_profile on actor_profile.id = w.actor_user_id
  where p_organization_id is not null
    and w.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = w.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by w.created_at desc, w.id desc;
$function$;

comment on function public.get_billing_workspace_waivers(uuid) is
  'Association admins only. Lists waived recurring contributions with reason, time and actor. Returns nothing to anybody else.';

revoke all on function public.get_billing_workspace_waivers(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_billing_workspace_waivers(uuid)
  to authenticated;
