begin;

select * from no_plan();

-- Retired Choose Life models frozen on each physical webbing.
--
-- New app builds read `legacy_model_snapshot` only. Released builds still
-- write `model`, so the trigger captures their writes, keeps the snapshot
-- server-owned and survives the old foreign key nulling `model`.

set local role postgres;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at
)
values (
  '86000000-0000-4000-8000-000000000201', 'authenticated', 'authenticated',
  'legacy-owner@example.com', timezone('utc'::text, now()),
  jsonb_build_object('full_name', 'Legacy Owner'),
  timezone('utc'::text, now()), timezone('utc'::text, now())
);

insert into public.profiles (id, name, username)
values ('86000000-0000-4000-8000-000000000201', 'Legacy Owner', '@legacy_owner')
on conflict (id) do update set name = excluded.name, username = excluded.username;

insert into public.webbing_model
  (name, material, weave, strength_class, recommended_lifetime_days, image_url)
values
  ('Legacy Full', 'polyester', 'tubular', 'B', 540, 'models/full.webp'),
  ('Legacy Sparse', 'nylon', 'flat', null, null, null),
  ('Legacy Retired', 'dyneema', 'flat', 'A', 720, null);

-- ---------------------------------------------------------------------------
-- Column and helper.
-- ---------------------------------------------------------------------------

select has_column('public', 'webbing', 'legacy_model_snapshot', 'webbing has a legacy snapshot');
select col_type_is('public', 'webbing', 'legacy_model_snapshot', 'jsonb', 'legacy snapshot is jsonb');
select has_trigger('public', 'webbing', 'webbing_capture_legacy_model', 'capture trigger exists');

select is(
  public.webbing_legacy_model_snapshot(
    (select id from public.webbing_model where name = 'Legacy Full'), 'backfill'
  ) - 'capturedAt' - 'modelId',
  jsonb_build_object(
    'schemaVersion', 1,
    'source', 'chooselife',
    'name', 'Legacy Full',
    'material', 'polyester',
    'weave', 'tubular',
    'strengthClass', 'B',
    'recommendedLifetimeDays', 540,
    'imagePath', 'models/full.webp',
    'capturedBy', 'backfill'
  ),
  'the helper copies every legacy display field'
);

select is(
  public.webbing_legacy_model_snapshot(
    (select id from public.webbing_model where name = 'Legacy Sparse'), 'backfill'
  ) ?| array['strengthClass', 'recommendedLifetimeDays', 'imagePath'],
  false,
  'missing legacy values are omitted, not stored as null'
);

-- ---------------------------------------------------------------------------
-- Released builds keep inserting model ids.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000201', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-4000-8000-000000000201","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, tag_name, model)
    select '86000000-0000-4000-8000-000000000201', 30, false, false, 'Old build line', id
    from public.webbing_model where name = 'Legacy Full'$$,
  'a 1.9.5-style insert with a model id still works'
);

select is(
  (select legacy_model_snapshot ->> 'capturedBy' || ':' || (legacy_model_snapshot ->> 'name')
   from public.webbing where tag_name = 'Old build line'),
  'legacy-client:Legacy Full',
  'the trigger freezes the model and marks it as a legacy-client write'
);

-- ---------------------------------------------------------------------------
-- The snapshot is server-owned.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.webbing
      (user_id, length, left_loop, right_loop, tag_name, legacy_model_snapshot)
    values ('86000000-0000-4000-8000-000000000201', 10, false, false, 'Forged line',
      '{"schemaVersion":1,"source":"chooselife","modelId":1,"name":"Fake","capturedAt":"x","capturedBy":"backfill"}')$$,
  'a client-supplied snapshot does not fail the insert'
);

select is(
  (select legacy_model_snapshot from public.webbing where tag_name = 'Forged line'),
  null::jsonb,
  'a client-supplied snapshot on insert is discarded'
);

update public.webbing
set legacy_model_snapshot = '{"schemaVersion":1,"source":"chooselife","modelId":1,"name":"Fake","capturedAt":"x","capturedBy":"backfill"}',
    tag_name = 'Old build line renamed'
where tag_name = 'Old build line';

select is(
  (select legacy_model_snapshot ->> 'name' from public.webbing
   where tag_name = 'Old build line renamed'),
  'Legacy Full',
  'a client update cannot overwrite the frozen snapshot'
);

update public.webbing
set model = (select id from public.webbing_model where name = 'Legacy Sparse')
where tag_name = 'Old build line renamed';

select is(
  (select legacy_model_snapshot ->> 'name' from public.webbing
   where tag_name = 'Old build line renamed'),
  'Legacy Sparse',
  'changing model from a released build re-captures the snapshot'
);

-- ---------------------------------------------------------------------------
-- Deleting a retired model no longer erases details.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.webbing (user_id, length, left_loop, right_loop, tag_name, model)
    select '86000000-0000-4000-8000-000000000201', 40, true, true, 'Retired line', id
    from public.webbing_model where name = 'Legacy Retired'$$,
  'gear linked to a model that will be retired'
);

set local role postgres;
delete from public.webbing_model where name = 'Legacy Retired';

select is(
  (select row(model, legacy_model_snapshot ->> 'name')::text
   from public.webbing where tag_name = 'Retired line'),
  row(null::bigint, 'Legacy Retired'::text)::text,
  'ON DELETE SET NULL clears model but keeps the frozen details'
);

-- ---------------------------------------------------------------------------
-- Shape check.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$alter table public.webbing disable trigger webbing_capture_legacy_model;
    update public.webbing set legacy_model_snapshot = '{"source":"chooselife"}'
    where tag_name = 'Retired line'$$,
  '23514',
  null,
  'the CHECK rejects a malformed snapshot'
);

select * from finish();
rollback;
