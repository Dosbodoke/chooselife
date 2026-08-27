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
    '82000000-0000-4000-8000-000000000103'::uuid,
    'authenticated',
    'authenticated',
    'fixed-day-admin@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Fixed Day Admin"}'::jsonb,
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
  ),
  (
    '82000000-0000-4000-8000-000000000103'::uuid,
    'Fixed Day Admin',
    '@fixed_day_admin'
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
  ),
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000103'::uuid,
    'admin'::public.organization_role_enum,
    '2026-01-09 12:00:00+00'
  );

-- Admission opens the schedule directly. The membership row no longer has a
-- trigger behind it, and there is no subscription to read the plan from.
select public.ensure_contribution_schedule(
  '82000000-0000-4000-8000-000000000001'::uuid,
  persona.user_id,
  'monthly'::public.subscription_plan_type_enum,
  '2026-01-09'::date
)
from (
  values
    ('82000000-0000-4000-8000-000000000101'::uuid),
    ('82000000-0000-4000-8000-000000000102'::uuid)
) as persona(user_id);

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

-- ---------------------------------------------------------------------------
-- Rule 8: every missed contribution stays its own owed obligation, and
-- nonpayment never touches the membership.
--
-- Nothing here suspends, downgrades or ends anybody. A member who has not paid
-- for a year owes twelve separate contributions and is still a member; an
-- admin settles or voids them later.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from public.payment_obligations po
   where po.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and po.user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and po.purpose = 'recurring'
     and po.status = 'available'),
  (select count(distinct po.period_key)::integer
   from public.payment_obligations po
   where po.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and po.user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and po.purpose = 'recurring'
     and po.status = 'available'),
  'each missed period is a separate owed obligation, never one rolled-up debt'
);

select cmp_ok(
  (select count(*)::integer
   from public.payment_obligations po
   where po.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and po.user_id = '82000000-0000-4000-8000-000000000101'::uuid
     and po.purpose = 'recurring'
     and po.status = 'available'),
  '>',
  1,
  'a long-unpaid member has accumulated more than one owed contribution'
);

select is(
  (select count(*)::integer
   from public.organization_members om
   where om.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and om.user_id = '82000000-0000-4000-8000-000000000101'::uuid),
  1,
  'nonpayment leaves the membership exactly where it was'
);

select is(
  (select cs.active
   from public.contribution_schedules cs
   where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid),
  true,
  'nonpayment does not retire the contribution schedule'
);

-- ---------------------------------------------------------------------------
-- Rule 10: the upcoming charge is priced by the term EFFECTIVE for its due
-- date, not by whichever term happens to be latest on file.
--
-- Ordering assignments by effective_period_start alone quoted a future price
-- for a charge falling before that price took effect. Member 101 gets a term
-- effective years from now; the next charge must ignore it.
-- ---------------------------------------------------------------------------

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
  (timezone('UTC', clock_timestamp())::date + interval '10 years')::date,
  'annual'::public.subscription_plan_type_enum,
  999999,
  'BRL',
  cs.due_day,
  cs.lead_days,
  cs.billing_timezone,
  '000201future-term-pix'
from public.contribution_schedules cs
where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
  and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid;

select cmp_ok(
  (select count(*)::integer
   from public.contribution_plan_assignments cpa
   join public.contribution_schedules cs on cs.id = cpa.schedule_id
   where cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '82000000-0000-4000-8000-000000000101'::uuid),
  '>',
  1,
  'the schedule now carries a future-effective term alongside its admission term'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000103',
  true
);

select isnt(
  (select next_charge_amount
   from public.get_association_member_detail(
     '82000000-0000-4000-8000-000000000001'::uuid,
     '82000000-0000-4000-8000-000000000101'::uuid
   )),
  999999,
  'the next charge is not priced from a term that is not effective yet'
);

select ok(
  (select next_charge_due_on
     < (timezone('UTC', clock_timestamp())::date + interval '10 years')::date
   from public.get_association_member_detail(
     '82000000-0000-4000-8000-000000000001'::uuid,
     '82000000-0000-4000-8000-000000000101'::uuid
   )),
  'the next charge falls before the future term takes effect'
);

set local role postgres;

-- ---------------------------------------------------------------------------
-- The retired model is actually gone, not merely unused.
-- ---------------------------------------------------------------------------

select hasnt_table('public', 'payments', 'the legacy payments table is gone');
select hasnt_table('public', 'subscriptions', 'the legacy subscriptions table is gone');
select hasnt_table('public', 'contribution_reminder_events',
  'the reminder event queue is gone');
select hasnt_table('public', 'contribution_reminder_batches',
  'the reminder batch queue is gone');
select hasnt_table('public', 'contribution_reminder_batch_events',
  'the reminder batch join table is gone');
select hasnt_table('public', 'contribution_reminder_delivery_attempts',
  'the reminder delivery attempt table is gone');

select hasnt_type('public', 'payment_status_enum',
  'the legacy payment status type is gone');
select hasnt_type('public', 'subscription_status_enum',
  'the legacy subscription status type is gone');
select hasnt_type('public', 'contribution_reminder_stage_enum',
  'the reminder stage type is gone');

select hasnt_function('public', 'reconcile_legacy_payment_obligations',
  'the legacy reconciliation helper is gone');
select hasnt_function('public', 'apply_payment_settlement_effects',
  'the legacy settlement path is gone');
select hasnt_function('public', 'schedule_contribution_plan_change',
  'there is no in-place plan change command');
select hasnt_function('public', 'sync_contribution_schedule_on_subscription',
  'no trigger derives a schedule from a subscription');
select hasnt_function('public', 'sync_contribution_schedule_on_membership',
  'admission opens the schedule itself instead of a membership row trigger');
select hasnt_function('public', 'enqueue_contribution_reminder_events',
  'the reminder scheduler command is gone');

select hasnt_column('public', 'organizations', 'contribution_reminder_local_time',
  'the reminder delivery time is no longer part of the billing policy');
select hasnt_column('public', 'payment_obligations', 'legacy_payment_id',
  'obligations no longer carry a link to a legacy payment');

-- Every SECURITY DEFINER function in the association model pins an empty
-- search_path, so an attacker cannot resolve an unqualified name into a schema
-- they control. Scoped to this model by name: the festival functions come from
-- unrelated migrations and still carry search_path=public.
--
-- Postgres stores the setting as search_path="" rather than search_path=, which
-- is why the comparison accepts both spellings.
select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and p.proname in (
       'approve_initial_claim',
       'approve_recurring_payment_claim',
       'claim_initial_payment',
       'claim_recurring_payment',
       'end_association_membership',
       'ensure_contribution_schedule',
       'generate_membership_billing_obligations',
       'generate_membership_billing_obligations_at',
       'get_association_member_detail',
       'get_billing_workspace_claim_detail',
       'get_billing_workspace_members',
       'get_billing_workspace_organizations',
       'get_billing_workspace_payments',
       'get_billing_workspace_people',
       'get_billing_workspace_queue',
       'get_initial_payment_claim_detail',
       'get_initial_payment_claim_queue',
       'get_membership_billing_ledger',
       'get_payment_obligation_instructions',
       'is_person_link_maintenance',
       'is_valid_billing_timezone',
       'prepare_association_account_deletion',
       'reject_contribution_plan_assignment_mutation',
       'reject_contribution_schedule_anchor_mutation',
       'reject_initial_claim',
       'reject_membership_application_revision_mutation',
       'reject_membership_departure_mutation',
       'reject_payment_claim_audit_mutation',
       'reject_payment_claim_evidence_mutation',
       'reject_payment_obligation_context_mutation',
       'reject_recurring_payment_claim',
       'resolve_association_person',
       'set_association_person_from_obligation',
       'set_association_person_from_subject',
       'snapshot_payment_obligation_context',
       'submit_association_application',
       'validate_billing_policy_timezone'
     )
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, array[]::text[])) as config(entry)
       where config.entry in ('search_path=', 'search_path=""')
     )),
  0,
  'every SECURITY DEFINER function in the association model pins an empty search_path'
);

-- No authenticated client may execute the account-deletion closure. It is the
-- one command that ends a membership without an admin, so it stays service
-- role only.
select is(
  (select has_function_privilege(
     'authenticated',
     'public.prepare_association_account_deletion(uuid)',
     'execute'
   )),
  false,
  'authenticated clients cannot run the account deletion closure'
);

select is(
  (select has_function_privilege(
     'service_role',
     'public.prepare_association_account_deletion(uuid)',
     'execute'
   )),
  true,
  'the service role can run the account deletion closure'
);

select is(
  (select has_table_privilege('authenticated', 'public.organization_members', 'INSERT')
     or has_table_privilege('authenticated', 'public.organization_members', 'UPDATE')
     or has_table_privilege('authenticated', 'public.organization_members', 'DELETE')
     or has_table_privilege('authenticated', 'public.organization_members', 'TRUNCATE')),
  false,
  'authenticated clients hold no write privilege on organization_members'
);

select is(
  (select has_table_privilege('authenticated', 'public.organization_members', 'SELECT')),
  true,
  'membership display for signed-in users is preserved'
);

select is(
  (select count(*)::integer
   from pg_policies
   where tablename = 'organization_members'
     and cmd <> 'SELECT'),
  0,
  'organization_members carries no write policy at all'
);

select * from finish();
rollback;
