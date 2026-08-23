begin;

select * from no_plan();

insert into public.organizations (
  id,
  name,
  slug,
  organization_type,
  billing_currency,
  membership_terms_version,
  monthly_price_amount,
  annual_price_amount,
  monthly_pix_copy_paste,
  annual_pix_copy_paste
)
values
  (
    '70000000-0000-4000-8000-000000000001'::uuid,
    'Admission Association',
    'admission-association',
    'association',
    'BRL',
    'estatuto-v1',
    12500,
    120000,
    '000201initial-monthly',
    '000201initial-annual'
  ),
  (
    '70000000-0000-4000-8000-000000000002'::uuid,
    'Informal Group',
    'informal-group',
    'group',
    'BRL',
    'group-v1',
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
    '70000000-0000-4000-8000-000000000101'::uuid,
    'authenticated',
    'authenticated',
    'admission-applicant@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Admission Applicant"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000102'::uuid,
    'authenticated',
    'authenticated',
    'admission-applicant-two@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Second Applicant"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000103'::uuid,
    'authenticated',
    'authenticated',
    'admission-reviewer@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Association Reviewer"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000104'::uuid,
    'authenticated',
    'authenticated',
    'admission-outsider@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Outside Reviewer"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000105'::uuid,
    'authenticated',
    'authenticated',
    'admission-legacy@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Legacy Applicant"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

insert into public.profiles (id, name, username, profile_picture)
values
  (
    '70000000-0000-4000-8000-000000000101'::uuid,
    'Admission Applicant',
    '@admission_applicant',
    'https://example.com/admission-applicant.jpg'
  ),
  (
    '70000000-0000-4000-8000-000000000102'::uuid,
    'Second Applicant',
    '@second_applicant',
    null
  ),
  (
    '70000000-0000-4000-8000-000000000103'::uuid,
    'Association Reviewer',
    '@association_reviewer',
    null
  ),
  (
    '70000000-0000-4000-8000-000000000104'::uuid,
    'Outside Reviewer',
    '@outside_reviewer',
    null
  ),
  (
    '70000000-0000-4000-8000-000000000105'::uuid,
    'Legacy Applicant',
    '@legacy_applicant',
    null
  )
on conflict (id) do update
set name = excluded.name,
    username = excluded.username,
    profile_picture = excluded.profile_picture;

insert into public.organization_members (organization_id, user_id, role)
values
  (
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000103'::uuid,
    'admin'
  ),
  (
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000103'::uuid,
    'admin'
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
    '70000000-0000-4000-8000-000000000201'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000101'::uuid,
    'submitted',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000202'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    'submitted',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000205'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000105'::uuid,
    'submitted',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000203'::uuid,
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
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
  full_name,
  birth_date,
  nationality,
  marital_status,
  profession,
  birthplace,
  cpf,
  id_document_number,
  id_document_issuer,
  postal_code,
  address_line,
  city,
  state,
  email,
  phone,
  has_allergies,
  allergies,
  has_dietary_restrictions,
  dietary_restrictions,
  plan_amount,
  currency,
  pix_copy_paste
)
values
  (
    '70000000-0000-4000-8000-000000000301'::uuid,
    '70000000-0000-4000-8000-000000000201'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000101'::uuid,
    1,
    1,
    'monthly',
    'estatuto-v1',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    'Frozen Applicant Name',
    '1990-01-01',
    'Brazilian',
    'single',
    'Engineer',
    'Sao Paulo',
    '12345678901',
    'RG-1',
    'SSP',
    '01001000',
    'Main Street 1',
    'Sao Paulo',
    'SP',
    'frozen@example.com',
    '11999999999',
    false,
    null,
    false,
    null,
    12500,
    'BRL',
    '000201initial-monthly'
  ),
  (
    '70000000-0000-4000-8000-000000000302'::uuid,
    '70000000-0000-4000-8000-000000000202'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    1,
    1,
    'annual',
    'estatuto-v1',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    'Second Applicant',
    '1991-02-02',
    'Brazilian',
    'single',
    'Designer',
    'Rio',
    '12345678902',
    'RG-2',
    'SSP',
    '20000000',
    'Second Street 2',
    'Rio',
    'RJ',
    'second@example.com',
    '21999999999',
    false,
    null,
    false,
    null,
    120000,
    'BRL',
    '000201initial-annual'
  ),
  (
    '70000000-0000-4000-8000-000000000305'::uuid,
    '70000000-0000-4000-8000-000000000205'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000105'::uuid,
    1,
    1,
    'monthly',
    'estatuto-v1',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    'Legacy Applicant',
    '1992-03-03',
    'Brazilian',
    'single',
    'Guide',
    'Belo Horizonte',
    '12345678903',
    'RG-3',
    'SSP',
    '30000000',
    'Third Street 3',
    'Belo Horizonte',
    'MG',
    'legacy@example.com',
    '31999999999',
    false,
    null,
    false,
    null,
    12500,
    'BRL',
    '000201initial-monthly'
  ),
  (
    '70000000-0000-4000-8000-000000000303'::uuid,
    '70000000-0000-4000-8000-000000000203'::uuid,
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    1,
    1,
    'monthly',
    'group-v1',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    'Group Applicant',
    '1993-04-04',
    'Brazilian',
    'single',
    'Athlete',
    'Curitiba',
    '12345678904',
    'RG-4',
    'SSP',
    '80000000',
    'Fourth Street 4',
    'Curitiba',
    'PR',
    'group@example.com',
    '41999999999',
    false,
    null,
    false,
    null,
    12500,
    'BRL',
    '000201group-monthly'
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
    '70000000-0000-4000-8000-000000000401'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000101'::uuid,
    '70000000-0000-4000-8000-000000000301'::uuid,
    'initial_admission',
    'available',
    'monthly',
    12500,
    'BRL',
    'manual_pix',
    '000201initial-monthly',
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000402'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    '70000000-0000-4000-8000-000000000302'::uuid,
    'initial_admission',
    'available',
    'annual',
    120000,
    'BRL',
    'manual_pix',
    '000201initial-annual',
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000403'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000105'::uuid,
    '70000000-0000-4000-8000-000000000305'::uuid,
    'initial_admission',
    'available',
    'monthly',
    12500,
    'BRL',
    'manual_pix',
    '000201initial-monthly',
    timezone('utc'::text, now())
  ),
  (
    '70000000-0000-4000-8000-000000000404'::uuid,
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    '70000000-0000-4000-8000-000000000303'::uuid,
    'initial_admission',
    'available',
    'monthly',
    12500,
    'BRL',
    'manual_pix',
    '000201group-monthly',
    timezone('utc'::text, now())
  );

insert into public.payment_claims (
  id,
  obligation_id,
  organization_id,
  claimant_user_id,
  payer_type,
  payer_name,
  status,
  created_at
)
values
  (
    '70000000-0000-4000-8000-000000000501'::uuid,
    '70000000-0000-4000-8000-000000000401'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000101'::uuid,
    'applicant',
    null,
    'under_review',
    timezone('utc'::text, now()) - interval '2 hours'
  ),
  (
    '70000000-0000-4000-8000-000000000502'::uuid,
    '70000000-0000-4000-8000-000000000402'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    'other',
    'Another person',
    'under_review',
    timezone('utc'::text, now()) - interval '1 hour'
  ),
  (
    '70000000-0000-4000-8000-000000000504'::uuid,
    '70000000-0000-4000-8000-000000000404'::uuid,
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    'applicant',
    null,
    'under_review',
    timezone('utc'::text, now())
  );

insert into public.payment_claim_audit_events (
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
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000401'::uuid,
    '70000000-0000-4000-8000-000000000501'::uuid,
    '70000000-0000-4000-8000-000000000101'::uuid,
    'payment_available',
    'under_review',
    timezone('utc'::text, now()) - interval '2 hours'
  ),
  (
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000402'::uuid,
    '70000000-0000-4000-8000-000000000502'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    'payment_available',
    'under_review',
    timezone('utc'::text, now()) - interval '1 hour'
  ),
  (
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000404'::uuid,
    '70000000-0000-4000-8000-000000000504'::uuid,
    '70000000-0000-4000-8000-000000000102'::uuid,
    'payment_available',
    'under_review',
    timezone('utc'::text, now())
  );

-- The queue is summary-only and scoped to association admins.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000103',
  true
);

select is(
  (select count(*)::integer from public.get_initial_payment_claim_queue()),
  2,
  'an association admin sees only current association claims'
);

select is(
  (select applicant_name from public.get_initial_payment_claim_queue()
   where claim_id = '70000000-0000-4000-8000-000000000501'::uuid),
  'Admission Applicant',
  'queue uses the safe profile identity'
);

select is(
  (select attempt_count::integer from public.get_initial_payment_claim_queue()
   where claim_id = '70000000-0000-4000-8000-000000000501'::uuid),
  1,
  'queue reports the immutable claim attempt count'
);

select is(
  (select count(*)::integer from public.get_initial_payment_claim_detail(
    '70000000-0000-4000-8000-000000000501'::uuid
  )),
  1,
  'an association admin can inspect one authorized claim detail'
);

select is(
  (select full_name from public.get_initial_payment_claim_detail(
    '70000000-0000-4000-8000-000000000501'::uuid
  )),
  'Frozen Applicant Name',
  'detail reads the exact immutable application revision'
);

select is(
  (select claim_history->0->>'claim_id'
   from public.get_initial_payment_claim_detail(
     '70000000-0000-4000-8000-000000000501'::uuid
   )),
  '70000000-0000-4000-8000-000000000501',
  'detail preserves ordered claim history'
);

create temp table approved_claim as
select *
from public.approve_initial_claim(
  '70000000-0000-4000-8000-000000000501'::uuid
);

select is(
  (select claim_status::text from approved_claim),
  'approved',
  'approval returns the authoritative claim decision'
);

select is(
  (select obligation_status::text from approved_claim),
  'settled',
  'approval settles the initial obligation atomically'
);

set local role postgres;

select is(
  (select status::text from public.subscriptions
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000101'::uuid),
  'active',
  'approval activates the selected subscription'
);

select ok(
  (select current_period_end is not null from public.subscriptions
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000101'::uuid),
  'approval creates the first recurring schedule'
);

set local role authenticated;

select is(
  (select count(*)::integer from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000101'::uuid),
  1,
  'approval creates exactly one membership'
);

select is(
  (select count(*)::integer from public.payment_claim_audit_events
   where claim_id = '70000000-0000-4000-8000-000000000501'::uuid),
  2,
  'approval appends one payment-settled audit event'
);

select is(
  (select actor_user_id from public.payment_claim_audit_events
   where claim_id = '70000000-0000-4000-8000-000000000501'::uuid
     and next_state = 'payment_settled'),
  '70000000-0000-4000-8000-000000000103'::uuid,
  'approval audit derives the reviewer actor'
);

select is(
  (select decision_applied_now from public.approve_initial_claim(
    '70000000-0000-4000-8000-000000000501'::uuid
  )),
  false,
  'identical approval retry returns the existing result'
);

select is(
  (select count(*)::integer from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000101'::uuid),
  1,
  'identical approval retry does not duplicate membership'
);

select throws_ok(
  $$select * from public.reject_initial_claim(
    '70000000-0000-4000-8000-000000000501'::uuid,
    'Too late'
  )$$,
  '40001',
  'This claim was already approved. Refresh before deciding.',
  'an approved claim cannot be rejected'
);

select throws_ok(
  $$select * from public.reject_initial_claim(
    '70000000-0000-4000-8000-000000000502'::uuid,
    '   '
  )$$,
  '22023',
  'A rejection reason is required.',
  'rejection requires a nonblank reason'
);

create temp table rejected_claim as
select *
from public.reject_initial_claim(
  '70000000-0000-4000-8000-000000000502'::uuid,
  '  Incorrect   payer  '
);

select is(
  (select decision_reason from rejected_claim),
  'Incorrect payer',
  'rejection reasons are normalized server-side'
);

set local role postgres;

select is(
  (select status::text from public.payment_obligations
   where id = '70000000-0000-4000-8000-000000000402'::uuid),
  'available',
  'rejection leaves the same obligation actionable'
);

select is(
  (select count(*)::integer from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  0,
  'rejection creates no membership'
);

select is(
  (select count(*)::integer from public.subscriptions
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  0,
  'rejection creates no subscription schedule'
);

set local role authenticated;

select is(
  (select decision_applied_now from public.reject_initial_claim(
    '70000000-0000-4000-8000-000000000502'::uuid,
    'Incorrect payer'
  )),
  false,
  'identical rejection retry returns the existing result'
);

select throws_ok(
  $$select * from public.reject_initial_claim(
    '70000000-0000-4000-8000-000000000502'::uuid,
    'Different reason'
  )$$,
  '40001',
  'This claim was already rejected with a different reason. Refresh before deciding.',
  'a conflicting rejection retry cannot rewrite history'
);

set local role postgres;

insert into public.organization_members (organization_id, user_id, role)
values (
  '70000000-0000-4000-8000-000000000001'::uuid,
  '70000000-0000-4000-8000-000000000102'::uuid,
  'admin'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000102',
  true
);

select is(
  (select count(*)::integer from public.claim_initial_payment(
    '70000000-0000-4000-8000-000000000402'::uuid,
    true,
    null
  )),
  1,
  'a later claim can be submitted against the same obligation after rejection'
);

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000103',
  true
);

select is(
  (select decision_applied_now from public.approve_initial_claim(
    (
      select id
      from public.payment_claims
      where obligation_id = '70000000-0000-4000-8000-000000000402'::uuid
        and status = 'under_review'
    )
  )),
  true,
  'an authorized reviewer can approve the later claim'
);

select is(
  (select role::text from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  'admin',
  'approval never demotes an existing admin role'
);

select is(
  (select count(*)::integer from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  1,
  'approving a later claim admits the applicant exactly once'
);

set local role postgres;

create temp table legacy_subscription as
select gen_random_uuid() as id;

insert into public.subscriptions (
  id,
  organization_id,
  user_id,
  plan_type,
  status
)
select
  id,
  '70000000-0000-4000-8000-000000000001'::uuid,
  '70000000-0000-4000-8000-000000000105'::uuid,
  'monthly',
  'pending_payment'
from legacy_subscription;

insert into public.payments (
  id,
  organization_id,
  user_id,
  subscription_id,
  amount,
  status
)
select
  '70000000-0000-4000-8000-000000000601'::uuid,
  '70000000-0000-4000-8000-000000000001'::uuid,
  '70000000-0000-4000-8000-000000000105'::uuid,
  id,
  12500,
  'pending'
from legacy_subscription;

update public.payment_obligations
set legacy_payment_id = '70000000-0000-4000-8000-000000000601'::uuid
where id = '70000000-0000-4000-8000-000000000403'::uuid;

update public.payments
set status = 'succeeded', paid_at = timezone('utc'::text, now())
where id = '70000000-0000-4000-8000-000000000601'::uuid;

select is(
  (select status::text from public.subscriptions
   where user_id = '70000000-0000-4000-8000-000000000105'::uuid),
  'pending_payment',
  'generic payment settlement cannot activate an initial-admission subscription'
);

select is(
  (select count(*)::integer from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000105'::uuid),
  0,
  'generic payment settlement cannot admit an initial applicant'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000104',
  true
);

select is(
  (select count(*)::integer from public.get_initial_payment_claim_queue()),
  0,
  'an admin of another association cannot list this queue'
);

select is(
  (select count(*)::integer from public.get_initial_payment_claim_detail(
    '70000000-0000-4000-8000-000000000502'::uuid
  )),
  0,
  'an admin of another association cannot inspect this claim'
);

select throws_ok(
  $$select * from public.approve_initial_claim(
    '70000000-0000-4000-8000-000000000502'::uuid
  )$$,
  '42501',
  'This claim is unavailable to the current reviewer.',
  'an admin of another association cannot decide this claim'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_claims', 'UPDATE'),
  'authenticated clients cannot update claims directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_claim_audit_events', 'INSERT'),
  'authenticated clients cannot insert audit events directly'
);

set local role postgres;

select throws_ok(
  $$update public.payment_claims
    set status = 'rejected',
        decided_at = timezone('utc'::text, now()),
        decision_reason = 'Bypass'
    where id = '70000000-0000-4000-8000-000000000504'::uuid$$,
  '42501',
  'Payment claim decisions must use the decision command.',
  'raw server-side decision mutation cannot bypass the command'
);

select * from finish();
rollback;
