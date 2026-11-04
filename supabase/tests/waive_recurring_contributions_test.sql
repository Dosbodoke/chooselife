begin;

select * from no_plan();

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
values
  (
    '86000000-0000-4000-8000-000000000001'::uuid,
    'Waiver Association',
    'waiver-association',
    'association'::public.organization_type_enum,
    'BRL',
    'America/Sao_Paulo',
    10,
    7,
    2500,
    25000,
    '000201waiver-monthly',
    '000201waiver-annual'
  ),
  (
    '86000000-0000-4000-8000-000000000002'::uuid,
    'Other Waiver Association',
    'other-waiver-association',
    'association'::public.organization_type_enum,
    'BRL',
    'America/Sao_Paulo',
    10,
    7,
    2500,
    25000,
    '000201other-waiver-monthly',
    '000201other-waiver-annual'
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
select
  persona.id,
  'authenticated',
  'authenticated',
  persona.email,
  timezone('utc'::text, now()),
  jsonb_build_object('full_name', persona.name),
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
from (
  values
    ('86000000-0000-4000-8000-000000000101'::uuid, 'waiver-admin@example.com', 'Waiver Admin'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'waiver-debtor@example.com', 'Waiver Debtor'),
    ('86000000-0000-4000-8000-000000000103'::uuid, 'waiver-member@example.com', 'Waiver Member'),
    ('86000000-0000-4000-8000-000000000105'::uuid, 'waiver-outsider@example.com', 'Waiver Outsider'),
    ('86000000-0000-4000-8000-000000000106'::uuid, 'waiver-other-admin@example.com', 'Other Waiver Admin')
) as persona(id, email, name);

insert into public.profiles (id, name, username)
values
  ('86000000-0000-4000-8000-000000000101'::uuid, 'Waiver Admin', '@waiver_admin'),
  ('86000000-0000-4000-8000-000000000102'::uuid, 'Waiver Debtor', '@waiver_debtor'),
  ('86000000-0000-4000-8000-000000000103'::uuid, 'Waiver Member', '@waiver_member'),
  ('86000000-0000-4000-8000-000000000105'::uuid, 'Waiver Outsider', '@waiver_outsider'),
  ('86000000-0000-4000-8000-000000000106'::uuid, 'Other Waiver Admin', '@other_waiver_admin')
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (organization_id, user_id, role)
values
  ('86000000-0000-4000-8000-000000000001'::uuid, '86000000-0000-4000-8000-000000000101'::uuid, 'admin'),
  ('86000000-0000-4000-8000-000000000001'::uuid, '86000000-0000-4000-8000-000000000102'::uuid, 'member'),
  ('86000000-0000-4000-8000-000000000001'::uuid, '86000000-0000-4000-8000-000000000103'::uuid, 'member'),
  ('86000000-0000-4000-8000-000000000002'::uuid, '86000000-0000-4000-8000-000000000106'::uuid, 'admin'),
  ('86000000-0000-4000-8000-000000000002'::uuid, '86000000-0000-4000-8000-000000000105'::uuid, 'member');

-- The debtor joined about seven months ago and never paid, so several months
-- are overdue. The outsider owes the other association.
select public.ensure_contribution_schedule(
  persona.organization_id,
  persona.user_id,
  'monthly'::public.subscription_plan_type_enum,
  timezone('America/Sao_Paulo', clock_timestamp())::date - persona.days_ago
)
from (
  values
    ('86000000-0000-4000-8000-000000000001'::uuid, '86000000-0000-4000-8000-000000000102'::uuid, 210),
    ('86000000-0000-4000-8000-000000000002'::uuid, '86000000-0000-4000-8000-000000000105'::uuid, 210)
) as persona(organization_id, user_id, days_ago);

select count(*) from public.generate_membership_billing_obligations();

-- Run the generator a couple of weeks ahead too, so the next month already
-- exists as a charge that is not yet due.
select count(*)
from public.generate_membership_billing_obligations_at(clock_timestamp() + interval '14 days');

-- The debtor's admission payment, which is never waivable here.
insert into public.membership_applications (
  id,
  organization_id,
  user_id,
  status,
  accepted_terms_at,
  submitted_at
)
values (
  '86000000-0000-4000-8000-000000000201'::uuid,
  '86000000-0000-4000-8000-000000000001'::uuid,
  '86000000-0000-4000-8000-000000000102'::uuid,
  'admitted',
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
);

insert into public.membership_application_revisions (
  id,
  application_id,
  organization_id,
  user_id,
  revision_number,
  draft_version,
  plan_type,
  terms_version,
  accepted_terms_at,
  submitted_at,
  has_allergies,
  has_dietary_restrictions,
  plan_amount,
  currency,
  pix_copy_paste
)
values (
  '86000000-0000-4000-8000-000000000202'::uuid,
  '86000000-0000-4000-8000-000000000201'::uuid,
  '86000000-0000-4000-8000-000000000001'::uuid,
  '86000000-0000-4000-8000-000000000102'::uuid,
  1,
  1,
  'monthly',
  'estatuto-v1',
  timezone('utc'::text, now()),
  timezone('utc'::text, now()),
  false,
  false,
  2500,
  'BRL',
  '000201waiver-monthly'
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
  available_at
)
values (
  '86000000-0000-4000-8000-000000000301'::uuid,
  '86000000-0000-4000-8000-000000000001'::uuid,
  '86000000-0000-4000-8000-000000000102'::uuid,
  '86000000-0000-4000-8000-000000000202'::uuid,
  'initial_admission',
  'available',
  'monthly',
  2500,
  'BRL',
  'manual_pix',
  '000201waiver-monthly',
  timezone('utc'::text, now()) - interval '200 days'
);

-- The debtor's overdue months, oldest first, plus whatever is not yet due.
create temporary table debtor_overdue on commit drop as
select
  row_number() over (order by po.due_on, po.id) as position,
  po.id,
  po.period_key,
  po.due_on
from public.payment_obligations po
where po.organization_id = '86000000-0000-4000-8000-000000000001'
  and po.user_id = '86000000-0000-4000-8000-000000000102'
  and po.purpose = 'recurring'
  and po.due_on < timezone('America/Sao_Paulo', clock_timestamp())::date;

create temporary table debtor_not_due on commit drop as
select po.id
from public.payment_obligations po
where po.organization_id = '86000000-0000-4000-8000-000000000001'
  and po.user_id = '86000000-0000-4000-8000-000000000102'
  and po.purpose = 'recurring'
  and po.due_on >= timezone('America/Sao_Paulo', clock_timestamp())::date;

create temporary table outsider_overdue on commit drop as
select po.id
from public.payment_obligations po
where po.organization_id = '86000000-0000-4000-8000-000000000002'
  and po.user_id = '86000000-0000-4000-8000-000000000105'
  and po.due_on < timezone('America/Sao_Paulo', clock_timestamp())::date
order by po.due_on
limit 1;

create temporary table baseline on commit drop as
select
  (select coalesce(max(id), 0) from public.notifications) as last_notification_id,
  (select count(*) from public.payment_obligations
   where user_id = '86000000-0000-4000-8000-000000000102') as debtor_obligations;

grant select on debtor_overdue, debtor_not_due, outsider_overdue, baseline
  to authenticated, anon;

select ok(
  (select count(*) >= 5 from debtor_overdue),
  'the fixture leaves the debtor with at least five overdue months'
);

select ok(
  exists (select 1 from debtor_not_due),
  'the fixture also has a month that is not yet due'
);

-- Month 4 is settled by an approved payment, month 5 has a payment waiting for
-- review. Neither may be waived.
update public.payment_obligations
set status = 'settled', settled_at = timezone('utc'::text, clock_timestamp())
where id = (select id from debtor_overdue where position = 4);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000102', true);

select ok(
  (select claim_status = 'under_review'
   from public.claim_recurring_payment(
     (select id from debtor_overdue where position = 5), true, null
   )),
  'the debtor sends a payment for month 5'
);

-- -------------------------------------------------------------------------
-- Client protections.
-- -------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);

select throws_ok(
  $$select count(*) from public.payment_obligation_waivers$$,
  '42501',
  'permission denied for table payment_obligation_waivers',
  'clients cannot read the waiver table directly'
);

select throws_ok(
  $$insert into public.payment_obligation_waivers (obligation_id, organization_id, association_person_id, reason)
    select id, '86000000-0000-4000-8000-000000000001', gen_random_uuid(), 'forged'
    from debtor_overdue where position = 1$$,
  '42501',
  'permission denied for table payment_obligation_waivers',
  'clients cannot forge a waiver'
);

select throws_ok(
  $$update public.payment_obligations set status = 'void'
    where id = (select id from debtor_overdue where position = 1)$$,
  '42501',
  'permission denied for table payment_obligations',
  'clients cannot void an obligation directly'
);

-- -------------------------------------------------------------------------
-- Authorization.
-- -------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000103', true);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1)],
    'Hardship')$$,
  '42501',
  'You are not authorized to waive contributions of this association.',
  'a plain member cannot waive'
);

select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000102', true);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1)],
    'Hardship')$$,
  '42501',
  'You are not authorized to waive contributions of this association.',
  'the debtor cannot waive their own debt'
);

select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000106', true);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1)],
    'Hardship')$$,
  '42501',
  'You are not authorized to waive contributions of this association.',
  'another association''s admin cannot waive'
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_waivers('86000000-0000-4000-8000-000000000001')),
  0,
  'another association''s admin reads no waivers'
);

-- -------------------------------------------------------------------------
-- Input validation, as the association admin.
-- -------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1)],
    '   ')$$,
  '22023',
  'A reason is required to waive contributions.',
  'a blank reason is refused'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1)],
    repeat('a', 501))$$,
  '22023',
  'The reason must be 500 characters or fewer.',
  'an overlong reason is refused'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    '{}'::uuid[],
    'Hardship')$$,
  '22023',
  'Select the contributions to waive.',
  'an empty selection is refused'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1), null],
    'Hardship')$$,
  '22023',
  'Select the contributions to waive.',
  'a selection with a NULL id is refused'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array(select gen_random_uuid() from generate_series(1, 61)),
    'Hardship')$$,
  '22023',
  'Waive at most 60 contributions at a time.',
  'the selection size is bounded'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1), (select id from outsider_overdue)],
    'Hardship')$$,
  '22023',
  'Some selected contributions do not belong to this person.',
  'a batch that reaches another association''s charge is refused'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000002',
    '86000000-0000-4000-8000-000000000105',
    array[(select id from outsider_overdue)],
    'Hardship')$$,
  '42501',
  'You are not authorized to waive contributions of this association.',
  'an admin cannot waive in an association they do not run'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000103',
    array[(select id from debtor_overdue where position = 1)],
    'Hardship')$$,
  '22023',
  'Some selected contributions do not belong to this person.',
  'a charge cannot be waived under somebody else''s name'
);

-- -------------------------------------------------------------------------
-- Charges that are not waivable fail the whole batch.
-- -------------------------------------------------------------------------

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1), (select id from debtor_overdue where position = 4)],
    'Hardship')$$,
  '40001',
  'A selected contribution can no longer be waived. Refresh and review again.',
  'a settled month cannot be waived, and takes the batch with it'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1), (select id from debtor_overdue where position = 5)],
    'Hardship')$$,
  '40001',
  'A selected contribution has a payment under review. Decide it first.',
  'a month with a payment under review cannot be waived'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1), '86000000-0000-4000-8000-000000000301'::uuid],
    'Hardship')$$,
  '40001',
  'A selected contribution can no longer be waived. Refresh and review again.',
  'the admission payment cannot be waived'
);

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 1)] || array(select id from debtor_not_due),
    'Hardship')$$,
  '40001',
  'A selected contribution can no longer be waived. Refresh and review again.',
  'a month that is not yet overdue cannot be waived'
);

set local role postgres;

select is(
  (select count(*)::integer
   from public.payment_obligations po
   where po.user_id = '86000000-0000-4000-8000-000000000102'
     and po.status = 'void'),
  0,
  'no refused batch voided anything'
);

select is(
  (select count(*)::integer from public.payment_obligation_waivers),
  0,
  'no refused batch left a waiver behind'
);

-- -------------------------------------------------------------------------
-- The waiver.
-- -------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);

create temporary table first_waiver on commit drop as
select *
from public.waive_recurring_contributions(
  '86000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000102',
  array[
    (select id from debtor_overdue where position = 2),
    (select id from debtor_overdue where position = 1),
    (select id from debtor_overdue where position = 2)
  ],
  '  Financial   hardship,
  agreed at the assembly  '
);

select results_eq(
  $$select obligation_id, waived_now, reason, waived_by_user_id, amount
    from first_waiver order by due_on$$,
  $$select id, true, 'Financial hardship, agreed at the assembly',
      '86000000-0000-4000-8000-000000000101'::uuid, 2500
    from debtor_overdue where position in (1, 2) order by due_on$$,
  'the two selected months are waived once each, with the normalized reason and actor'
);

select results_eq(
  $$select obligation_id, reason, waived_by_name
    from public.get_billing_workspace_waivers('86000000-0000-4000-8000-000000000001')
    order by obligation_id$$,
  $$select id, 'Financial hardship, agreed at the assembly', 'Waiver Admin'
    from debtor_overdue where position in (1, 2) order by id$$,
  'the admin reads the waivers with reason and actor'
);

select results_eq(
  $$select effective_payment_state, amount, settled_at is null
    from public.get_billing_workspace_payments('86000000-0000-4000-8000-000000000001')
    where obligation_id in (select id from debtor_overdue where position in (1, 2))$$,
  $$values ('void', 2500, true), ('void', 2500, true)$$,
  'the waived months stay in the history as void with their amount and no payment'
);

-- A repeat with another reason changes nothing.
select results_eq(
  $$select obligation_id, waived_now, reason
    from public.waive_recurring_contributions(
      '86000000-0000-4000-8000-000000000001',
      '86000000-0000-4000-8000-000000000102',
      array(select id from debtor_overdue where position in (1, 2)),
      'A different reason')
    order by due_on$$,
  $$select id, false, 'Financial hardship, agreed at the assembly'
    from debtor_overdue where position in (1, 2) order by due_on$$,
  'repeating the waiver returns the original waiver untouched'
);

-- The debtor cannot pay a waived month any more.
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000102', true);

select throws_ok(
  $$select * from public.claim_recurring_payment(
    (select id from debtor_overdue where position = 1), true, null)$$,
  '23514',
  'This recurring contribution cannot be claimed.',
  'a waived month is no longer payable'
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_waivers('86000000-0000-4000-8000-000000000001')),
  0,
  'a member reads no waivers'
);

set local role postgres;

select results_eq(
  $$select status::text, settled_at is null
    from public.payment_obligations
    where id in (select id from debtor_overdue where position in (1, 2))$$,
  $$values ('void', true), ('void', true)$$,
  'a waived month is void, never settled'
);

select is(
  (select count(*)::integer
   from public.payment_claims pc
   where pc.obligation_id in (select id from debtor_overdue where position in (1, 2))),
  0,
  'waiving invents no payment claim'
);

select is(
  (select count(*)::integer from public.payment_obligation_waivers),
  2,
  'the repeat added no audit rows'
);

select is(
  (select association_person_id from public.payment_obligation_waivers limit 1),
  (select association_person_id from public.payment_obligations
   where id = (select id from debtor_overdue where position = 1)),
  'the waiver keeps the person link that survives account deletion'
);

-- -------------------------------------------------------------------------
-- Billing continues and does not bring the debt back.
-- -------------------------------------------------------------------------

select count(*) from public.generate_membership_billing_obligations();

select is(
  (select count(*) from public.payment_obligations
   where user_id = '86000000-0000-4000-8000-000000000102'),
  (select debtor_obligations from baseline),
  'the generator does not recreate a waived month'
);

select is(
  (select status::text from public.payment_obligations
   where id = (select id from debtor_overdue where position = 1)),
  'void',
  'the generator leaves the waived month void'
);

select ok(
  (select cs.active from public.contribution_schedules cs
   where cs.organization_id = '86000000-0000-4000-8000-000000000001'
     and cs.user_id = '86000000-0000-4000-8000-000000000102'),
  'the person''s billing schedule stays active'
);

select is(
  (select role::text from public.organization_members
   where organization_id = '86000000-0000-4000-8000-000000000001'
     and user_id = '86000000-0000-4000-8000-000000000102'),
  'member',
  'waiving does not touch membership'
);

-- -------------------------------------------------------------------------
-- What the admin and the member see afterwards.
-- -------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);

select is(
  (select overdue_count
   from public.get_membership_payment_reminder_preview(
     '86000000-0000-4000-8000-000000000001',
     '86000000-0000-4000-8000-000000000102'
   )),
  (select count(*)::integer from debtor_overdue where position > 2 and position <> 4 and position <> 5),
  'the reminder no longer counts the waived months'
);

select ok(
  (select next_charge_due_on is not null
   from public.get_association_member_detail(
     '86000000-0000-4000-8000-000000000001',
     '86000000-0000-4000-8000-000000000102'
   )),
  'the next charge is still scheduled'
);

-- Waive everything else still owed and overdue.
select is(
  (select count(*)::integer
   from public.waive_recurring_contributions(
     '86000000-0000-4000-8000-000000000001',
     '86000000-0000-4000-8000-000000000102',
     array(select id from debtor_overdue where position not in (4, 5)),
     'Remaining arrears forgiven')
   where waived_now),
  (select count(*)::integer from debtor_overdue where position > 2 and position <> 4 and position <> 5),
  'a later batch can include already-waived months and waives only the rest'
);

select is(
  (select overdue_count
   from public.get_membership_payment_reminder_preview(
     '86000000-0000-4000-8000-000000000001',
     '86000000-0000-4000-8000-000000000102'
   )),
  0,
  'with every overdue month waived or in review, nothing is overdue'
);

-- Settle what was left: the payment under review is approved and the
-- admission was paid long ago.
select is(
  (select obligation_status::text
   from public.approve_recurring_payment_claim(
     (select pc.id from public.payment_claims pc
      where pc.obligation_id = (select id from debtor_overdue where position = 5))
   )),
  'settled',
  'the admin approves the payment that was under review'
);

set local role postgres;

update public.payment_obligations
set status = 'settled', settled_at = timezone('utc'::text, clock_timestamp())
where id = '86000000-0000-4000-8000-000000000301';

set local role authenticated;
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000102', true);

select is(
  public.get_membership_billing_ledger(
    '86000000-0000-4000-8000-000000000001', null, 50
  )->>'financial_standing',
  case
    when exists (
      select 1
      from public.payment_obligations po
      where po.user_id = '86000000-0000-4000-8000-000000000102'
        and po.status = 'available'
        and po.available_on <= timezone('America/Sao_Paulo', clock_timestamp())::date
    ) then 'payment_available'
    else 'up_to_date'
  end,
  'with the arrears waived the member is up to date, or only owes the current month'
);

select ok(
  (select count(*) >= 2
   from jsonb_array_elements(
     public.get_membership_billing_ledger(
       '86000000-0000-4000-8000-000000000001', null, 50
     )->'history'
   ) entry
   where entry->>'status' = 'void' and entry->>'purpose' = 'recurring'),
  'the member still sees the waived months in their history'
);

set local role postgres;

select is(
  (select count(*)::integer
   from public.notifications n
   where n.id > (select last_notification_id from baseline)),
  0,
  'waiving sends no notification'
);

-- -------------------------------------------------------------------------
-- The audit trail is immutable, except for an actor account going away.
-- -------------------------------------------------------------------------

select throws_ok(
  $$update public.payment_obligation_waivers set reason = 'Rewritten'$$,
  '55000',
  'Payment obligation waivers are immutable.',
  'a waiver reason cannot be rewritten'
);

select throws_ok(
  $$delete from public.payment_obligation_waivers$$,
  '55000',
  'Payment obligation waivers are immutable.',
  'a waiver cannot be deleted'
);

select lives_ok(
  $$update public.payment_obligation_waivers set actor_user_id = null$$,
  'the actor link may be cleared when that account is deleted'
);

-- -------------------------------------------------------------------------
-- Anonymous callers have no access at all.
-- -------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select * from public.waive_recurring_contributions(
    '86000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000102',
    array[(select id from debtor_overdue where position = 3)],
    'Hardship')$$,
  '42501',
  'permission denied for function waive_recurring_contributions',
  'anonymous callers cannot waive'
);

select throws_ok(
  $$select * from public.get_billing_workspace_waivers('86000000-0000-4000-8000-000000000001')$$,
  '42501',
  'permission denied for function get_billing_workspace_waivers',
  'anonymous callers cannot read waivers'
);

select * from finish();

rollback;
