begin;

select * from no_plan();

-- Device token ownership.
--
-- `register_push_token` and `unregister_push_token` are the only write path to
-- push_tokens: the billing cutover revoked every direct grant on the table from
-- public, anon and authenticated, so a client that cannot call these commands
-- cannot register a device at all. The Expo app calls both -- one on sign-in,
-- one on sign-out.
--
-- The four assertions that used to cover them lived in
-- contribution_reminders_test.sql, which the cutover deleted along with the
-- reminder outbox. The commands were deliberately kept, so their coverage moves
-- here rather than disappearing with the feature that happened to host it.
--
-- Two behaviours are easy to confuse and are both pinned below. Registering a
-- token you physically hold TRANSFERS ownership -- that is how account
-- switching on a shared handset works, and it is the documented contract.
-- Unregistering is owner-scoped and transfers nothing: it can only remove a row
-- the caller already owns.

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
    ('85000000-0000-4000-8000-000000000101'::uuid, 'device-owner@example.com', 'Device Owner'),
    ('85000000-0000-4000-8000-000000000102'::uuid, 'device-second@example.com', 'Device Second'),
    ('85000000-0000-4000-8000-000000000103'::uuid, 'device-stranger@example.com', 'Device Stranger')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('85000000-0000-4000-8000-000000000101'::uuid, 'Device Owner', '@device_owner'),
    ('85000000-0000-4000-8000-000000000102'::uuid, 'Device Second', '@device_second'),
    ('85000000-0000-4000-8000-000000000103'::uuid, 'Device Stranger', '@device_stranger')
) as persona(id, display_name, handle)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

-- ---------------------------------------------------------------------------
-- The table is closed. The commands are the only door.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000101',
  true
);

select throws_ok(
  $$select count(*) from public.push_tokens$$,
  '42501',
  'permission denied for table push_tokens',
  'clients cannot read device ownership rows directly'
);

select throws_ok(
  $$insert into public.push_tokens (token, profile_id)
    values ('ExponentPushToken[85-direct]',
            '85000000-0000-4000-8000-000000000101'::uuid)$$,
  '42501',
  'permission denied for table push_tokens',
  'clients cannot insert a device row around the command boundary'
);

-- ---------------------------------------------------------------------------
-- Register.
-- ---------------------------------------------------------------------------

select is(
  public.register_push_token(
    'ExponentPushToken[85-owner-device]',
    'pt'::public.language
  ),
  'registered',
  'an authenticated client registers a device through the command boundary'
);

set local role postgres;

select is(
  (select profile_id
   from public.push_tokens
   where token = 'ExponentPushToken[85-owner-device]'),
  '85000000-0000-4000-8000-000000000101'::uuid,
  'the registered token belongs to the calling profile'
);

select is(
  (select language::text
   from public.push_tokens
   where token = 'ExponentPushToken[85-owner-device]'),
  'pt',
  'the requested delivery language is stored with the token'
);

-- ---------------------------------------------------------------------------
-- Re-register: idempotent for the same owner, and it refreshes the language
-- rather than accumulating a second row for the same device.
-- ---------------------------------------------------------------------------

set local role authenticated;

select is(
  public.register_push_token(
    'ExponentPushToken[85-owner-device]',
    'en'::public.language
  ),
  'registered',
  're-registering the same device is not an error'
);

set local role postgres;

select is(
  (select count(*)::integer
   from public.push_tokens
   where token = 'ExponentPushToken[85-owner-device]'),
  1,
  're-registering the same device does not create a second row'
);

select is(
  (select language::text
   from public.push_tokens
   where token = 'ExponentPushToken[85-owner-device]'),
  'en',
  're-registering refreshes the delivery language in place'
);

select is(
  (select count(*)::integer
   from public.push_tokens
   where profile_id = '85000000-0000-4000-8000-000000000101'::uuid),
  1,
  'the owner still holds exactly one device'
);

-- ---------------------------------------------------------------------------
-- A blank or oversized token is refused before it reaches the table.
-- ---------------------------------------------------------------------------

set local role authenticated;

select throws_ok(
  $$select public.register_push_token('   ', 'pt'::public.language)$$,
  '22023',
  'A valid push token is required.',
  'a whitespace-only token is refused'
);

select throws_ok(
  $$select public.register_push_token(repeat('x', 513), 'pt'::public.language)$$,
  '22023',
  'A valid push token is required.',
  'an oversized token is refused'
);

set local role postgres;

select is(
  (select count(*)::integer
   from public.push_tokens
   where token like 'ExponentPushToken[85-%'),
  1,
  'a refused registration writes nothing'
);

-- ---------------------------------------------------------------------------
-- Isolation: a second profile registering its OWN device leaves the first
-- profile's device alone.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000102',
  true
);

select is(
  public.register_push_token(
    'ExponentPushToken[85-second-device]',
    'pt'::public.language
  ),
  'registered',
  'a second profile registers its own device'
);

set local role postgres;

select is(
  (select profile_id
   from public.push_tokens
   where token = 'ExponentPushToken[85-owner-device]'),
  '85000000-0000-4000-8000-000000000101'::uuid,
  'registering another device does not move the first profile''s token'
);

-- ---------------------------------------------------------------------------
-- Unregister is owner-scoped. This is the assertion that matters for
-- isolation: a stranger naming someone else's token removes nothing.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000103',
  true
);

select is(
  public.unregister_push_token('ExponentPushToken[85-owner-device]'),
  false,
  'a stranger cannot unregister a token it does not own'
);

set local role postgres;

select is(
  (select count(*)::integer
   from public.push_tokens
   where token = 'ExponentPushToken[85-owner-device]'),
  1,
  'the owner''s token survives a stranger''s unregister attempt'
);

select is(
  (select count(*)::integer
   from public.push_tokens
   where token like 'ExponentPushToken[85-%'),
  2,
  'no device row was removed by the stranger'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000101',
  true
);

select is(
  public.unregister_push_token('ExponentPushToken[85-owner-device]'),
  true,
  'the owner unregisters its own device on sign-out'
);

select is(
  public.unregister_push_token('ExponentPushToken[85-owner-device]'),
  false,
  'unregistering an already removed device reports no removal'
);

set local role postgres;

select is(
  (select count(*)::integer
   from public.push_tokens
   where token = 'ExponentPushToken[85-owner-device]'),
  0,
  'the unregistered device is gone'
);

select is(
  (select count(*)::integer
   from public.push_tokens
   where token = 'ExponentPushToken[85-second-device]'),
  1,
  'the second profile''s device is untouched by the first''s sign-out'
);

-- ---------------------------------------------------------------------------
-- Account switching on a shared handset. Registering a token the previous
-- owner still holds TRANSFERS it, so the previous account stops receiving that
-- device's notifications. This is the documented contract, and it is the one
-- case where a register call does touch another profile's row.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000103',
  true
);

select is(
  public.register_push_token(
    'ExponentPushToken[85-second-device]',
    'en'::public.language
  ),
  'registered',
  'signing in on a handset registers the device to the new account'
);

set local role postgres;

select is(
  (select profile_id
   from public.push_tokens
   where token = 'ExponentPushToken[85-second-device]'),
  '85000000-0000-4000-8000-000000000103'::uuid,
  'the shared device now has exactly one current owner'
);

select is(
  (select count(*)::integer
   from public.push_tokens
   where token = 'ExponentPushToken[85-second-device]'),
  1,
  'account switching does not duplicate the device row'
);

select is(
  (select count(*)::integer
   from public.push_tokens
   where profile_id = '85000000-0000-4000-8000-000000000102'::uuid),
  0,
  'the previous account no longer receives that device'
);

-- ---------------------------------------------------------------------------
-- Anonymous callers have no path at all.
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.register_push_token('ExponentPushToken[85-anon]', 'pt'::public.language)$$,
  '42501',
  'permission denied for function register_push_token',
  'anonymous callers cannot register a device'
);

select throws_ok(
  $$select public.unregister_push_token('ExponentPushToken[85-second-device]')$$,
  '42501',
  'permission denied for function unregister_push_token',
  'anonymous callers cannot unregister a device'
);

-- ---------------------------------------------------------------------------
-- Deleting the profile takes its devices with it: a retained association
-- record must never keep a live delivery target for a deleted account.
-- ---------------------------------------------------------------------------

set local role postgres;

delete from public.profiles
where id = '85000000-0000-4000-8000-000000000103'::uuid;

select is(
  (select count(*)::integer
   from public.push_tokens
   where token = 'ExponentPushToken[85-second-device]'),
  0,
  'deleting the profile removes the devices it owned'
);

select * from finish();
rollback;
