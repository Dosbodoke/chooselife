begin;

select * from no_plan();

-- Coverage for the objects recovered by
-- 20260730140837_festival_live_companion.sql.
--
-- That migration ran directly against stage on 2026-07-30 and was never
-- committed, so until now it had no test of any kind. It is recovered verbatim,
-- which means these assertions pin what stage ACTUALLY runs -- not what a
-- tidied-up version would run. If a future change edits the recovered file,
-- these tests are the record of the behaviour that stage already depends on.
--
-- Two surfaces are covered:
--
--   1. `push_tokens.platform`. The recovered migration adds a sixth column to a
--      table this repo owns and already tests in `push_tokens_test.sql`. That
--      file needs no change -- nothing in it counts columns and the command
--      boundary never sets `platform` -- so the new column's own contract is
--      pinned here instead.
--
--   2. The owner-scoping of `festival_companion_tokens`. All four of its
--      policies resolve `(select auth.uid()) = profile_id`, so each one gets a
--      matched positive/negative pair: the same statement run under two JWT
--      subjects, asserting the owner is served and the stranger is not.
--
--   3. The singleton `festival_companion_config` the migration seeds.
--
--   4. `enqueue_festival_companion_notifications`, which is BROKEN in the
--      recovered body and is pinned here as broken. See the comment above that
--      assertion -- it is deliberate, and a future fix must invert it.

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
    ('86000000-0000-4000-8000-000000000101'::uuid, 'companion-owner@example.com', 'Companion Owner'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'companion-stranger@example.com', 'Companion Stranger')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('86000000-0000-4000-8000-000000000101'::uuid, 'Companion Owner', '@companion_owner'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'Companion Stranger', '@companion_stranger')
) as persona(id, display_name, handle)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

-- ---------------------------------------------------------------------------
-- 1. push_tokens.platform -- the column the recovered migration adds to a
-- table this repo already owned. Local had five columns; stage had six.
-- ---------------------------------------------------------------------------

select has_column(
  'public',
  'push_tokens',
  'platform',
  'push_tokens carries the platform column the recovered migration adds'
);

select col_type_is(
  'public',
  'push_tokens',
  'platform',
  'text',
  'push_tokens.platform is text'
);

select col_is_null(
  'public',
  'push_tokens',
  'platform',
  'push_tokens.platform is nullable, so the existing command boundary can keep inserting without it'
);

-- The CHECK admits exactly three values, plus NULL. Each arm is asserted
-- rather than sampled: a constraint test that only tries one good value and
-- one bad value cannot tell a three-value list from a one-value list.

select lives_ok(
  $$insert into public.push_tokens (token, profile_id, platform)
    values ('ExponentPushToken[86-ios]',
            '86000000-0000-4000-8000-000000000101'::uuid,
            'ios')$$,
  'the platform check accepts ios'
);

select lives_ok(
  $$insert into public.push_tokens (token, profile_id, platform)
    values ('ExponentPushToken[86-android]',
            '86000000-0000-4000-8000-000000000101'::uuid,
            'android')$$,
  'the platform check accepts android'
);

select lives_ok(
  $$insert into public.push_tokens (token, profile_id, platform)
    values ('ExponentPushToken[86-web]',
            '86000000-0000-4000-8000-000000000101'::uuid,
            'web')$$,
  'the platform check accepts web'
);

select lives_ok(
  $$insert into public.push_tokens (token, profile_id, platform)
    values ('ExponentPushToken[86-null]',
            '86000000-0000-4000-8000-000000000101'::uuid,
            null)$$,
  'the platform check accepts NULL, which is what every pre-existing row holds'
);

select throws_ok(
  $$insert into public.push_tokens (token, profile_id, platform)
    values ('ExponentPushToken[86-bad]',
            '86000000-0000-4000-8000-000000000101'::uuid,
            'windows')$$,
  '23514',
  null,
  'the platform check rejects a value outside ios/android/web'
);

select is(
  (select count(*)::integer
   from public.push_tokens
   where token = 'ExponentPushToken[86-bad]'),
  0,
  'a rejected platform value writes no row'
);

select is(
  (select platform
   from public.push_tokens
   where token = 'ExponentPushToken[86-ios]'),
  'ios',
  'an accepted platform value is stored as given'
);

-- ---------------------------------------------------------------------------
-- 2. festival_companion_tokens owner-scoping.
--
-- Seed one row per persona as postgres (which bypasses RLS), then exercise
-- each policy as `authenticated` under two different JWT subjects.
-- ---------------------------------------------------------------------------

insert into public.festival_companion_tokens (
  profile_id,
  installation_id,
  token_type,
  activity_name,
  token,
  language
)
values
  ('86000000-0000-4000-8000-000000000101'::uuid,
   '86000000-0000-4000-8000-00000000a101'::uuid,
   'push_to_start',
   '',
   'companion-token-owner',
   'pt'::public.language),
  ('86000000-0000-4000-8000-000000000102'::uuid,
   '86000000-0000-4000-8000-00000000a102'::uuid,
   'push_to_start',
   '',
   'companion-token-stranger',
   'en'::public.language);

select is(
  (select count(*)::integer from public.festival_companion_tokens),
  2,
  'both personas hold one companion token each before RLS is exercised'
);

-- SELECT policy ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select count(*)::integer from public.festival_companion_tokens),
  1,
  'the SELECT policy shows an owner exactly its own companion token'
);

-- Aggregated deliberately. A bare `(select token from ...)` would raise
-- "more than one row returned by a subquery" the moment the policy stopped
-- scoping, aborting the transaction and masking every assertion below it. This
-- form pins the exact visible set and always fails cleanly instead.
select is(
  (select string_agg(token, ',' order by token)
   from public.festival_companion_tokens),
  'companion-token-owner',
  'the only row an owner can see is its own'
);

select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000102',
  true
);

select is(
  (select count(*)::integer
   from public.festival_companion_tokens
   where token = 'companion-token-owner'),
  0,
  'the SELECT policy hides another profile''s companion token from a stranger'
);

-- INSERT policy ------------------------------------------------------------

select throws_ok(
  $$insert into public.festival_companion_tokens (
      profile_id, installation_id, token_type, activity_name, token
    )
    values (
      '86000000-0000-4000-8000-000000000101'::uuid,
      '86000000-0000-4000-8000-00000000a201'::uuid,
      'activity_update',
      '',
      'companion-token-forged'
    )$$,
  '42501',
  'new row violates row-level security policy for table "festival_companion_tokens"',
  'the INSERT policy refuses a row registered against another profile'
);

select lives_ok(
  $$insert into public.festival_companion_tokens (
      profile_id, installation_id, token_type, activity_name, token
    )
    values (
      '86000000-0000-4000-8000-000000000102'::uuid,
      '86000000-0000-4000-8000-00000000a202'::uuid,
      'activity_update',
      '',
      'companion-token-own-insert'
    )$$,
  'the INSERT policy admits a row registered against the caller''s own profile'
);

-- UPDATE policy ------------------------------------------------------------

-- A data-modifying CTE cannot sit inside a scalar subquery, so each of these
-- runs the statement and then asserts observed state -- the same act-then-check
-- shape push_tokens_test.sql uses. A policy-filtered write is silently a no-op
-- rather than an error, so the assertion has to read the row back.

select lives_ok(
  $$update public.festival_companion_tokens
    set activity_name = 'hijacked'
    where token = 'companion-token-owner'$$,
  'a stranger''s update of another profile''s row raises nothing -- RLS filters it'
);

select lives_ok(
  $$update public.festival_companion_tokens
    set activity_name = 'mine'
    where token = 'companion-token-stranger'$$,
  'the UPDATE policy admits an owner''s update of its own row'
);

set local role postgres;

select is(
  (select activity_name
   from public.festival_companion_tokens
   where token = 'companion-token-owner'),
  '',
  'the UPDATE policy left the owner''s row untouched by the stranger'
);

select is(
  (select activity_name
   from public.festival_companion_tokens
   where token = 'companion-token-stranger'),
  'mine',
  'the UPDATE policy did apply the owner''s update to its own row'
);

-- DELETE policy ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000102',
  true
);

select lives_ok(
  $$delete from public.festival_companion_tokens
    where token = 'companion-token-owner'$$,
  'a stranger''s delete of another profile''s row raises nothing -- RLS filters it'
);

select lives_ok(
  $$delete from public.festival_companion_tokens
    where token = 'companion-token-stranger'$$,
  'the DELETE policy admits an owner''s delete of its own row'
);

set local role postgres;

select is(
  (select count(*)::integer
   from public.festival_companion_tokens
   where token = 'companion-token-owner'),
  1,
  'the owner''s companion token survives the stranger''s delete attempt'
);

select is(
  (select count(*)::integer
   from public.festival_companion_tokens
   where token = 'companion-token-stranger'),
  0,
  'the DELETE policy did remove the owner''s own row'
);

-- Cascade: a deleted profile must not leave a live delivery target behind,
-- matching the contract push_tokens_test.sql pins for the older table.

-- Wrapped in lives_ok rather than run bare: if the FK ever stopped cascading,
-- a bare delete would raise and abort the whole file, masking every assertion
-- after it instead of reporting this one.
select lives_ok(
  $$delete from public.profiles
    where id = '86000000-0000-4000-8000-000000000101'::uuid$$,
  'a profile holding companion tokens can be deleted -- the FK cascades rather than blocking'
);

select is(
  (select count(*)::integer
   from public.festival_companion_tokens
   where profile_id = '86000000-0000-4000-8000-000000000101'::uuid),
  0,
  'deleting a profile removes the companion tokens it owned'
);

-- ---------------------------------------------------------------------------
-- 3. festival_companion_config -- the singleton the recovered migration seeds.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.festival_companion_config),
  1,
  'the recovered migration seeds exactly one companion config row'
);

select throws_ok(
  $$insert into public.festival_companion_config (singleton) values (true)$$,
  '23505',
  null,
  'the singleton primary key refuses a second config row'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '86000000-0000-4000-8000-000000000102',
  true
);

select is(
  (select count(*)::integer from public.festival_companion_config),
  1,
  'the config read policy exposes the singleton to any authenticated caller'
);

-- ---------------------------------------------------------------------------
-- 4. enqueue_festival_companion_notifications is BROKEN, and this pins it.
--
-- Read this before "fixing" the assertion below.
--
-- The recovered function's `schedule` CTE selects `highline.name AS
-- highline_name` and never selects `highline.id`. `candidate_events` carries
-- that CTE forward with `schedule.*`. The final INSERT then reads
-- `event.highline_id` to build a URL. That name is not in scope, so the
-- statement fails during planning with 42703 -- unconditionally, even with zero
-- bookings, because planning happens before any row is examined.
--
-- The recovered file's last statement schedules this function to run every
-- minute. It has therefore been failing on every tick on stage since
-- 2026-07-30, and it fails the same way here. `cron.job_run_details` records
-- `festival-companion-notifications-every-minute` as `failed` with this exact
-- message while the pre-existing `festival-schedule-*` jobs succeed in the same
-- worker.
--
-- This assertion pins MEASURED state, not desired state. It exists so that the
-- defect is covered and intentional rather than merely known, and so that any
-- future repair is forced to acknowledge what it is switching on: the fix would
-- turn a never-once-successful, once-per-minute writer into
-- `public.notifications` live for real users for the first time. That is a
-- behaviour change and a product decision, not a lint cleanup.
--
-- A follow-up that repairs the function MUST invert or delete this assertion.
-- If it goes green on its own, something changed the recovered file.
-- ---------------------------------------------------------------------------

set local role postgres;

select throws_ok(
  $$select public.enqueue_festival_companion_notifications()$$,
  '42703',
  'column event.highline_id does not exist',
  'the recovered notification enqueuer fails unconditionally, exactly as it does on stage'
);

select * from finish();
rollback;
