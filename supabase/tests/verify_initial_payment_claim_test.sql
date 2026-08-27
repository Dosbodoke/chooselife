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

-- Admission is one atomic command now: it opens the contribution schedule and
-- its admission-effective plan snapshot, and reports both ids. There is no
-- subscription behind a membership any more.
select is(
  (select count(*)::integer from public.contribution_schedules
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000101'::uuid
     and active),
  1,
  'approval opens exactly one active contribution schedule'
);

select ok(
  (select schedule_id is not null and assignment_id is not null
   from approved_claim),
  'approval reports the schedule and the plan snapshot it created'
);

select ok(
  (select exists (
     select 1
     from public.contribution_schedules cs
     join public.contribution_plan_assignments cpa on cpa.schedule_id = cs.id
     where cs.id = (select schedule_id from approved_claim)
       and cpa.id = (select assignment_id from approved_claim)
       and cpa.effective_period_start = cs.admission_date
   )),
  'the reported plan snapshot is the one effective from the admission date'
);

select is(
  (select ma.status::text
   from public.membership_applications ma
   where ma.organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and ma.user_id = '70000000-0000-4000-8000-000000000101'::uuid),
  'admitted',
  'approval marks the application admitted'
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
  'void',
  'one refusal voids the obligation it decided'
);

select is(
  (select application_status::text from rejected_claim),
  'refused',
  'the same action refuses the application'
);

select is(
  (select claim_status::text from rejected_claim),
  'rejected',
  'the same action rejects the claim'
);

select is(
  (select ma.status::text
   from public.membership_applications ma
   where ma.id = (select application_id from rejected_claim)),
  'refused',
  'the refusal is recorded on the application itself, not only in the result'
);

select is(
  (select count(*)::integer from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  0,
  'rejection creates no membership'
);

select is(
  (select count(*)::integer from public.contribution_schedules
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  0,
  'rejection opens no contribution schedule'
);

-- Nothing is deleted. The revision, the payer identity, the claim and the
-- audit trail are the evidence of what was decided, and they all survive.
select cmp_ok(
  (select count(*)::integer from public.membership_application_revisions mar
   where mar.application_id = (select application_id from rejected_claim)),
  '>',
  0,
  'the refused application keeps its submitted revision'
);

select is(
  (select count(*)::integer from public.payment_claims pc
   where pc.id = '70000000-0000-4000-8000-000000000502'::uuid),
  1,
  'the rejected claim row is preserved, not removed'
);

select cmp_ok(
  (select count(*)::integer from public.payment_claim_audit_events pcae
   where pcae.claim_id = '70000000-0000-4000-8000-000000000502'::uuid),
  '>',
  0,
  'the refusal leaves an audit event behind'
);

select is(
  (select pcae.reason from public.payment_claim_audit_events pcae
   where pcae.claim_id = '70000000-0000-4000-8000-000000000502'::uuid
     and pcae.next_state = 'payment_available'),
  'Incorrect payer',
  'the audit event carries the normalized user-visible reason'
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

-- ---------------------------------------------------------------------------
-- Rule 6, correction: a refusal is terminal for the application it decided.
--
-- The refused application, its revision, its claim and its voided obligation
-- all stay exactly as they were. Correcting means submitting a NEW application
-- with a NEW revision and a NEW obligation. The stale claim can no longer be
-- decided either way, so a reviewer cannot reach back and approve the version
-- that was already refused.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000102',
  true
);

select throws_ok(
  $$select * from public.claim_initial_payment(
    '70000000-0000-4000-8000-000000000402'::uuid,
    true,
    null
  )$$,
  '23514',
  'This payment obligation cannot be claimed.',
  'the voided obligation of a refused application cannot be claimed again'
);

set local role postgres;

-- The correction: a second application for the same person, with its own
-- revision and its own obligation. The refused row is left untouched.
insert into public.membership_applications (
  id, organization_id, user_id, status, accepted_terms_at, submitted_at
)
values (
  '70000000-0000-4000-8000-000000000212'::uuid,
  '70000000-0000-4000-8000-000000000001'::uuid,
  '70000000-0000-4000-8000-000000000102'::uuid,
  'submitted',
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
);

insert into public.membership_application_revisions (
  id, application_id, organization_id, user_id, revision_number, draft_version,
  plan_type, terms_version, accepted_terms_at, submitted_at,
  full_name, birth_date, nationality, marital_status, profession, birthplace,
  cpf, id_document_number, id_document_issuer, postal_code, address_line,
  city, state, email, phone, has_allergies, allergies,
  has_dietary_restrictions, dietary_restrictions,
  plan_amount, currency, pix_copy_paste
)
values (
  '70000000-0000-4000-8000-000000000312'::uuid,
  '70000000-0000-4000-8000-000000000212'::uuid,
  '70000000-0000-4000-8000-000000000001'::uuid,
  '70000000-0000-4000-8000-000000000102'::uuid,
  1,
  1,
  'monthly',
  'estatuto-v1',
  timezone('utc'::text, now()),
  timezone('utc'::text, now()),
  'Corrected Applicant Name',
  '1990-01-01',
  'Brazilian',
  'single',
  'Engineer',
  'Sao Paulo',
  '12345678901',
  'RG-2',
  'SSP',
  '01001000',
  'Main Street 2',
  'Sao Paulo',
  'SP',
  'corrected@example.com',
  '11999999998',
  false,
  null,
  false,
  null,
  12500,
  'BRL',
  '000201initial-monthly'
);

insert into public.payment_obligations (
  id, organization_id, user_id, application_revision_id, purpose, status,
  plan_type, amount, currency, payment_method, pix_copy_paste, available_at
)
values (
  '70000000-0000-4000-8000-000000000412'::uuid,
  '70000000-0000-4000-8000-000000000001'::uuid,
  '70000000-0000-4000-8000-000000000102'::uuid,
  '70000000-0000-4000-8000-000000000312'::uuid,
  'initial_admission',
  'available',
  'monthly',
  12500,
  'BRL',
  'manual_pix',
  '000201initial-monthly',
  timezone('utc'::text, now())
);

select is(
  (select count(*)::integer
   from public.membership_applications ma
   where ma.organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and ma.user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  2,
  'a correction is a second application, so the refused one survives intact'
);

select is(
  (select ma.status::text
   from public.membership_applications ma
   where ma.id = '70000000-0000-4000-8000-000000000202'::uuid),
  'refused',
  'the refused application is not reopened by the correction'
);

select throws_ok(
  $$insert into public.membership_applications (
      id, organization_id, user_id, status
    ) values (
      '70000000-0000-4000-8000-000000000213'::uuid,
      '70000000-0000-4000-8000-000000000001'::uuid,
      '70000000-0000-4000-8000-000000000102'::uuid,
      'submitted'
    )$$,
  '23505',
  'duplicate key value violates unique constraint "membership_applications_one_open_per_person_idx"',
  'only one application per person may be open at a time'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000102',
  true
);

select is(
  (select count(*)::integer from public.claim_initial_payment(
    '70000000-0000-4000-8000-000000000412'::uuid,
    true,
    null
  )),
  1,
  'the corrected application can be claimed on its own new obligation'
);

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000103',
  true
);

select throws_ok(
  $$select * from public.approve_initial_claim(
    '70000000-0000-4000-8000-000000000502'::uuid
  )$$,
  '40001',
  'This claim was already rejected. Refresh before deciding.',
  'the stale claim of a refused application can no longer be approved'
);

select is(
  (select decision_applied_now from public.approve_initial_claim(
    (
      select id
      from public.payment_claims
      where obligation_id = '70000000-0000-4000-8000-000000000412'::uuid
        and status = 'under_review'
    )
  )),
  true,
  'a reviewer approves the corrected submission instead'
);

set local role postgres;

select is(
  (select ma.status::text
   from public.membership_applications ma
   where ma.id = '70000000-0000-4000-8000-000000000212'::uuid),
  'admitted',
  'approval admits the corrected application'
);

set local role authenticated;

select is(
  (select count(*)::integer from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  1,
  'approving the correction admits the applicant exactly once'
);

set local role postgres;

-- Approval preserves an existing admin role rather than overwriting it.
update public.organization_members
set role = 'admin'::public.organization_role_enum
where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
  and user_id = '70000000-0000-4000-8000-000000000102'::uuid;

set local role authenticated;
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
      where obligation_id = '70000000-0000-4000-8000-000000000412'::uuid
        and status = 'approved'
    )
  )),
  false,
  'approving an already-approved claim replays its result instead of redoing it'
);

select is(
  (select role::text from public.organization_members
   where organization_id = '70000000-0000-4000-8000-000000000001'::uuid
     and user_id = '70000000-0000-4000-8000-000000000102'::uuid),
  'admin',
  'approval never demotes an existing admin role'
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
