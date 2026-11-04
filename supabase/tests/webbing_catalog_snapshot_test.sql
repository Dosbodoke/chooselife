begin;

select * from no_plan();

-- Saved SlackData selections on physical webbing.
--
-- A physical webbing either references a legacy Choose Life model, carries a
-- saved SlackData snapshot, or neither (manual gear). The snapshot is
-- per-item: two owners -- or one owner with two lines -- may save the same
-- upstream model. `registration_key` makes one registration draft recoverable
-- after a lost response without becoming a catalog identity.

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
    ('86000000-0000-4000-8000-000000000101'::uuid, 'webbing-owner@example.com', 'Webbing Owner'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'webbing-second@example.com', 'Webbing Second')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('86000000-0000-4000-8000-000000000101'::uuid, 'Webbing Owner', '@webbing_owner'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'Webbing Second', '@webbing_second')
) as persona(id, display_name, handle)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.webbing_model (name, material, weave, strength_class)
values ('Snapshot Test Legacy Model', 'polyester', 'flat', 'A');

create temporary table snapshot_fixture on commit drop as
select jsonb_build_object(
  'schemaVersion', 1,
  'source', 'slackdata',
  'gearType', 'webbing',
  'sourceId', 1,
  'sourceUrl', 'https://slackdata.org/api/webbing/1',
  'retrievedAt', '2026-10-14T12:00:00.000Z',
  'attribution', 'Gear data from SlackData by the International Slackline Association, CC BY-SA 4.0',
  'licenseUrl', 'https://creativecommons.org/licenses/by-sa/4.0/',
  'normalizationVersion', 1,
  'name', 'Core 2 HS',
  'brandName', 'Landcruising',
  'materials', jsonb_build_array('Polyester'),
  'breakingStrengthKn', 44
) as snapshot;
grant select on snapshot_fixture to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Additive columns.
-- ---------------------------------------------------------------------------

select has_column('public', 'webbing', 'catalog_snapshot', 'webbing has a catalog snapshot');
select col_type_is('public', 'webbing', 'catalog_snapshot', 'jsonb', 'snapshot is jsonb');
select col_is_null('public', 'webbing', 'catalog_snapshot', 'snapshot is nullable');
select has_column('public', 'webbing', 'registration_key', 'webbing has a registration key');
select col_type_is('public', 'webbing', 'registration_key', 'uuid', 'registration key is a uuid');
select col_is_null('public', 'webbing', 'registration_key', 'registration key is nullable');

-- ---------------------------------------------------------------------------
-- The owner can register manual, legacy and catalog gear.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-4000-8000-000000000101","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, tag_name)
    values ('86000000-0000-4000-8000-000000000101', 50, true, false, 'Manual line')$$,
  'an old-style manual insert still works'
);

select is(
  (select row(catalog_snapshot, registration_key)::text
   from public.webbing where tag_name = 'Manual line'),
  row(null::jsonb, null::uuid)::text,
  'old-style inserts default snapshot and registration key to null'
);

select lives_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, tag_name, model)
    select '86000000-0000-4000-8000-000000000101', 30, false, false, 'Legacy line', id
    from public.webbing_model where name = 'Snapshot Test Legacy Model'$$,
  'legacy model gear keeps its local model reference'
);

select lives_ok(
  $$insert into public.webbing
      (user_id, length, left_loop, right_loop, tag_name, catalog_snapshot, registration_key)
    select '86000000-0000-4000-8000-000000000101', 100.5, true, true, 'Catalog line A',
      snapshot, '86000000-0000-4000-8000-00000000a001'
    from snapshot_fixture$$,
  'the owner saves a catalog selection with model null'
);

select lives_ok(
  $$insert into public.webbing
      (user_id, length, left_loop, right_loop, tag_name, catalog_snapshot, registration_key)
    select '86000000-0000-4000-8000-000000000101', 20, false, false, 'Catalog line B',
      snapshot, '86000000-0000-4000-8000-00000000a002'
    from snapshot_fixture$$,
  'the same upstream model can back a second physical item'
);

select is(
  (select count(distinct id)::integer from public.webbing
   where catalog_snapshot ->> 'sourceId' = '1'
     and user_id = '86000000-0000-4000-8000-000000000101'),
  2,
  'two physical items share one source id with distinct ids'
);

select is(
  (select catalog_snapshot ->> 'name' from public.webbing where tag_name = 'Catalog line A'),
  'Core 2 HS',
  'the saved snapshot reads back its source name'
);

select is(
  (select model from public.webbing where tag_name = 'Catalog line A'),
  null::bigint,
  'catalog selections keep the legacy model null'
);

select throws_ok(
  $$insert into public.webbing
      (user_id, length, left_loop, right_loop, tag_name, registration_key)
    values ('86000000-0000-4000-8000-000000000101', 20, false, false, 'Retry',
      '86000000-0000-4000-8000-00000000a001')$$,
  '23505',
  null,
  'one owner cannot reuse a registration key'
);

-- ---------------------------------------------------------------------------
-- Snapshot shape is enforced, including missing keys.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot, model)
    select '86000000-0000-4000-8000-000000000101', 10, false, false, snapshot, id
    from snapshot_fixture, public.webbing_model
    where webbing_model.name = 'Snapshot Test Legacy Model'$$,
  '23514',
  null,
  'a snapshot cannot coexist with a legacy model'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    select '86000000-0000-4000-8000-000000000101', 10, false, false, snapshot - 'sourceId'
    from snapshot_fixture$$,
  '23514',
  null,
  'a missing source id is rejected'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    select '86000000-0000-4000-8000-000000000101', 10, false, false, snapshot - 'name'
    from snapshot_fixture$$,
  '23514',
  null,
  'a missing name is rejected'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    select '86000000-0000-4000-8000-000000000101', 10, false, false,
      jsonb_set(snapshot, '{name}', '"   "')
    from snapshot_fixture$$,
  '23514',
  null,
  'a blank name is rejected'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    select '86000000-0000-4000-8000-000000000101', 10, false, false,
      jsonb_set(snapshot, '{sourceId}', '"1"')
    from snapshot_fixture$$,
  '23514',
  null,
  'a string source id is rejected'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    select '86000000-0000-4000-8000-000000000101', 10, false, false,
      jsonb_set(snapshot, '{sourceId}', '0')
    from snapshot_fixture$$,
  '23514',
  null,
  'a zero source id is rejected'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    select '86000000-0000-4000-8000-000000000101', 10, false, false,
      jsonb_set(snapshot, '{schemaVersion}', '2')
    from snapshot_fixture$$,
  '23514',
  null,
  'an unknown schema version is rejected'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    select '86000000-0000-4000-8000-000000000101', 10, false, false,
      jsonb_set(snapshot, '{source}', '"elsewhere"')
    from snapshot_fixture$$,
  '23514',
  null,
  'another source is rejected'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    values ('86000000-0000-4000-8000-000000000101', 10, false, false, '"Core 2 HS"'::jsonb)$$,
  '23514',
  null,
  'a scalar snapshot is rejected'
);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, catalog_snapshot)
    select '86000000-0000-4000-8000-000000000101', 10, false, false,
      jsonb_set(snapshot, '{description}', to_jsonb(repeat('x', 70000)))
    from snapshot_fixture$$,
  '23514',
  null,
  'an oversized snapshot is rejected'
);

-- ---------------------------------------------------------------------------
-- Inserts belong to the caller.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, tag_name)
    values ('86000000-0000-4000-8000-000000000102', 10, false, false, 'Not mine')$$,
  '42501',
  null,
  'an authenticated user cannot insert another owner''s webbing'
);

set local role postgres;
select is(
  (select count(*)::integer
   from pg_policies
   where schemaname = 'public'
     and tablename = 'webbing'
     and cmd in ('INSERT', 'ALL')
     and permissive = 'PERMISSIVE'),
  1,
  'only the owner-checked INSERT policy admits webbing writes'
);

-- A different owner may reuse the same draft key value.
set local role authenticated;
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000102', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-4000-8000-000000000102","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.webbing
      (user_id, length, left_loop, right_loop, tag_name, catalog_snapshot, registration_key)
    select '86000000-0000-4000-8000-000000000102', 40, false, true, 'Second owner line',
      snapshot, '86000000-0000-4000-8000-00000000a001'
    from snapshot_fixture$$,
  'registration keys are scoped per owner'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, tag_name)
    values ('86000000-0000-4000-8000-000000000101', 10, false, false, 'Anon')$$,
  '42501',
  null,
  'anonymous callers cannot insert webbing'
);

select * from finish();
rollback;
