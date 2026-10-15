begin;

select * from no_plan();

-- ISA account links.
--
-- A row asserts that the profile owner signed in to their ISA account, so the
-- only writer is the `link-isa-account` edge function (service role), which
-- verifies the ISA ID token first. Clients can read the public part of a link
-- to show the badge, and can remove their own link, but can never create or
-- rewrite one, and never see the Cognito subject.

set local role postgres;

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
    ('86000000-0000-4000-8000-000000000101'::uuid, 'isa-owner@example.com', 'ISA Owner'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'isa-stranger@example.com', 'ISA Stranger')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('86000000-0000-4000-8000-000000000101'::uuid, 'ISA Owner', '@isa_owner'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'ISA Stranger', '@isa_stranger')
) as persona(id, display_name, handle)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.profile_isa_accounts (profile_id, isa_id, cognito_sub, isa_name)
values (
  '86000000-0000-4000-8000-000000000101',
  'ISA_1A2B3C4D',
  '86000000-0000-4000-8000-0000000000aa',
  'Isa Owner'
);

-- ---------------------------------------------------------------------------
-- Integrity.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.profile_isa_accounts (profile_id, isa_id, cognito_sub)
    values ('86000000-0000-4000-8000-000000000102', 'ISA_1A2B3C4D',
            '86000000-0000-4000-8000-0000000000bb')$$,
  '23505',
  null,
  'one ISA account cannot be linked to two profiles'
);

select throws_ok(
  $$insert into public.profile_isa_accounts (profile_id, isa_id, cognito_sub)
    values ('86000000-0000-4000-8000-000000000102', 'not-an-isa-id',
            '86000000-0000-4000-8000-0000000000bb')$$,
  '23514',
  null,
  'the ISA ID must look like an ISA member ID'
);

-- ---------------------------------------------------------------------------
-- Reading: public badge, private subject.
-- ---------------------------------------------------------------------------

set local role anon;

select is(
  (select isa_id
   from public.profile_isa_accounts
   where profile_id = '86000000-0000-4000-8000-000000000101'),
  'ISA_1A2B3C4D',
  'anyone can read the ISA ID shown on a public profile'
);

select throws_ok(
  $$select cognito_sub from public.profile_isa_accounts$$,
  '42501',
  null,
  'the Cognito subject is not readable by clients'
);

-- ---------------------------------------------------------------------------
-- Writing: clients cannot forge or rewrite a link.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000102',
  true
);

select throws_ok(
  $$insert into public.profile_isa_accounts (profile_id, isa_id, cognito_sub)
    values ('86000000-0000-4000-8000-000000000102', 'ISA_99999999',
            '86000000-0000-4000-8000-0000000000bb')$$,
  '42501',
  null,
  'clients cannot link an ISA account without the edge function'
);

select throws_ok(
  $$update public.profile_isa_accounts set isa_id = 'ISA_99999999'$$,
  '42501',
  null,
  'clients cannot rewrite a link'
);

-- ---------------------------------------------------------------------------
-- Unlinking is owner-scoped.
-- ---------------------------------------------------------------------------

delete from public.profile_isa_accounts
where profile_id = '86000000-0000-4000-8000-000000000101';

set local role postgres;

select is(
  (select count(*)::integer from public.profile_isa_accounts),
  1,
  'a stranger cannot unlink someone else''s ISA account'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000101',
  true
);

delete from public.profile_isa_accounts
where profile_id = '86000000-0000-4000-8000-000000000101';

set local role postgres;

select is(
  (select count(*)::integer from public.profile_isa_accounts),
  0,
  'the owner can unlink their ISA account'
);

select * from finish();
rollback;
