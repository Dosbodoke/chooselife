begin;

select * from no_plan();

-- Account deletion versus association retention.
--
-- Deleting a Choose Life account has to remove the ordinary profile, but the
-- association is obliged to keep exactly what a person submitted and exactly
-- what was decided about it. Before the association_people indirection those
-- two requirements were in direct conflict: every formal record hung off
-- profiles(id) NOT NULL, so `delete from auth.users` was simply refused with
-- SQLSTATE 23503.
--
-- What this file pins down is that both halves now hold at once, and that the
-- retained half is readable by association admins and by nobody else.

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
  membership_terms_version,
  monthly_price_amount,
  annual_price_amount,
  monthly_pix_copy_paste,
  annual_pix_copy_paste
)
values (
  '84000000-0000-4000-8000-000000000001'::uuid,
  'Retention Association',
  'retention-association',
  'association',
  'BRL',
  'America/Sao_Paulo',
  10,
  7,
  'estatuto-retention-v1',
  9900,
  99000,
  '000201retention-monthly',
  '000201retention-annual'
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
    ('84000000-0000-4000-8000-000000000101'::uuid, 'retention-admin@example.com', 'Retention Admin'),
    ('84000000-0000-4000-8000-000000000102'::uuid, 'retention-leaver@example.com', 'Retention Leaver'),
    ('84000000-0000-4000-8000-000000000103'::uuid, 'retention-outsider@example.com', 'Retention Outsider')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('84000000-0000-4000-8000-000000000101'::uuid, 'Retention Admin', '@retention_admin'),
    ('84000000-0000-4000-8000-000000000102'::uuid, 'Retention Leaver', '@retention_leaver'),
    ('84000000-0000-4000-8000-000000000103'::uuid, 'Retention Outsider', '@retention_outsider')
) as persona(id, display_name, handle)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (organization_id, user_id, role, joined_at)
values
  (
    '84000000-0000-4000-8000-000000000001'::uuid,
    '84000000-0000-4000-8000-000000000101'::uuid,
    'admin',
    timezone('utc'::text, now()) - interval '3 years'
  ),
  (
    '84000000-0000-4000-8000-000000000001'::uuid,
    '84000000-0000-4000-8000-000000000102'::uuid,
    'member',
    timezone('utc'::text, now()) - interval '2 years'
  );

select public.ensure_contribution_schedule(
  '84000000-0000-4000-8000-000000000001'::uuid,
  '84000000-0000-4000-8000-000000000102'::uuid,
  'monthly'::public.subscription_plan_type_enum,
  (timezone('America/Sao_Paulo', now()) - interval '2 years')::date
);

-- The full formal trail for the person who will delete their account: the
-- application, the immutable revision they attested to, the admission
-- obligation, the claim naming a third-party payer, and the decision audit.
insert into public.membership_applications (
  id, organization_id, user_id, status, accepted_terms_at, submitted_at
)
values (
  '84000000-0000-4000-8000-000000000201'::uuid,
  '84000000-0000-4000-8000-000000000001'::uuid,
  '84000000-0000-4000-8000-000000000102'::uuid,
  'admitted',
  timezone('utc'::text, now()) - interval '2 years',
  timezone('utc'::text, now()) - interval '2 years'
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
  '84000000-0000-4000-8000-000000000301'::uuid,
  '84000000-0000-4000-8000-000000000201'::uuid,
  '84000000-0000-4000-8000-000000000001'::uuid,
  '84000000-0000-4000-8000-000000000102'::uuid,
  1,
  1,
  'monthly',
  'estatuto-retention-v1',
  timezone('utc'::text, now()) - interval '2 years',
  timezone('utc'::text, now()) - interval '2 years',
  'Retention Leaver Legal Name',
  '1985-03-03',
  'Brasileiro',
  'single',
  'Rigger',
  'Curitiba',
  '32132132132',
  'RG-RET-1',
  'SSP-PR',
  '80010000',
  'Rua da Retencao 100',
  'Curitiba',
  'PR',
  'retention-leaver@example.com',
  '41999998888',
  false,
  null,
  false,
  null,
  9900,
  'BRL',
  '000201retention-monthly'
);

insert into public.payment_obligations (
  id, organization_id, user_id, application_revision_id, purpose, status,
  plan_type, amount, currency, payment_method, pix_copy_paste,
  available_at, settled_at
)
values (
  '84000000-0000-4000-8000-000000000401'::uuid,
  '84000000-0000-4000-8000-000000000001'::uuid,
  '84000000-0000-4000-8000-000000000102'::uuid,
  '84000000-0000-4000-8000-000000000301'::uuid,
  'initial_admission',
  'settled',
  'monthly',
  9900,
  'BRL',
  'manual_pix',
  '000201retention-monthly',
  timezone('utc'::text, now()) - interval '2 years',
  timezone('utc'::text, now()) - interval '2 years'
);

insert into public.payment_claims (
  id, obligation_id, organization_id, claimant_user_id,
  payer_type, payer_name, status, decided_at, created_at
)
values (
  '84000000-0000-4000-8000-000000000501'::uuid,
  '84000000-0000-4000-8000-000000000401'::uuid,
  '84000000-0000-4000-8000-000000000001'::uuid,
  '84000000-0000-4000-8000-000000000102'::uuid,
  'other',
  'Terceiro Pagador',
  'approved',
  timezone('utc'::text, now()) - interval '2 years',
  timezone('utc'::text, now()) - interval '2 years'
);

insert into public.payment_claim_audit_events (
  id, organization_id, obligation_id, claim_id, actor_user_id,
  previous_state, next_state, created_at
)
values (
  '84000000-0000-4000-8000-000000000601'::uuid,
  '84000000-0000-4000-8000-000000000001'::uuid,
  '84000000-0000-4000-8000-000000000401'::uuid,
  '84000000-0000-4000-8000-000000000501'::uuid,
  '84000000-0000-4000-8000-000000000101'::uuid,
  'under_review',
  'payment_settled',
  timezone('utc'::text, now()) - interval '2 years'
);

-- ---------------------------------------------------------------------------
-- The subject exists and is linked to the account while the account does.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from public.association_people ap
   where ap.organization_id = '84000000-0000-4000-8000-000000000001'::uuid
     and ap.account_user_id = '84000000-0000-4000-8000-000000000102'::uuid),
  1,
  'one formal subject exists for this account in this association'
);

select is(
  (select count(*)::integer
   from public.association_people ap
   where ap.organization_id = '84000000-0000-4000-8000-000000000001'::uuid
     and ap.account_user_id = '84000000-0000-4000-8000-000000000102'::uuid
     and ap.anonymized_at is null),
  1,
  'the subject is not anonymized while the account exists'
);

select ok(
  (select bool_and(linked.association_person_id is not null)
   from (
     select association_person_id from public.membership_applications
       where id = '84000000-0000-4000-8000-000000000201'::uuid
     union all
     select association_person_id from public.membership_application_revisions
       where id = '84000000-0000-4000-8000-000000000301'::uuid
     union all
     select association_person_id from public.payment_obligations
       where id = '84000000-0000-4000-8000-000000000401'::uuid
     union all
     select association_person_id from public.payment_claims
       where id = '84000000-0000-4000-8000-000000000501'::uuid
     union all
     select association_person_id from public.payment_claim_audit_events
       where id = '84000000-0000-4000-8000-000000000601'::uuid
     union all
     select association_person_id from public.contribution_schedules
       where organization_id = '84000000-0000-4000-8000-000000000001'::uuid
         and user_id = '84000000-0000-4000-8000-000000000102'::uuid
   ) linked),
  'every formal record was linked to the subject on insert'
);

-- ---------------------------------------------------------------------------
-- Rule 11: while the account exists, the owner reads their own formal records
-- and nobody else's.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '84000000-0000-4000-8000-000000000102',
  true
);

select is(
  (select count(*)::integer from public.membership_application_revisions),
  1,
  'the applicant reads the revision they attested to'
);

select is(
  (select count(*)::integer from public.payment_claims),
  1,
  'the applicant reads their own claim'
);

select is(
  (select count(*)::integer from public.payment_claim_audit_events),
  1,
  'the applicant reads the audit trail of their own claim'
);

select is(
  (select count(*)::integer from public.association_people),
  1,
  'the applicant reads their own subject row'
);

select set_config(
  'request.jwt.claim.sub',
  '84000000-0000-4000-8000-000000000103',
  true
);

select is(
  (select count(*)::integer from public.membership_application_revisions),
  0,
  'an unrelated signed-in user reads no application revision'
);

select is(
  (select count(*)::integer from public.payment_claims),
  0,
  'an unrelated signed-in user reads no claim'
);

select is(
  (select count(*)::integer from public.payment_claim_audit_events),
  0,
  'an unrelated signed-in user reads no audit event'
);

select is(
  (select count(*)::integer from public.association_people),
  0,
  'an unrelated signed-in user reads no subject row'
);

-- ---------------------------------------------------------------------------
-- Rule 12: preparing the account for deletion closes the relationship and
-- severs the account link, and deletes nothing formal.
-- ---------------------------------------------------------------------------

set local role postgres;

select lives_ok(
  $$select public.prepare_association_account_deletion(
    '84000000-0000-4000-8000-000000000102'::uuid
  )$$,
  'the account deletion closure runs'
);

select is(
  (select count(*)::integer
   from public.organization_members om
   where om.organization_id = '84000000-0000-4000-8000-000000000001'::uuid
     and om.user_id = '84000000-0000-4000-8000-000000000102'::uuid),
  0,
  'the closure removes the active membership authorization'
);

select is(
  (select count(*)::integer
   from public.organization_membership_departures d
   where d.organization_id = '84000000-0000-4000-8000-000000000001'::uuid
     and d.user_id = '84000000-0000-4000-8000-000000000102'::uuid),
  1,
  'the closure journals the membership period it ended'
);

select is(
  (select d.actor_user_id
   from public.organization_membership_departures d
   where d.user_id = '84000000-0000-4000-8000-000000000102'::uuid),
  null,
  'a system closure records no acting admin'
);

select is(
  (select count(*)::integer
   from public.contribution_schedules cs
   where cs.organization_id = '84000000-0000-4000-8000-000000000001'::uuid
     and cs.user_id = '84000000-0000-4000-8000-000000000102'::uuid
     and cs.active),
  0,
  'the closure deactivates the contribution schedule'
);

select ok(
  (select ap.account_user_id is null and ap.anonymized_at is not null
   from public.association_people ap
   where ap.organization_id = '84000000-0000-4000-8000-000000000001'::uuid
     and ap.id = (
       select association_person_id from public.payment_obligations
       where id = '84000000-0000-4000-8000-000000000401'::uuid
     )),
  'the closure severs the account link and stamps anonymized_at'
);

-- The whole point: the hard delete must now succeed. Before the subject
-- indirection this raised SQLSTATE 23503 and account deletion was impossible.
select lives_ok(
  $$delete from auth.users where id = '84000000-0000-4000-8000-000000000102'::uuid$$,
  'the ordinary account can now actually be deleted'
);

select is(
  (select count(*)::integer from public.profiles
   where id = '84000000-0000-4000-8000-000000000102'::uuid),
  0,
  'the ordinary profile is gone'
);

-- Nothing formal went with it.
select is(
  (select count(*)::integer from public.membership_application_revisions
   where id = '84000000-0000-4000-8000-000000000301'::uuid),
  1,
  'the submitted revision is retained'
);

select is(
  (select full_name from public.membership_application_revisions
   where id = '84000000-0000-4000-8000-000000000301'::uuid),
  'Retention Leaver Legal Name',
  'the retained revision still holds exactly what was submitted'
);

select is(
  (select count(*)::integer from public.organization_membership_departures
   where association_person_id = (
     select association_person_id from public.payment_obligations
     where id = '84000000-0000-4000-8000-000000000401'::uuid
   )),
  1,
  'the membership period is retained'
);

select is(
  (select count(*)::integer from public.payment_obligations
   where id = '84000000-0000-4000-8000-000000000401'::uuid),
  1,
  'the admission obligation is retained'
);

select is(
  (select count(*)::integer from public.payment_claims
   where id = '84000000-0000-4000-8000-000000000501'::uuid),
  1,
  'the claim is retained'
);

select is(
  (select payer_name from public.payment_claims
   where id = '84000000-0000-4000-8000-000000000501'::uuid),
  'Terceiro Pagador',
  'the payer identity asserted on the claim is retained'
);

select is(
  (select count(*)::integer from public.payment_claim_audit_events
   where id = '84000000-0000-4000-8000-000000000601'::uuid),
  1,
  'the decision audit event is retained'
);

select is(
  (select count(*)::integer from public.contribution_schedules
   where organization_id = '84000000-0000-4000-8000-000000000001'::uuid
     and association_person_id = (
       select association_person_id from public.payment_obligations
       where id = '84000000-0000-4000-8000-000000000401'::uuid
     )),
  1,
  'the retained schedule survives, so historical obligations keep their anchor'
);

-- The account references were nulled rather than the rows removed.
select is(
  (select claimant_user_id from public.payment_claims
   where id = '84000000-0000-4000-8000-000000000501'::uuid),
  null,
  'the claim no longer points at a deleted account'
);

select is(
  (select user_id from public.payment_obligations
   where id = '84000000-0000-4000-8000-000000000401'::uuid),
  null,
  'the obligation no longer points at a deleted account'
);

-- ---------------------------------------------------------------------------
-- Rule 12, access: after deletion the retained records are admin-only.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '84000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select count(*)::integer from public.membership_application_revisions),
  1,
  'an association admin still reads the retained revision'
);

select is(
  (select count(*)::integer from public.payment_claims),
  1,
  'an association admin still reads the retained claim'
);

select is(
  (select count(*)::integer from public.payment_claim_audit_events),
  1,
  'an association admin still reads the retained audit trail'
);

select is(
  (select count(*)::integer from public.organization_membership_departures),
  1,
  'an association admin still reads the retained membership period'
);

select set_config(
  'request.jwt.claim.sub',
  '84000000-0000-4000-8000-000000000103',
  true
);

select is(
  (select count(*)::integer from public.membership_application_revisions),
  0,
  'a signed-in non-admin reads none of the retained records'
);

select is(
  (select count(*)::integer from public.payment_claims),
  0,
  'a signed-in non-admin reads no retained claim'
);

select is(
  (select count(*)::integer from public.payment_claim_audit_events),
  0,
  'a signed-in non-admin reads no retained audit event'
);

select is(
  (select count(*)::integer from public.organization_membership_departures),
  0,
  'a signed-in non-admin reads no retained membership period'
);

-- The subject carries no personal data of its own: the revision is the
-- retained form, and copying profile PII into association_people would create
-- a second, weaker copy with none of the revision's immutability.
set local role postgres;

select is(
  (select array_agg(column_name::text order by column_name)
   from information_schema.columns
   where table_schema = 'public' and table_name = 'association_people'),
  array['account_user_id', 'anonymized_at', 'created_at', 'id', 'organization_id'],
  'the subject table holds only links and timestamps, never personal data'
);

select * from finish();
rollback;
