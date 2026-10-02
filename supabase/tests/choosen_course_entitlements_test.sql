begin;

select * from no_plan();

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
values
  (
    '89000000-0000-4000-8000-000000000101'::uuid,
    'authenticated',
    'authenticated',
    'course-entitlement-owner@example.com',
    timezone('utc'::text, now()),
    '{}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '89000000-0000-4000-8000-000000000102'::uuid,
    'authenticated',
    'authenticated',
    'course-entitlement-stranger@example.com',
    timezone('utc'::text, now()),
    '{}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

insert into public.choosen_course_entitlements (user_id)
values
  ('89000000-0000-4000-8000-000000000101'::uuid),
  ('89000000-0000-4000-8000-000000000102'::uuid);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '89000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select count(*)::integer from public.choosen_course_entitlements),
  1,
  'an authenticated user can read their own course entitlement'
);

select is(
  (select count(*)::integer
   from public.choosen_course_entitlements
   where user_id = '89000000-0000-4000-8000-000000000102'::uuid),
  0,
  'an authenticated user cannot read another user''s course entitlement'
);

select throws_ok(
  $$insert into public.choosen_course_entitlements (user_id)
    values ('89000000-0000-4000-8000-000000000101'::uuid)$$,
  '42501',
  'permission denied for table choosen_course_entitlements',
  'authenticated clients cannot grant course access'
);

select throws_ok(
  $$update public.choosen_course_entitlements
    set created_at = timezone('utc'::text, now())$$,
  '42501',
  'permission denied for table choosen_course_entitlements',
  'authenticated clients cannot update course access'
);

select throws_ok(
  $$delete from public.choosen_course_entitlements
    where user_id = '89000000-0000-4000-8000-000000000101'::uuid$$,
  '42501',
  'permission denied for table choosen_course_entitlements',
  'authenticated clients cannot revoke course access'
);

set local role anon;

select throws_ok(
  $$select count(*) from public.choosen_course_entitlements$$,
  '42501',
  'permission denied for table choosen_course_entitlements',
  'unauthenticated callers cannot read course entitlements'
);

select * from finish();
rollback;
