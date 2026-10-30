begin;

select * from no_plan();

-- Regression: production had an active monthly schedule admitted on
-- 2026-07-20 (due day 10) and, by 2026-10-30, zero recurring obligations. The
-- generator worked when called, but nothing called it: the cutover installed
-- the scheduler "paused" and no migration ever scheduled it. With no rows the
-- Ledger read "up to date" and projected the next charge (Nov 10) as if Sep 10
-- and Oct 10 had never been owed.
--
-- The fixture mirrors that shape relative to the database clock, so the test
-- stays meaningful whatever day it runs on.

set local role postgres;

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
  '83000000-0000-4000-8000-000000000001'::uuid,
  'Generation Job Association',
  'generation-job-association',
  'association'::public.organization_type_enum,
  'BRL',
  'America/Sao_Paulo',
  10,
  7,
  2500,
  25000,
  '000201generation-monthly',
  '000201generation-annual'
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
values (
  '83000000-0000-4000-8000-000000000101'::uuid,
  'authenticated',
  'authenticated',
  'generation-admin@example.com',
  timezone('utc'::text, now()),
  '{"full_name":"Generation Admin"}'::jsonb,
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
);

insert into public.profiles (id, name, username)
values (
  '83000000-0000-4000-8000-000000000101'::uuid,
  'Generation Admin',
  '@generation_admin'
)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (organization_id, user_id, role)
values (
  '83000000-0000-4000-8000-000000000001'::uuid,
  '83000000-0000-4000-8000-000000000101'::uuid,
  'admin'::public.organization_role_enum
);

-- Admitted a little over three months ago, so at least two fixed-day periods
-- are already past due.
select public.ensure_contribution_schedule(
  '83000000-0000-4000-8000-000000000001'::uuid,
  '83000000-0000-4000-8000-000000000101'::uuid,
  'monthly'::public.subscription_plan_type_enum,
  (timezone('America/Sao_Paulo', clock_timestamp())::date - 102)
);

-- The scheduler contract. pg_cron runs the stored command as the job owner;
-- the job must exist, be active, and call the trusted generator.
select is(
  (select count(*)::integer
   from cron.job
   where jobname = 'membership-billing-generate-obligations'
     and active
     and command ~ 'public\.generate_membership_billing_obligations\(\)'),
  1,
  'an active pg_cron job materializes recurring obligations'
);

select is(
  (select schedule
   from cron.job
   where jobname = 'membership-billing-generate-obligations'),
  '17 * * * *',
  'the generator runs hourly, so a local-midnight availability lags at most an hour'
);

select is(
  (select count(*)::integer
   from cron.job
   where command ~ 'generate-renewal-payments'
      or jobname in ('daily-renewal-check', 'membership-billing-obligation-generator')),
  0,
  'the retired Edge Function schedulers stay retired'
);

-- Before the scheduler runs, the database holds nothing for these periods:
-- this is exactly the state production was stuck in.
select is(
  (select count(*)::integer
   from public.payment_obligations
   where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum),
  0,
  'no recurring obligation exists until the generator runs'
);

-- Run the scheduled command exactly as pg_cron stores it.
do $$
begin
  execute (
    select command
    from cron.job
    where jobname = 'membership-billing-generate-obligations'
  );
end;
$$;

select ok(
  (select count(*)
   from public.payment_obligations
   where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum
     and due_on < timezone('America/Sao_Paulo', clock_timestamp())::date) >= 2,
  'one scheduler run catches up every missed fixed-day period since admission'
);

select is(
  (select count(*)::integer
   from public.payment_obligations
   where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum
     and status <> 'available'::public.payment_obligation_status_enum),
  0,
  'caught-up periods are owed, never silently settled or voided'
);

select is(
  (select count(*)::integer
   from public.payment_obligations
   where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum
     and available_on > timezone('America/Sao_Paulo', clock_timestamp())::date),
  0,
  'nothing is materialized before its availability date'
);

create temporary table generated_before_rerun on commit drop as
select id
from public.payment_obligations
where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
  and purpose = 'recurring'::public.payment_obligation_purpose_enum;

do $$
begin
  execute (
    select command
    from cron.job
    where jobname = 'membership-billing-generate-obligations'
  );
end;
$$;

select is(
  (select count(*)::integer
   from public.payment_obligations
   where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and purpose = 'recurring'::public.payment_obligation_purpose_enum
     and id not in (select id from generated_before_rerun)),
  0,
  'a second scheduler run is idempotent'
);

select is(
  (select count(*)::integer
   from public.notifications
   where user_id = '83000000-0000-4000-8000-000000000101'::uuid),
  0,
  'materializing obligations sends no push notification'
);

-- The member's own Ledger now tells the truth about the missed months.
create temporary table expected_attention on commit drop as
select min(po.due_on) as due_on
from public.payment_obligations po
where po.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
  and po.purpose = 'recurring'::public.payment_obligation_purpose_enum;
grant select on expected_attention to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000101',
  true
);

select is(
  public.get_membership_billing_ledger(
    '83000000-0000-4000-8000-000000000001'::uuid,
    null,
    10
  )->>'financial_standing',
  'overdue',
  'a member with missed periods is overdue, not up to date'
);

select is(
  public.get_membership_billing_ledger(
    '83000000-0000-4000-8000-000000000001'::uuid,
    null,
    10
  )->>'legal_membership_state',
  'active',
  'financial debt does not change the legal membership state'
);

select is(
  (public.get_membership_billing_ledger(
    '83000000-0000-4000-8000-000000000001'::uuid,
    null,
    10
  )->'attention_obligation'->>'due_on')::date,
  (select due_on from expected_attention),
  'the oldest missed period is the one that needs attention'
);

select * from finish();

rollback;
