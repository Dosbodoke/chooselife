begin;

select * from no_plan();

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
  monthly_pix_copy_paste
)
values
  (
    '81000000-0000-4000-8000-000000000001'::uuid,
    'Ledger Association',
    'ledger-association',
    'association',
    'BRL',
    'America/Sao_Paulo',
    10,
    7,
    12500,
    '000201ledger-test-pix'
  ),
  (
    '81000000-0000-4000-8000-000000000002'::uuid,
    'Private Association',
    'private-association',
    'association',
    'BRL',
    'America/Sao_Paulo',
    10,
    7,
    12500,
    '000201private-test-pix'
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
    '81000000-0000-4000-8000-000000000101'::uuid,
    'authenticated',
    'authenticated',
    'ledger-overdue@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Ledger Overdue"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '81000000-0000-4000-8000-000000000102'::uuid,
    'authenticated',
    'authenticated',
    'ledger-available@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Ledger Available"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '81000000-0000-4000-8000-000000000103'::uuid,
    'authenticated',
    'authenticated',
    'ledger-review@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Ledger Review"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '81000000-0000-4000-8000-000000000104'::uuid,
    'authenticated',
    'authenticated',
    'ledger-current@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Ledger Current"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

insert into public.profiles (id, name, username)
values
  (
    '81000000-0000-4000-8000-000000000101'::uuid,
    'Ledger Overdue',
    '@ledger_overdue'
  ),
  (
    '81000000-0000-4000-8000-000000000102'::uuid,
    'Ledger Available',
    '@ledger_available'
  ),
  (
    '81000000-0000-4000-8000-000000000103'::uuid,
    'Ledger Review',
    '@ledger_review'
  ),
  (
    '81000000-0000-4000-8000-000000000104'::uuid,
    'Ledger Current',
    '@ledger_current'
  )
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (organization_id, user_id, role)
select
  '81000000-0000-4000-8000-000000000001'::uuid,
  user_id,
  'member'::public.organization_role_enum
from unnest(
  array[
    '81000000-0000-4000-8000-000000000101'::uuid,
    '81000000-0000-4000-8000-000000000102'::uuid,
    '81000000-0000-4000-8000-000000000103'::uuid,
    '81000000-0000-4000-8000-000000000104'::uuid
  ]
) as members(user_id);

-- Admission opens the schedule and snapshots the plan the applicant chose.
-- There is no subscription row behind a membership any more, and no trigger on
-- organization_members either.
select public.ensure_contribution_schedule(
  '81000000-0000-4000-8000-000000000001'::uuid,
  members.user_id,
  'monthly'::public.subscription_plan_type_enum
)
from unnest(
  array[
    '81000000-0000-4000-8000-000000000101'::uuid,
    '81000000-0000-4000-8000-000000000102'::uuid,
    '81000000-0000-4000-8000-000000000103'::uuid,
    '81000000-0000-4000-8000-000000000104'::uuid
  ]
) as members(user_id);

select is(
  (select count(*)::integer
   from public.contribution_schedules
   where organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and active),
  4,
  'admission opens exactly one active contribution schedule per member'
);

select is(
  (select count(*)::integer
   from public.contribution_plan_assignments cpa
   join public.contribution_schedules cs on cs.id = cpa.schedule_id
   where cs.organization_id = '81000000-0000-4000-8000-000000000001'::uuid),
  4,
  'admission snapshots the selected plan and amount'
);

insert into public.payment_obligations (
  id,
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
select
  obligation.id,
  '81000000-0000-4000-8000-000000000001'::uuid,
  obligation.user_id,
  null,
  'recurring'::public.payment_obligation_purpose_enum,
  'available'::public.payment_obligation_status_enum,
  'monthly'::public.subscription_plan_type_enum,
  12500,
  'BRL',
  'manual_pix',
  '000201ledger-test-pix',
  timezone('utc'::text, now()),
  cs.id,
  obligation.period_key,
  obligation.period_start,
  obligation.period_end,
  obligation.available_on,
  obligation.due_on
from (
  values
    (
      '81000000-0000-4000-8000-000000000201'::uuid,
      '81000000-0000-4000-8000-000000000101'::uuid,
      'ledger-overdue-1',
      (current_date - 1)::date,
      (current_date - 31)::date,
      (current_date - 38)::date,
      (current_date - 1)::date
    ),
    (
      '81000000-0000-4000-8000-000000000202'::uuid,
      '81000000-0000-4000-8000-000000000101'::uuid,
      'ledger-overdue-2',
      (current_date - 32)::date,
      (current_date - 62)::date,
      (current_date - 69)::date,
      (current_date - 32)::date
    ),
    (
      '81000000-0000-4000-8000-000000000203'::uuid,
      '81000000-0000-4000-8000-000000000102'::uuid,
      'ledger-available',
      current_date,
      (current_date + 5)::date,
      (current_date - 2)::date,
      (current_date + 5)::date
    ),
    (
      '81000000-0000-4000-8000-000000000204'::uuid,
      '81000000-0000-4000-8000-000000000103'::uuid,
      'ledger-review',
      current_date,
      (current_date + 6)::date,
      (current_date - 1)::date,
      (current_date + 6)::date
    )
) as obligation(
  id,
  user_id,
  period_key,
  period_start,
  period_end,
  available_on,
  due_on
)
join public.contribution_schedules cs
  on cs.organization_id = '81000000-0000-4000-8000-000000000001'::uuid
  and cs.user_id = obligation.user_id;

insert into public.payment_claims (
  id,
  obligation_id,
  organization_id,
  claimant_user_id,
  payer_type,
  payer_name,
  status
)
values (
  '81000000-0000-4000-8000-000000000301'::uuid,
  '81000000-0000-4000-8000-000000000201'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000101'::uuid,
  'applicant'::public.payment_claim_payer_type_enum,
  null,
  'under_review'::public.payment_claim_status_enum
);

insert into public.payment_claim_audit_events (
  organization_id,
  obligation_id,
  claim_id,
  actor_user_id,
  previous_state,
  next_state
)
values (
  '81000000-0000-4000-8000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000201'::uuid,
  '81000000-0000-4000-8000-000000000301'::uuid,
  '81000000-0000-4000-8000-000000000101'::uuid,
  'payment_available',
  'under_review'
);

insert into public.payment_claims (
  id,
  obligation_id,
  organization_id,
  claimant_user_id,
  payer_type,
  payer_name,
  status
)
values (
  '81000000-0000-4000-8000-000000000302'::uuid,
  '81000000-0000-4000-8000-000000000204'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000103'::uuid,
  'other'::public.payment_claim_payer_type_enum,
  'Ledger Payer',
  'under_review'::public.payment_claim_status_enum
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000101',
  true
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->>'financial_standing',
  'overdue',
  'overdue takes precedence over a claim under review'
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->'attention_obligation'->>'status',
  'overdue',
  'the oldest overdue obligation drives attention ahead of a newer claim'
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->'attention_obligation'->'action'->>'type',
  'open_obligation',
  'an overdue obligation opens its authoritative PIX instructions'
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid,
    null,
    1
  )->>'history_has_more',
  'true',
  'history is bounded and reports a continuation cursor'
);

select is(
  jsonb_array_length(
    public.get_membership_billing_ledger(
      '81000000-0000-4000-8000-000000000001'::uuid,
      null,
      1
    )->'history'
  ),
  1,
  'history returns only the requested page size'
);

select throws_ok(
  $$select public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000002'::uuid
  )$$,
  '42501',
  'Membership Ledger was not found.',
  'the private read model rejects an organization outside the caller scope'
);

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000102',
  true
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->>'financial_standing',
  'payment_available',
  'an available future-dated obligation is payment_available'
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->'attention_obligation'->'action'->>'type',
  'open_obligation',
  'an available obligation opens its authoritative PIX instructions'
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->'attention_obligation'->>'obligation_id',
  '81000000-0000-4000-8000-000000000203',
  'the action points to the exact available obligation'
);

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000103',
  true
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->>'financial_standing',
  'under_review',
  'a current claim without an overdue period is under_review'
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->'attention_obligation'->'action'->>'type',
  'open_claim',
  'the under-review period opens the existing claim'
);

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000104',
  true
);
set local role postgres;

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->>'financial_standing',
  'up_to_date',
  'an active member without an actionable obligation is up_to_date'
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->'next_contribution'->>'status',
  'scheduled',
  'an active member receives the next scheduled contribution'
);

select is(
  public.get_membership_billing_ledger(
    '81000000-0000-4000-8000-000000000001'::uuid
  )->'next_contribution'->>'obligation_id',
  null,
  'a not-yet-materialized next contribution has no action id'
);

set local role postgres;
update public.organization_members
set role = 'admin'::public.organization_role_enum
where organization_id = '81000000-0000-4000-8000-000000000001'::uuid
  and user_id = '81000000-0000-4000-8000-000000000104'::uuid;

set local role authenticated;
select is(
  (select count(*)::integer
   from public.payment_obligations
   where organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and user_id = '81000000-0000-4000-8000-000000000101'::uuid),
  2,
  'an authorized association admin can read another member''s billing rows'
);

select throws_ok(
  $$insert into public.contribution_schedules (
    organization_id,
    user_id,
    cadence,
    admission_date,
    due_day,
    lead_days,
    billing_timezone,
    currency
  ) values (
    '81000000-0000-4000-8000-000000000001'::uuid,
    '81000000-0000-4000-8000-000000000104'::uuid,
    'monthly',
    current_date,
    10,
    7,
    'America/Sao_Paulo',
    'BRL'
  )$$,
  '42501',
  'permission denied for table contribution_schedules',
  'client schedule writes are disabled behind the server boundary'
);

-- ---------------------------------------------------------------------------
-- Ending a membership stops future generation. A canceled subscription used to
-- do this; the departure command does it now.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000104',
  true
);

select is(
  (select departed_role::text
   from public.end_association_membership(
     '81000000-0000-4000-8000-000000000001'::uuid,
     '81000000-0000-4000-8000-000000000101'::uuid,
     'Saiu da associacao.'
   )),
  'member',
  'the admin ends another member''s membership'
);

select is(
  (select count(*)::integer
   from public.contribution_schedules
   where organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and user_id = '81000000-0000-4000-8000-000000000101'::uuid
     and active),
  0,
  'a closed membership stops future Ledger generation'
);

select cmp_ok(
  (select count(*)::integer
   from public.payment_obligations
   where organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and user_id = '81000000-0000-4000-8000-000000000101'::uuid
     and status = 'available'),
  '>',
  0,
  'the unpaid contributions left behind are still owed and still on the Ledger'
);

select is(
  (select count(*)::integer
   from public.payment_obligations
   where organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and user_id = '81000000-0000-4000-8000-000000000101'::uuid
     and status in ('settled', 'void')),
  0,
  'leaving neither settles nor voids what was owed'
);

-- ---------------------------------------------------------------------------
-- There is no in-place plan change.
--
-- A member who wants a different plan closes the membership and opens a new
-- one, so the new plan is snapshotted at a new admission rather than spliced
-- into an existing schedule. The schedule anchor and its policy stay immutable,
-- and the effective-dated term history is append-only.
-- ---------------------------------------------------------------------------

set local role postgres;

update public.organizations
set
  annual_price_amount = 140000,
  annual_pix_copy_paste = '000201ledger-annual-pix'
where id = '81000000-0000-4000-8000-000000000001'::uuid;

select is(
   (select cadence
    from public.contribution_schedules
   where organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and user_id = '81000000-0000-4000-8000-000000000104'::uuid),
  'monthly'::public.contribution_cadence_enum,
  'the admission schedule cadence remains an immutable anchor'
);

select throws_ok(
  $$update public.contribution_schedules
    set cadence = 'annual'::public.contribution_cadence_enum
    where organization_id = '81000000-0000-4000-8000-000000000001'::uuid
      and user_id = '81000000-0000-4000-8000-000000000104'::uuid$$,
  '55000',
  'Contribution schedule policy is immutable; append an effective-dated term.',
  'a member''s plan cannot be switched in place on the schedule'
);

select throws_ok(
  $$update public.contribution_plan_assignments
    set plan_type = 'annual'::public.subscription_plan_type_enum
    where schedule_id = (
      select cs.id from public.contribution_schedules cs
      where cs.organization_id = '81000000-0000-4000-8000-000000000001'::uuid
        and cs.user_id = '81000000-0000-4000-8000-000000000104'::uuid
    )$$,
  '55000',
  'An effective-dated contribution term is immutable; append a new term.',
  'an existing price snapshot cannot be rewritten into another plan'
);

select is(
  (select plan_type
   from public.contribution_plan_assignments cpa
   join public.contribution_schedules cs on cs.id = cpa.schedule_id
   where cs.organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '81000000-0000-4000-8000-000000000104'::uuid
   order by cpa.effective_period_start desc
   limit 1),
  'monthly'::public.subscription_plan_type_enum,
  'raising the association''s annual price does not reprice an existing member'
);

-- Rejoining on a different plan is the supported route, and it snapshots the
-- price that is current at the new admission.
set local role authenticated;

select is(
  (select departed_role::text
   from public.end_association_membership(
     '81000000-0000-4000-8000-000000000001'::uuid,
     '81000000-0000-4000-8000-000000000102'::uuid
   )),
  'member',
  'the member who wants another plan leaves first'
);

set local role postgres;

insert into public.organization_members (organization_id, user_id, role)
values (
  '81000000-0000-4000-8000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000102'::uuid,
  'member'::public.organization_role_enum
);

select public.ensure_contribution_schedule(
  '81000000-0000-4000-8000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000102'::uuid,
  'annual'::public.subscription_plan_type_enum
);

select is(
  (select cpa.amount
   from public.contribution_schedules cs
   join public.contribution_plan_assignments cpa on cpa.schedule_id = cs.id
   where cs.organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '81000000-0000-4000-8000-000000000102'::uuid
     and cs.active),
  140000,
  'the new membership snapshots the price current at its own admission'
);

select is(
  (select cs.cadence::text
   from public.contribution_schedules cs
   where cs.organization_id = '81000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '81000000-0000-4000-8000-000000000102'::uuid
     and cs.active),
  'annual',
  'the new membership runs on the plan the person actually chose'
);

select * from finish();
rollback;
