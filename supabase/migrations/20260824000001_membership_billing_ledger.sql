-- Issue #208: expose one authenticated, organization-scoped Ledger read model.
--
-- Existing initial-admission obligations remain the same source of truth. The
-- recurring schedule extends that table with dated, snapshotted obligations so
-- the member UI never has to infer financial state from subscriptions or
-- legacy payment rows.

do $$
begin
  create type public.contribution_cadence_enum as enum ('monthly', 'annual');
exception
  when duplicate_object then null;
end;
$$;

alter table public.organizations
  add column if not exists billing_timezone text not null default 'America/Sao_Paulo',
  add column if not exists billing_due_day smallint not null default 10,
  add column if not exists billing_lead_days smallint not null default 7;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_billing_timezone_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_billing_timezone_check
      check (nullif(btrim(billing_timezone), '') is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_billing_due_day_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_billing_due_day_check
      check (billing_due_day between 1 and 28);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_billing_lead_days_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_billing_lead_days_check
      check (billing_lead_days between 0 and 31);
  end if;
end;
$$;

comment on column public.organizations.billing_timezone is
  'IANA timezone used when evaluating contribution calendar dates.';
comment on column public.organizations.billing_due_day is
  'Calendar day used for recurring contributions; initially 10 for SL.A.C.';
comment on column public.organizations.billing_lead_days is
  'Number of calendar days before due_on when a recurring obligation becomes available.';

create table if not exists public.contribution_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cadence public.contribution_cadence_enum not null,
  admission_date date not null,
  due_day smallint not null,
  lead_days smallint not null,
  billing_timezone text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (organization_id, user_id),
  check (due_day between 1 and 28),
  check (lead_days between 0 and 31)
);

create table if not exists public.contribution_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.contribution_schedules(id) on delete cascade,
  effective_period_start date not null,
  plan_type public.subscription_plan_type_enum not null,
  amount integer not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (schedule_id, effective_period_start)
);

create index if not exists contribution_schedules_org_user_idx
  on public.contribution_schedules (organization_id, user_id)
  where active;

create index if not exists contribution_plan_assignments_schedule_effective_idx
  on public.contribution_plan_assignments (schedule_id, effective_period_start desc);

alter table public.contribution_schedules enable row level security;
alter table public.contribution_plan_assignments enable row level security;
revoke all on table public.contribution_schedules from public, anon, authenticated;
revoke all on table public.contribution_plan_assignments from public, anon, authenticated;
grant select on table public.contribution_schedules to authenticated;
grant select on table public.contribution_plan_assignments to authenticated;

drop policy if exists "Members and association admins can read schedules"
  on public.contribution_schedules;
create policy "Members and association admins can read schedules"
on public.contribution_schedules
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = contribution_schedules.organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'::public.organization_role_enum
      and o.organization_type = 'association'::public.organization_type_enum
  )
);

drop policy if exists "Members and association admins can read plan snapshots"
  on public.contribution_plan_assignments;
create policy "Members and association admins can read plan snapshots"
on public.contribution_plan_assignments
for select
to authenticated
using (exists (
  select 1
  from public.contribution_schedules cs
  where cs.id = contribution_plan_assignments.schedule_id
    and (
      cs.user_id = (select auth.uid())
      or exists (
        select 1
        from public.organization_members om
        join public.organizations o on o.id = om.organization_id
        where om.organization_id = cs.organization_id
          and om.user_id = (select auth.uid())
          and om.role = 'admin'::public.organization_role_enum
          and o.organization_type = 'association'::public.organization_type_enum
      )
    )
));

alter table public.payment_obligations
  alter column application_revision_id drop not null,
  add column if not exists schedule_id uuid references public.contribution_schedules(id),
  add column if not exists period_key text default 'initial',
  add column if not exists period_start date default current_date,
  add column if not exists period_end date default current_date,
  add column if not exists available_on date default current_date,
  add column if not exists due_on date default current_date;

-- Keep the existing admission-payment commands compatible. They predate the
-- calendar columns and intentionally insert only the obligation snapshot;
-- their defaults are replaced with the real available_at-derived values below
-- for rows already present during this migration.
alter table public.payment_obligations
  alter column period_key set default 'initial',
  alter column period_start set default current_date,
  alter column period_end set default current_date,
  alter column available_on set default current_date,
  alter column due_on set default current_date;

update public.payment_obligations po
set
  period_key = coalesce(po.period_key, 'initial:' || po.id::text),
  period_start = coalesce(
    po.period_start,
    (timezone(o.billing_timezone, po.available_at))::date
  ),
  period_end = coalesce(
    po.period_end,
    (timezone(o.billing_timezone, po.available_at))::date
  ),
  available_on = coalesce(
    po.available_on,
    (timezone(o.billing_timezone, po.available_at))::date
  ),
  due_on = coalesce(
    po.due_on,
    (timezone(o.billing_timezone, po.available_at))::date
  )
from public.organizations o
where o.id = po.organization_id;

alter table public.payment_obligations
  alter column period_key set not null,
  alter column period_start set not null,
  alter column period_end set not null,
  alter column available_on set not null,
  alter column due_on set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_obligations_scope_check'
      and conrelid = 'public.payment_obligations'::regclass
  ) then
    alter table public.payment_obligations
      add constraint payment_obligations_scope_check
      check (
        (
          purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and application_revision_id is not null
          and schedule_id is null
        )
        or (
          purpose = 'recurring'::public.payment_obligation_purpose_enum
          and application_revision_id is null
          and schedule_id is not null
        )
      );
  end if;
end;
$$;

create unique index if not exists payment_obligations_recurring_schedule_period_idx
  on public.payment_obligations (schedule_id, period_key)
  where purpose = 'recurring'::public.payment_obligation_purpose_enum;

create index if not exists payment_obligations_member_due_idx
  on public.payment_obligations (organization_id, user_id, due_on desc, created_at desc, id desc);

create index if not exists payment_obligations_actionable_idx
  on public.payment_obligations (organization_id, user_id, available_on, due_on, created_at, id)
  where status not in (
    'settled'::public.payment_obligation_status_enum,
    'void'::public.payment_obligation_status_enum
  );

create index if not exists payment_claims_obligation_status_idx
  on public.payment_claims (obligation_id, status, created_at desc, id desc);

drop policy if exists "Association admins can read payment obligations"
  on public.payment_obligations;
create policy "Association admins can read payment obligations"
on public.payment_obligations
for select
to authenticated
using (exists (
  select 1
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.organization_id = payment_obligations.organization_id
    and om.user_id = (select auth.uid())
    and om.role = 'admin'::public.organization_role_enum
    and o.organization_type = 'association'::public.organization_type_enum
));

create or replace function public.clamped_billing_date(
  p_year integer,
  p_month integer,
  p_day integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select (
    make_date(p_year, p_month, 1)
      + (
        least(
          p_day,
          extract(day from (
            date_trunc('month', make_date(p_year, p_month, 1))
              + interval '1 month - 1 day'
          ))::integer
        ) - 1
      ) * interval '1 day'
  )::date;
$$;

create or replace function public.first_recurring_due_date(
  p_admission_date date,
  p_cadence public.contribution_cadence_enum,
  p_due_day integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  candidate_month date;
  candidate_due date;
  minimum_due date;
begin
  if p_cadence = 'annual'::public.contribution_cadence_enum then
    return public.clamped_billing_date(
      extract(year from p_admission_date)::integer + 1,
      extract(month from p_admission_date)::integer,
      p_due_day
    );
  end if;

  minimum_due := (p_admission_date + interval '1 month')::date;
  candidate_month := date_trunc('month', minimum_due)::date;
  candidate_due := public.clamped_billing_date(
    extract(year from candidate_month)::integer,
    extract(month from candidate_month)::integer,
    p_due_day
  );

  if candidate_due < minimum_due then
    candidate_month := (candidate_month + interval '1 month')::date;
    candidate_due := public.clamped_billing_date(
      extract(year from candidate_month)::integer,
      extract(month from candidate_month)::integer,
      p_due_day
    );
  end if;

  return candidate_due;
end;
$$;

create or replace function public.next_recurring_due_date(
  p_due_date date,
  p_cadence public.contribution_cadence_enum,
  p_due_day integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_cadence = 'annual'::public.contribution_cadence_enum then
      public.clamped_billing_date(
        extract(year from p_due_date)::integer + 1,
        extract(month from p_due_date)::integer,
        p_due_day
      )
    else public.clamped_billing_date(
      extract(year from (p_due_date + interval '1 month'))::integer,
      extract(month from (p_due_date + interval '1 month'))::integer,
      p_due_day
    )
  end;
$$;

revoke all on function public.clamped_billing_date(integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.first_recurring_due_date(
  date, public.contribution_cadence_enum, integer
) from public, anon, authenticated;
revoke all on function public.next_recurring_due_date(
  date, public.contribution_cadence_enum, integer
) from public, anon, authenticated;

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
  assignment_effective_date date;
begin
  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    return null;
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
    return null;
  end if;

  admission_date_value := coalesce(
    p_admission_date,
    (
      select timezone(organization_record.billing_timezone, om.joined_at)::date
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = p_user_id
    ),
    timezone(organization_record.billing_timezone, timezone('utc'::text, now()))::date
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
  set
    cadence = excluded.cadence,
    due_day = excluded.due_day,
    lead_days = excluded.lead_days,
    billing_timezone = excluded.billing_timezone,
    currency = excluded.currency,
    active = true
  returning * into schedule_record;

  if schedule_record.id is null then
    select cs.*
    into schedule_record
    from public.contribution_schedules cs
    where cs.organization_id = p_organization_id
      and cs.user_id = p_user_id
    for update;
  end if;

  assignment_effective_date := greatest(
    schedule_record.admission_date,
    timezone(
      schedule_record.billing_timezone,
      timezone('utc'::text, now())
    )::date
  );

  insert into public.contribution_plan_assignments (
    schedule_id,
    effective_period_start,
    plan_type,
    amount,
    currency
  )
  values (
    schedule_record.id,
    assignment_effective_date,
    subscription_record.plan_type,
    amount_value,
    organization_record.billing_currency
  )
  on conflict (schedule_id, effective_period_start) do update
  set
    plan_type = excluded.plan_type,
    amount = excluded.amount,
    currency = excluded.currency;

  return schedule_record.id;
end;
$$;

revoke all on function public.ensure_contribution_schedule(uuid, uuid, date)
  from public, anon, authenticated;

create or replace function public.sync_contribution_schedule_on_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role in (
    'admin'::public.organization_role_enum,
    'member'::public.organization_role_enum
  ) then
    perform public.ensure_contribution_schedule(new.organization_id, new.user_id, null);
  end if;

  return new;
end;
$$;

revoke all on function public.sync_contribution_schedule_on_membership()
  from public, anon, authenticated;

drop trigger if exists organization_members_sync_contribution_schedule
  on public.organization_members;
create trigger organization_members_sync_contribution_schedule
after insert or update of role on public.organization_members
for each row
execute function public.sync_contribution_schedule_on_membership();

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
after insert or update of status, plan_type on public.subscriptions
for each row
execute function public.sync_contribution_schedule_on_subscription();

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
select
  om.organization_id,
  om.user_id,
  case
    when s.plan_type = 'annual'::public.subscription_plan_type_enum
      then 'annual'::public.contribution_cadence_enum
    else 'monthly'::public.contribution_cadence_enum
  end,
  timezone(o.billing_timezone, om.joined_at)::date,
  o.billing_due_day,
  o.billing_lead_days,
  o.billing_timezone,
  o.billing_currency,
  true
from public.organization_members om
join public.organizations o on o.id = om.organization_id
join public.subscriptions s
  on s.organization_id = om.organization_id
  and s.user_id = om.user_id
where o.organization_type = 'association'::public.organization_type_enum
  and s.status = 'active'::public.subscription_status_enum
on conflict (organization_id, user_id) do nothing;

insert into public.contribution_plan_assignments (
  schedule_id,
  effective_period_start,
  plan_type,
  amount,
  currency
)
select
  cs.id,
  cs.admission_date,
  s.plan_type,
  case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end,
  o.billing_currency
from public.contribution_schedules cs
join public.organizations o on o.id = cs.organization_id
join public.subscriptions s
  on s.organization_id = cs.organization_id
  and s.user_id = cs.user_id
where cs.active
  and case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end > 0
on conflict (schedule_id, effective_period_start) do nothing;

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_record record;
  assignment_record public.contribution_plan_assignments%rowtype;
  organization_record public.organizations%rowtype;
  created_obligation public.payment_obligations%rowtype;
  existing_obligation public.payment_obligations%rowtype;
  evaluated_at timestamp with time zone := coalesce(
    p_as_of,
    timezone('utc'::text, clock_timestamp())
  );
  local_date_value date;
  due_date_value date;
  next_due_date_value date;
  period_start_value date;
  period_end_value date;
  available_on_value date;
  period_key_value text;
  pix_value text;
begin
  for schedule_record in
    select cs.*, o.name as organization_name
    from public.contribution_schedules cs
    join public.organizations o on o.id = cs.organization_id
    join public.organization_members om
      on om.organization_id = cs.organization_id
      and om.user_id = cs.user_id
    where cs.active
      and o.organization_type = 'association'::public.organization_type_enum
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )
    order by cs.organization_id, cs.user_id
  loop
    select o.*
    into organization_record
    from public.organizations o
    where o.id = schedule_record.organization_id;

    local_date_value := timezone(schedule_record.billing_timezone, evaluated_at)::date;
    due_date_value := public.first_recurring_due_date(
      schedule_record.admission_date,
      schedule_record.cadence,
      schedule_record.due_day
    );

    while due_date_value - schedule_record.lead_days <= local_date_value loop
      period_start_value := case
        when schedule_record.cadence = 'annual'::public.contribution_cadence_enum
          then due_date_value
        else date_trunc('month', due_date_value)::date
      end;
      next_due_date_value := public.next_recurring_due_date(
        due_date_value,
        schedule_record.cadence,
        schedule_record.due_day
      );
      period_end_value := next_due_date_value - 1;
      available_on_value := due_date_value - schedule_record.lead_days;
      period_key_value := to_char(due_date_value, 'YYYY-MM');

      select cpa.*
      into assignment_record
      from public.contribution_plan_assignments cpa
      where cpa.schedule_id = schedule_record.id
        and cpa.effective_period_start <= period_start_value
      order by cpa.effective_period_start desc
      limit 1;

      if not found then
        schedule_id := schedule_record.id;
        period_key := period_key_value;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'No price snapshot exists for the recurring period.';
        return next;
        exit;
      end if;

      pix_value := case assignment_record.plan_type
        when 'annual'::public.subscription_plan_type_enum
          then organization_record.annual_pix_copy_paste
        else organization_record.monthly_pix_copy_paste
      end;

      if nullif(btrim(pix_value), '') is null then
        schedule_id := schedule_record.id;
        period_key := period_key_value;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'No PIX configuration exists for the recurring period.';
        return next;
        exit;
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
        period_key,
        period_start,
        period_end,
        available_on,
        due_on
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
        pix_value,
        available_on_value::timestamp at time zone schedule_record.billing_timezone,
        schedule_record.id,
        period_key_value,
        period_start_value,
        period_end_value,
        available_on_value,
        due_date_value
      )
      on conflict (schedule_id, period_key)
        where purpose = 'recurring'::public.payment_obligation_purpose_enum
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

      -- Reconcile matching legacy succeeded rows without changing their
      -- historical amount or creating a second payment record.
      update public.payment_obligations po
      set
        status = 'settled'::public.payment_obligation_status_enum,
        legacy_payment_id = p.id,
        settled_at = coalesce(p.paid_at, p.created_at)
      from public.payments p
      where po.id = existing_obligation.id
        and p.organization_id = po.organization_id
        and p.user_id = po.user_id
        and p.status = 'succeeded'::public.payment_status_enum
        and p.amount = po.amount
        and timezone(schedule_record.billing_timezone, coalesce(p.paid_at, p.created_at))::date
          between po.period_start and po.period_end
        and p.id = (
          select matching_payment.id
          from public.payments matching_payment
          where matching_payment.organization_id = po.organization_id
            and matching_payment.user_id = po.user_id
            and matching_payment.status = 'succeeded'::public.payment_status_enum
            and matching_payment.amount = po.amount
            and timezone(
              schedule_record.billing_timezone,
              coalesce(matching_payment.paid_at, matching_payment.created_at)
            )::date between po.period_start and po.period_end
            and not exists (
              select 1
              from public.payment_obligations linked_obligation
              where linked_obligation.legacy_payment_id = matching_payment.id
                and linked_obligation.id <> po.id
            )
          order by
            coalesce(matching_payment.paid_at, matching_payment.created_at),
            matching_payment.id
          limit 1
        );

      schedule_id := schedule_record.id;
      period_key := period_key_value;
      obligation_id := existing_obligation.id;
      result := case when created_obligation.id is null then 'already_exists' else 'created' end;
      failure_reason := null;
      return next;

      due_date_value := next_due_date_value;
    end loop;
  end loop;
end;
$$;

revoke all on function public.generate_membership_billing_obligations(timestamp with time zone)
  from public, anon, authenticated;
grant execute on function public.generate_membership_billing_obligations(timestamp with time zone)
  to service_role;

-- Materialize existing active members and any periods already available on the
-- first deployment. Later runs are idempotent and can be scheduled by the
-- existing Supabase cron/Edge Function setup.
do $$
begin
  perform public.generate_membership_billing_obligations(
    timezone('utc'::text, clock_timestamp())
  );
end;
$$;

drop function if exists public.get_membership_billing_ledger(uuid);
drop function if exists public.get_membership_billing_ledger(uuid, text, integer);

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
  evaluated_at_value timestamp with time zone := timezone('utc'::text, clock_timestamp());
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
  next_due_date_value date;
  next_period_start_value date;
  next_assignment record;
  latest_due_date date;
  member_exists boolean;
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

  if not member_exists and not found then
    raise exception 'Membership Ledger was not found.' using errcode = '42501';
  end if;

  local_date_value := timezone(organization_record.billing_timezone, evaluated_at_value)::date;
  legal_state := case when member_exists then 'active' else 'applicant' end;

  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.organization_id = p_organization_id
    and cs.user_id = actor_id
    and cs.active
  order by cs.id
  limit 1;

  select case
    when schedule_record.cadence = 'annual'::public.contribution_cadence_enum
      then 'annual'::public.subscription_plan_type_enum
    when schedule_record.cadence = 'monthly'::public.contribution_cadence_enum
      then 'monthly'::public.subscription_plan_type_enum
    else null
  end
  into plan_type_value;

  if plan_type_value is null then
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
      and po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.due_on < local_date_value
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
      and po.available_on <= local_date_value
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
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < local_date_value then 'overdue'
      when po.available_on <= local_date_value then 'available'
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
        when po.available_on <= local_date_value then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.schedule_id = schedule_record.id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.due_on > local_date_value
    order by po.due_on asc, po.created_at asc, po.id asc
    limit 1;

    if next_obligation is null then
      select max(po.due_on)
      into latest_due_date
      from public.payment_obligations po
      where po.schedule_id = schedule_record.id;

      next_due_date_value := case
        when latest_due_date is null then public.first_recurring_due_date(
          schedule_record.admission_date,
          schedule_record.cadence,
          schedule_record.due_day
        )
        else public.next_recurring_due_date(
          latest_due_date,
          schedule_record.cadence,
          schedule_record.due_day
        )
      end;
      next_period_start_value := case
        when schedule_record.cadence = 'annual'::public.contribution_cadence_enum
          then next_due_date_value
        else date_trunc('month', next_due_date_value)::date
      end;

      select cpa.plan_type, cpa.amount, cpa.currency
      into next_assignment
      from public.contribution_plan_assignments cpa
      where cpa.schedule_id = schedule_record.id
        and cpa.effective_period_start <= next_period_start_value
      order by cpa.effective_period_start desc
      limit 1;

      if found and next_assignment.amount is not null then
        next_obligation := jsonb_build_object(
          'obligation_id', null,
          'purpose', 'recurring',
          'status', 'scheduled',
          'period_key', to_char(next_due_date_value, 'YYYY-MM'),
          'period_start', next_period_start_value,
          'period_end', public.next_recurring_due_date(
            next_due_date_value,
            schedule_record.cadence,
            schedule_record.due_day
          ) - 1,
          'available_on', next_due_date_value - schedule_record.lead_days,
          'due_on', next_due_date_value,
          'amount', next_assignment.amount,
          'currency', next_assignment.currency,
          'action', null
        );
      end if;
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
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.due_on < local_date_value then 'overdue'
        when po.available_on <= local_date_value then 'available'
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
    'application_status', application_record.status,
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
  'Returns the signed-in person''s private, organization-scoped membership and contribution Ledger. The server derives the person and effective states.';

revoke all on function public.get_membership_billing_ledger(uuid, text, integer)
  from public, anon;
grant execute on function public.get_membership_billing_ledger(uuid, text, integer)
  to authenticated;

drop function if exists public.get_payment_obligation_instructions(uuid);

create function public.get_payment_obligation_instructions(
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
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(o.billing_timezone, timezone('utc'::text, now()))::date
        then 'overdue'
      when po.available_on <= timezone(o.billing_timezone, timezone('utc'::text, now()))::date
        then 'available'
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
  'Returns authoritative PIX instructions, calendar dates, and the signed-in owner''s latest claim for one obligation.';

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
    btrim(regexp_replace(coalesce(p_payer_name, ''), '\s+', ' ', 'g')),
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
      organization_record.billing_timezone,
      timezone('utc'::text, now())
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
  'Atomically records one authenticated member claim for an available recurring manual-PIX obligation without settling it.';

revoke all on function public.claim_recurring_payment(uuid, boolean, text)
  from public, anon;
grant execute on function public.claim_recurring_payment(uuid, boolean, text)
  to authenticated;

create or replace function public.approve_recurring_payment_claim(
  p_claim_id uuid
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  claim_status public.payment_claim_status_enum,
  obligation_status public.payment_obligation_status_enum,
  audit_event_id uuid,
  decision_applied_now boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  claim_record public.payment_claims%rowtype;
  obligation_record public.payment_obligations%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select pc.*
  into claim_record
  from public.payment_claims pc
  where pc.id = p_claim_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.' using errcode = '42501';
  end if;

  if claim_record.claimant_user_id = actor_id
    or not exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = claim_record.organization_id
        and om.user_id = actor_id
        and om.role = 'admin'::public.organization_role_enum
        and o.organization_type = 'association'::public.organization_type_enum
    ) then
    raise exception 'Association admin access is required.' using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found
    or obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum then
    raise exception 'This claim is not a recurring contribution claim.' using errcode = '40001';
  end if;

  if claim_record.status = 'approved'::public.payment_claim_status_enum then
    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_settled'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum then
    raise exception 'This claim is no longer actionable. Refresh before deciding.'
      using errcode = '40001';
  end if;

  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'approved'::public.payment_claim_status_enum,
    decided_at = timezone('utc'::text, clock_timestamp()),
    decision_reason = null
  where pc.id = claim_record.id;

  update public.payment_obligations po
  set
    status = 'settled'::public.payment_obligation_status_enum,
    settled_at = timezone('utc'::text, clock_timestamp())
  where po.id = obligation_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason
  )
  values (
    claim_record.organization_id,
    claim_record.obligation_id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_settled',
    null
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'approved'::public.payment_claim_status_enum,
    'settled'::public.payment_obligation_status_enum,
    audit_record.id,
    true;
end;
$$;

comment on function public.approve_recurring_payment_claim(uuid) is
  'Atomically verifies a recurring contribution claim and settles only that obligation.';

revoke all on function public.approve_recurring_payment_claim(uuid)
  from public, anon;
grant execute on function public.approve_recurring_payment_claim(uuid)
  to authenticated;

create or replace function public.reject_recurring_payment_claim(
  p_claim_id uuid,
  p_reason text
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  claim_status public.payment_claim_status_enum,
  obligation_status public.payment_obligation_status_enum,
  decision_reason text,
  audit_event_id uuid,
  decision_applied_now boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  claim_record public.payment_claims%rowtype;
  obligation_record public.payment_obligations%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  normalized_reason text := nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if normalized_reason is null then
    raise exception 'A rejection reason is required.' using errcode = '22023';
  end if;

  if char_length(normalized_reason) > 500 then
    raise exception 'The rejection reason must be 500 characters or fewer.'
      using errcode = '22023';
  end if;

  select pc.*
  into claim_record
  from public.payment_claims pc
  where pc.id = p_claim_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.' using errcode = '42501';
  end if;

  if claim_record.claimant_user_id = actor_id
    or not exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = claim_record.organization_id
        and om.user_id = actor_id
        and om.role = 'admin'::public.organization_role_enum
        and o.organization_type = 'association'::public.organization_type_enum
    ) then
    raise exception 'Association admin access is required.' using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found
    or obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum then
    raise exception 'This claim is not a recurring contribution claim.' using errcode = '40001';
  end if;

  if claim_record.status = 'rejected'::public.payment_claim_status_enum then
    if claim_record.decision_reason is distinct from normalized_reason then
      raise exception 'This claim was already rejected with a different reason. Refresh before deciding.'
        using errcode = '40001';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_available'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      claim_record.decision_reason,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum then
    raise exception 'This claim is no longer actionable. Refresh before deciding.'
      using errcode = '40001';
  end if;

  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'rejected'::public.payment_claim_status_enum,
    decided_at = timezone('utc'::text, clock_timestamp()),
    decision_reason = normalized_reason
  where pc.id = claim_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason
  )
  values (
    claim_record.organization_id,
    claim_record.obligation_id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_available',
    normalized_reason
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'rejected'::public.payment_claim_status_enum,
    obligation_record.status,
    normalized_reason,
    audit_record.id,
    true;
end;
$$;

comment on function public.reject_recurring_payment_claim(uuid, text) is
  'Rejects one recurring contribution claim, preserves its evidence, and leaves the obligation available for another claim.';

revoke all on function public.reject_recurring_payment_claim(uuid, text)
  from public, anon;
grant execute on function public.reject_recurring_payment_claim(uuid, text)
  to authenticated;

-- The read model and recurring claim commands are the only public boundaries;
-- raw recurring writes remain unavailable to client roles.
revoke insert, update, delete on table public.contribution_schedules
  from anon, authenticated;
revoke insert, update, delete on table public.contribution_plan_assignments
  from anon, authenticated;
revoke insert, update, delete on table public.payment_obligations
  from anon, authenticated;
