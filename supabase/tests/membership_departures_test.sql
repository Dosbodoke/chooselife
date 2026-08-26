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
    ('83000000-0000-4000-8000-000000000104'::uuid, 'departures-drafter@example.com', 'Departures Drafter')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('83000000-0000-4000-8000-000000000101'::uuid, 'Departures Admin', '@departures_admin'),
    ('83000000-0000-4000-8000-000000000102'::uuid, 'Departures Member', '@departures_member'),
    ('83000000-0000-4000-8000-000000000103'::uuid, 'Departures Applicant', '@departures_applicant'),
    ('83000000-0000-4000-8000-000000000104'::uuid, 'Departures Drafter', '@departures_drafter')
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

insert into public.subscriptions (
  organization_id,
  user_id,
  plan_type,
  status,
  current_period_end
)
values (
  '83000000-0000-4000-8000-000000000001'::uuid,
  '83000000-0000-4000-8000-000000000102'::uuid,
  'monthly',
  'active',
  timezone('utc'::text, now()) + interval '1 month'
);

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

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_people(
     '83000000-0000-4000-8000-000000000001'::uuid
   )
   where lifecycle_status = 'draft'),
  0,
  'unsubmitted drafts never reach the people ledger'
);

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
  'active',
  'a current member reads as active'
);

select throws_ok(
  $$select * from public.end_association_membership(
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000101'::uuid
  )$$,
  '23514',
  'Promote another admin before ending the last admin membership.',
  'the last admin cannot walk out of the association'
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
  (select lifecycle_status
   from public.get_billing_workspace_people(
     '83000000-0000-4000-8000-000000000001'::uuid
   )
   where member_user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  'inactive',
  'an ex-member stays on the ledger as inactive instead of vanishing'
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
  (select active
   from public.contribution_schedules cs
   where cs.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  false,
  'the contribution schedule is retired so no new periods are generated'
);

set local role postgres;

select is(
  (select status::text
   from public.subscriptions s
   where s.organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and s.user_id = '83000000-0000-4000-8000-000000000102'::uuid),
  'canceled',
  'the subscription is canceled alongside the membership'
);

set local role authenticated;

select throws_ok(
  $$select * from public.end_association_membership(
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000102'::uuid
  )$$,
  'P0002',
  'This person is not a current member of the association.',
  'ending an already-ended membership is rejected'
);

set local role postgres;

select throws_ok(
  $$update public.organization_membership_departures
    set reason = 'rewritten'$$,
  '55000',
  'Membership departures are append-only.',
  'a recorded departure cannot be rewritten'
);

select throws_ok(
  $$delete from public.organization_membership_departures$$,
  '55000',
  'Membership departures are append-only.',
  'a recorded departure cannot be deleted'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000103',
  true
);

select throws_ok(
  $$select * from public.end_association_membership(
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000101'::uuid
  )$$,
  '42501',
  'You are not authorized to end this membership.',
  'a non-admin cannot end somebody else''s membership'
);

select * from finish();
rollback;
