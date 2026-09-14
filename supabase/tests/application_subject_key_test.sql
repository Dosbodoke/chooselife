begin;

select * from no_plan();

-- The durable subject key is server-derived, never client-supplied.
--
-- membership_applications.association_person_id is the only thing that ties a
-- draft to a formal association identity: it is NOT NULL, it backs the partial
-- unique index that enforces one open application per person, and it is the
-- join key for every person-keyed read and for the records the association
-- retains after an account is deleted.
--
-- membership_applications is also the ONE subject-keyed table that
-- `authenticated` may INSERT into, and its RLS policy constrains only user_id
-- and status. So if a client could name the subject key, any authenticated user
-- could bind their own draft to somebody else's association identity --
-- occupying that person's single open-application slot and hanging immutable
-- revisions off their subject. PostgREST is exposed directly, so omitting the
-- column from the Expo draft type is not a defense.
--
-- The fix is that set_association_person_from_subject() overwrites the column
-- unconditionally. It cannot be done in the policy: WITH CHECK is evaluated
-- AFTER the BEFORE INSERT trigger on this Postgres image, so a predicate like
-- `association_person_id is null` would reject every legitimate insert instead
-- of only the malicious ones. What this file pins down is the resulting
-- behavior from the client's side of the boundary.

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
  '86000000-0000-4000-8000-000000000001'::uuid,
  'Subject Key Association',
  'subject-key-association',
  'association',
  'BRL',
  'America/Sao_Paulo',
  10,
  7,
  'estatuto-subject-key-v1',
  9900,
  99000,
  '000201subjectkey-monthly',
  '000201subjectkey-annual'
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
    ('86000000-0000-4000-8000-000000000101'::uuid, 'subject-attacker@example.com', 'Subject Attacker'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'subject-victim@example.com', 'Subject Victim'),
    ('86000000-0000-4000-8000-000000000103'::uuid, 'subject-newcomer@example.com', 'Subject Newcomer')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('86000000-0000-4000-8000-000000000101'::uuid, 'Subject Attacker', '@subject_attacker'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'Subject Victim', '@subject_victim'),
    ('86000000-0000-4000-8000-000000000103'::uuid, 'Subject Newcomer', '@subject_newcomer')
) as persona(id, display_name, handle)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

-- The victim already has a formal subject in this association, as anyone who
-- has ever applied does. Its id is the value the attacker would guess or read.
insert into public.association_people (id, organization_id, account_user_id)
values (
  '86000000-0000-4000-8000-0000000009b0'::uuid,
  '86000000-0000-4000-8000-000000000001'::uuid,
  '86000000-0000-4000-8000-000000000102'::uuid
);

-- ---------------------------------------------------------------------------
-- The client write surface: membership_applications and nothing else.
--
-- This is the premise of everything below. If a future migration grants
-- `authenticated` INSERT on any other subject-keyed table, that table needs the
-- same scrutiny and this assertion is where it surfaces.
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'association_people',
       'contribution_schedules',
       'membership_application_revisions',
       'membership_applications',
       'organization_membership_departures',
       'payment_claim_audit_events',
       'payment_claims',
       'payment_obligations'
     )
     and has_table_privilege('authenticated', c.oid, 'INSERT')),
  array['membership_applications'],
  'membership_applications is the only subject-keyed table a client may insert into'
);

-- ---------------------------------------------------------------------------
-- The attack: a signed-in user names somebody else's subject key.
--
-- The attacker holds no application yet, so nothing but the subject-key
-- derivation can decide the outcome -- the partial unique index is not in play
-- and cannot mask the result.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000101',
  true
);

select lives_ok(
  $$insert into public.membership_applications (
      id, organization_id, user_id, association_person_id, status, accepted_terms_at
    )
    values (
      '86000000-0000-4000-8000-000000000201'::uuid,
      '86000000-0000-4000-8000-000000000001'::uuid,
      '86000000-0000-4000-8000-000000000101'::uuid,
      '86000000-0000-4000-8000-0000000009b0'::uuid,
      'draft',
      timezone('utc'::text, now())
    )$$,
  'the insert naming a foreign subject key is accepted by the policy, as it was before'
);

-- The security property, stated as the plan states it: after the statement, no
-- row anywhere carries the victim's subject id.
set local role postgres;

select is(
  (select count(*)::integer
   from public.membership_applications ma
   where ma.association_person_id = '86000000-0000-4000-8000-0000000009b0'::uuid),
  0,
  'no application is bound to the victim subject the attacker named'
);

select is(
  (select ap.account_user_id
   from public.membership_applications ma
   join public.association_people ap on ap.id = ma.association_person_id
   where ma.id = '86000000-0000-4000-8000-000000000201'::uuid),
  '86000000-0000-4000-8000-000000000101'::uuid,
  'the attacker draft was rewritten onto the attacker own subject'
);

select isnt(
  (select ma.association_person_id
   from public.membership_applications ma
   where ma.id = '86000000-0000-4000-8000-000000000201'::uuid),
  '86000000-0000-4000-8000-0000000009b0'::uuid,
  'the client supplied subject key was discarded rather than trusted'
);

-- The victim keeps an empty open-application slot, which is the concrete harm
-- the gap caused: the attacker could otherwise have denied them an application.
select is(
  (select count(*)::integer
   from public.membership_applications ma
   where ma.organization_id = '86000000-0000-4000-8000-000000000001'::uuid
     and ma.association_person_id = '86000000-0000-4000-8000-0000000009b0'::uuid
     and ma.status in (
       'draft'::public.membership_application_status_enum,
       'submitted'::public.membership_application_status_enum
     )),
  0,
  'the victim open-application slot is still free'
);

-- A subject id that belongs to nobody is discarded too, so the derivation is
-- not merely preferring an existing row over a foreign one.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000103',
  true
);

select lives_ok(
  $$insert into public.membership_applications (
      id, organization_id, user_id, association_person_id, status, accepted_terms_at
    )
    values (
      '86000000-0000-4000-8000-000000000203'::uuid,
      '86000000-0000-4000-8000-000000000001'::uuid,
      '86000000-0000-4000-8000-000000000103'::uuid,
      '86000000-0000-4000-8000-00000000dead'::uuid,
      'draft',
      timezone('utc'::text, now())
    )$$,
  'a subject key referencing no existing row does not even reach the foreign key'
);

set local role postgres;

select is(
  (select ap.account_user_id
   from public.membership_applications ma
   join public.association_people ap on ap.id = ma.association_person_id
   where ma.id = '86000000-0000-4000-8000-000000000203'::uuid),
  '86000000-0000-4000-8000-000000000103'::uuid,
  'the invented subject key was replaced by the inserting user own subject'
);

-- ---------------------------------------------------------------------------
-- Regression guard: the ordinary path still works.
--
-- This is the assertion that fails loudly if the remedy is ever changed to a
-- policy predicate on association_person_id. WITH CHECK runs after the
-- trigger, so `is null` there would reject exactly this insert.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000102',
  true
);

select lives_ok(
  $$insert into public.membership_applications (
      id, organization_id, user_id, status, accepted_terms_at
    )
    values (
      '86000000-0000-4000-8000-000000000202'::uuid,
      '86000000-0000-4000-8000-000000000001'::uuid,
      '86000000-0000-4000-8000-000000000102'::uuid,
      'draft',
      timezone('utc'::text, now())
    )$$,
  'a client that omits the subject key inserts its draft normally'
);

set local role postgres;

select is(
  (select ma.association_person_id
   from public.membership_applications ma
   where ma.id = '86000000-0000-4000-8000-000000000202'::uuid),
  '86000000-0000-4000-8000-0000000009b0'::uuid,
  'the trigger reuses the existing subject row rather than minting a second one'
);

select is(
  (select count(*)::integer
   from public.association_people ap
   where ap.organization_id = '86000000-0000-4000-8000-000000000001'::uuid
     and ap.account_user_id = '86000000-0000-4000-8000-000000000102'::uuid),
  1,
  'the victim still has exactly one subject row in this association'
);

-- Three distinct people, three distinct subjects, one application each.
select is(
  (select count(distinct ma.association_person_id)::integer
   from public.membership_applications ma
   where ma.organization_id = '86000000-0000-4000-8000-000000000001'::uuid),
  3,
  'each of the three applications carries its own inserting user subject'
);

-- ---------------------------------------------------------------------------
-- The partial unique index still enforces one open application per person,
-- and it is not confused by a client-supplied subject key.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000101',
  true
);

select throws_ok(
  $$insert into public.membership_applications (
      organization_id, user_id, status, accepted_terms_at
    )
    values (
      '86000000-0000-4000-8000-000000000001'::uuid,
      '86000000-0000-4000-8000-000000000101'::uuid,
      'draft',
      timezone('utc'::text, now())
    )$$,
  '23505',
  'duplicate key value violates unique constraint "membership_applications_one_open_per_person_idx"',
  'a second open application for the same person is still refused'
);

select throws_ok(
  $$insert into public.membership_applications (
      organization_id, user_id, association_person_id, status, accepted_terms_at
    )
    values (
      '86000000-0000-4000-8000-000000000001'::uuid,
      '86000000-0000-4000-8000-000000000101'::uuid,
      '86000000-0000-4000-8000-0000000009b0'::uuid,
      'draft',
      timezone('utc'::text, now())
    )$$,
  '23505',
  'duplicate key value violates unique constraint "membership_applications_one_open_per_person_idx"',
  'naming a foreign subject key does not buy a second open application either'
);

-- A closed application releases the slot for that person and nobody else.
set local role postgres;

update public.membership_applications
set status = 'refused'::public.membership_application_status_enum
where id = '86000000-0000-4000-8000-000000000201'::uuid;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000101',
  true
);

select lives_ok(
  $$insert into public.membership_applications (
      organization_id, user_id, status, accepted_terms_at
    )
    values (
      '86000000-0000-4000-8000-000000000001'::uuid,
      '86000000-0000-4000-8000-000000000101'::uuid,
      'draft',
      timezone('utc'::text, now())
    )$$,
  'once the previous application is refused the person may apply again'
);

-- The other two people were never affected by any of the above.
set local role postgres;

select is(
  (select count(*)::integer
   from public.membership_applications ma
   where ma.organization_id = '86000000-0000-4000-8000-000000000001'::uuid
     and ma.association_person_id = '86000000-0000-4000-8000-0000000009b0'::uuid
     and ma.status in (
       'draft'::public.membership_application_status_enum,
       'submitted'::public.membership_application_status_enum
     )),
  1,
  'the victim still holds their own single open application, untouched'
);

select is(
  (select count(*)::integer
   from public.membership_applications ma
   join public.association_people ap on ap.id = ma.association_person_id
   where ap.account_user_id = '86000000-0000-4000-8000-000000000103'::uuid),
  1,
  'the newcomer application is unaffected by the attacker retries'
);

select * from finish();
rollback;
