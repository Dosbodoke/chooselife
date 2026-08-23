begin;

select * from no_plan();

select is(
  public.first_recurring_due_date(
    '2026-01-09'::date,
    'monthly'::public.contribution_cadence_enum,
    10
  ),
  '2026-02-10'::date,
  'monthly admission on January 9 first becomes due on February 10'
);

select is(
  public.first_recurring_due_date(
    '2026-01-10'::date,
    'monthly'::public.contribution_cadence_enum,
    10
  ),
  '2026-02-10'::date,
  'monthly admission on January 10 first becomes due on February 10'
);

select is(
  public.first_recurring_due_date(
    '2026-01-11'::date,
    'monthly'::public.contribution_cadence_enum,
    10
  ),
  '2026-03-10'::date,
  'monthly admission on January 11 waits for the following fixed-day period'
);

select is(
  public.clamped_billing_date(2024, 2, 31),
  '2024-02-29'::date,
  'day 31 clamps to leap-day February'
);

select is(
  public.clamped_billing_date(2025, 2, 31),
  '2025-02-28'::date,
  'day 31 clamps to non-leap February'
);

select is(
  public.next_recurring_due_date(
    '2025-02-28'::date,
    'monthly'::public.contribution_cadence_enum,
    31
  ),
  '2025-03-31'::date,
  'a clamped February period returns to day 31 in March'
);

select is(
  public.first_recurring_due_date(
    '2024-02-29'::date,
    'annual'::public.contribution_cadence_enum,
    10
  ),
  '2025-02-10'::date,
  'annual admission uses the next anniversary year'
);

insert into public.organizations (
  id,
  name,
  slug,
  organization_type,
  billing_currency,
  billing_timezone,
  billing_due_day,
  billing_lead_days,
  monthly_price_amount,
  annual_price_amount,
  monthly_pix_copy_paste,
  annual_pix_copy_paste
)
values (
  '82000000-0000-4000-8000-000000000001'::uuid,
  'Fixed Day Association',
  'fixed-day-association',
  'association'::public.organization_type_enum,
  'BRL',
  'UTC',
  31,
  7,
  12500,
  36000,
  '000201fixed-monthly-pix',
  '000201fixed-annual-pix'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '82000000-0000-4000-8000-000000000101'::uuid,
    'authenticated',
    'authenticated',
    'fixed-day-member@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Fixed Day Member"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '82000000-0000-4000-8000-000000000102'::uuid,
    'authenticated',
    'authenticated',
    'fixed-day-invalid@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Fixed Day Invalid"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

insert into public.profiles (id, name, username)
values
  (
    '82000000-0000-4000-8000-000000000101'::uuid,
    'Fixed Day Member',
    '@fixed_day_member'
  ),
  (
    '82000000-0000-4000-8000-000000000102'::uuid,
    'Fixed Day Invalid',
    '@fixed_day_invalid'
  )
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  joined_at
)
values
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000101'::uuid,
    'member'::public.organization_role_enum,
    '2026-01-09 12:00:00+00'
  ),
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000102'::uuid,
    'member'::public.organization_role_enum,
    '2026-01-09 12:00:00+00'
  );

insert into public.subscriptions (
  organization_id,
  user_id,
  plan_type,
  status,
  current_period_end
)
values
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000101'::uuid,
    'monthly'::public.subscription_plan_type_enum,
    'active'::public.subscription_status_enum,
    '2026-02-09 00:00:00+00'
  ),
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000102'::uuid,
    'monthly'::public.subscription_plan_type_enum,
    'active'::public.subscription_status_enum,
    '2026-02-09 00:00:00+00'
  );

select is(
  (select admission_date from public.contribution_schedules
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid),
  '2026-01-09'::date,
  'the schedule keeps the verified admission anchor'
);

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
select
  cs.id,
  '2026-03-31'::date,
  'annual'::public.subscription_plan_type_enum,
  36000,
  'BRL',
  31,
  7,
  'UTC',
  '000201fixed-annual-pix'
from public.contribution_schedules cs
where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
  and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid;

select is(
  (select count(*)::integer
   from public.contribution_plan_assignments cpa
   join public.contribution_schedules cs on cs.id = cpa.schedule_id
   where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid),
  2,
  'the member has an immutable initial term and one future term'
);

select is(
  (select count(*)::integer
   from public.generate_membership_billing_obligations_at(
     '2026-02-22 12:00:00+00'::timestamp with time zone
   )
   where schedule_id = (
     select cs.id
     from public.contribution_schedules cs
     where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
       and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid
   )
     and result = 'created'),
  1,
  'the generator materializes the first available fixed-day period'
);

select is(
  (select count(*)::integer
   from public.payment_obligations
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum),
  1,
  'one recurring obligation exists after the first generation'
);

select is(
  (select period_key
   from public.payment_obligations
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum),
  'monthly:2026-02-28',
  'the recurring period identity includes cadence and due date'
);

select is(
  (select period_start
   from public.payment_obligations
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum),
  '2026-02-28'::date,
  'period start is the due-date boundary and does not overlap the next period'
);

select is(
  (select period_end
   from public.payment_obligations
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum),
  '2026-03-30'::date,
  'period end is the day before the next fixed-day boundary'
);

select is(
  (select available_on
   from public.payment_obligations
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum),
  '2026-02-21'::date,
  'availability is exactly the configured lead days before due'
);

select is(
  (select count(*)::integer
   from public.generate_membership_billing_obligations_at(
     '2026-02-22 12:00:00+00'::timestamp with time zone
   )
   where schedule_id = (
     select cs.id
     from public.contribution_schedules cs
     where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
       and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid
   )
     and result = 'already_exists'),
  1,
  'repeating generation is idempotent'
);

select is(
  (select count(*)::integer
   from public.generate_membership_billing_obligations_at(
     '2027-01-25 12:00:00+00'::timestamp with time zone
   )
   where schedule_id = (
     select cs.id
     from public.contribution_schedules cs
     where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
       and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid
   )
     and result = 'created'),
  1,
  'a future annual term eventually materializes its anniversary period'
);

select is(
  (select period_key
   from public.payment_obligations
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and plan_type = 'annual'::public.subscription_plan_type_enum),
  'annual:2027-01-31',
  'annual periods remain anniversary anchored after a future plan change'
);

select throws_ok(
  $$update public.contribution_schedules
    set due_day = 10
    where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
      and user_id = '82000000-0000-4000-8000-000000000101'::uuid$$,
  '55000',
  'Contribution schedule policy is immutable; append an effective-dated term.',
  'the original schedule policy cannot drift after admission'
);

select throws_ok(
  $$update public.contribution_plan_assignments
    set amount = 1
    where schedule_id = (
      select cs.id
      from public.contribution_schedules cs
      where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
        and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid
    )
      and effective_period_start = '2026-01-09'::date$$,
  '55000',
  'An effective-dated contribution term is immutable; append a new term.',
  'effective-dated plan snapshots cannot be rewritten'
);

update public.organizations
set
  billing_timezone = 'America/Sao_Paulo',
  billing_due_day = 10,
  billing_lead_days = 3,
  monthly_price_amount = 1,
  monthly_pix_copy_paste = '000201changed-policy-pix'
where id = '82000000-0000-4000-8000-000000000001'::uuid;

select is(
  (select billing_timezone
   from public.payment_obligations
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and period_key = 'monthly:2026-02-28'),
  'UTC',
  'existing obligations keep their original timezone snapshot'
);

select is(
  (select amount
   from public.payment_obligations
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and period_key = 'monthly:2026-02-28'),
  12500,
  'existing obligations keep their original price snapshot'
);

select throws_ok(
  $$update public.payment_obligations
    set amount = 1
    where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
      and user_id = '82000000-0000-4000-8000-000000000101'::uuid
      and period_key = 'monthly:2026-02-28'$$,
  '55000',
  'Payment obligation billing context is immutable.',
  'materialized obligation context cannot be rewritten'
);

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
select
  cs.id,
  '2026-02-28'::date,
  'annual'::public.subscription_plan_type_enum,
  36000,
  'BRL',
  31,
  7,
  'UTC',
  null
from public.contribution_schedules cs
where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
  and cs.user_id = '82000000-0000-4000-8000-000000000102'::uuid;

select is(
  (select count(*)::integer
   from public.generate_membership_billing_obligations_at(
     '2027-02-22 12:00:00+00'::timestamp with time zone
   )
   where schedule_id = (
     select cs.id
     from public.contribution_schedules cs
     where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
       and cs.user_id = '82000000-0000-4000-8000-000000000102'::uuid
   )
     and result = 'failed'),
  1,
  'an invalid member term is an operational failure and does not abort valid schedules'
);

select throws_ok(
  $$update public.organizations
    set billing_timezone = 'Mars/Olympus'
    where id = '82000000-0000-4000-8000-000000000001'::uuid$$,
  '22023',
  'Billing timezone must be a valid IANA timezone name.',
  'invalid IANA timezones are rejected by the database policy boundary'
);

insert into public.payments (
  id,
  organization_id,
  user_id,
  subscription_id,
  amount,
  status,
  created_at
)
select
  '82000000-0000-4000-8000-000000000401'::uuid,
  '82000000-0000-4000-8000-000000000001'::uuid,
  '82000000-0000-4000-8000-000000000101'::uuid,
  s.id,
  36000,
  'pending'::public.payment_status_enum,
  '2027-01-31 12:00:00+00'
from public.subscriptions s
where s.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
  and s.user_id = '82000000-0000-4000-8000-000000000101'::uuid;

select is(
  (select result
   from public.reconcile_legacy_payment_obligations(false)
   where payment_id = '82000000-0000-4000-8000-000000000401'::uuid),
  'ready',
  'legacy pending payments produce a reviewed dry-run mapping'
);

select is(
  (select result
   from public.reconcile_legacy_payment_obligations(true)
   where payment_id = '82000000-0000-4000-8000-000000000401'::uuid),
  'linked',
  'only an unambiguous legacy mapping is applied'
);

select is(
  (select status
   from public.payment_obligations
   where legacy_payment_id = '82000000-0000-4000-8000-000000000401'::uuid),
  'available'::public.payment_obligation_status_enum,
  'a pending legacy payment is linked without being falsely settled'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000101',
  true
);

select throws_ok(
  $$update public.subscriptions
    set plan_type = 'annual'::public.subscription_plan_type_enum
    where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
      and user_id = '82000000-0000-4000-8000-000000000101'::uuid$$,
  '42501',
  'permission denied for table subscriptions',
  'authenticated members cannot mutate the recurring billing source'
);

select * from finish();
rollback;
