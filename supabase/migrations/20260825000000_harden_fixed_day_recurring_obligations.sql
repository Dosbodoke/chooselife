-- Issue #209: make recurring contribution periods server-owned, immutable,
-- effective-dated, and safe to backfill without rewriting billing history.
--
-- The preceding Ledger migration introduced the first version of these
-- tables. This migration is deliberately additive/compensating so it is safe
-- for environments that have already applied that migration.

create or replace function public.is_valid_billing_timezone(p_timezone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  );
$$;

revoke all on function public.is_valid_billing_timezone(text)
  from public, anon, authenticated;

create or replace function public.validate_billing_policy_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_valid_billing_timezone(new.billing_timezone) then
    raise exception 'Billing timezone must be a valid IANA timezone name.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_billing_policy_timezone()
  from public, anon, authenticated;

drop trigger if exists organizations_validate_billing_policy_timezone
  on public.organizations;
create trigger organizations_validate_billing_policy_timezone
before insert or update of billing_timezone on public.organizations
for each row
execute function public.validate_billing_policy_timezone();

drop trigger if exists contribution_schedules_validate_timezone
  on public.contribution_schedules;
create trigger contribution_schedules_validate_timezone
before insert or update of billing_timezone on public.contribution_schedules
for each row
execute function public.validate_billing_policy_timezone();

-- The original Ledger migration accidentally capped the policy at day 28.
-- Fixed-day billing supports all configured days 1 through 31 and clamps only
-- the target month when that day does not exist.
alter table public.organizations
  drop constraint if exists organizations_billing_due_day_check;
alter table public.organizations
  add constraint organizations_billing_due_day_check
  check (billing_due_day between 1 and 31);

alter table public.contribution_schedules
  drop constraint if exists contribution_schedules_due_day_check;
alter table public.contribution_schedules
  add constraint contribution_schedules_due_day_check
  check (due_day between 1 and 31);

alter table public.contribution_plan_assignments
  add column if not exists due_day smallint,
  add column if not exists lead_days smallint,
  add column if not exists billing_timezone text,
  add column if not exists pix_copy_paste text;

update public.contribution_plan_assignments cpa
set
  due_day = coalesce(cpa.due_day, cs.due_day),
  lead_days = coalesce(cpa.lead_days, cs.lead_days),
  billing_timezone = coalesce(cpa.billing_timezone, cs.billing_timezone),
  pix_copy_paste = coalesce(
    cpa.pix_copy_paste,
    case cpa.plan_type
      when 'annual'::public.subscription_plan_type_enum
        then o.annual_pix_copy_paste
      else o.monthly_pix_copy_paste
    end
  )
from public.contribution_schedules cs
join public.organizations o on o.id = cs.organization_id
where cs.id = cpa.schedule_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contribution_plan_assignments_due_day_check'
      and conrelid = 'public.contribution_plan_assignments'::regclass
  ) then
    alter table public.contribution_plan_assignments
      add constraint contribution_plan_assignments_due_day_check
      check (due_day is null or due_day between 1 and 31);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'contribution_plan_assignments_lead_days_check'
      and conrelid = 'public.contribution_plan_assignments'::regclass
  ) then
    alter table public.contribution_plan_assignments
      add constraint contribution_plan_assignments_lead_days_check
      check (lead_days is null or lead_days between 0 and 31);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'contribution_plan_assignments_timezone_check'
      and conrelid = 'public.contribution_plan_assignments'::regclass
  ) then
    alter table public.contribution_plan_assignments
      add constraint contribution_plan_assignments_timezone_check
      check (billing_timezone is null or nullif(btrim(billing_timezone), '') is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'contribution_plan_assignments_pix_check'
      and conrelid = 'public.contribution_plan_assignments'::regclass
  ) then
    alter table public.contribution_plan_assignments
      add constraint contribution_plan_assignments_pix_check
      check (pix_copy_paste is null or nullif(btrim(pix_copy_paste), '') is not null);
  end if;
end;
$$;

-- Replace the first Ledger read model with one that resolves the current term
-- history and evaluates each obligation with its own timezone snapshot.
alter function public.get_membership_billing_ledger(uuid, text, integer)
  rename to get_membership_billing_ledger_legacy;
revoke all on function public.get_membership_billing_ledger_legacy(uuid, text, integer)
  from public, anon, authenticated;

create function public.get_membership_billing_ledger(
  p_organization_id uuid,
  p_history_cursor text default null,
  p_history_limit integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  organization_record public.organizations%rowtype;
  application_record public.membership_applications%rowtype;
  schedule_record public.contribution_schedules%rowtype;
  evaluated_at_value timestamp with time zone := clock_timestamp();
  local_date_value date;
  legal_state text;
  financial_state text := 'up_to_date';
  application_correction_reason text;
  plan_type_value public.subscription_plan_type_enum;
  attention_obligation jsonb;
  next_obligation jsonb;
  history jsonb;
  history_count integer;
  history_limit_value integer := greatest(1, least(coalesce(p_history_limit, 24), 50));
  history_has_more boolean := false;
  history_next_cursor text;
  cursor_due_on date;
  cursor_obligation_id uuid;
  member_exists boolean := false;
  application_found boolean := false;
  next_assignment record;
  candidate_due_date date;
  candidate_next_due_date date;
  candidate_available_on date;
  candidate_period_start date;
  candidate_period_end date;
  candidate_plan_type public.subscription_plan_type_enum;
  candidate_amount integer;
  candidate_currency text;
  candidate_found boolean := false;
  candidate_effective_start date;
  selected_candidate_due_date date;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_history_cursor, '')), '') is not null then
    begin
      cursor_due_on := split_part(p_history_cursor, '|', 1)::date;
      cursor_obligation_id := split_part(p_history_cursor, '|', 2)::uuid;
    exception
      when others then
        raise exception 'The Ledger history cursor is invalid.' using errcode = '22023';
    end;
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Association was not found.' using errcode = '40400';
  end if;

  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
  )
  into member_exists;

  select ma.*
  into application_record
  from public.membership_applications ma
  where ma.organization_id = p_organization_id
    and ma.user_id = actor_id
  order by ma.updated_at desc, ma.id desc
  limit 1;
  application_found := found;

  if not member_exists and not application_found then
    raise exception 'Membership Ledger was not found.' using errcode = '42501';
  end if;

  legal_state := case when member_exists then 'active' else 'applicant' end;
  local_date_value := timezone(
    organization_record.billing_timezone,
    evaluated_at_value
  )::date;

  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.organization_id = p_organization_id
    and cs.user_id = actor_id
    and cs.active
  order by cs.id
  limit 1;

  if found then
    select case
      when cpa.plan_type = 'annual'::public.subscription_plan_type_enum
        then 'annual'::public.subscription_plan_type_enum
      else 'monthly'::public.subscription_plan_type_enum
    end
    into plan_type_value
    from public.contribution_plan_assignments cpa
    where cpa.schedule_id = schedule_record.id
      and cpa.effective_period_start <= local_date_value
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1;
  end if;

  if plan_type_value is null and application_found then
    select mar.plan_type
    into plan_type_value
    from public.membership_application_revisions mar
    where mar.application_id = application_record.id
    order by mar.revision_number desc, mar.id desc
    limit 1;
  end if;

  select pc.decision_reason
  into application_correction_reason
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  where pc.claimant_user_id = actor_id
    and pc.organization_id = p_organization_id
    and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    and pc.status = 'rejected'::public.payment_claim_status_enum
  order by pc.decided_at desc nulls last, pc.created_at desc, pc.id desc
  limit 1;

  if exists (
    select 1
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and po.due_on < timezone(
        coalesce(po.billing_timezone, organization_record.billing_timezone),
        evaluated_at_value
      )::date
  ) then
    financial_state := 'overdue';
  elsif exists (
    select 1
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and (
        (
          po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and po.available_at <= evaluated_at_value
        )
        or (
          po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
            coalesce(po.billing_timezone, organization_record.billing_timezone),
            evaluated_at_value
          )::date
        )
      )
      and not exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
  ) then
    financial_state := 'payment_available';
  elsif exists (
    select 1
    from public.payment_obligations po
    join public.payment_claims pc on pc.obligation_id = po.id
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and pc.status = 'under_review'::public.payment_claim_status_enum
  ) then
    financial_state := 'under_review';
  end if;

  select jsonb_build_object(
    'obligation_id', po.id,
    'purpose', po.purpose,
    'status', state.effective_status,
    'period_key', po.period_key,
    'period_start', po.period_start,
    'period_end', po.period_end,
    'available_on', po.available_on,
    'due_on', po.due_on,
    'amount', po.amount,
    'currency', po.currency,
    'action', case state.effective_status
      when 'under_review' then jsonb_build_object('type', 'open_claim')
      when 'available' then jsonb_build_object('type', 'open_obligation')
      when 'overdue' then jsonb_build_object('type', 'open_obligation')
      else null
    end,
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'claim_id', pc.id,
        'status', pc.status,
        'payer', pc.payer_type,
        'payer_name', pc.payer_name,
        'created_at', pc.created_at,
        'decided_at', pc.decided_at,
        'decision_reason', pc.decision_reason
      ) order by pc.created_at asc, pc.id asc)
      from public.payment_claims pc
      where pc.obligation_id = po.id
    ), '[]'::jsonb)
  )
  into attention_obligation
  from public.payment_obligations po
  cross join lateral (
    select case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= evaluated_at_value then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, organization_record.billing_timezone),
          evaluated_at_value
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
        coalesce(po.billing_timezone, organization_record.billing_timezone),
        evaluated_at_value
      )::date then 'available'
      else 'scheduled'
    end as effective_status
  ) state
  where po.organization_id = p_organization_id
    and po.user_id = actor_id
    and state.effective_status in ('available', 'under_review', 'overdue')
  order by
    case state.effective_status
      when 'overdue' then 0
      when 'available' then 1
      when 'under_review' then 2
      else 3
    end,
    po.due_on asc,
    po.created_at asc,
    po.id asc
  limit 1;

  if member_exists and schedule_record.id is not null then
    select jsonb_build_object(
      'obligation_id', po.id,
      'purpose', po.purpose,
      'status', state.effective_status,
      'period_key', po.period_key,
      'period_start', po.period_start,
      'period_end', po.period_end,
      'available_on', po.available_on,
      'due_on', po.due_on,
      'amount', po.amount,
      'currency', po.currency,
      'action', case state.effective_status
        when 'under_review' then jsonb_build_object('type', 'open_claim')
        when 'available' then jsonb_build_object('type', 'open_obligation')
        when 'overdue' then jsonb_build_object('type', 'open_obligation')
        else null
      end
    )
    into next_obligation
    from public.payment_obligations po
    cross join lateral (
      select case
        when exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        ) then 'under_review'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
          coalesce(po.billing_timezone, schedule_record.billing_timezone),
          evaluated_at_value
        )::date then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.schedule_id = schedule_record.id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.due_on > timezone(
        coalesce(po.billing_timezone, schedule_record.billing_timezone),
        evaluated_at_value
      )::date
    order by po.due_on asc, po.created_at asc, po.id asc
    limit 1;

    if next_obligation is null then
      for next_assignment in
        select
          cpa.*,
          lead(cpa.effective_period_start) over (
            order by cpa.effective_period_start, cpa.id
          ) as next_effective_period_start
        from public.contribution_plan_assignments cpa
        where cpa.schedule_id = schedule_record.id
        order by cpa.effective_period_start, cpa.id
      loop
        candidate_plan_type := next_assignment.plan_type;
        candidate_effective_start := greatest(
          schedule_record.admission_date,
          next_assignment.effective_period_start
        );
        candidate_due_date := public.recurring_due_date_on_or_after(
          schedule_record.admission_date,
          case candidate_plan_type
            when 'annual'::public.subscription_plan_type_enum
              then 'annual'::public.contribution_cadence_enum
            else 'monthly'::public.contribution_cadence_enum
          end,
          coalesce(next_assignment.due_day, schedule_record.due_day),
          greatest(
            candidate_effective_start,
            timezone(
              coalesce(next_assignment.billing_timezone, schedule_record.billing_timezone),
              evaluated_at_value
            )::date + 1
          )
        );

        if next_assignment.next_effective_period_start is not null
          and candidate_due_date >= next_assignment.next_effective_period_start then
          continue;
        end if;

        if not candidate_found or candidate_due_date < selected_candidate_due_date then
          candidate_found := true;
          selected_candidate_due_date := candidate_due_date;
          candidate_next_due_date := public.next_recurring_due_date(
            candidate_due_date,
            case candidate_plan_type
              when 'annual'::public.subscription_plan_type_enum
                then 'annual'::public.contribution_cadence_enum
              else 'monthly'::public.contribution_cadence_enum
            end,
            coalesce(next_assignment.due_day, schedule_record.due_day)
          );
          candidate_available_on := candidate_due_date
            - coalesce(next_assignment.lead_days, schedule_record.lead_days);
          candidate_period_start := candidate_due_date;
          candidate_period_end := candidate_next_due_date - 1;
          candidate_amount := next_assignment.amount;
          candidate_currency := next_assignment.currency;
          next_obligation := jsonb_build_object(
            'obligation_id', null,
            'purpose', 'recurring',
            'status', 'scheduled',
            'period_key', public.recurring_period_key(
              case candidate_plan_type
                when 'annual'::public.subscription_plan_type_enum
                  then 'annual'::public.contribution_cadence_enum
                else 'monthly'::public.contribution_cadence_enum
              end,
              candidate_due_date
            ),
            'period_start', candidate_period_start,
            'period_end', candidate_period_end,
            'available_on', candidate_available_on,
            'due_on', candidate_due_date,
            'amount', candidate_amount,
            'currency', candidate_currency,
            'action', null
          );
        end if;
      end loop;
    end if;
  end if;

  select coalesce(jsonb_agg(row_data order by due_on desc, obligation_id desc), '[]'::jsonb),
    count(*)::integer
  into history, history_count
  from (
    select
      jsonb_build_object(
        'obligation_id', po.id,
        'purpose', po.purpose,
        'status', state.effective_status,
        'period_key', po.period_key,
        'period_start', po.period_start,
        'period_end', po.period_end,
        'available_on', po.available_on,
        'due_on', po.due_on,
        'amount', po.amount,
        'currency', po.currency,
        'settled_at', po.settled_at,
        'claims', coalesce((
          select jsonb_agg(jsonb_build_object(
            'claim_id', pc.id,
            'status', pc.status,
            'payer', pc.payer_type,
            'payer_name', pc.payer_name,
            'created_at', pc.created_at,
            'decided_at', pc.decided_at,
            'decision_reason', pc.decision_reason
          ) order by pc.created_at asc, pc.id asc)
          from public.payment_claims pc
          where pc.obligation_id = po.id
        ), '[]'::jsonb)
      ) as row_data,
      po.due_on,
      po.created_at,
      po.id as obligation_id
    from public.payment_obligations po
    cross join lateral (
      select case
        when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
        when po.status = 'void'::public.payment_obligation_status_enum then 'void'
        when exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        ) then 'under_review'
        when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and po.available_at <= evaluated_at_value then 'available'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.due_on < timezone(
            coalesce(po.billing_timezone, organization_record.billing_timezone),
            evaluated_at_value
          )::date then 'overdue'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
          coalesce(po.billing_timezone, organization_record.billing_timezone),
          evaluated_at_value
        )::date then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and (
        cursor_due_on is null
        or (po.due_on, po.id) < (cursor_due_on, cursor_obligation_id)
      )
    order by po.due_on desc, po.id desc
    limit history_limit_value + 1
  ) history_rows;

  if history_count > history_limit_value then
    history_has_more := true;
    select jsonb_agg(value order by ordinal)
    into history
    from jsonb_array_elements(history) with ordinality as items(value, ordinal)
    where ordinal <= history_limit_value;

    select to_char(po.due_on, 'YYYY-MM-DD') || '|' || po.id::text
    into history_next_cursor
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and (
        cursor_due_on is null
        or (po.due_on, po.id) < (cursor_due_on, cursor_obligation_id)
      )
    order by po.due_on desc, po.id desc
    offset history_limit_value
    limit 1;
  end if;

  return jsonb_build_object(
    'organization_id', organization_record.id,
    'organization_slug', organization_record.slug,
    'organization_name', organization_record.name,
    'legal_membership_state', legal_state,
    'application_status', case when application_found then application_record.status else null end,
    'application_correction_reason', application_correction_reason,
    'financial_standing', financial_state,
    'evaluated_at', evaluated_at_value,
    'plan_type', plan_type_value,
    'attention_obligation', attention_obligation,
    'next_contribution', next_obligation,
    'history', coalesce(history, '[]'::jsonb),
    'history_limit', history_limit_value,
    'history_has_more', history_has_more,
    'history_next_cursor', history_next_cursor
  );
end;
$$;

comment on function public.get_membership_billing_ledger(uuid, text, integer) is
  'Returns the signed-in person''s private Ledger using effective-dated terms and obligation timezone snapshots.';

revoke all on function public.get_membership_billing_ledger(uuid, text, integer)
  from public, anon;
grant execute on function public.get_membership_billing_ledger(uuid, text, integer)
  to authenticated;

drop trigger if exists contribution_plan_assignments_validate_timezone
  on public.contribution_plan_assignments;
create trigger contribution_plan_assignments_validate_timezone
before insert or update of billing_timezone on public.contribution_plan_assignments
for each row
when (new.billing_timezone is not null)
execute function public.validate_billing_policy_timezone();

create or replace function public.reject_contribution_plan_assignment_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.schedule_id is distinct from new.schedule_id
    or old.effective_period_start is distinct from new.effective_period_start
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.pix_copy_paste is distinct from new.pix_copy_paste then
    raise exception 'An effective-dated contribution term is immutable; append a new term.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_contribution_plan_assignment_mutation()
  from public, anon, authenticated;

drop trigger if exists contribution_plan_assignments_immutable
  on public.contribution_plan_assignments;
create trigger contribution_plan_assignments_immutable
before update on public.contribution_plan_assignments
for each row
execute function public.reject_contribution_plan_assignment_mutation();

-- A schedule's admission date is the legal anchor. Future terms are appended
-- to the assignment history; the anchor and its original policy are never
-- rewritten by a payment or subscription event.
create or replace function public.reject_contribution_schedule_anchor_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.admission_date is distinct from new.admission_date then
    raise exception 'A contribution schedule admission anchor is immutable.'
      using errcode = '55000';
  end if;

  if old.cadence is distinct from new.cadence
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.currency is distinct from new.currency then
    raise exception 'Contribution schedule policy is immutable; append an effective-dated term.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_contribution_schedule_anchor_mutation()
  from public, anon, authenticated;

drop trigger if exists contribution_schedules_immutable_anchor
  on public.contribution_schedules;
create trigger contribution_schedules_immutable_anchor
before update on public.contribution_schedules
for each row
execute function public.reject_contribution_schedule_anchor_mutation();

alter table public.payment_obligations
  add column if not exists schedule_term_id uuid
    references public.contribution_plan_assignments(id),
  add column if not exists billing_timezone text,
  add column if not exists billing_due_day smallint,
  add column if not exists billing_lead_days smallint,
  add column if not exists organization_name_snapshot text,
  add column if not exists organization_slug_snapshot text;

-- Initial obligations keep schedule_id null, so a full unique constraint is
-- equivalent for recurring rows and gives the worker a stable conflict target.
drop index if exists public.payment_obligations_recurring_schedule_period_idx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_obligations_schedule_period_key'
      and conrelid = 'public.payment_obligations'::regclass
  ) then
    alter table public.payment_obligations
      add constraint payment_obligations_schedule_period_key
      unique (schedule_id, period_key);
  end if;
end;
$$;

update public.payment_obligations po
set
  billing_timezone = coalesce(po.billing_timezone, o.billing_timezone),
  billing_due_day = coalesce(po.billing_due_day, o.billing_due_day),
  billing_lead_days = coalesce(po.billing_lead_days, o.billing_lead_days),
  organization_name_snapshot = coalesce(po.organization_name_snapshot, o.name),
  organization_slug_snapshot = coalesce(po.organization_slug_snapshot, o.slug)
from public.organizations o
where o.id = po.organization_id;

create or replace function public.snapshot_payment_obligation_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_record public.organizations%rowtype;
  term_record public.contribution_plan_assignments%rowtype;
begin
  select o.*
  into organization_record
  from public.organizations o
  where o.id = new.organization_id;

  if not found then
    raise exception 'Payment obligation organization was not found.'
      using errcode = '23503';
  end if;

  if new.schedule_term_id is not null then
    select cpa.*
    into term_record
    from public.contribution_plan_assignments cpa
    where cpa.id = new.schedule_term_id;

    if not found then
      raise exception 'Payment obligation billing term was not found.'
        using errcode = '23503';
    end if;

    new.billing_timezone := coalesce(new.billing_timezone, term_record.billing_timezone);
    new.billing_due_day := coalesce(new.billing_due_day, term_record.due_day);
    new.billing_lead_days := coalesce(new.billing_lead_days, term_record.lead_days);
  end if;

  new.billing_timezone := coalesce(new.billing_timezone, organization_record.billing_timezone);
  new.billing_due_day := coalesce(new.billing_due_day, organization_record.billing_due_day);
  new.billing_lead_days := coalesce(new.billing_lead_days, organization_record.billing_lead_days);
  new.organization_name_snapshot := coalesce(
    new.organization_name_snapshot,
    organization_record.name
  );
  new.organization_slug_snapshot := coalesce(
    new.organization_slug_snapshot,
    organization_record.slug
  );

  return new;
end;
$$;

revoke all on function public.snapshot_payment_obligation_context()
  from public, anon, authenticated;

drop trigger if exists payment_obligations_snapshot_context
  on public.payment_obligations;
create trigger payment_obligations_snapshot_context
before insert on public.payment_obligations
for each row
execute function public.snapshot_payment_obligation_context();

create index if not exists contribution_plan_assignments_schedule_period_idx
  on public.contribution_plan_assignments (schedule_id, effective_period_start, id);

create index if not exists payment_obligations_recurring_term_idx
  on public.payment_obligations (schedule_term_id, due_on, id)
  where purpose = 'recurring'::public.payment_obligation_purpose_enum;

create or replace function public.recurring_due_date_on_or_after(
  p_admission_date date,
  p_cadence public.contribution_cadence_enum,
  p_due_day integer,
  p_from_date date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  due_date_value date;
  lower_bound date;
begin
  if p_admission_date is null
    or p_cadence is null
    or p_due_day is null
    or p_from_date is null then
    raise exception 'Recurring date inputs are required.' using errcode = '22023';
  end if;

  if p_due_day < 1 or p_due_day > 31 then
    raise exception 'Recurring due day must be between 1 and 31.'
      using errcode = '22023';
  end if;

  lower_bound := greatest(p_admission_date, p_from_date);
  due_date_value := public.first_recurring_due_date(
    p_admission_date,
    p_cadence,
    p_due_day
  );

  while due_date_value < lower_bound loop
    due_date_value := public.next_recurring_due_date(
      due_date_value,
      p_cadence,
      p_due_day
    );
  end loop;

  return due_date_value;
end;
$$;

create or replace function public.recurring_period_key(
  p_cadence public.contribution_cadence_enum,
  p_due_date date
)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_cadence::text || ':' || to_char(p_due_date, 'YYYY-MM-DD');
$$;

revoke all on function public.recurring_due_date_on_or_after(
  date, public.contribution_cadence_enum, integer, date
) from public, anon, authenticated;
revoke all on function public.recurring_period_key(
  public.contribution_cadence_enum, date
) from public, anon, authenticated;

-- Convert rows created by the first Ledger migration to the stable period
-- identity. The old YYYY-MM key and month-start boundary were not sufficient
-- once cadence changes and late reconciliation were introduced.
with recurring_terms as (
  select
    po.id as obligation_id,
    po.due_on,
    term.id as term_id,
    term.plan_type,
    term.due_day,
    term.lead_days,
    term.billing_timezone
  from public.payment_obligations po
  cross join lateral (
    select cpa.*
    from public.contribution_plan_assignments cpa
    where cpa.schedule_id = po.schedule_id
      and cpa.effective_period_start <= po.due_on
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1
  ) term
  where po.purpose = 'recurring'::public.payment_obligation_purpose_enum
    and po.schedule_id is not null
    and po.due_on is not null
)
update public.payment_obligations po
set
  schedule_term_id = term.term_id,
  period_key = public.recurring_period_key(
    case term.plan_type
      when 'annual'::public.subscription_plan_type_enum
        then 'annual'::public.contribution_cadence_enum
      else 'monthly'::public.contribution_cadence_enum
    end,
    term.due_on
  ),
  period_start = term.due_on,
  period_end = public.next_recurring_due_date(
    term.due_on,
    case term.plan_type
      when 'annual'::public.subscription_plan_type_enum
        then 'annual'::public.contribution_cadence_enum
      else 'monthly'::public.contribution_cadence_enum
    end,
    term.due_day
  ) - 1,
  billing_timezone = coalesce(po.billing_timezone, term.billing_timezone),
  billing_due_day = coalesce(po.billing_due_day, term.due_day),
  billing_lead_days = coalesce(po.billing_lead_days, term.lead_days)
from recurring_terms term
where term.obligation_id = po.id;

-- Existing recurring rows from the first migration were linked to succeeded
-- legacy payments inside generation. Preserve those links, but all future
-- reconciliation is explicit and dry-run by default.
comment on column public.payment_obligations.schedule_term_id is
  'Immutable effective-dated contribution term that produced this obligation.';
comment on column public.payment_obligations.billing_timezone is
  'Timezone snapshot used to evaluate this obligation; never read from live policy for history.';
comment on column public.payment_obligations.billing_due_day is
  'Due-day policy snapshot used to produce this obligation.';
comment on column public.payment_obligations.billing_lead_days is
  'Lead-day policy snapshot used to produce this obligation.';

create or replace function public.reject_payment_obligation_context_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
    or old.user_id is distinct from new.user_id
    or old.application_revision_id is distinct from new.application_revision_id
    or old.purpose is distinct from new.purpose
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.payment_method is distinct from new.payment_method
    or old.pix_copy_paste is distinct from new.pix_copy_paste
    or old.available_at is distinct from new.available_at
    or old.schedule_id is distinct from new.schedule_id
    or old.schedule_term_id is distinct from new.schedule_term_id
    or old.period_key is distinct from new.period_key
    or old.period_start is distinct from new.period_start
    or old.period_end is distinct from new.period_end
    or old.available_on is distinct from new.available_on
    or old.due_on is distinct from new.due_on
    or old.billing_timezone is distinct from new.billing_timezone
    or old.billing_due_day is distinct from new.billing_due_day
    or old.billing_lead_days is distinct from new.billing_lead_days
    or old.organization_name_snapshot is distinct from new.organization_name_snapshot
    or old.organization_slug_snapshot is distinct from new.organization_slug_snapshot then
    raise exception 'Payment obligation billing context is immutable.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_payment_obligation_context_mutation()
  from public, anon, authenticated;

drop trigger if exists payment_obligations_immutable_context
  on public.payment_obligations;
create trigger payment_obligations_immutable_context
before update on public.payment_obligations
for each row
execute function public.reject_payment_obligation_context_mutation();

-- The public client may read subscriptions for its existing UI, but it must
-- not mutate the source that drives recurring billing. Plan changes use the
-- future-effective command below.
revoke insert, update, delete on table public.subscriptions
  from anon, authenticated;

create or replace function public.ensure_contribution_schedule(
  p_organization_id uuid,
  p_user_id uuid,
  p_admission_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_record public.organizations%rowtype;
  subscription_record public.subscriptions%rowtype;
  schedule_record public.contribution_schedules%rowtype;
  admission_date_value date;
  cadence_value public.contribution_cadence_enum;
  amount_value integer;
  pix_value text;
begin
  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
  for update;

  if not found then
    return null;
  end if;

  if not public.is_valid_billing_timezone(organization_record.billing_timezone)
    or organization_record.billing_due_day not between 1 and 31
    or organization_record.billing_lead_days not between 0 and 31
    or organization_record.billing_currency !~ '^[A-Z]{3}$' then
    raise exception 'The association billing policy is invalid.' using errcode = '23514';
  end if;

  select s.*
  into subscription_record
  from public.subscriptions s
  where s.organization_id = p_organization_id
    and s.user_id = p_user_id
    and s.status = 'active'::public.subscription_status_enum
  for update;

  if not found then
    return null;
  end if;

  cadence_value := case
    when subscription_record.plan_type = 'annual'::public.subscription_plan_type_enum
      then 'annual'::public.contribution_cadence_enum
    else 'monthly'::public.contribution_cadence_enum
  end;
  amount_value := case subscription_record.plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;
  pix_value := case subscription_record.plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if amount_value is null or amount_value <= 0
    or nullif(btrim(pix_value), '') is null then
    raise exception 'The association contribution price or PIX configuration is incomplete.'
      using errcode = '23514';
  end if;

  admission_date_value := coalesce(
    p_admission_date,
    (
      select timezone(organization_record.billing_timezone, om.joined_at)::date
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = p_user_id
    ),
    timezone(organization_record.billing_timezone, clock_timestamp())::date
  );

  insert into public.contribution_schedules (
    organization_id,
    user_id,
    cadence,
    admission_date,
    due_day,
    lead_days,
    billing_timezone,
    currency,
    active
  )
  values (
    p_organization_id,
    p_user_id,
    cadence_value,
    admission_date_value,
    organization_record.billing_due_day,
    organization_record.billing_lead_days,
    organization_record.billing_timezone,
    organization_record.billing_currency,
    true
  )
  on conflict (organization_id, user_id) do update
  set active = true
  returning * into schedule_record;

  if schedule_record.id is null then
    select cs.*
    into schedule_record
    from public.contribution_schedules cs
    where cs.organization_id = p_organization_id
      and cs.user_id = p_user_id
    for update;
  end if;

  perform 1
  from public.contribution_plan_assignments cpa
  where cpa.schedule_id = schedule_record.id
    and cpa.effective_period_start = schedule_record.admission_date
  for update;

  if not found then
    insert into public.contribution_plan_assignments (
      schedule_id,
      effective_period_start,
      plan_type,
      amount,
      currency,
      due_day,
      lead_days,
      billing_timezone,
      pix_copy_paste
    )
    values (
      schedule_record.id,
      schedule_record.admission_date,
      subscription_record.plan_type,
      amount_value,
      organization_record.billing_currency,
      schedule_record.due_day,
      schedule_record.lead_days,
      schedule_record.billing_timezone,
      pix_value
    );
  end if;

  return schedule_record.id;
end;
$$;

revoke all on function public.ensure_contribution_schedule(uuid, uuid, date)
  from public, anon, authenticated;

create or replace function public.sync_contribution_schedule_on_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active'::public.subscription_status_enum then
    if exists (
      select 1
      from public.organization_members om
      where om.organization_id = new.organization_id
        and om.user_id = new.user_id
        and om.role in (
          'admin'::public.organization_role_enum,
          'member'::public.organization_role_enum
        )
    ) then
      perform public.ensure_contribution_schedule(new.organization_id, new.user_id, null);
    end if;
  else
    update public.contribution_schedules
    set active = false
    where organization_id = new.organization_id
      and user_id = new.user_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_contribution_schedule_on_subscription()
  from public, anon, authenticated;

drop trigger if exists subscriptions_sync_contribution_schedule
  on public.subscriptions;
create trigger subscriptions_sync_contribution_schedule
after insert or update of status on public.subscriptions
for each row
execute function public.sync_contribution_schedule_on_subscription();

create or replace function public.schedule_contribution_plan_change(
  p_schedule_id uuid,
  p_effective_period_start date,
  p_plan_type public.subscription_plan_type_enum
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  schedule_record public.contribution_schedules%rowtype;
  organization_record public.organizations%rowtype;
  latest_assignment public.contribution_plan_assignments%rowtype;
  existing_assignment public.contribution_plan_assignments%rowtype;
  amount_value integer;
  pix_value text;
  expected_period_start date;
  local_date_value date;
begin
  if actor_id is null and current_user <> 'service_role' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.id = p_schedule_id
  for update;

  if not found then
    raise exception 'Contribution schedule was not found.' using errcode = 'P0002';
  end if;

  if not schedule_record.active then
    raise exception 'Only an active contribution schedule can receive a plan change.'
      using errcode = '55000';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = schedule_record.organization_id
    and o.organization_type = 'association'::public.organization_type_enum
  for update;

  if not found then
    raise exception 'Contribution organization was not found.' using errcode = 'P0002';
  end if;

  if current_user <> 'service_role'
    and not exists (
      select 1
      from public.organization_members om
      where om.organization_id = schedule_record.organization_id
        and om.user_id = actor_id
        and om.role = 'admin'::public.organization_role_enum
    ) then
    raise exception 'Association admin access is required.' using errcode = '42501';
  end if;

  if p_effective_period_start is null or p_plan_type is null then
    raise exception 'A future effective period and plan are required.'
      using errcode = '22023';
  end if;

  local_date_value := timezone(schedule_record.billing_timezone, clock_timestamp())::date;
  if p_effective_period_start <= local_date_value then
    raise exception 'A plan change must start in a future billing period.'
      using errcode = '22023';
  end if;

  select cpa.*
  into latest_assignment
  from public.contribution_plan_assignments cpa
  where cpa.schedule_id = schedule_record.id
  order by cpa.effective_period_start desc, cpa.id desc
  limit 1;

  if not found then
    raise exception 'Contribution schedule has no billing term.' using errcode = '23514';
  end if;

  if p_effective_period_start <= latest_assignment.effective_period_start then
    raise exception 'A plan change must append a later effective billing period.'
      using errcode = '22023';
  end if;

  expected_period_start := public.recurring_due_date_on_or_after(
    schedule_record.admission_date,
    case latest_assignment.plan_type
      when 'annual'::public.subscription_plan_type_enum
        then 'annual'::public.contribution_cadence_enum
      else 'monthly'::public.contribution_cadence_enum
    end,
    coalesce(latest_assignment.due_day, schedule_record.due_day),
    p_effective_period_start
  );

  if expected_period_start <> p_effective_period_start then
    raise exception 'The effective date must be the start of an existing recurring period.'
      using errcode = '22023';
  end if;

  amount_value := case p_plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;
  pix_value := case p_plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if amount_value is null or amount_value <= 0
    or nullif(btrim(pix_value), '') is null
    or organization_record.billing_currency !~ '^[A-Z]{3}$' then
    raise exception 'The future plan price or PIX configuration is incomplete.'
      using errcode = '23514';
  end if;

  select cpa.*
  into existing_assignment
  from public.contribution_plan_assignments cpa
  where cpa.schedule_id = schedule_record.id
    and cpa.effective_period_start = p_effective_period_start
  for update;

  if found then
    if existing_assignment.plan_type <> p_plan_type
      or existing_assignment.amount <> amount_value
      or existing_assignment.currency <> organization_record.billing_currency
      or existing_assignment.due_day <> schedule_record.due_day
      or existing_assignment.lead_days <> schedule_record.lead_days
      or existing_assignment.billing_timezone <> schedule_record.billing_timezone
      or existing_assignment.pix_copy_paste <> pix_value then
      raise exception 'A different plan is already scheduled for this period.'
        using errcode = '40001';
    end if;

    return existing_assignment.id;
  end if;

  insert into public.contribution_plan_assignments (
    schedule_id,
    effective_period_start,
    plan_type,
    amount,
    currency,
    due_day,
    lead_days,
    billing_timezone,
    pix_copy_paste
  )
  values (
    schedule_record.id,
    p_effective_period_start,
    p_plan_type,
    amount_value,
    organization_record.billing_currency,
    schedule_record.due_day,
    schedule_record.lead_days,
    schedule_record.billing_timezone,
    pix_value
  )
  returning id into existing_assignment.id;

  return existing_assignment.id;
end;
$$;

comment on function public.schedule_contribution_plan_change(
  uuid, date, public.subscription_plan_type_enum
) is
  'Appends one idempotent future-effective billing term. Existing periods and schedule anchors are never rewritten.';

revoke all on function public.schedule_contribution_plan_change(
  uuid, date, public.subscription_plan_type_enum
) from public, anon;
grant execute on function public.schedule_contribution_plan_change(
  uuid, date, public.subscription_plan_type_enum
) to authenticated, service_role;

-- The timestamp-injected worker is retained only as a private test/migration
-- seam. Production callers use the no-argument wrapper below, which derives
-- the database clock and cannot be asked to generate arbitrary history.
create or replace function public.generate_membership_billing_obligations_at(
  p_as_of timestamp with time zone
)
returns table (
  schedule_id uuid,
  period_key text,
  obligation_id uuid,
  result text,
  failure_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluated_at timestamp with time zone := coalesce(p_as_of, clock_timestamp());
  schedule_record record;
  assignment_record record;
  term_count integer;
  local_date_value date;
  due_date_value date;
  next_due_date_value date;
  period_key_value text;
  period_start_value date;
  period_end_value date;
  available_on_value date;
  created_obligation public.payment_obligations%rowtype;
  existing_obligation public.payment_obligations%rowtype;
  cadence_value public.contribution_cadence_enum;
begin
  if evaluated_at is null then
    raise exception 'The generation clock is required.' using errcode = '22023';
  end if;

  for schedule_record in
    select
      cs.*,
      o.name as organization_name,
      o.slug as organization_slug
    from public.contribution_schedules cs
    join public.organizations o on o.id = cs.organization_id
    join public.organization_members om
      on om.organization_id = cs.organization_id
      and om.user_id = cs.user_id
    join public.subscriptions s
      on s.organization_id = cs.organization_id
      and s.user_id = cs.user_id
      and s.status = 'active'::public.subscription_status_enum
    where cs.active
      and o.organization_type = 'association'::public.organization_type_enum
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )
    order by cs.organization_id, cs.user_id
  loop
    begin
      if not public.is_valid_billing_timezone(schedule_record.billing_timezone)
        or schedule_record.due_day not between 1 and 31
        or schedule_record.lead_days not between 0 and 31
        or schedule_record.currency !~ '^[A-Z]{3}$' then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'The contribution schedule billing policy is invalid.';
        return next;
        continue;
      end if;

      local_date_value := timezone(
        schedule_record.billing_timezone,
        evaluated_at
      )::date;
      term_count := 0;

      for assignment_record in
        select
          cpa.*,
          lead(cpa.effective_period_start) over (
            order by cpa.effective_period_start, cpa.id
          ) as next_effective_period_start
        from public.contribution_plan_assignments cpa
        where cpa.schedule_id = schedule_record.id
        order by cpa.effective_period_start, cpa.id
      loop
        term_count := term_count + 1;
        cadence_value := case
          when assignment_record.plan_type = 'annual'::public.subscription_plan_type_enum
            then 'annual'::public.contribution_cadence_enum
          else 'monthly'::public.contribution_cadence_enum
        end;

        if assignment_record.due_day is null
          or assignment_record.due_day not between 1 and 31
          or assignment_record.lead_days is null
          or assignment_record.lead_days not between 0 and 31
          or not public.is_valid_billing_timezone(assignment_record.billing_timezone)
          or assignment_record.currency !~ '^[A-Z]{3}$'
          or assignment_record.amount is null
          or assignment_record.amount <= 0 then
          schedule_id := schedule_record.id;
          period_key := null;
          obligation_id := null;
          result := 'failed';
          failure_reason := 'The recurring billing term is invalid or has no positive price.';
          return next;
          continue;
        end if;

        due_date_value := public.recurring_due_date_on_or_after(
          schedule_record.admission_date,
          cadence_value,
          assignment_record.due_day,
          greatest(
            schedule_record.admission_date,
            assignment_record.effective_period_start
          )
        );

        while due_date_value - assignment_record.lead_days <= local_date_value loop
          if assignment_record.next_effective_period_start is not null
            and due_date_value >= assignment_record.next_effective_period_start then
            exit;
          end if;

          next_due_date_value := public.next_recurring_due_date(
            due_date_value,
            cadence_value,
            assignment_record.due_day
          );
          period_start_value := due_date_value;
          period_end_value := next_due_date_value - 1;
          available_on_value := due_date_value - assignment_record.lead_days;
          period_key_value := public.recurring_period_key(
            cadence_value,
            due_date_value
          );

          if nullif(btrim(assignment_record.pix_copy_paste), '') is null then
            schedule_id := schedule_record.id;
            period_key := period_key_value;
            obligation_id := null;
            result := 'failed';
            failure_reason := 'No PIX snapshot exists for the recurring period.';
            return next;
            due_date_value := next_due_date_value;
            continue;
          end if;

          created_obligation := null;
          existing_obligation := null;

          insert into public.payment_obligations (
            organization_id,
            user_id,
            application_revision_id,
            purpose,
            status,
            plan_type,
            amount,
            currency,
            payment_method,
            pix_copy_paste,
            available_at,
            schedule_id,
            schedule_term_id,
            period_key,
            period_start,
            period_end,
            available_on,
            due_on,
            billing_timezone,
            billing_due_day,
            billing_lead_days,
            organization_name_snapshot,
            organization_slug_snapshot
          )
          values (
            schedule_record.organization_id,
            schedule_record.user_id,
            null,
            'recurring'::public.payment_obligation_purpose_enum,
            'available'::public.payment_obligation_status_enum,
            assignment_record.plan_type,
            assignment_record.amount,
            assignment_record.currency,
            'manual_pix',
            assignment_record.pix_copy_paste,
            available_on_value::timestamp at time zone assignment_record.billing_timezone,
            schedule_record.id,
            assignment_record.id,
            period_key_value,
            period_start_value,
            period_end_value,
            available_on_value,
            due_date_value,
            assignment_record.billing_timezone,
            assignment_record.due_day,
            assignment_record.lead_days,
            schedule_record.organization_name,
            schedule_record.organization_slug
          )
          on conflict on constraint payment_obligations_schedule_period_key
          do nothing
          returning * into created_obligation;

          if created_obligation.id is null then
            select po.*
            into existing_obligation
            from public.payment_obligations po
            where po.schedule_id = schedule_record.id
              and po.period_key = period_key_value
              and po.purpose = 'recurring'::public.payment_obligation_purpose_enum;
          else
            existing_obligation := created_obligation;
          end if;

          schedule_id := schedule_record.id;
          period_key := period_key_value;
          obligation_id := existing_obligation.id;
          result := case
            when created_obligation.id is null then 'already_exists'
            else 'created'
          end;
          failure_reason := null;
          return next;

          due_date_value := next_due_date_value;
        end loop;
      end loop;

      if term_count = 0 then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'No effective-dated billing term exists for the schedule.';
        return next;
      end if;
    exception
      when others then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := sqlerrm;
        return next;
    end;
  end loop;
end;
$$;

revoke all on function public.generate_membership_billing_obligations_at(
  timestamp with time zone
) from public, anon, authenticated, service_role;

create or replace function public.generate_membership_billing_obligations(
  p_as_of timestamp with time zone default null
)
returns table (
  schedule_id uuid,
  period_key text,
  obligation_id uuid,
  result text,
  failure_reason text
)
language sql
security definer
set search_path = ''
as $$
  select *
  from public.generate_membership_billing_obligations_at(
    coalesce(p_as_of, clock_timestamp())
  );
$$;

revoke all on function public.generate_membership_billing_obligations(
  timestamp with time zone
) from public, anon, authenticated, service_role;

create or replace function public.generate_membership_billing_obligations()
returns table (
  schedule_id uuid,
  period_key text,
  obligation_id uuid,
  result text,
  failure_reason text
)
language sql
security definer
set search_path = ''
as $$
  select *
  from public.generate_membership_billing_obligations_at(clock_timestamp());
$$;

comment on function public.generate_membership_billing_obligations() is
  'Trusted scheduler command. Derives the database clock and materializes every available recurring period exactly once.';

revoke all on function public.generate_membership_billing_obligations()
  from public, anon, authenticated;
grant execute on function public.generate_membership_billing_obligations()
  to service_role;

-- Legacy payment reconciliation is intentionally separate from generation.
-- The default is a dry run. Only an unambiguous one-to-one match may be
-- applied, and a succeeded legacy payment never settles an obligation that
-- already has a claim under review.
create or replace function public.reconcile_legacy_payment_obligations(
  p_apply boolean default false
)
returns table (
  payment_id uuid,
  obligation_id uuid,
  payment_status public.payment_status_enum,
  result text,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record record;
  candidate_obligation_id uuid;
  candidate_count integer;
  matched_obligation public.payment_obligations%rowtype;
begin
  for payment_record in
    select p.*
    from public.payments p
    where p.status in (
      'pending'::public.payment_status_enum,
      'succeeded'::public.payment_status_enum
    )
      and p.payment_provider is null
      and p.provider_payment_id is null
      and not exists (
        select 1
        from public.payment_obligations linked
        where linked.legacy_payment_id = p.id
      )
    order by coalesce(p.paid_at, p.created_at), p.id
  loop
    select count(*)::integer, min(candidates.id::text)::uuid
    into candidate_count, candidate_obligation_id
    from public.payment_obligations candidates
    where candidates.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and candidates.legacy_payment_id is null
      and candidates.organization_id = payment_record.organization_id
      and candidates.user_id = payment_record.user_id
      and candidates.amount = payment_record.amount
      and timezone(
        coalesce(
          candidates.billing_timezone,
          (select o.billing_timezone
           from public.organizations o
           where o.id = candidates.organization_id)
        ),
        coalesce(payment_record.paid_at, payment_record.created_at)
      )::date between candidates.period_start and candidates.period_end;

    payment_id := payment_record.id;
    obligation_id := candidate_obligation_id;
    payment_status := payment_record.status;

    if candidate_count = 0 then
      result := 'unmatched';
      reason := 'No stable recurring period matches this legacy payment.';
      return next;
      continue;
    end if;

    if candidate_count > 1 then
      obligation_id := null;
      result := 'ambiguous';
      reason := 'More than one recurring period matches this legacy payment.';
      return next;
      continue;
    end if;

    select po.*
    into matched_obligation
    from public.payment_obligations po
    where po.id = candidate_obligation_id
    for update;

    if exists (
      select 1
      from public.payment_claims pc
      where pc.obligation_id = matched_obligation.id
        and pc.status = 'under_review'::public.payment_claim_status_enum
    ) then
      result := 'blocked_under_review';
      reason := 'The period has an active payment claim under review.';
      return next;
      continue;
    end if;

    if not p_apply then
      result := 'ready';
      reason := 'One stable period matches; apply only after dry-run review.';
      return next;
      continue;
    end if;

    update public.payment_obligations po
    set
      legacy_payment_id = payment_record.id,
      status = case
        when payment_record.status = 'succeeded'::public.payment_status_enum
          then 'settled'::public.payment_obligation_status_enum
        else po.status
      end,
      settled_at = case
        when payment_record.status = 'succeeded'::public.payment_status_enum
          then coalesce(payment_record.paid_at, payment_record.created_at)
        else po.settled_at
      end
    where po.id = matched_obligation.id
      and po.legacy_payment_id is null;

    if found then
      result := 'linked';
      reason := 'One stable period was linked to the legacy payment.';
    else
      result := 'already_linked';
      reason := 'The stable period was linked by an earlier reconciliation row.';
    end if;
    return next;
  end loop;
end;
$$;

comment on function public.reconcile_legacy_payment_obligations(boolean) is
  'Returns a dry-run legacy payment mapping by default; only unambiguous reviewed mappings may be applied.';

revoke all on function public.reconcile_legacy_payment_obligations(boolean)
  from public, anon, authenticated;
grant execute on function public.reconcile_legacy_payment_obligations(boolean)
  to service_role;

-- The old daily job ran before São Paulo midnight and the old implementation
-- also emitted immediate-renewal notifications. Replace it with one frequent,
-- scheduler-only job; reminders belong to their own workflow.
do $$
begin
  if to_regclass('cron.job') is not null then
    if exists (select 1 from cron.job where jobname = 'daily-renewal-check') then
      perform cron.unschedule('daily-renewal-check');
    end if;

    if not exists (
      select 1
      from cron.job
      where jobname = 'membership-billing-obligation-generator'
    ) then
      perform cron.schedule(
        'membership-billing-obligation-generator',
        '*/15 * * * *',
        $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/generate-renewal-payments',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'secret_key'
            )
          ),
          body := '{}'::jsonb
        ) as request_id;
        $cron$
      );
    end if;
  end if;
end;
$$;

create or replace function public.get_payment_obligation_instructions(
  p_obligation_id uuid
)
returns table (
  obligation_id uuid,
  organization_id uuid,
  purpose public.payment_obligation_purpose_enum,
  status text,
  plan_type public.subscription_plan_type_enum,
  amount integer,
  currency text,
  payment_method text,
  pix_copy_paste text,
  available_at timestamp with time zone,
  available_on date,
  due_on date,
  period_key text,
  claim_id uuid,
  claim_status public.payment_claim_status_enum,
  payer_type public.payment_claim_payer_type_enum,
  payer_name text,
  claim_created_at timestamp with time zone,
  claim_decision_reason text
)
language sql
security definer
set search_path = ''
as $$
  select
    po.id,
    po.organization_id,
    po.purpose,
    case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when claim.status = 'under_review'::public.payment_claim_status_enum then 'under_review'
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
    po.plan_type,
    po.amount,
    po.currency,
    po.payment_method,
    po.pix_copy_paste,
    po.available_at,
    po.available_on,
    po.due_on,
    po.period_key,
    claim.id,
    claim.status,
    claim.payer_type,
    claim.payer_name,
    claim.created_at,
    claim.decision_reason
  from public.payment_obligations po
  join public.organizations o on o.id = po.organization_id
  left join lateral (
    select
      pc.id,
      pc.status,
      pc.payer_type,
      pc.payer_name,
      pc.created_at,
      pc.decision_reason
    from public.payment_claims pc
    where pc.obligation_id = po.id
      and pc.claimant_user_id = (select auth.uid())
    order by pc.created_at desc, pc.id desc
    limit 1
  ) claim on true
  where po.id = p_obligation_id
    and po.user_id = (select auth.uid());
$$;

comment on function public.get_payment_obligation_instructions(uuid) is
  'Returns authoritative PIX instructions and evaluates availability using the obligation timezone snapshot.';

revoke all on function public.get_payment_obligation_instructions(uuid)
  from public, anon;
grant execute on function public.get_payment_obligation_instructions(uuid)
  to authenticated;

create or replace function public.claim_recurring_payment(
  p_obligation_id uuid,
  p_paid_by_applicant boolean,
  p_payer_name text default null
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  payer_type public.payment_claim_payer_type_enum,
  payer_name text,
  claim_status public.payment_claim_status_enum,
  claim_created_at timestamp with time zone,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  organization_record public.organizations%rowtype;
  obligation_record public.payment_obligations%rowtype;
  existing_claim public.payment_claims%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  inserted_claim public.payment_claims%rowtype;
  normalized_payer_name text;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  normalized_payer_name := nullif(
    btrim(regexp_replace(coalesce(p_payer_name, ''), '\\s+', ' ', 'g')),
    ''
  );

  if p_paid_by_applicant and normalized_payer_name is not null then
    raise exception 'Payer name is only allowed when another person paid.'
      using errcode = '22023';
  end if;

  if not p_paid_by_applicant and normalized_payer_name is null then
    raise exception 'Enter the name of the person who made the payment.'
      using errcode = '22023';
  end if;

  if normalized_payer_name is not null and char_length(normalized_payer_name) > 120 then
    raise exception 'Payer name must be 120 characters or fewer.' using errcode = '22023';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = p_obligation_id
    and po.user_id = actor_id
  for update;

  if not found then
    raise exception 'Payment obligation is unavailable.' using errcode = '42501';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = obligation_record.organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Payment obligation is unavailable.' using errcode = '42501';
  end if;

  if obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.available_on > timezone(
      coalesce(obligation_record.billing_timezone, organization_record.billing_timezone),
      clock_timestamp()
    )::date
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null
    or not exists (
      select 1
      from public.organization_members om
      where om.organization_id = obligation_record.organization_id
        and om.user_id = actor_id
        and om.role in (
          'admin'::public.organization_role_enum,
          'member'::public.organization_role_enum
        )
    ) then
    raise exception 'This recurring contribution cannot be claimed.' using errcode = '23514';
  end if;

  select pc.*
  into existing_claim
  from public.payment_claims pc
  where pc.obligation_id = obligation_record.id
    and pc.status = 'under_review'::public.payment_claim_status_enum
  for update;

  if found then
    if existing_claim.payer_type <> (
      case
        when p_paid_by_applicant then 'applicant'::public.payment_claim_payer_type_enum
        else 'other'::public.payment_claim_payer_type_enum
      end
    )
    or existing_claim.payer_name is distinct from (
      case
        when p_paid_by_applicant then null
        else normalized_payer_name
      end
    ) then
      raise exception 'A payment claim is already under review with different payer details.'
        using errcode = '40001';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = existing_claim.id
      and pcae.next_state = 'under_review'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    return query
    select
      existing_claim.id,
      existing_claim.obligation_id,
      existing_claim.payer_type,
      existing_claim.payer_name,
      existing_claim.status,
      existing_claim.created_at,
      audit_record.id;
    return;
  end if;

  if exists (
    select 1
    from public.payment_claims pc
    where pc.obligation_id = obligation_record.id
      and pc.status = 'approved'::public.payment_claim_status_enum
  ) then
    raise exception 'This payment obligation has already been approved.' using errcode = '23514';
  end if;

  insert into public.payment_claims (
    obligation_id,
    organization_id,
    claimant_user_id,
    payer_type,
    payer_name,
    status
  )
  values (
    obligation_record.id,
    obligation_record.organization_id,
    actor_id,
    case
      when p_paid_by_applicant then 'applicant'::public.payment_claim_payer_type_enum
      else 'other'::public.payment_claim_payer_type_enum
    end,
    case when p_paid_by_applicant then null else normalized_payer_name end,
    'under_review'::public.payment_claim_status_enum
  )
  returning * into inserted_claim;

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state
  )
  values (
    obligation_record.organization_id,
    obligation_record.id,
    inserted_claim.id,
    actor_id,
    'payment_available',
    'under_review'
  )
  returning * into audit_record;

  return query
  select
    inserted_claim.id,
    inserted_claim.obligation_id,
    inserted_claim.payer_type,
    inserted_claim.payer_name,
    inserted_claim.status,
    inserted_claim.created_at,
    audit_record.id;
end;
$$;

comment on function public.claim_recurring_payment(uuid, boolean, text) is
  'Records a recurring payment claim only on or after the obligation''s snapshotted local availability date.';

revoke all on function public.claim_recurring_payment(uuid, boolean, text)
  from public, anon;
grant execute on function public.claim_recurring_payment(uuid, boolean, text)
  to authenticated;

-- The local pgTAP runner uses the privileged postgres role for deterministic
-- calendar and generation scenarios. These grants do not expose the helpers
-- to anon/authenticated callers.
grant execute on function public.clamped_billing_date(integer, integer, integer)
  to postgres;
grant execute on function public.first_recurring_due_date(
  date, public.contribution_cadence_enum, integer
) to postgres;
grant execute on function public.next_recurring_due_date(
  date, public.contribution_cadence_enum, integer
) to postgres;
grant execute on function public.recurring_due_date_on_or_after(
  date, public.contribution_cadence_enum, integer, date
) to postgres;
grant execute on function public.recurring_period_key(
  public.contribution_cadence_enum, date
) to postgres;
grant execute on function public.generate_membership_billing_obligations_at(
  timestamp with time zone
) to postgres;
grant execute on function public.reconcile_legacy_payment_obligations(boolean)
  to postgres;
