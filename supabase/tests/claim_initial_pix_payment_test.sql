BEGIN;

select plan(34);

-- These fixtures model the same server-owned rows created by application
-- submission. The public command below is the seam under test.
insert into public.organizations (
  id,
  name,
  slug,
  organization_type,
  billing_currency,
  membership_terms_version,
  monthly_price_amount,
  monthly_pix_copy_paste
)
values (
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  'SL.A.C',
  'slac',
  'association',
  'BRL',
  'estatuto-v1',
  12500,
  '000201claim-test-pix'
)
on conflict (id) do update
set
  organization_type = excluded.organization_type,
  billing_currency = excluded.billing_currency,
  membership_terms_version = excluded.membership_terms_version,
  monthly_price_amount = excluded.monthly_price_amount,
  monthly_pix_copy_paste = excluded.monthly_pix_copy_paste;

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
    '11111111-1111-4111-8111-111111111111'::uuid,
    'authenticated',
    'authenticated',
    'claim-applicant@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Claim Applicant"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '22222222-2222-4222-8222-222222222222'::uuid,
    'authenticated',
    'authenticated',
    'claim-other-user@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Other User"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

insert into public.membership_applications (
  id,
  organization_id,
  user_id,
  status,
  accepted_terms_at,
  submitted_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'submitted',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'submitted',
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
values
  (
    'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    1,
    1,
    'monthly',
    'estatuto-v1',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    false,
    false,
    12500,
    'BRL',
    '000201claim-test-pix'
  ),
  (
    'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    1,
    1,
    'monthly',
    'estatuto-v1',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    false,
    false,
    12500,
    'BRL',
    '000201claim-test-pix'
  );

insert into public.organization_members (organization_id, user_id, role)
values (
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  'admin'
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
values
  (
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    'initial_admission',
    'available',
    'monthly',
    12500,
    'BRL',
    'manual_pix',
    '000201claim-test-pix',
    timezone('utc'::text, now())
  ),
  (
    'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
    'initial_admission',
    'available',
    'monthly',
    12500,
    'BRL',
    'manual_pix',
    '000201claim-test-pix',
    timezone('utc'::text, now())
  )
on conflict (id) do nothing;

insert into public.payment_claims (
  id,
  obligation_id,
  organization_id,
  claimant_user_id,
  payer_type,
  payer_name,
  status,
  created_at,
  decided_at,
  decision_reason
)
values (
    'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
    'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
  'other',
  'Former Payer',
  'rejected',
  timezone('utc'::text, now()) - interval '2 hours',
  timezone('utc'::text, now()) - interval '1 hour',
  'The first claim needs correction.'
);

insert into public.payment_claim_audit_events (
  id,
  organization_id,
  obligation_id,
  claim_id,
  actor_user_id,
  previous_state,
  next_state,
  created_at
)
values
  (
    'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2'::uuid,
    'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'payment_available',
    'under_review',
    timezone('utc'::text, now()) - interval '2 hours'
  ),
  (
    'eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2'::uuid,
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2'::uuid,
    'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'under_review',
    'payment_available',
    timezone('utc'::text, now()) - interval '1 hour'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

select is(
  (select amount from public.get_payment_obligation_instructions(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
  )),
  12500,
  'the owner sees the snapshotted amount from the obligation'
);

select is(
  (select pix_copy_paste from public.get_payment_obligation_instructions(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
  )),
  '000201claim-test-pix',
  'the owner sees the snapshotted PIX payload'
);

select is(
  (select status::text from public.get_payment_obligation_instructions(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
  )),
  'available',
  'an unclaimed initial obligation is payment_available'
);

set local role postgres;

update public.payment_obligations
set status = 'settled'
where id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid;

set local role authenticated;

select throws_ok(
  $$select * from public.claim_initial_payment(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
    true,
    null
  )$$,
  '23514',
  'This payment obligation cannot be claimed.',
  'a settled obligation cannot be claimed'
);

set local role postgres;

update public.payment_obligations
set status = 'void'
where id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid;

set local role authenticated;

select throws_ok(
  $$select * from public.claim_initial_payment(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
    true,
    null
  )$$,
  '23514',
  'This payment obligation cannot be claimed.',
  'a void obligation cannot be claimed'
);

set local role postgres;

update public.payment_obligations
set status = 'available'
where id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid;

set local role authenticated;

create temp table first_claim as
select *
from public.claim_initial_payment(
  'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
  true,
  null
);

select is(
  (select count(*)::integer from first_claim),
  1,
  'a valid claim returns one authoritative result'
);

select is(
  (select payer_type::text from first_claim),
  'applicant',
  'the default payer choice records the applicant'
);

select is(
  (select claim_status::text from first_claim),
  'under_review',
  'a valid claim enters under_review'
);

select is(
  (select claim_status::text from public.get_payment_obligation_instructions(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
  )),
  'under_review',
  'reopening the obligation returns the persisted under_review claim'
);

select is(
  (select count(*)::integer
   from public.payment_claim_audit_events
   where claim_id = (select claim_id from first_claim)),
  1,
  'the claim and its first audit event are created together'
);

select is(
  (select previous_state || ' -> ' || next_state
   from public.payment_claim_audit_events
   where claim_id = (select claim_id from first_claim)),
  'payment_available -> under_review',
  'the audit event records the applicant-facing transition'
);

select is(
  (select count(*)::integer
   from public.claim_initial_payment(
     'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
     true,
     null
   )),
  1,
  'an identical retry returns the existing claim'
);

select is(
  (select count(*)::integer
   from public.payment_claims
   where obligation_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid),
  1,
  'an identical retry does not create a second claim'
);

select is(
  (select count(*)::integer
   from public.payment_claim_audit_events
   where claim_id = (select claim_id from first_claim)),
  1,
  'an identical retry does not create a second audit event'
);

select throws_ok(
  $$select * from public.claim_initial_payment(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
    false,
    'Another Payer'
  )$$,
  '40001',
  'A payment claim is already under review with different payer details.',
  'a conflicting retry cannot overwrite payer details'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

select throws_ok(
  $$select * from public.claim_initial_payment(
    'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2'::uuid,
    false,
    '   '
  )$$,
  '22023',
  'Enter the name of the person who made the payment.',
  'another payer requires a nonblank name'
);

create temp table retried_claim as
select *
from public.claim_initial_payment(
  'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2'::uuid,
  false,
  '  Ana   Maria  '
);

select is(
  (select payer_name from retried_claim),
  'Ana Maria',
  'the server normalizes another payer name'
);

select is(
  (select count(*)::integer
   from public.payment_claims
   where obligation_id = 'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2'::uuid),
  2,
  'a retry after rejection creates a new claim'
);

select is(
  (select decision_reason
   from public.payment_claims
   where id = 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1'::uuid),
  'The first claim needs correction.',
  'the rejected claim and its decision reason remain preserved'
);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

select is(
  (select status::text from public.payment_obligations
   where id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid),
  'available',
  'claiming does not settle the obligation'
);

select is(
  (select count(*)::integer from public.organization_members
   where organization_id = '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid
     and user_id = '11111111-1111-4111-8111-111111111111'::uuid),
  0,
  'claiming does not create membership'
);

-- The legacy provider model is retired outright, so there is no parallel
-- payment row for a claim to create or settle. Assert its absence rather than
-- counting rows in a table that no longer exists.
select hasnt_table('public', 'payments', 'the legacy payments table is gone');
select hasnt_table('public', 'subscriptions', 'the legacy subscriptions table is gone');
select hasnt_column(
  'public', 'payment_obligations', 'legacy_payment_id',
  'obligations no longer carry a link to a legacy payment'
);

select is(
  (select count(*)::integer from public.get_payment_obligation_instructions(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
  )),
  1,
  'the owner can read exactly their obligation'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

select is(
  (select count(*)::integer from public.get_payment_obligation_instructions(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
  )),
  0,
  'another authenticated person cannot read the obligation'
);

select is(
  (select count(*)::integer
   from public.payment_claims
   where obligation_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid),
  1,
  'an organization admin can read the applicant claim'
);

select is(
  (select count(*)::integer
   from public.payment_claim_audit_events
   where obligation_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid),
  1,
  'an organization admin can read the claim audit event'
);

set local role service_role;

select throws_ok(
  $$update public.payment_claims
    set payer_name = 'Tampered Payer'
    where id = (
      select id
      from public.payment_claims
      where obligation_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
    )$$,
  '55000',
  'Payment claim evidence is immutable.',
  'claim evidence cannot be mutated even with server-side table access'
);

select throws_ok(
  $$update public.payment_claims
    set status = 'rejected', decided_at = null
    where id = (
      select id
      from public.payment_claims
      where obligation_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
    )$$,
  '23514',
  null,
  'terminal claims require a decision timestamp'
);

select throws_ok(
  $$insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state
  )
  values (
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
    (
      select id
      from public.payment_claims
      where obligation_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid
    ),
    '11111111-1111-4111-8111-111111111111'::uuid,
    'payment_available',
    'payment_available'
  )$$,
  '23514',
  null,
  'audit events reject invalid state transitions'
);

set local role authenticated;

select throws_ok(
  $$select * from public.claim_initial_payment(
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
    true,
    null
  )$$,
  '42501',
  'Payment obligation is unavailable.',
  'another authenticated person cannot claim the obligation'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_claims', 'INSERT'),
  'authenticated clients cannot insert payment claims directly'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_initial_payment(uuid,boolean,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the claim command'
);

SELECT * FROM finish();
ROLLBACK;
