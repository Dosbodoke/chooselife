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
values (
  '83000000-0000-4000-8000-000000000001'::uuid,
  'Departures Association',
  'departures-association',
  'association',
  'BRL',
  'America/Sao_Paulo',
  10,
  7,
  12500,
  120000,
  '000201departures-monthly',
  '000201departures-annual'
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
  jsonb_build_object('full_name', persona.display_name),
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
from (
  values
    ('83000000-0000-4000-8000-000000000101'::uuid, 'departures-admin@example.com', 'Departures Admin'),
    ('83000000-0000-4000-8000-000000000102'::uuid, 'departures-member@example.com', 'Departures Member'),
    ('83000000-0000-4000-8000-000000000103'::uuid, 'departures-applicant@example.com', 'Departures Applicant'),
    ('83000000-0000-4000-8000-000000000104'::uuid, 'departures-drafter@example.com', 'Departures Drafter'),
    ('83000000-0000-4000-8000-000000000105'::uuid, 'departures-outsider@example.com', 'Departures Outsider')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('83000000-0000-4000-8000-000000000101'::uuid, 'Departures Admin', '@departures_admin'),
    ('83000000-0000-4000-8000-000000000102'::uuid, 'Departures Member', '@departures_member'),
    ('83000000-0000-4000-8000-000000000103'::uuid, 'Departures Applicant', '@departures_applicant'),
    ('83000000-0000-4000-8000-000000000104'::uuid, 'Departures Drafter', '@departures_drafter'),
    ('83000000-0000-4000-8000-000000000105'::uuid, 'Departures Outsider', '@departures_outsider')
) as persona(id, display_name, handle)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (organization_id, user_id, role, joined_at)
values
  (
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000101'::uuid,
    'admin',
    timezone('utc'::text, now()) - interval '2 years'
  ),
  (
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000102'::uuid,
    'member',
    timezone('utc'::text, now()) - interval '1 year'
  );

-- Admission opens the schedule now that no membership trigger does it.
select public.ensure_contribution_schedule(
  '83000000-0000-4000-8000-000000000001'::uuid,
  '83000000-0000-4000-8000-000000000102'::uuid,
  'monthly'::public.subscription_plan_type_enum,
  (timezone('America/Sao_Paulo', now()) - interval '1 year')::date
);

-- One unpaid recurring obligation, so the ledger has something that must
-- survive the departure.
insert into public.payment_obligations (
  organization_id,
  user_id,
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
  due_on
)
select
  cs.organization_id,
  cs.user_id,
  'recurring',
  'available',
  'monthly',
  12500,
  'BRL',
  'manual_pix',
  '000201departures-monthly',
  timezone('utc'::text, now()) - interval '40 days',
  cs.id,
  cpa.id,
  'monthly:' || to_char(
    (timezone('America/Sao_Paulo', now()) - interval '1 month')::date, 'YYYY-MM-DD'),
  (timezone('America/Sao_Paulo', now()) - interval '1 month')::date,
  (timezone('America/Sao_Paulo', now()) - interval '1 day')::date,
  (timezone('America/Sao_Paulo', now()) - interval '40 days')::date,
  (timezone('America/Sao_Paulo', now()) - interval '30 days')::date
from public.contribution_schedules cs
join public.contribution_plan_assignments cpa on cpa.schedule_id = cs.id
where cs.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
  and cs.user_id = '83000000-0000-4000-8000-000000000102'::uuid;

-- One submitted application and one abandoned draft.
insert into public.membership_applications (
  id,
  organization_id,
  user_id,
  status
)
values
  (
    '83000000-0000-4000-8000-000000000301'::uuid,
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000103'::uuid,
    'submitted'
  ),
  (
    '83000000-0000-4000-8000-000000000302'::uuid,
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000104'::uuid,
    'draft'
  );

-- ---------------------------------------------------------------------------
-- Rule 1: a client cannot write organization_members directly.
--
-- These used to be open: any signed-in user could insert themselves as a
-- member and delete themselves out again, with no application, no
-- contribution, no decision and no membership period recorded.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000105',
  true
);

select throws_ok(
  $$insert into public.organization_members (organization_id, user_id, role)
    values (
      '83000000-0000-4000-8000-000000000001'::uuid,
      '83000000-0000-4000-8000-000000000105'::uuid,
      'member'
    )$$,
  '42501',
  'permission denied for table organization_members',
  'a client cannot insert itself into an association'
);

select throws_ok(
  $$delete from public.organization_members
    where user_id = '83000000-0000-4000-8000-000000000105'::uuid$$,
  '42501',
  'permission denied for table organization_members',
  'a client cannot delete a membership row'
);

select throws_ok(
  $$update public.organization_members set role = 'admin'
    where organization_id = '83000000-0000-4000-8000-000000000001'::uuid$$,
  '42501',
  'permission denied for table organization_members',
  'a client cannot promote itself to admin'
);

select is(
  (select count(*)::integer
   from public.organization_members om
   where om.organization_id = '83000000-0000-4000-8000-000000000001'::uuid),
  2,
  'signed-in clients can still read the membership list'
);

-- ---------------------------------------------------------------------------
-- Rule 2: only an association admin may end a membership.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select * from public.end_association_membership(
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000102'::uuid
  )$$,
  '42501',
  'You are not authorized to end this membership.',
  'an outsider cannot end somebody else''s membership'
);

select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000102',
  true
);

select throws_ok(
  $$select * from public.end_association_membership(
    '83000000-0000-4000-8000-000000000001'::uuid
  )$$,
  '42501',
  'You are not authorized to end this membership.',
  'a member cannot end their own membership; departure is an admin action'
);

-- ---------------------------------------------------------------------------
-- Rule 3: departure writes exactly one immutable period, retires the
-- schedule, and leaves the debt owed.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select departed_role::text
   from public.end_association_membership(
     '83000000-0000-4000-8000-000000000001'::uuid,
     '83000000-0000-4000-8000-000000000102'::uuid,
     'Mudou de cidade.'
   )),
  'member',
  'an association admin can end a member''s membership'
);

select is(
  (select count(*)::integer
   from public.organization_membership_departures d
   where d.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and d.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  1,
  'departure writes exactly one membership period'
);

set local role postgres;

select ok(
  (select d.departed_role = 'member'::public.organization_role_enum
     and d.joined_at = om_snapshot.joined_at
     and d.actor_user_id = '83000000-0000-4000-8000-000000000101'::uuid
     and d.reason = 'Mudou de cidade.'
     and d.departed_at >= d.joined_at
   from public.organization_membership_departures d
   cross join (
     select (timezone('utc'::text, now()) - interval '1 year') as joined_at
   ) om_snapshot
   where d.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  'the period copies the role and joined_at it closed, and records the actor'
);

select is(
  (select count(*)::integer
   from public.organization_members om
   where om.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and om.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  0,
  'the membership row is gone, so every membership check keeps reading correctly'
);

select is(
  (select count(*)::integer
   from public.contribution_schedules cs
   where cs.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '83000000-0000-4000-8000-000000000102'::uuid
     and cs.active),
  0,
  'the contribution schedule is retired so no new periods are generated'
);

select is(
  (select status::text
   from public.payment_obligations po
   where po.user_id = '83000000-0000-4000-8000-000000000102'::uuid
     and po.purpose = 'recurring'),
  'available',
  'walking away does not settle or void what was already owed'
);

select throws_ok(
  $$update public.organization_membership_departures
    set reason = 'rewritten'$$,
  '55000',
  'Membership periods are append-only.',
  'a recorded membership period cannot be rewritten'
);

select throws_ok(
  $$delete from public.organization_membership_departures$$,
  '55000',
  'Membership periods are append-only.',
  'a recorded membership period cannot be deleted'
);

-- The former member still sees the debt, and so does the admin, but the
-- former member can no longer pay it.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000102',
  true
);

select is(
  (select count(*)::integer
   from public.payment_obligations po
   where po.organization_id = '83000000-0000-4000-8000-000000000001'::uuid),
  1,
  'a former member can still read the obligations they left behind'
);

select is(
  (select count(*)::integer
   from public.organization_membership_departures d
   where d.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  1,
  'a former member can read their own closed membership period'
);

select throws_ok(
  format(
    $$select * from public.claim_recurring_payment(%L::uuid, true)$$,
    (select po.id from public.payment_obligations po
     where po.user_id = '83000000-0000-4000-8000-000000000102'::uuid limit 1)
  ),
  '23514',
  'This recurring contribution cannot be claimed.',
  'a former member cannot claim the contributions they still owe'
);

select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select count(*)::integer
   from public.payment_obligations po
   where po.organization_id = '83000000-0000-4000-8000-000000000001'::uuid),
  1,
  'an association admin can still read a former member''s obligations'
);

select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000105',
  true
);

select is(
  (select count(*)::integer
   from public.payment_obligations po
   where po.organization_id = '83000000-0000-4000-8000-000000000001'::uuid),
  0,
  'an unrelated signed-in user reads none of it'
);

select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000101',
  true
);

select throws_ok(
  $$select * from public.end_association_membership(
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000102'::uuid
  )$$,
  'P0002',
  'This person is not a current member of the association.',
  'ending an already-ended membership is rejected'
);

-- ---------------------------------------------------------------------------
-- Rule 9: the people ledger shows one row per person, with active beating
-- submitted beating inactive, and drafts excluded entirely.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from public.get_billing_workspace_people(
     '83000000-0000-4000-8000-000000000001'::uuid
   )
   where member_user_id = '83000000-0000-4000-8000-000000000104'::uuid),
  0,
  'the person behind an abandoned draft is not listed at all'
);

select is(
  (select lifecycle_status
   from public.get_billing_workspace_people(
     '83000000-0000-4000-8000-000000000001'::uuid
   )
   where member_user_id = '83000000-0000-4000-8000-000000000103'::uuid),
  'pending',
  'a submitted application reads as pending'
);

select is(
  (select lifecycle_status
   from public.get_billing_workspace_people(
     '83000000-0000-4000-8000-000000000001'::uuid
   )
   where member_user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  'inactive',
  'an ex-member stays on the ledger as inactive instead of vanishing'
);

select is(
  (select departed_at is not null
   from public.get_association_member_detail(
     '83000000-0000-4000-8000-000000000001'::uuid,
     '83000000-0000-4000-8000-000000000102'::uuid
   )),
  true,
  'member detail reports the closed period while there is no live membership'
);

-- ---------------------------------------------------------------------------
-- Rule 4: rejoining is a NEW membership. It never backfills the absence, and
-- leaving again yields a second, distinct period.
-- ---------------------------------------------------------------------------

set local role postgres;

insert into public.organization_members (organization_id, user_id, role, joined_at)
values (
  '83000000-0000-4000-8000-000000000001'::uuid,
  '83000000-0000-4000-8000-000000000102'::uuid,
  'member',
  timezone('utc'::text, now())
);

select public.ensure_contribution_schedule(
  '83000000-0000-4000-8000-000000000001'::uuid,
  '83000000-0000-4000-8000-000000000102'::uuid,
  'annual'::public.subscription_plan_type_enum
);

select is(
  (select count(*)::integer
   from public.contribution_schedules cs
   where cs.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  2,
  'a rejoin opens a second schedule rather than reviving the retired one'
);

select is(
  (select cs.admission_date
   from public.contribution_schedules cs
   where cs.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '83000000-0000-4000-8000-000000000102'::uuid
     and cs.active),
  timezone('America/Sao_Paulo', now())::date,
  'the new schedule is anchored on the new admission, not on the old one'
);

select is(
  (select cs.cadence::text
   from public.contribution_schedules cs
   where cs.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '83000000-0000-4000-8000-000000000102'::uuid
     and cs.active),
  'annual',
  'a rejoin may choose a different plan'
);

select is(
  (select cpa.amount
   from public.contribution_schedules cs
   join public.contribution_plan_assignments cpa on cpa.schedule_id = cs.id
   where cs.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '83000000-0000-4000-8000-000000000102'::uuid
     and cs.active),
  120000,
  'the new membership snapshots the current price for the plan it chose'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select lifecycle_status
   from public.get_billing_workspace_people(
     '83000000-0000-4000-8000-000000000001'::uuid
   )
   where member_user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  'active',
  'a rejoined person reads as active, not as an ex-member'
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_people(
     '83000000-0000-4000-8000-000000000001'::uuid
   )
   where member_user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  1,
  'a rejoined person appears exactly once, not once per membership period'
);

select is(
  (select departed_at
   from public.get_association_member_detail(
     '83000000-0000-4000-8000-000000000001'::uuid,
     '83000000-0000-4000-8000-000000000102'::uuid
   )),
  null,
  'member detail does not present the old departure as a rejoined member''s state'
);

select is(
  (select departed_role::text
   from public.end_association_membership(
     '83000000-0000-4000-8000-000000000001'::uuid,
     '83000000-0000-4000-8000-000000000102'::uuid,
     'Saiu de novo.'
   )),
  'member',
  'the rejoined membership can be ended again'
);

select is(
  (select count(*)::integer
   from public.organization_membership_departures d
   where d.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and d.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  2,
  'leave, rejoin, leave yields two distinct closed periods'
);

select is(
  (select count(distinct d.joined_at)::integer
   from public.organization_membership_departures d
   where d.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  2,
  'the two periods have different start dates, so neither backfilled the gap'
);

-- ---------------------------------------------------------------------------
-- Rule 2, continued: an admin may end their own membership, and the database
-- does not insist that one admin remains.
-- ---------------------------------------------------------------------------

select is(
  (select departed_role::text
   from public.end_association_membership(
     '83000000-0000-4000-8000-000000000001'::uuid
   )),
  'admin',
  'an admin can end their own membership without naming themselves'
);

select * from finish();
rollback;
