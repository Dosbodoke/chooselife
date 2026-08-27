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
    '82000000-0000-4000-8000-000000000001'::uuid,
    'Workspace Association',
    'workspace-association',
    'association',
    'BRL',
    'America/Sao_Paulo',
    10,
    7,
    12500,
    120000,
    '000201workspace-monthly',
    '000201workspace-annual'
  ),
  (
    '82000000-0000-4000-8000-000000000002'::uuid,
    'Workspace Group',
    'workspace-group',
    'group',
    'BRL',
    'America/Sao_Paulo',
    10,
    7,
    12500,
    120000,
    '000201group-monthly',
    '000201group-annual'
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
    'workspace-admin@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Workspace Admin"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '82000000-0000-4000-8000-000000000102'::uuid,
    'authenticated',
    'authenticated',
    'workspace-member@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Workspace Member"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '82000000-0000-4000-8000-000000000103'::uuid,
    'authenticated',
    'authenticated',
    'workspace-group-admin@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Workspace Group Admin"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

insert into public.profiles (id, name, username)
values
  (
    '82000000-0000-4000-8000-000000000101'::uuid,
    'Workspace Admin',
    '@workspace_admin'
  ),
  (
    '82000000-0000-4000-8000-000000000102'::uuid,
    'Workspace Member',
    '@workspace_member'
  ),
  (
    '82000000-0000-4000-8000-000000000103'::uuid,
    'Workspace Group Admin',
    '@workspace_group_admin'
  )
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (organization_id, user_id, role)
values
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000101'::uuid,
    'admin'
  ),
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000102'::uuid,
    'member'
  ),
  (
    '82000000-0000-4000-8000-000000000002'::uuid,
    '82000000-0000-4000-8000-000000000103'::uuid,
    'admin'
  );

-- Admission opens the schedule and snapshots the plan. There is no
-- subscription behind a membership any more.
select public.ensure_contribution_schedule(
  '82000000-0000-4000-8000-000000000001'::uuid,
  '82000000-0000-4000-8000-000000000102'::uuid,
  'monthly'::public.subscription_plan_type_enum
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
  '82000000-0000-4000-8000-000000000001'::uuid,
  '82000000-0000-4000-8000-000000000102'::uuid,
  null,
  'recurring',
  'available',
  'monthly',
  12500,
  'BRL',
  'manual_pix',
  '000201workspace-monthly',
  timezone('utc'::text, now()),
  cs.id,
  obligation.period_key,
  current_date,
  obligation.due_on,
  current_date - 1,
  obligation.due_on
from (
  values
    (
      '82000000-0000-4000-8000-000000000201'::uuid,
      'workspace:current',
      (current_date + 7)::date
    ),
    (
      '82000000-0000-4000-8000-000000000202'::uuid,
      'workspace:retry',
      (current_date + 14)::date
    )
) as obligation(id, period_key, due_on)
join public.contribution_schedules cs
  on cs.organization_id = '82000000-0000-4000-8000-000000000001'::uuid
  and cs.user_id = '82000000-0000-4000-8000-000000000102'::uuid;

insert into public.payment_claims (
  id,
  obligation_id,
  organization_id,
  claimant_user_id,
  payer_type,
  payer_name,
  status
)
values
  (
    '82000000-0000-4000-8000-000000000301'::uuid,
    '82000000-0000-4000-8000-000000000201'::uuid,
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000102'::uuid,
    'applicant',
    null,
    'under_review'
  ),
  (
    '82000000-0000-4000-8000-000000000302'::uuid,
    '82000000-0000-4000-8000-000000000202'::uuid,
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000102'::uuid,
    'other',
    'Workspace Payer',
    'under_review'
  );

insert into public.payment_claim_audit_events (
  organization_id,
  obligation_id,
  claim_id,
  actor_user_id,
  previous_state,
  next_state
)
values
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000201'::uuid,
    '82000000-0000-4000-8000-000000000301'::uuid,
    '82000000-0000-4000-8000-000000000102'::uuid,
    'payment_available',
    'under_review'
  ),
  (
    '82000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000202'::uuid,
    '82000000-0000-4000-8000-000000000302'::uuid,
    '82000000-0000-4000-8000-000000000102'::uuid,
    'payment_available',
    'under_review'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_people(
     '82000000-0000-4000-8000-000000000001'::uuid
   )),
  2,
  'the people ledger returns active association members with profile fields'
);

select is(
  (select count(*)::integer from public.get_billing_workspace_organizations()),
  1,
  'the workspace lists only association admin scopes'
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_queue(
     '82000000-0000-4000-8000-000000000001'::uuid
   )),
  2,
  'the queue combines the association''s recurring claims'
);

select is(
  (select approve_command
   from public.get_billing_workspace_queue(
     '82000000-0000-4000-8000-000000000001'::uuid
   )
   where claim_id = '82000000-0000-4000-8000-000000000301'::uuid),
  'approve_recurring_payment_claim',
  'recurring queue rows expose the purpose-specific approval command'
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_claim_detail(
     '82000000-0000-4000-8000-000000000301'::uuid
   )),
  1,
  'an association admin can inspect an authorized recurring claim'
);

select is(
  (select audit_history->0->>'actor_name'
   from public.get_billing_workspace_claim_detail(
     '82000000-0000-4000-8000-000000000301'::uuid
   )),
  'Workspace Member',
  'claim detail keeps the server-derived audit actor'
);

select is(
  (select effective_payment_state
   from public.get_billing_workspace_payments(
     '82000000-0000-4000-8000-000000000001'::uuid
   )
   where obligation_id = '82000000-0000-4000-8000-000000000201'::uuid),
  'under_review',
  'payments expose the current effective obligation state'
);

select is(
  (select financial_standing
   from public.get_billing_workspace_members(
     '82000000-0000-4000-8000-000000000001'::uuid
   )
   where member_user_id = '82000000-0000-4000-8000-000000000102'::uuid),
  'under_review',
  'members derive standing from the active claim'
);

select is(
  (select decision_applied_now
   from public.approve_recurring_payment_claim(
     '82000000-0000-4000-8000-000000000301'::uuid
   )),
  true,
  'approval settles one recurring obligation'
);

select is(
  (select role::text
   from public.organization_members
   where organization_id = '82000000-0000-4000-8000-000000000001'::uuid
     and user_id = '82000000-0000-4000-8000-000000000102'::uuid),
  'member',
  'recurring approval never changes legal membership'
);

select is(
  (select effective_payment_state
   from public.get_billing_workspace_payments(
     '82000000-0000-4000-8000-000000000001'::uuid
   )
   where obligation_id = '82000000-0000-4000-8000-000000000201'::uuid),
  'settled',
  'payments refresh from the settled obligation state'
);

select is(
  (select decision_reason
   from public.reject_recurring_payment_claim(
     '82000000-0000-4000-8000-000000000302'::uuid,
     '  Retry   with   the   correct   payer  '
   )),
  'Retry with the correct payer',
  'recurring rejection normalizes and preserves its reason'
);

select is(
  (select status::text
   from public.payment_obligations
   where id = '82000000-0000-4000-8000-000000000202'::uuid),
  'available',
  'recurring rejection leaves the obligation actionable'
);

select is(
  (select decision_applied_now
   from public.reject_recurring_payment_claim(
     '82000000-0000-4000-8000-000000000302'::uuid,
     'Retry with the correct payer'
   )),
  false,
  'identical recurring rejection retries are idempotent'
);

set local role postgres;

select throws_ok(
  $$select * from public.reject_recurring_payment_claim(
    '82000000-0000-4000-8000-000000000302'::uuid,
    'Different reason'
  )$$,
  '40001',
  'This claim was already rejected with a different reason. Refresh before deciding.',
  'a conflicting recurring rejection cannot rewrite history'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000103',
  true
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_queue(
     '82000000-0000-4000-8000-000000000002'::uuid
   )),
  0,
  'a group admin cannot list an association billing workspace'
);

select is(
  (select count(*)::integer
   from public.get_billing_workspace_claim_detail(
     '82000000-0000-4000-8000-000000000301'::uuid
   )),
  0,
  'a group admin cannot inspect an association claim'
);

select throws_ok(
  $$select * from public.approve_recurring_payment_claim(
    '82000000-0000-4000-8000-000000000301'::uuid
  )$$,
  '42501',
  'Association admin access is required.',
  'a group admin cannot decide an association claim'
);

select * from finish();
rollback;
